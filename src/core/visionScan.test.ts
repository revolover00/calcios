import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_GROQ_API_URL,
  DEFAULT_GROQ_MODEL,
  normalizeEndpointUrl,
  normalizeToCalcios2D,
  scanMathFromImage,
} from './visionScan';
import { calculatorReducer, formatActiveResult, hydrateState } from './calculator';
import { deserialize } from './value';
import { formatDecimal } from './format';

describe('Math Vision Scanner & Calcios 2D Normalizer', () => {
  it('normalizes bare Groq and OpenAI-compatible base URLs to /chat/completions', () => {
    expect(normalizeEndpointUrl('')).toBe(DEFAULT_GROQ_API_URL);
    expect(normalizeEndpointUrl('https://api.groq.com')).toBe(DEFAULT_GROQ_API_URL);
    expect(normalizeEndpointUrl('https://api.groq.com/openai/v1/')).toBe(DEFAULT_GROQ_API_URL);
    expect(normalizeEndpointUrl('https://my-proxy.workers.dev/v1')).toBe(
      'https://my-proxy.workers.dev/v1/chat/completions',
    );
    expect(normalizeEndpointUrl('https://my-proxy.workers.dev/scan')).toBe(
      'https://my-proxy.workers.dev/scan',
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

  it('calls qwen/qwen3.8-27b with reasoning_effort="none" and loads evaluated 2D math onto Calcios', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  expression: 'integ(cos(X),0,frac(π,2))',
                  mode: 'COMP',
                  angle: 'Rad',
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const fakeBlob = new Blob(['fake-image-bytes'], { type: 'image/png' });
    const scanned = await scanMathFromImage(fakeBlob, {
      apiUrl: DEFAULT_GROQ_API_URL,
      model: DEFAULT_GROQ_MODEL,
      apiKey: 'gsk_test_key_123',
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [calledUrl, reqInit] = fetchSpy.mock.calls[0];
    expect(calledUrl).toBe(DEFAULT_GROQ_API_URL);
    const sentBody = JSON.parse(String(reqInit?.body)) as Record<string, unknown>;
    expect(sentBody.model).toBe('qwen/qwen3.8-27b');
    expect(sentBody.reasoning_effort).toBe('none');
    expect(sentBody.response_format).toEqual({ type: 'json_object' });

    expect(scanned).toEqual({
      expression: 'integ(cos(X),0,frac(π,2))',
      mode: 'COMP',
      angle: 'RAD',
    });

    const initial = hydrateState(null);
    const next = calculatorReducer(initial, {
      type: 'load-scanned-math',
      expression: scanned.expression,
      mode: scanned.mode,
      angle: scanned.angle,
    });
    expect(next.angle).toBe('RAD');
    expect(next.expression).toBe('integ(cos(X),0,frac(π,2))');
    expect(formatActiveResult(next)).toEqual({ type: 'text', text: '1' });
  });

  it('automatically solves single-variable equations loaded from a scanned photo', () => {
    const initial = hydrateState(null);
    const solved = calculatorReducer(initial, {
      type: 'load-scanned-math',
      expression: '2X+5=13',
      mode: 'COMP',
    });
    expect(solved.solvePrompt?.stage).toBe('solved');
    expect(solved.solvePrompt?.root && formatDecimal(deserialize(solved.solvePrompt.root))).toBe('4');
  });
});
