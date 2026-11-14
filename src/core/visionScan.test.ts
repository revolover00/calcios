import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_GROQ_API_URL,
  DEFAULT_GROQ_MODEL,
  DEFAULT_VISION_PROXY_URL,
  getConfiguredEndpointUrl,
  getConfiguredKeyPool,
  normalizeEndpointUrl,
  normalizeToCalcios2D,
  resetKeyRotationState,
  scanMathFromImage,
} from './visionScan';
import { calculatorReducer, formatActiveResult, hydrateState } from './calculator';
import { deserialize } from './value';

describe('Math Vision Scanner & Multi-Key Failover Pool', () => {
  beforeEach(() => {
    resetKeyRotationState();
  });

  it('uses the same-origin server proxy and never reads API keys from browser configuration', () => {
    expect(getConfiguredEndpointUrl()).toBe(DEFAULT_VISION_PROXY_URL);
    expect(getConfiguredKeyPool()).toEqual([]);
  });

  it('sends scans to the same-origin proxy without an Authorization header by default', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        transcription: '2x + 3 = 7',
        expression: '2x+3=7',
        mode: 'COMP',
      }) } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await scanMathFromImage(new Blob(['image'], { type: 'image/png' }));

    expect(fetchSpy.mock.calls[0][0]).toBe(DEFAULT_VISION_PROXY_URL);
    const headers = new Headers(fetchSpy.mock.calls[0][1]?.headers);
    expect(headers.has('authorization')).toBe(false);
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
    ].join('\n');
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

  it('retries when OCR mistakes calculator key labels for the problem and keeps the full retry text', async () => {
    const keypadDump = 'SHIFT MODE ALPHA OPTN CALC MATRIX VECTOR TABLE\\nsin cos tan sin^-1 cos^-1 tan^-1\\nMATRIX VECTOR REPLAY SETUP';
    const fullProblem = 'A particle moves with position x(t) = t^2 + 3t.\\nFind its velocity at t = 2.';
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({
          transcription: keypadDump,
          expression: 'sin(x)',
          mode: 'COMP',
        }) } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: fullProblem } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const result = await scanMathFromImage(new Blob(['image'], { type: 'image/png' }), {
      apiUrl: DEFAULT_GROQ_API_URL,
      model: DEFAULT_GROQ_MODEL,
      apiKeys: ['test-key'],
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result.transcription).toBe(fullProblem);
    expect(result.expression).toBe('sin(X)');
  });

  it('rejects keypad-label OCR when the transcription retry is also only calculator controls', async () => {
    const keypadDump = 'SHIFT MODE ALPHA OPTN CALC MATRIX VECTOR TABLE\\nsin cos tan sin^-1 cos^-1 tan^-1\\nMATRIX VECTOR REPLAY SETUP';
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ transcription: keypadDump, expression: 'sin(x)' }) } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: keypadDump } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await expect(scanMathFromImage(new Blob(['image'], { type: 'image/png' }), {
      apiUrl: DEFAULT_GROQ_API_URL,
      model: DEFAULT_GROQ_MODEL,
      apiKeys: ['test-key'],
    })).rejects.toThrow('The AI returned no readable text');
  });

  it('auto-routes to a specialized mode only when structured values are complete and high-confidence', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        transcription: 'Solve x^2 - 5x + 6 = 0.',
        expression: '',
        mode: 'EQN',
        modeConfidence: 0.97,
        modeData: { type: 'quad', coefficients: ['1', '-5', '6'] },
        angle: null,
      }) } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const result = await scanMathFromImage(new Blob(['image'], { type: 'image/png' }));
    expect(result.mode).toBe('EQN');
    expect(result.modeData).toEqual({ type: 'quad', coefficients: ['1', '-5', '6'] });
    expect(result.recommendedMode).toBeUndefined();
  });

  it('keeps uncertain specialized-mode scans in COMP while preserving the recommendation and expression', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        transcription: 'x^2 - 5x + 6 = 0',
        expression: 'x^2-5x+6=0',
        mode: 'EQN',
        modeConfidence: 0.62,
        modeData: { type: 'quad', coefficients: ['1', '-5', '6'] },
      }) } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const result = await scanMathFromImage(new Blob(['image'], { type: 'image/png' }));
    expect(result.mode).toBe('COMP');
    expect(result.recommendedMode).toBe('EQN');
    expect(result.modeData).toBeUndefined();
    expect(result.expression).toBe('X^(2)-5X+6=0');
  });

  it('retries OCR-only when JSON mode returns an invisible blank transcription', async () => {
    const fullText = 'Definition line\nFirst equation\nInitial values\nFinal question';
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({
          transcription: '\u200b',
          expression: '',
          mode: 'COMP',
          angle: null,
        }) } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: fullText } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const result = await scanMathFromImage(new Blob(['image'], { type: 'image/png' }), {
      apiUrl: DEFAULT_GROQ_API_URL,
      model: DEFAULT_GROQ_MODEL,
      apiKeys: ['test-key'],
    });

    expect(result.transcription).toBe(fullText);
    expect(result.expression).toBe('');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const retryBody = JSON.parse(String(fetchSpy.mock.calls[1][1]?.body)) as Record<string, unknown>;
    expect(retryBody.response_format).toBeUndefined();
  });

  it('retries a non-empty answer-only transcription that contains just the final question', async () => {
    const fullText = [
      'Let f(x,y) = (x^2 + y^2)^2 + 3xy - 4x - 6y + 1 = 0',
      'x,y in R, x != y',
      'df/dx = 4x(x^2+y^2) + 3y - 4 = 0',
      'df/dy = 4y(x^2+y^2) + 3x - 6 = 0',
      'x(0) = 1, y(0) = -1',
      'Find lim(t->infinity) (x(t)+y(t))',
    ].join('\\n');
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({
          transcription: 'Find lim(t->infinity) (x(t)+y(t))',
          expression: 'lim(t->infinity)(x(t)+y(t))',
          mode: 'COMP',
        }) } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: fullText } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const result = await scanMathFromImage(new Blob(['image'], { type: 'image/png' }), {
      apiUrl: DEFAULT_GROQ_API_URL,
      model: DEFAULT_GROQ_MODEL,
      apiKeys: ['test-key'],
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result.transcription).toBe(fullText);
    expect(result.expression).toBe('lim(t->infinity)(X(t)+Y(t))');
  });

  it('does not treat a JSON expression as a complete transcription when the OCR field is absent', async () => {
    const fullText = 'Question 1\\n2x + 3y = 12\\nx - y = 1\\nFind x and y';
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ expression: '2x+3y=12' }) } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: [{ type: 'text', text: fullText }] } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const result = await scanMathFromImage(new Blob(['image'], { type: 'image/png' }), {
      apiUrl: DEFAULT_GROQ_API_URL,
      model: DEFAULT_GROQ_MODEL,
      apiKeys: ['test-key'],
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result.transcription).toBe(fullText);
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
                    transcription: 'integ(cos(X),0,frac(π,2))',
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
                    transcription: 'frac(1+sqrt(5),2)',
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

  it('prefills supported structured scan payloads into their native calculator modes', () => {
    const cases = [
      { mode: 'TABLE', expression: '', modeData: { fExpr: 'X^(2)', start: '-2', end: '2', step: '1' } },
      { mode: 'STAT', expression: '', modeData: { subMode: '1-VAR', rows: [{ x: '1', freq: '1' }, { x: '2', freq: '1' }] } },
      { mode: 'INEQ', expression: '', modeData: { degree: 2, relation: '>', coefficients: ['1', '0', '-4'] } },
      { mode: 'MATRIX', expression: 'MatA', modeData: { matrices: { MatA: [['1', '2'], ['3', '4']] } } },
      { mode: 'VECTOR', expression: 'VctA', modeData: { vectors: { VctA: ['3', '4'] } } },
      { mode: 'DIST', expression: '', modeData: { subMode: 'poisson-pd', params: ['2', '3'] } },
      { mode: 'RATIO', expression: '', modeData: { form: 'a:b=X:d', coefficients: ['2', '3', '12'] } },
      { mode: 'BASE-N', expression: 'FF', modeData: { base: 'HEX' } },
      { mode: 'VERIF', expression: '1=1', modeData: { expression: '1=1' } },
    ] as const;

    for (const entry of cases) {
      const loaded = calculatorReducer(hydrateState(null), {
        type: 'load-scanned-math',
        expression: entry.expression,
        mode: entry.mode,
        modeData: entry.modeData,
      });
      expect(loaded.mode).toBe(entry.mode);
      expect(loaded.notice).toContain(`Loaded scan into ${entry.mode}`);
    }
  });

  it('turns scanned statistical frequencies on when the extracted rows contain frequency counts', () => {
    const loaded = calculatorReducer(hydrateState(null), {
      type: 'load-scanned-math',
      expression: '',
      mode: 'STAT',
      modeData: {
        subMode: '1-VAR',
        rows: [{ x: '4', freq: '3' }, { x: '8', freq: '1' }],
      },
    });
    expect(loaded.mode).toBe('STAT');
    expect(loaded.stat.useFreq).toBe(true);
    expect(loaded.stat.rows).toEqual([
      { x: '4', y: undefined, freq: '3' },
      { x: '8', y: undefined, freq: '1' },
    ]);
  });

  it('prefills a complete scanned quadratic into EQN mode without calculating it', () => {
    const loaded = calculatorReducer(hydrateState(null), {
      type: 'load-scanned-math',
      expression: '',
      mode: 'EQN',
      modeData: { type: 'quad', coefficients: ['1', '-5', '6'] },
    });
    expect(loaded.mode).toBe('EQN');
    expect(loaded.eqn?.type).toBe('quad');
    expect(loaded.eqn?.coeffs.map((value) => deserialize(value).decimal.toString())).toEqual(['1', '-5', '6']);
    expect(loaded.eqn?.outcome).toBeNull();
    expect(loaded.phase).toBe('editing');
  });

  it('keeps an incomplete specialized scan in COMP and displays the recommendation', () => {
    const loaded = calculatorReducer(hydrateState(null), {
      type: 'load-scanned-math',
      expression: 'X^(2)-5X+6=0',
      mode: 'EQN',
      recommendedMode: 'EQN',
      modeData: { type: 'quad', coefficients: ['1', 'bad', '6'] },
    });
    expect(loaded.mode).toBe('COMP');
    expect(loaded.expression).toBe('X^(2)-5X+6=0');
    expect(loaded.notice).toContain('EQN');
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
