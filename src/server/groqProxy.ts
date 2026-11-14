export const GROQ_CHAT_COMPLETIONS_URL = 'https://api.groq.com/openai/v1/chat/completions';
export const DEFAULT_SERVER_VISION_MODEL = 'qwen/qwen3.8-27b';
const MAX_REQUEST_BYTES = 4_000_000;

export interface ProxyResult {
  status: number;
  body: unknown;
}

function getApiKeys(env: Record<string, string | undefined>): string[] {
  const keys: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const value = (env[`GROQ_API_KEY_${i}`] ?? env[`GROQ_API_KEY${i}`] ?? '').trim();
    if (value) keys.push(value);
  }
  for (const value of [env.GROQ_API_KEYS, env.GROQ_API_KEY]) {
    if (value?.trim()) keys.push(...value.split(',').map((key) => key.trim()).filter(Boolean));
  }
  return Array.from(new Set(keys));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validateVisionPayload(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value) || !Array.isArray(value.messages) || value.messages.length !== 2) return false;
  const [system, user] = value.messages;
  if (!isRecord(system) || system.role !== 'system' || typeof system.content !== 'string') return false;
  if (!isRecord(user) || user.role !== 'user' || !Array.isArray(user.content)) return false;
  if (JSON.stringify(value).length > MAX_REQUEST_BYTES) return false;

  const imagePart = user.content.find((part: unknown) => {
    if (!isRecord(part) || part.type !== 'image_url' || !isRecord(part.image_url)) return false;
    const url = part.image_url.url;
    return typeof url === 'string' && /^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=\r\n]+$/i.test(url);
  });
  return Boolean(imagePart);
}

function shouldFailover(status: number): boolean {
  return [401, 402, 403, 408, 429, 500, 502, 503, 504, 529].includes(status);
}

function parseUpstreamBody(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { error: { message: 'Vision provider returned an invalid response.' } };
  }
}

/** Server-only Groq proxy. Never returns or logs API key values. */
export async function proxyVisionRequest(
  requestBody: unknown,
  env: Record<string, string | undefined>,
  fetcher: typeof fetch = fetch,
): Promise<ProxyResult> {
  if (!validateVisionPayload(requestBody)) {
    return { status: 400, body: { error: { message: 'Invalid image scan request.' } } };
  }

  const keys = getApiKeys(env);
  if (keys.length === 0) {
    return { status: 503, body: { error: { message: 'Scanner is not configured on the server.' } } };
  }

  const body = requestBody;
  const upstreamRequest: Record<string, unknown> = {
    model: env.GROQ_MODEL?.trim() || DEFAULT_SERVER_VISION_MODEL,
    messages: body.messages,
    temperature: typeof body.temperature === 'number' ? Math.min(1, Math.max(0, body.temperature)) : 0,
    max_completion_tokens: typeof body.max_completion_tokens === 'number'
      ? Math.min(1600, Math.max(1, Math.floor(body.max_completion_tokens)))
      : 1200,
  };
  if (isRecord(body.response_format) && body.response_format.type === 'json_object') {
    upstreamRequest.response_format = { type: 'json_object' };
  }
  if (body.reasoning_effort === 'none') upstreamRequest.reasoning_effort = 'none';

  let lastStatus = 502;
  let lastBody: unknown = { error: { message: 'Vision service temporarily unavailable.' } };
  for (let index = 0; index < keys.length; index++) {
    let response: Response;
    try {
      response = await fetcher(GROQ_CHAT_COMPLETIONS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${keys[index]}`,
        },
        body: JSON.stringify(upstreamRequest),
      });
    } catch {
      lastStatus = 502;
      lastBody = { error: { message: 'Could not reach the vision provider.' } };
      if (index < keys.length - 1) continue;
      break;
    }

    const responseBody = parseUpstreamBody(await response.text());
    if (response.ok) return { status: 200, body: responseBody };

    lastStatus = response.status;
    lastBody = responseBody;
    if (!shouldFailover(response.status) || index === keys.length - 1) break;
  }

  return { status: lastStatus, body: lastBody };
}
