import crypto from 'node:crypto';

// In-memory cache for prompt deduplication (TTL: 10 minutes)
interface CacheEntry {
  text: string;
  expires: number;
}
const promptCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000;

// Rate-limiting queue: ensure at least 250ms spacing between all concurrent calls
let lastCallTime = 0;
const MIN_CALL_INTERVAL_MS = 250;
let throttleChain = Promise.resolve();

async function throttle(): Promise<void> {
  const next = throttleChain.then(async () => {
    const now = Date.now();
    const elapsed = now - lastCallTime;
    if (elapsed < MIN_CALL_INTERVAL_MS) {
      await new Promise((res) => setTimeout(res, MIN_CALL_INTERVAL_MS - elapsed));
    }
    lastCallTime = Date.now();
  });
  throttleChain = next.catch(() => {});
  await next;
}

function getCacheKey(system: string, user: string): string {
  return crypto.createHash('sha256').update((system || '') + ':::' + (user || '')).digest('hex');
}

/**
 * Parses Gemini API error responses to find recommended retry delay
 */
function parseRetryDelayMs(errorText: string, defaultMs: number): number {
  try {
    const match = errorText.match(/retry in\s+([\d.]+)\s*s/i);
    if (match && match[1]) {
      const sec = parseFloat(match[1]);
      if (!isNaN(sec) && sec > 0) {
        return Math.min(Math.round(sec * 1000), 8000);
      }
    }
  } catch {}
  return defaultMs;
}

/**
 * Extracts generated text across all supported Gemini and OpenAI response schemas
 */
function extractResponseText(data: any): string {
  return (
    (typeof data?.output_text === 'string' && data.output_text.trim()) ||
    data?.steps
      ?.filter((step: any) => step.type === 'model_output')
      ?.flatMap((step: any) => step.content || [])
      ?.filter((item: any) => item.type === 'text' && typeof item.text === 'string')
      ?.map((item: any) => item.text)
      ?.join('')
      ?.trim() ||
    data?.candidates?.[0]?.content?.parts
      ?.map((part: any) => part.text || '')
      ?.join('')
      ?.trim() ||
    data?.choices?.[0]?.message?.content?.trim() ||
    ''
  );
}

export async function ai(system: string, user: string): Promise<string> {
  if (!process.env.AI_API_KEY) {
    throw new Error('AI provider is not configured: AI_API_KEY is missing');
  }

  // 1. Check in-memory prompt cache
  const cacheKey = getCacheKey(system, user);
  const cached = promptCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.text;
  }

  const apiKey = process.env.AI_API_KEY;
  const configuredModel = process.env.AI_MODEL || 'gemini-3.5-flash';

  // Distinct model quota pools in Google AI Studio
  const modelPool: string[] = Array.from(
    new Set([
      configuredModel,
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.8-flash',
      'gemini-3.6-flash',
    ])
  );

  const maxAttempts = 3;
  let lastError = '';

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    for (const model of modelPool) {
      await throttle();

      // Strategy 1: Try Interactions API
      try {
        const interactionsUrl =
          process.env.AI_API_URL ||
          'https://generativelanguage.googleapis.com/v1beta/interactions';

        const body: Record<string, any> = {
          model,
          input: user,
        };
        if (system && system.trim()) {
          body.system_instruction = system.trim();
        }

        const response = await fetch(interactionsUrl, {
          method: 'POST',
          headers: {
            'x-goog-api-key': apiKey,
            'Content-Type': 'application/json',
            'Api-Revision': '2026-05-20',
          },
          body: JSON.stringify(body),
        });

        if (response.ok) {
          const data = await response.json();
          const text = extractResponseText(data);
          if (text) {
            promptCache.set(cacheKey, { text, expires: Date.now() + CACHE_TTL_MS });
            return text;
          }
        }

        const errText = await response.text();
        lastError = `Model ${model} [${response.status}]: ${errText}`;

        // If rate-limited (429), high-demand/capacity (503), server error (500/502/504), or unavailable (404), cascade to next model
        if (!response.ok) {
          console.warn(`[AI Failover] ${model} interactions returned status ${response.status}. Automatically cascading to next model...`);
          // Continue to fallback endpoint or next model
        }
      } catch (err: any) {
        lastError = `Interactions error (${model}): ${err.message}`;
        console.warn(`[AI Failover] ${model} interactions threw exception (${err.message}). Cascading...`);
      }

      // Strategy 2: Fallback to generateContent API endpoint for this model
      try {
        const generateUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const genBody: Record<string, any> = {
          contents: [{ parts: [{ text: user }] }],
        };
        if (system && system.trim()) {
          genBody.systemInstruction = { parts: [{ text: system.trim() }] };
        }

        const genResponse = await fetch(generateUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(genBody),
        });

        if (genResponse.ok) {
          const genData = await genResponse.json();
          const genText = extractResponseText(genData);
          if (genText) {
            promptCache.set(cacheKey, { text: genText, expires: Date.now() + CACHE_TTL_MS });
            return genText;
          }
        }

        const genErrText = await genResponse.text();
        lastError = `generateContent ${model} [${genResponse.status}]: ${genErrText}`;

        if (!genResponse.ok) {
          console.warn(`[AI Failover] ${model} generateContent returned ${genResponse.status}. Cascading to next model...`);
          continue;
        }
      } catch (genErr: any) {
        lastError = `generateContent error (${model}): ${genErr.message}`;
        console.warn(`[AI Failover] ${model} generateContent threw exception (${genErr.message}). Cascading...`);
      }
    }

    // If all models in the pool were rate-limited on this attempt, back off before next attempt
    if (attempt < maxAttempts) {
      const waitMs = parseRetryDelayMs(lastError, attempt * 1500);
      console.warn(`[AI Retry] All candidate models busy. Backing off for ${waitMs}ms before attempt ${attempt + 1}...`);
      await new Promise((res) => setTimeout(res, waitMs));
    }
  }

  throw new Error(`AI service temporarily busy. Please retry in a moment. (${lastError})`);
}

/**
 * Safely parses JSON returned from an LLM.
 * Handles markdown code fences (```json ... ```), raw JSON, 
 * conversational prefix/suffix text, and trailing newlines.
 */
export function safeJson<T = any>(x: string): T | { text: string } {
  if (typeof x !== 'string') {
    return { text: String(x ?? '') };
  }

  const trimmed = x.trim();

  // 1. Direct JSON parse
  try {
    return JSON.parse(trimmed);
  } catch {}

  // 2. Extract from markdown code blocks (```json ... ``` or ``` ... ```)
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/gi;
  let match: RegExpExecArray | null;
  while ((match = codeBlockRegex.exec(trimmed)) !== null) {
    try {
      return JSON.parse(match[1].trim());
    } catch {}
  }

  // 3. Extract outermost JSON object {...}
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    } catch {}
  }

  // 4. Extract outermost JSON array [...]
  const firstBracket = trimmed.indexOf('[');
  const lastBracket = trimmed.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    try {
      return JSON.parse(trimmed.slice(firstBracket, lastBracket + 1));
    } catch {}
  }

  // Fallback if parsing fails
  return { text: x };
}
