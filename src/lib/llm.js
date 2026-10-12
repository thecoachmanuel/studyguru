import { GoogleGenAI } from '@google/genai';

const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
const openrouterApiKey = process.env.OPENROUTER_API_KEY || '';
const configuredModel = process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3.5-lightning:free';

// Candidate models to rotate through if one is deprecated or unavailable
const OPENROUTER_MODELS = Array.from(
  new Set([
    configuredModel,
    'nvidia/nemotron-3.5-lightning:free',
    'liquid/lfm-2.5-2.6b:free',
    'google/gemma-4-26b-a4b-it:free',
  ])
);

const ai = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;

/**
 * Check which AI providers are available
 */
export function getAvailableProviders() {
  return {
    gemini: Boolean(geminiApiKey),
    openrouter: Boolean(openrouterApiKey),
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
  } catch (err) {
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
 * Call OpenRouter API with resilient model fallback
 */
async function callOpenRouter({ prompt, systemPrompt = '', json = false }) {
  if (!openrouterApiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }

  const messages = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  let lastError = null;

  for (const model of OPENROUTER_MODELS) {
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
          'Authorization': `Bearer ${openrouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://studycord.me',
          'X-Title': 'StudyCord',
        },
        body: JSON.stringify(body),
      });

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
      console.warn(`[OpenRouter] Model ${model} failed, trying next available free model...`, err.message);
    }
  }

  throw lastError || new Error('All OpenRouter models failed');
}

/**
 * Call OpenRouter API with Server-Sent Events (SSE Streaming) and model fallback
 */
async function* streamOpenRouter({ prompt, systemPrompt = '' }) {
  if (!openrouterApiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }

  const messages = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  let streamSucceeded = false;
  let lastError = null;

  for (const model of OPENROUTER_MODELS) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openrouterApiKey}`,
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
            } catch {
              // Ignore partial parse
            }
          }
        }
      }

      if (streamSucceeded) {
        return;
      }
    } catch (err) {
      lastError = err;
      console.warn(`[OpenRouter Stream] Model ${model} failed, attempting next fallback...`, err.message);
    }
  }

  throw lastError || new Error('All OpenRouter streaming models failed');
}

/**
 * Generate content with automatic Gemini -> OpenRouter fallback
 * Used by Flashcards and MCQ endpoints
 */
export async function generateContentWithFallback({ prompt, systemPrompt = '', json = false }) {
  // 1. Try Primary: Google Gemini
  if (ai) {
    try {
      const contents = [];
      if (systemPrompt) {
        contents.push({ role: 'user', parts: [{ text: `${systemPrompt}\n\n${prompt}` }] });
      } else {
        contents.push({ role: 'user', parts: [{ text: prompt }] });
      }

      const config = json ? { responseMimeType: 'application/json' } : undefined;

      const res = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config,
      });

      const text = res.text || '';
      if (text.trim()) {
        return { text, provider: 'gemini' };
      }
    } catch (geminiError) {
      console.warn('[LLM] Primary Gemini failed (rate limit or credit issue). Falling back to OpenRouter:', geminiError.message);
    }
  }

  // 2. Try Fallback: OpenRouter
  if (openrouterApiKey) {
    try {
      console.log(`[LLM] Active failover to OpenRouter...`);
      const text = await callOpenRouter({ prompt, systemPrompt, json });
      return { text, provider: 'openrouter' };
    } catch (openrouterError) {
      console.error('[LLM] OpenRouter fallback also failed:', openrouterError.message);
      throw openrouterError;
    }
  }

  if (!ai && !openrouterApiKey) {
    throw new Error('No AI provider configured. Set GEMINI_API_KEY or OPENROUTER_API_KEY in .env.local');
  }

  throw new Error('All configured AI providers failed to generate response');
}

/**
 * Generate streaming content with automatic Gemini -> OpenRouter fallback
 * Used by Chat and Summary endpoints
 */
export async function* generateStreamWithFallback({ prompt, systemPrompt = '' }) {
  // 1. Try Primary: Google Gemini Streaming
  let geminiFailed = false;
  if (ai) {
    try {
      const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
      const responseStream = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
      });

      for await (const chunk of responseStream) {
        if (chunk.text) {
          yield chunk.text;
        }
      }
      return;
    } catch (geminiError) {
      console.warn('[LLM Stream] Gemini stream unavailable (rate limit or credit issue). Switching to OpenRouter:', geminiError.message);
      geminiFailed = true;
    }
  }

  // 2. Try Fallback: OpenRouter Streaming
  if (openrouterApiKey) {
    try {
      console.log(`[LLM Stream] Streaming via OpenRouter...`);
      for await (const chunk of streamOpenRouter({ prompt, systemPrompt })) {
        yield chunk;
      }
      return;
    } catch (openrouterError) {
      console.error('[LLM Stream] OpenRouter streaming error:', openrouterError.message);
      throw openrouterError;
    }
  }

  if (!ai && !openrouterApiKey) {
    yield 'Hello! Please configure GEMINI_API_KEY or OPENROUTER_API_KEY in .env.local to enable real-time AI study assistance.';
    return;
  }

  if (geminiFailed) {
    yield 'An error occurred while generating AI response, and OpenRouter fallback is not configured in .env.local.';
  }
}
