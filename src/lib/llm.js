import { GoogleGenAI } from '@google/genai';

// ── 1. Robust Multi-Key Pool Support for Gemini & OpenRouter ──
function parseKeyPool(...envNames) {
  const keys = [];
  for (const name of envNames) {
    const val = process.env[name];
    if (val && typeof val === 'string') {
      const parts = val.split(',').map((k) => k.trim()).filter(Boolean);
      keys.push(...parts);
    }
  }
  return Array.from(new Set(keys));
}

const geminiKeys = parseKeyPool('GEMINI_API_KEYS', 'GEMINI_API_KEY', 'GOOGLE_API_KEY');
const openrouterKeys = parseKeyPool('OPENROUTER_API_KEYS', 'OPENROUTER_API_KEY');
const configuredModel = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free';

// Expanded high-performance free models pool on OpenRouter
const OPENROUTER_MODELS = Array.from(
  new Set([
    configuredModel,
    'meta-llama/llama-3.3-70b-instruct:free',
    'nvidia/nemotron-3.5-lightning:free',
    'mistralai/mistral-small-24b-instruct-2501:free',
    'qwen/qwen-2.5-coder-32b-instruct:free',
    'google/gemma-2-9b-it:free',
    'meta-llama/llama-3.1-8b-instruct:free',
    'liquid/lfm-2.5-2.6b:free',
    'google/gemma-4-26b-a4b-it:free',
  ])
);

// Key pointer index for rotating round-robin across key pools
let geminiKeyIndex = 0;
let openrouterKeyIndex = 0;

function getActiveGeminiClient() {
  if (geminiKeys.length === 0) return null;
  const key = geminiKeys[geminiKeyIndex % geminiKeys.length];
  return new GoogleGenAI({ apiKey: key });
}

function rotateGeminiKey() {
  if (geminiKeys.length > 1) {
    geminiKeyIndex = (geminiKeyIndex + 1) % geminiKeys.length;
    console.log(`[LLM Scaling] Rotated to Gemini API key index #${geminiKeyIndex}`);
  }
}

function getActiveOpenRouterKey() {
  if (openrouterKeys.length === 0) return '';
  return openrouterKeys[openrouterKeyIndex % openrouterKeys.length];
}

function rotateOpenRouterKey() {
  if (openrouterKeys.length > 1) {
    openrouterKeyIndex = (openrouterKeyIndex + 1) % openrouterKeys.length;
    console.log(`[LLM Scaling] Rotated to OpenRouter API key index #${openrouterKeyIndex}`);
  }
}

// ── 2. In-Memory LRU Cache with TTL for High-Concurrency Deduplication ──
const llmResponseCache = new Map();
const CACHE_MAX_ENTRIES = 500;
const CACHE_TTL_MS = 1000 * 60 * 45; // 45 minutes

function getCacheKey(prompt, systemPrompt = '', json = false) {
  return `${json ? 'JSON:' : 'TEXT:'}${systemPrompt.slice(0, 100)}::${prompt.trim()}`;
}

function getCachedResult(key) {
  const item = llmResponseCache.get(key);
  if (!item) return null;
  if (Date.now() - item.timestamp > CACHE_TTL_MS) {
    llmResponseCache.delete(key);
    return null;
  }
  return item.value;
}

function setCachedResult(key, value) {
  if (llmResponseCache.size >= CACHE_MAX_ENTRIES) {
    const oldestKey = llmResponseCache.keys().next().value;
    if (oldestKey) llmResponseCache.delete(oldestKey);
  }
  llmResponseCache.set(key, { value, timestamp: Date.now() });
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check which AI providers are available
 */
export function getAvailableProviders() {
  return {
    gemini: geminiKeys.length > 0,
    openrouter: openrouterKeys.length > 0,
    geminiKeyCount: geminiKeys.length,
    openrouterKeyCount: openrouterKeys.length,
    openrouterModelsCount: OPENROUTER_MODELS.length,
  };
}

/**
 * Extract clean JSON array or object from LLM response text
 */
export function extractJson(text) {
  if (!text || typeof text !== 'string') return null;
  
  let cleaned = text.trim();
  // Remove markdown code fences if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      try {
        return JSON.parse(cleaned.slice(firstBracket, lastBracket + 1));
      } catch {}
    }

    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
      } catch {}
    }

    return null;
  }
}

/**
 * Call OpenRouter API with multi-key rotation, model failover pool, and jittered exponential retry
 */
async function callOpenRouter({ prompt, systemPrompt = '', json = false }) {
  if (openrouterKeys.length === 0) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }

  const messages = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  let lastError = null;

  for (let keyAttempt = 0; keyAttempt < Math.max(openrouterKeys.length, 1); keyAttempt++) {
    const activeKey = getActiveOpenRouterKey();

    for (const model of OPENROUTER_MODELS) {
      for (let retry = 0; retry < 2; retry++) {
        try {
          const body = {
            model,
            messages,
            temperature: 0.7,
          };

          if (json) {
            body.response_format = { type: 'json_object' };
          }

          const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${activeKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://studycord.me',
              'X-Title': 'StudyCord',
            },
            body: JSON.stringify(body),
          });

          if (res.status === 429) {
            rotateOpenRouterKey();
            const jitter = Math.floor(Math.random() * 400) + 400;
            await sleep(jitter);
            continue; // retry next
          }

          if (!res.ok) {
            const errorText = await res.text().catch(() => '');
            throw new Error(`OpenRouter (${model}) returned HTTP ${res.status}: ${errorText}`);
          }

          const data = await res.json();
          const outputText = data.choices?.[0]?.message?.content || '';
          if (outputText) {
            return outputText;
          }
        } catch (err) {
          lastError = err;
          console.warn(`[OpenRouter Scale] Model ${model} failed, testing next model in pool...`, err.message);
          break; // proceed to next model in pool
        }
      }
    }
  }

  throw lastError || new Error('All OpenRouter models and keys failed');
}

