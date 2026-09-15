export async function ai(system: string, user: string): Promise<string> {
  if (!process.env.AI_API_KEY) {
    throw new Error('AI provider is not configured: AI_API_KEY is missing');
  }

  // Default to the official Gemini Interactions API endpoint if not specified
  const apiUrl =
    process.env.AI_API_URL ||
    'https://generativelanguage.googleapis.com/v1beta/interactions';

  const body: Record<string, any> = {
    // Current recommended standard Flash model
    model: process.env.AI_MODEL || 'gemini-3.7-flash',
    // In the Interactions API, input can be a direct string
    input: user,
  };

  // system_instruction expects a plain string, not an object
  if (system && system.trim()) {
    body.system_instruction = system.trim();
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'x-goog-api-key': process.env.AI_API_KEY,
      'Content-Type': 'application/json',
      'Api-Revision': '2026-05-20',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('AI provider error:', response.status, errorText);
    throw new Error(`AI provider error ${response.status}: ${errorText}`);
  }

  const data = await response.json();

  // Robust multi-format extraction:
  // 1. Direct output_text convenience property
  // 2. Interactions API steps format (model_output -> content -> text)
  // 3. Fallback: generateContent candidates format
  // 4. Fallback: OpenAI-compatible choices format
  const text =
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
    '';

  if (!text) {
    throw new Error('AI provider returned no text');
  }

  return text;
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
  // Handles case insensitivity, surrounding chat text, and newlines
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
