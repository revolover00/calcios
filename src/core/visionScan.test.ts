import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_GROQ_API_URL,
  DEFAULT_GROQ_MODEL,
  decodeKeyShard,
  encodeKeyShard,
  normalizeEndpointUrl,
  normalizeToCalcios2D,
  resetKeyRotationState,
  scanMathFromImage,
} from './visionScan';
import { calculatorReducer, formatActiveResult, hydrateState } from './calculator';

describe('Math Vision Scanner & Multi-Key Failover Pool', () => {
  beforeEach(() => {
    resetKeyRotationState();
  });

  it('obfuscates and restores API key shards without exposing plaintext prefixes', () => {
    const sample = 'gsk_AbCdEfGhIjKlMnOpQrStUvWxYz123456';
    const shard = encodeKeyShard(sample);
    expect(JSON.stringify(shard)).not.toContain('gsk_');
    expect(decodeKeyShard(shard)).toBe(sample);
  });

  it('normalizes bare Groq and OpenAI-compatible base URLs to /chat/completions', () => {
    expect(normalizeEndpointUrl('')).toBe(DEFAULT_GROQ_API_URL);
    expect(normalizeEndpointUrl('https://api.groq.com')).toBe(DEFAULT_GROQ_API_URL);
    expect(normalizeEndpointUrl('https://api.groq.com/openai/v1/')).toBe(DEFAULT_GROQ_API_URL);
    expect(normalizeEndpointUrl('https://my-proxy.workers.dev/v1')).toBe(
      'https://my-proxy.workers.dev/v1/chat/completions',
    );
  });

  it('compiles LaTeX and ASCII math expressions into valid Calcios 2D templates', () => {
    expect(normalizeToCalcios2D('\\frac{1 + \\sqrt{5}}{2} = ?')).toBe('frac(1+sqrt(5),2)');
    expect(normalizeToCalcios2D('\\int_{0}^{\\frac{\\pi}{2}} \\cos(x) \\, dx')).toBe(
      'integ(cos(X),0,frac(π,2))',
    );
    expect(normalizeToCalcios2D('\\sqrt[3]{27} + x^{2}')).toBe('cbrt(27)+X^(2)');
    expect(normalizeToCalcios2D('2x + 5 = 13')).toBe('2X+5=13');
    expect(normalizeToCalcios2D('|-7| \\times 3')).toBe('abs(-7)×3');
  });

  it('keeps the entire multi-line problem transcription separate from the calculator expression', async () => {
    const transcription = [
      'Let f(x,y) = (x^2+y^2)^2 + 3xy - 4x - 6y + 1 = 0',
      'x,y ∈ R, x ≠ y',
      '∂f/∂x = 4x(x^2+y^2) + 3y - 4 = 0',
      '∂f/∂y = 4y(x^2+y^2) + 3x - 6 = 0',
      'x(0) = 1, y(0) = -1',
      'Find lim(t→∞)(x(t)+y(t))',
    ].join('\\n');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({
            transcription,
            expression: '2x+5=13',
            mode: 'COMP',
            angle: null,
          }) } }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await scanMathFromImage(new Blob(['image'], { type: 'image/png' }), {
      apiUrl: DEFAULT_GROQ_API_URL,
      model: DEFAULT_GROQ_MODEL,
      apiKeys: ['test-key'],
    });
    expect(result.transcription).toBe(transcription);
    expect(result.expression).toBe('2X+5=13');
    const request = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body)) as {
      messages: Array<{ content: string | Array<{ text: string }> }>;
      max_completion_tokens: number;
    };
    const systemContent = request.messages[0].content;
    const userContent = request.messages[1].content;
    expect(typeof systemContent === 'string' ? systemContent : '').toContain('Transcribe ALL readable lines');
    expect(Array.isArray(userContent) ? userContent[0]?.text : userContent).toContain('complete problem faithfully');
    expect(request.max_completion_tokens).toBeGreaterThanOrEqual(1000);
  });

  it('automatically fails over across 5 API keys on 429/401 and sticks to the healthy key on subsequent scans', async () => {
    const keys = ['gsk_key_1', 'gsk_key_2', 'gsk_key_3', 'gsk_key_4', 'gsk_key_5'];

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      // Key 1 -> 429 Rate Limit
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'Rate limit reached' } }), {
          status: 429,
          headers: { 'retry-after': '60' },
        }),
      )
      // Key 2 -> 401 Invalid/Expired
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'Invalid API Key' } }), {
          status: 401,
        }),
      )
      // Key 3 -> 200 OK!
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    expression: 'integ(cos(X),0,frac(π,2))',
                    mode: 'COMP',
                    angle: 'RAD',
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      // Next user scan should start directly on Key 3!
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    expression: 'frac(1+sqrt(5),2)',
                    mode: 'COMP',
                    angle: null,
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    const fakeBlob = new Blob(['fake-image-bytes'], { type: 'image/png' });

    // First scan: fails over Key 1 -> Key 2 -> succeeds on Key 3
    const firstScan = await scanMathFromImage(fakeBlob, {
      apiUrl: DEFAULT_GROQ_API_URL,
      model: DEFAULT_GROQ_MODEL,
      apiKeys: keys,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect((fetchSpy.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBe('Bearer gsk_key_1');
    expect((fetchSpy.mock.calls[1][1]?.headers as Record<string, string>).Authorization).toBe('Bearer gsk_key_2');
    expect((fetchSpy.mock.calls[2][1]?.headers as Record<string, string>).Authorization).toBe('Bearer gsk_key_3');
    expect(firstScan).toEqual({
      expression: 'integ(cos(X),0,frac(π,2))',
      transcription: 'integ(cos(X),0,frac(π,2))',
      mode: 'COMP',
      angle: 'RAD',
    });

    // Second scan: starts immediately on Key 3 without wasting requests on Key 1 or Key 2!
    const secondScan = await scanMathFromImage(fakeBlob, {
      apiUrl: DEFAULT_GROQ_API_URL,
      model: DEFAULT_GROQ_MODEL,
      apiKeys: keys,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(4);
    expect((fetchSpy.mock.calls[3][1]?.headers as Record<string, string>).Authorization).toBe('Bearer gsk_key_3');
    expect(secondScan.expression).toBe('frac(1+sqrt(5),2)');

    const initial = hydrateState(null);
    const next = calculatorReducer(initial, {
      type: 'load-scanned-math',
      expression: firstScan.expression,
      mode: firstScan.mode,
      angle: firstScan.angle,
    });
    expect(next.angle).toBe('RAD');
    expect(next.phase).toBe('editing');
    expect(next.expression).toBe(firstScan.expression);
    expect(next.result).toBeNull();
    expect(formatActiveResult(next)).toBeNull();
  });

  it('loads scanned equations as editable transcription without solving them automatically', () => {
    const initial = hydrateState(null);
    const loaded = calculatorReducer(initial, {
      type: 'load-scanned-math',
      expression: '2X+5=13',
      mode: 'COMP',
    });
    expect(loaded.phase).toBe('editing');
    expect(loaded.expression).toBe('2X+5=13');
    expect(loaded.solvePrompt).toBeNull();
    expect(loaded.result).toBeNull();
  });
});