/**
 * Call OpenRouter API with Server-Sent Events (SSE Streaming) and model failover
 */
async function* streamOpenRouter({ prompt, systemPrompt = '' }) {
  if (openrouterKeys.length === 0) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }

  const messages = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  let streamSucceeded = false;
  let lastError = null;

  for (let keyAttempt = 0; keyAttempt < Math.max(openrouterKeys.length, 1); keyAttempt++) {
    const activeKey = getActiveOpenRouterKey();

    for (const model of OPENROUTER_MODELS) {
      try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${activeKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://studycord.me',
            'X-Title': 'StudyCord',
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.7,
            stream: true,
          }),
        });

        if (res.status === 429) {
          rotateOpenRouterKey();
          await sleep(500);
          continue;
        }

        if (!res.ok) {
          const errorText = await res.text().catch(() => '');
          throw new Error(`OpenRouter stream (${model}) failed HTTP ${res.status}: ${errorText}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === 'data: [DONE]') continue;
            if (trimmed.startsWith('data: ')) {
              try {
                const json = JSON.parse(trimmed.slice(6));
                const content = json.choices?.[0]?.delta?.content;
                if (content) {
                  streamSucceeded = true;
                  yield content;
                }
              } catch {}
            }
          }
        }

        if (streamSucceeded) {
          return;
        }
      } catch (err) {
        lastError = err;
        console.warn(`[OpenRouter Stream Scale] Model ${model} error, switching to next fallback...`, err.message);
      }
    }
  }

  throw lastError || new Error('All OpenRouter streaming models failed');
}

/**
 * Generate content with automatic Gemini multi-key rotation and OpenRouter multi-model failover
 * Optimized for thousands of concurrent students with response deduplication
 */
export async function generateContentWithFallback({ prompt, systemPrompt = '', json = false }) {
  // Check in-memory deduplication cache first
  const cacheKey = getCacheKey(prompt, systemPrompt, json);
  const cached = getCachedResult(cacheKey);
  if (cached) {
    return { text: cached, provider: 'cache' };
  }

  // 1. Try Primary: Google Gemini (with key rotation on 429)
  for (let attempt = 0; attempt < Math.max(geminiKeys.length, 1); attempt++) {
    const aiClient = getActiveGeminiClient();
    if (!aiClient) break;

    try {
      const contents = [];
      if (systemPrompt) {
        contents.push({ role: 'user', parts: [{ text: `${systemPrompt}\n\n${prompt}` }] });
      } else {
        contents.push({ role: 'user', parts: [{ text: prompt }] });
      }

      const config = json ? { responseMimeType: 'application/json' } : undefined;

      const res = await aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config,
      });

      const text = res.text || '';
      if (text.trim()) {
        setCachedResult(cacheKey, text);
        return { text, provider: 'gemini' };
      }
    } catch (geminiError) {
      console.warn('[LLM Scale] Gemini notice:', geminiError.message);
      rotateGeminiKey();
      if (geminiError.message?.includes('429') || geminiError.message?.includes('quota')) {
        await sleep(400);
      }
    }
  }

  // 2. Try Fallback: OpenRouter with multi-model failover pool
  if (openrouterKeys.length > 0) {
    try {
      console.log(`[LLM Scale] Engaging OpenRouter high-availability pool...`);
      const text = await callOpenRouter({ prompt, systemPrompt, json });
      if (text) {
        setCachedResult(cacheKey, text);
        return { text, provider: 'openrouter' };
      }
    } catch (openrouterError) {
      console.error('[LLM Scale] OpenRouter pool notice:', openrouterError.message);
    }
  }

  if (geminiKeys.length === 0 && openrouterKeys.length === 0) {
    throw new Error('No AI provider configured. Set GEMINI_API_KEY or OPENROUTER_API_KEY in .env.local');
  }

  throw new Error('All configured AI providers and backup models are temporarily unavailable');
}

/**
 * Generate streaming content with multi-key Gemini streaming and OpenRouter streaming pool
 */
export async function* generateStreamWithFallback({ prompt, systemPrompt = '' }) {
  // 1. Try Primary: Google Gemini Streaming
  let geminiFailed = false;
  for (let attempt = 0; attempt < Math.max(geminiKeys.length, 1); attempt++) {
    const aiClient = getActiveGeminiClient();
    if (!aiClient) break;

    try {
      const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
      const responseStream = await aiClient.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
      });

      let hadChunks = false;
      for await (const chunk of responseStream) {
        if (chunk.text) {
          hadChunks = true;
          yield chunk.text;
        }
      }
      if (hadChunks) return;
    } catch (geminiError) {
      console.warn('[LLM Stream Scale] Gemini stream notice:', geminiError.message);
      rotateGeminiKey();
      geminiFailed = true;
    }
  }

  // 2. Try Fallback: OpenRouter Streaming
  if (openrouterKeys.length > 0) {
    try {
      console.log(`[LLM Stream Scale] Streaming via resilient OpenRouter pool...`);
      for await (const chunk of streamOpenRouter({ prompt, systemPrompt })) {
        yield chunk;
      }
      return;
    } catch (openrouterError) {
      console.error('[LLM Stream Scale] OpenRouter streaming notice:', openrouterError.message);
    }
  }

  if (geminiKeys.length === 0 && openrouterKeys.length === 0) {
    yield 'Hello! Please configure GEMINI_API_KEY or OPENROUTER_API_KEY in .env.local to enable real-time AI study assistance.';
    return;
  }

  if (geminiFailed) {
    yield 'All available AI providers are currently processing high traffic. Please try your question again in a moment.';
  }
}
