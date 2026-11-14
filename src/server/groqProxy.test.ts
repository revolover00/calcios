import { describe, expect, it, vi } from 'vitest';
import { GROQ_CHAT_COMPLETIONS_URL, proxyVisionRequest } from './groqProxy';

const validRequest = {
  model: 'client-model-is-ignored',
  messages: [
    { role: 'system', content: 'Transcribe every line.' },
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Transcribe the whole problem.' },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,ZmFrZQ==' } },
      ],
    },
  ],
  temperature: 0.1,
  max_completion_tokens: 1200,
  response_format: { type: 'json_object' },
  reasoning_effort: 'none',
};

describe('server-only Groq vision proxy', () => {
  it('rejects requests without a valid inline image before contacting Groq', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const result = await proxyVisionRequest({
      ...validRequest,
      messages: [
        validRequest.messages[0],
        { role: 'user', content: [{ type: 'image_url', image_url: { url: 'https://attacker.example/image.png' } }] },
      ],
    }, { GROQ_API_KEY_1: 'server-secret' }, fetcher);

    expect(result.status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('returns a clear unavailable response when no server-side key is configured', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const result = await proxyVisionRequest(validRequest, {}, fetcher);
    expect(result.status).toBe(503);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('adds the server-only key, pins the model, and forwards a successful OCR response', async () => {
    let requestInit: RequestInit | undefined;
    const fetcher: typeof fetch = async (input, init) => {
      expect(input).toBe(GROQ_CHAT_COMPLETIONS_URL);
      requestInit = init;
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"transcription":"full text"}' } }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const result = await proxyVisionRequest(validRequest, {
      GROQ_API_KEY_1: 'server-secret',
      GROQ_MODEL: 'server-model',
    }, fetcher);

    expect(result.status).toBe(200);
    expect(JSON.stringify(result.body)).toContain('full text');
    expect(JSON.stringify(result.body)).not.toContain('server-secret');
    expect(new Headers(requestInit?.headers).get('authorization')).toBe('Bearer server-secret');
    const sentBody = JSON.parse(String(requestInit?.body)) as Record<string, unknown>;
    expect(sentBody.model).toBe('server-model');
    expect(sentBody.reasoning_effort).toBe('none');
  });

  it('supports the legacy key variable name and fails over after provider rate limiting', async () => {
    const authorizations: string[] = [];
    const fetcher: typeof fetch = async (_input, init) => {
      authorizations.push(new Headers(init?.headers).get('authorization') ?? '');
      if (authorizations.length === 1) {
        return new Response(JSON.stringify({ error: { message: 'Rate limit' } }), { status: 429 });
      }
      return new Response(JSON.stringify({ choices: [{ message: { content: 'transcription' } }] }), { status: 200 });
    };

    const result = await proxyVisionRequest(validRequest, {
      GROQ_API_KEY1: 'legacy-server-key',
      GROQ_API_KEY_2: 'healthy-server-key',
    }, fetcher);

    expect(result.status).toBe(200);
    expect(authorizations).toEqual(['Bearer legacy-server-key', 'Bearer healthy-server-key']);
  });
});
