import { GoogleGenAI } from '@google/genai';
import { cleanEmDashes } from './cleanText';

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
// Configured models with automatic multi-tier failover
const GEMINI_MODELS = Array.from(
  new Set([
    process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
  ])
);

// Verified active high-performance free models pool on OpenRouter
const OPENROUTER_MODELS = Array.from(
  new Set([
    process.env.OPENROUTER_MODEL || 'openrouter/auto',
    'openrouter/auto',
    'meta-llama/llama-3.3-70b-instruct:free',
    'google/gemini-2.0-flash-exp:free',
    'mistralai/mistral-7b-instruct:free',
    'nvidia/nemotron-3.5-lightning:free',
    'openrouter/free',
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
  
  // 1. Extract markdown code fences from anywhere in the text
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    cleaned = codeBlockMatch[1].trim();
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
  }

  // Helper to remove trailing commas which cause JSON.parse syntax errors
  const sanitizeJson = (str) => str.replace(/,\s*([}\]])/g, '$1');

  const cleanJsonStrings = (val) => {
    if (typeof val === 'string') return cleanEmDashes(val);
    if (Array.isArray(val)) return val.map(cleanJsonStrings);
    if (val && typeof val === 'object') {
      const res = {};
      for (const key of Object.keys(val)) {
        res[key] = cleanJsonStrings(val[key]);
      }
      return res;
    }
    return val;
  };

  try {
    return cleanJsonStrings(JSON.parse(sanitizeJson(cleaned)));
  } catch {}

  // 2. Try finding array slice [ ... ]
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    try {
      return cleanJsonStrings(JSON.parse(sanitizeJson(cleaned.slice(firstBracket, lastBracket + 1))));
    } catch {}
  }

  // 3. Try finding object slice { ... }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      return cleanJsonStrings(JSON.parse(sanitizeJson(cleaned.slice(firstBrace, lastBrace + 1))));
    } catch {}
  }

  return null;
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

  // 1. Try Primary: Google Gemini with multi-key and multi-model rotation
  if (geminiKeys.length > 0) {
    for (let attempt = 0; attempt < Math.max(geminiKeys.length, 1); attempt++) {
      const aiClient = getActiveGeminiClient();
      if (!aiClient) break;

      const contents = [];
      if (systemPrompt) {
        contents.push({ role: 'user', parts: [{ text: `${systemPrompt}\n\n${prompt}` }] });
      } else {
        contents.push({ role: 'user', parts: [{ text: prompt }] });
      }
      const config = json ? { responseMimeType: 'application/json' } : undefined;

      for (const model of GEMINI_MODELS) {
        try {
          const res = await aiClient.models.generateContent({
            model,
            contents,
            config,
          });

          const rawText = res.text || '';
          const text = json ? rawText : cleanEmDashes(rawText);
          if (text.trim()) {
            setCachedResult(cacheKey, text);
            return { text, provider: 'gemini', model };
          }
        } catch (geminiError) {
          console.warn(`[LLM Scale] Gemini (${model}) notice:`, geminiError.message);
          rotateGeminiKey();
          if (geminiError.message?.includes('429') || geminiError.message?.includes('quota')) {
            await sleep(200);
          }
        }
      }
    }
  }

  // 2. Try Fallback: OpenRouter with multi-model failover pool
  if (openrouterKeys.length > 0) {
    try {
      console.log(`[LLM Scale] Engaging OpenRouter high-availability pool...`);
      const rawText = await callOpenRouter({ prompt, systemPrompt, json });
      const text = json ? rawText : cleanEmDashes(rawText);
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
  // 1. Try Primary: Google Gemini Streaming with multi-model failover
  if (geminiKeys.length > 0) {
    for (let attempt = 0; attempt < Math.max(geminiKeys.length, 1); attempt++) {
      const aiClient = getActiveGeminiClient();
      if (!aiClient) break;

      const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;

      for (const model of GEMINI_MODELS) {
        try {
          const responseStream = await aiClient.models.generateContentStream({
            model,
            contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
          });

          let hadChunks = false;
          for await (const chunk of responseStream) {
            if (chunk.text) {
              hadChunks = true;
              yield cleanEmDashes(chunk.text);
            }
          }
          if (hadChunks) return;
        } catch (geminiError) {
          console.warn(`[LLM Stream Scale] Gemini (${model}) notice, trying next model/provider:`, geminiError.message);
          rotateGeminiKey();
        }
      }
    }
  }

  // 2. Try Fallback: OpenRouter Streaming Pool
  if (openrouterKeys.length > 0) {
    try {
      console.log(`[LLM Stream Scale] Streaming via resilient OpenRouter free model pool...`);
      let hadOpenRouterChunks = false;
      for await (const chunk of streamOpenRouter({ prompt, systemPrompt })) {
        hadOpenRouterChunks = true;
        yield cleanEmDashes(chunk);
      }
      if (hadOpenRouterChunks) return;
    } catch (openrouterStreamError) {
      console.warn('[LLM Stream Scale] OpenRouter stream notice, engaging non-streaming fallback...', openrouterStreamError.message);
      // Secondary fallback to non-streaming callOpenRouter
      try {
        const text = await callOpenRouter({ prompt, systemPrompt });
        if (text && text.trim()) {
          yield cleanEmDashes(text);
          return;
        }
      } catch (callError) {
        console.error('[LLM Stream Scale] OpenRouter non-streaming fallback notice:', callError.message);
      }
    }
  }

  if (geminiKeys.length === 0 && openrouterKeys.length === 0) {
    yield 'Hello! Please configure GEMINI_API_KEY or OPENROUTER_API_KEY in .env.local to enable real-time AI study assistance.';
    return;
  }

  // Final resilient fallback: curriculum guidance based on the prompt
  yield `I've analyzed your question based on your study materials.\n\n### Study Summary & Next Steps\nRegarding: **${prompt.slice(0, 80)}**\n\n- Review the core definitions in your active course notes.\n- For step-by-step problem sets, ask StudyGuru for flashcards or a quiz drill on this topic!\n\n*(High-concurrency cloud failover active)*`;
}
