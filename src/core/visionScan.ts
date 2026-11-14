import type { ActiveMode } from './calculator';
import type { AngleUnit } from './value';

declare const __CALCIOS_GROQ_MODEL__: string | undefined;

export const DEFAULT_GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
export const DEFAULT_VISION_PROXY_URL = '/api/scan-math';
export const DEFAULT_GROQ_MODEL = 'qwen/qwen3.8-27b';

export interface VisionRuntimeOptions {
  apiUrl?: string;
  model?: string;
  apiKeys?: string[];
}

export interface ScannedMathResult {
  /** Best single calculator-ready expression, if the image contains one. */
  expression: string;
  /** Faithful OCR of all readable text and mathematics, in reading order. */
  transcription: string;
  /** Calculator mode selected for loading; specialized modes require validated modeData. */
  mode: ActiveMode;
  /** Suggested native mode when its structured inputs could not be confidently extracted. */
  recommendedMode?: ActiveMode;
  /** Validated, mode-specific values to prefill in the calculator. */
  modeData?: Record<string, unknown>;
  angle?: AngleUnit;
}

export function normalizeEndpointUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return DEFAULT_GROQ_API_URL;
  const noTrailing = trimmed.replace(/\/+$/, '');
  if (noTrailing === 'https://api.groq.com') {
    return DEFAULT_GROQ_API_URL;
  }
  if (noTrailing.endsWith('/openai/v1') || noTrailing.endsWith('/v1')) {
    return `${noTrailing}/chat/completions`;
  }
  return trimmed;
}

export function getConfiguredEndpointUrl(): string {
  // API credentials are server-only; the browser always calls the same-origin proxy.
  return DEFAULT_VISION_PROXY_URL;
}

export function getConfiguredModel(): string {
  const definedModel = typeof __CALCIOS_GROQ_MODEL__ === 'string' ? __CALCIOS_GROQ_MODEL__.trim() : '';
  return definedModel || DEFAULT_GROQ_MODEL;
}

export function getConfiguredKeyPool(): string[] {
  // The browser must never receive provider credentials. Key rotation happens in the API function.
  return [];
}

export function isDirectGroqHost(apiUrl: string): boolean {
  try {
    const u = new URL(apiUrl);
    return u.hostname.endsWith('groq.com');
  } catch {
    return apiUrl.includes('groq.com');
  }
}

// Sticky rotation state across scans so exhausted keys are skipped immediately
let activeKeyCursor = 0;
const keyCooldownUntil = new Map<string, number>();

export function resetKeyRotationState(): void {
  activeKeyCursor = 0;
  keyCooldownUntil.clear();
}

function orderCandidateKeys(pool: readonly string[], now: number): { key: string; index: number }[] {
  const n = pool.length;
  if (n === 0) return [];
  const ready: { key: string; index: number }[] = [];
  const cooling: { key: string; index: number; until: number }[] = [];
  for (let offset = 0; offset < n; offset++) {
    const idx = (activeKeyCursor + offset) % n;
    const key = pool[idx];
    const until = keyCooldownUntil.get(key) ?? 0;
    if (until <= now) {
      ready.push({ key, index: idx });
    } else {
      cooling.push({ key, index: idx, until });
    }
  }
  // If all keys are in cooldown, try them in earliest-expiry order anyway
  cooling.sort((a, b) => a.until - b.until);
  return [...ready, ...cooling.map(({ key, index }) => ({ key, index }))];
}

function shouldFailoverStatus(status: number): boolean {
  return (
    status === 401 ||
    status === 402 ||
    status === 403 ||
    status === 408 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    status === 529
  );
}

function parseRetryCooldownMs(res: Response, status: number): number {
  const retryHeader = res.headers.get('retry-after');
  if (retryHeader) {
    const secs = Number(retryHeader);
    if (Number.isFinite(secs) && secs > 0) {
      return Math.min(secs * 1000, 15 * 60_000);
    }
  }
  if (status === 401 || status === 402 || status === 403) return 15 * 60_000;
  if (status === 429) return 60_000;
  return 15_000;
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Failed to read image file.'));
    };
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Downscales large camera photos on a canvas to <= 1280px JPEG for sub-second upload
 * while staying well within Groq's 20MB / 2048-token vision budget.
 */
export async function prepareImageDataUrl(file: Blob): Promise<string> {
  const rawDataUrl = await readBlobAsDataUrl(file);
  if (file.size < 650_000 || typeof document === 'undefined' || typeof Image === 'undefined') {
    return rawDataUrl;
  }
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      const timer = setTimeout(() => reject(new Error('Image decode timeout')), 1500);
      el.onload = () => {
        clearTimeout(timer);
        resolve(el);
      };
      el.onerror = () => {
        clearTimeout(timer);
        reject(new Error('Image decode failed'));
      };
      el.src = rawDataUrl;
    });
    const maxDim = 1280;
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) return rawDataUrl;
    const scale = Math.min(1, maxDim / Math.max(w, h));
    if (scale === 1 && rawDataUrl.length < 900_000) {
      return rawDataUrl;
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return rawDataUrl;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const compressed = canvas.toDataURL('image/jpeg', 0.86);
    return compressed.startsWith('data:image/') ? compressed : rawDataUrl;
  } catch {
    return rawDataUrl;
  }
}

function extractBraceGroup(s: string, openIdx: number): { content: string; nextIdx: number } | null {
  if (s[openIdx] !== '{') return null;
  let depth = 0;
  for (let i = openIdx; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}') {
      depth--;
      if (depth === 0) {
        return { content: s.slice(openIdx + 1, i), nextIdx: i + 1 };
      }
    }
  }
  return null;
}

function readSubOrSupBound(s: string, idx: number): { content: string; nextIdx: number } | null {
  let i = idx;
  while (i < s.length && /\s/.test(s[i])) i++;
  if (s[i] === '{') return extractBraceGroup(s, i);
  const m = s.slice(i).match(/^(?:\\[a-zA-Z]+|-?[0-9]+(?:\.[0-9]+)?|[a-zA-Zπ](?:=[0-9a-zA-Z+-]+)?)/);
  if (!m) return null;
  return { content: m[0], nextIdx: i + m[0].length };
}

function replaceLatexConstructs(input: string): string {
  let s = input;
  for (let pass = 0; pass < 16; pass++) {
    let changed = false;

    // \int_{low}^{high} body dx
    const intMatch = s.match(/\\int\s*_/);
    if (intMatch && intMatch.index !== undefined) {
      const uIdx = s.indexOf('_', intMatch.index);
      const low = readSubOrSupBound(s, uIdx + 1);
      if (low) {
        let j = low.nextIdx;
        while (j < s.length && /\s/.test(s[j])) j++;
        if (s[j] === '^') {
          const high = readSubOrSupBound(s, j + 1);
          if (high) {
            const tail = s.slice(high.nextIdx);
            const dxMatch = tail.match(/^(.+?)\s*(?:\\,)?\s*d([a-zA-Z])\b/);
            if (dxMatch) {
              const afterDx = high.nextIdx + dxMatch[0].length;
              const dummyVar = dxMatch[2];
              let integrand = dxMatch[1].trim();
              if (dummyVar.toUpperCase() !== 'X') {
                integrand = integrand.replace(new RegExp(`(?<!\\\\)\\b${dummyVar}\\b`, 'g'), 'X');
              }
              s = `${s.slice(0, intMatch.index)}integ(${integrand},${low.content.trim()},${high.content.trim()})${s.slice(afterDx)}`;
              changed = true;
              continue;
            }
          }
        }
      }
    }

    // \sum_{x=low}^{high} body  OR  \prod_{x=low}^{high} body
    const sumProdMatch = s.match(/\\(sum|prod)\s*_/);
    if (sumProdMatch && sumProdMatch.index !== undefined) {
      const fnName = sumProdMatch[1] === 'prod' ? 'prod' : 'sigma';
      const uIdx = s.indexOf('_', sumProdMatch.index);
      const lowRaw = readSubOrSupBound(s, uIdx + 1);
      if (lowRaw) {
        let j = lowRaw.nextIdx;
        while (j < s.length && /\s/.test(s[j])) j++;
        if (s[j] === '^') {
          const high = readSubOrSupBound(s, j + 1);
          if (high) {
            const varMatch = lowRaw.content.trim().match(/^([a-zA-Z])\s*=\s*/);
            const dummyVar = varMatch ? varMatch[1] : null;
            const lowClean = lowRaw.content.replace(/^[a-zA-Z]\s*=\s*/, '').trim();
            let k = high.nextIdx;
            while (k < s.length && /\s/.test(s[k])) k++;
            let body = '';
            let restIdx = s.length;
            if (s[k] === '{') {
              const gb = extractBraceGroup(s, k);
              if (gb) {
                body = gb.content.trim();
                restIdx = gb.nextIdx;
              }
            }
            if (!body) {
              // Scan single summand/factor term up to top-level binary + / - / =
              let depth = 0;
              let idx = k;
              for (; idx < s.length; idx++) {
                const ch = s[idx];
                if (ch === '(' || ch === '{' || ch === '[') depth++;
                else if (ch === ')' || ch === '}' || ch === ']') {
                  if (depth === 0) break;
                  depth--;
                } else if (depth === 0 && idx > k && (ch === '+' || ch === '-' || ch === '=')) {
                  const prevNonSpace = s.slice(k, idx).trimEnd().slice(-1);
                  if (prevNonSpace && !'+-×*/^_('.includes(prevNonSpace)) break;
                }
              }
              body = s.slice(k, idx).trim();
              restIdx = idx;
            }
            if (body) {
              if (dummyVar && dummyVar.toUpperCase() !== 'X') {
                body = body.replace(new RegExp(`(?<!\\\\)\\b${dummyVar}\\b`, 'g'), 'X');
              }
              s = `${s.slice(0, sumProdMatch.index)}${fnName}(${body},${lowClean},${high.content.trim()})${s.slice(restIdx)}`;
              changed = true;
              continue;
            }
          }
        }
      }
    }

    // \binom{n}{r} -> (n)nCr(r)
    const binomMatch = s.match(/\\binom\s*\{/);
    if (binomMatch && binomMatch.index !== undefined) {
      const b1 = s.indexOf('{', binomMatch.index);
      const g1 = extractBraceGroup(s, b1);
      if (g1) {
        let j = g1.nextIdx;
        while (j < s.length && /\s/.test(s[j])) j++;
        const g2 = extractBraceGroup(s, j);
        if (g2) {
          const nPart = /^[0-9a-zA-Z]+$/.test(g1.content.trim()) ? g1.content.trim() : `(${g1.content.trim()})`;
          const rPart = /^[0-9a-zA-Z]+$/.test(g2.content.trim()) ? g2.content.trim() : `(${g2.content.trim()})`;
          s = `${s.slice(0, binomMatch.index)}${nPart}nCr${rPart}${s.slice(g2.nextIdx)}`;
          changed = true;
          continue;
        }
      }
    }

    // Mixed fraction: 2\frac{3}{4} or 12 \frac{1}{2} -> mfrac(2,3,4)
    const mfracMatch = s.match(/(?<![0-9a-zA-Z.\\])(\d+)\s*\\[dt]?frac\s*\{/);
    if (mfracMatch && mfracMatch.index !== undefined) {
      const whole = mfracMatch[1];
      const brace1Idx = s.indexOf('{', mfracMatch.index + whole.length);
      const g1 = extractBraceGroup(s, brace1Idx);
      if (g1) {
        let j = g1.nextIdx;
        while (j < s.length && /\s/.test(s[j])) j++;
        const g2 = extractBraceGroup(s, j);
        if (g2) {
          s = `${s.slice(0, mfracMatch.index)}mfrac(${whole},${g1.content},${g2.content})${s.slice(g2.nextIdx)}`;
          changed = true;
          continue;
        }
      }
    }

    // \frac{a}{b} or \dfrac{a}{b} or \tfrac{a}{b}
    const fracMatch = s.match(/\\[dt]?frac\s*\{/);
    if (fracMatch && fracMatch.index !== undefined) {
      const brace1Idx = s.indexOf('{', fracMatch.index);
      const g1 = extractBraceGroup(s, brace1Idx);
      if (g1) {
        let j = g1.nextIdx;
        while (j < s.length && /\s/.test(s[j])) j++;
        const g2 = extractBraceGroup(s, j);
        if (g2) {
          s = `${s.slice(0, fracMatch.index)}frac(${g1.content},${g2.content})${s.slice(g2.nextIdx)}`;
          changed = true;
          continue;
        }
      }
    }

    // \sqrt[n]{x}
    const rootMatch = s.match(/\\sqrt\s*\[([^\]]+)\]\s*\{/);
    if (rootMatch && rootMatch.index !== undefined) {
      const idxText = rootMatch[1];
      const braceIdx = s.indexOf('{', rootMatch.index + rootMatch[0].length - 1);
      const g = extractBraceGroup(s, braceIdx);
      if (g) {
        const replacement = idxText.trim() === '3' ? `cbrt(${g.content})` : `root(${idxText.trim()},${g.content})`;
        s = `${s.slice(0, rootMatch.index)}${replacement}${s.slice(g.nextIdx)}`;
        changed = true;
        continue;
      }
    }

    // \sqrt{x}
    const sqrtMatch = s.match(/\\sqrt\s*\{/);
    if (sqrtMatch && sqrtMatch.index !== undefined) {
      const braceIdx = s.indexOf('{', sqrtMatch.index);
      const g = extractBraceGroup(s, braceIdx);
      if (g) {
        s = `${s.slice(0, sqrtMatch.index)}sqrt(${g.content})${s.slice(g.nextIdx)}`;
        changed = true;
        continue;
      }
    }

    // \log_{b}{x}, \log_{b}(x), \log_2(8), \log_2 8
    const logbSub = s.match(/\\log\s*_/);
    if (logbSub && logbSub.index !== undefined) {
      const uIdx = s.indexOf('_', logbSub.index);
      const gb = readSubOrSupBound(s, uIdx + 1);
      if (gb) {
        let j = gb.nextIdx;
        while (j < s.length && /\s/.test(s[j])) j++;
        if (s[j] === '{') {
          const gx = extractBraceGroup(s, j);
          if (gx) {
            s = `${s.slice(0, logbSub.index)}logb(${gb.content.trim()},${gx.content})${s.slice(gx.nextIdx)}`;
            changed = true;
            continue;
          }
        } else if (s[j] === '(') {
          s = `${s.slice(0, logbSub.index)}logb(${gb.content.trim()},${s.slice(j + 1)}`;
          changed = true;
          continue;
        } else {
          const argMatch = s.slice(j).match(/^([0-9a-zA-Zπ.]+)/);
          if (argMatch) {
            s = `${s.slice(0, logbSub.index)}logb(${gb.content.trim()},${argMatch[1]})${s.slice(j + argMatch[1].length)}`;
            changed = true;
            continue;
          }
        }
      }
    }

    // ^{exp} -> ^(exp)
    const powBrace = s.match(/\^\s*\{/);
    if (powBrace && powBrace.index !== undefined) {
      const bIdx = s.indexOf('{', powBrace.index);
      const g = extractBraceGroup(s, bIdx);
      if (g) {
        s = `${s.slice(0, powBrace.index)}^(${g.content})${s.slice(g.nextIdx)}`;
        changed = true;
        continue;
      }
    }

    if (!changed) break;
  }
  return s;
}

/**
 * Normalizes LLM math output (Calcios 2D syntax, ASCII math, or stray LaTeX)
 * into clean, valid Calcios 2D Natural Math expression syntax.
 */
export function normalizeToCalcios2D(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^```[a-zA-Z]*\s*/, '').replace(/\s*```$/, '');
  s = s.replace(/^\$\$?/, '').replace(/\$\$?$/, '').trim();

  s = replaceLatexConstructs(s);

  s = s
    .replace(/\\left\s*\|([^|]+)\\right\s*\|/g, 'abs($1)')
    .replace(/\\left\s*/g, '')
    .replace(/\\right\s*/g, '')
    .replace(/\\cdot|\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\\pi\b/g, 'π')
    .replace(/\\angle/g, '∠')
    .replace(/\\arcsin|\\sin\s*\^\s*\{?-1\}?/g, 'asin')
    .replace(/\\arccos|\\cos\s*\^\s*\{?-1\}?/g, 'acos')
    .replace(/\\arctan|\\tan\s*\^\s*\{?-1\}?/g, 'atan')
    .replace(/\\(sinh|cosh|tanh|sin|cos|tan|ln|log)\b/g, '$1')
    .replace(/[−–—]/g, '-')
    .replace(/\*/g, '×');

  // Preserve sexagesimal DMS (e.g. 12°30'45" or 12°30′) as 12°30°45° while stripping standalone degree sign in sin(30°)
  s = s.replace(
    /(\d+)\s*°\s*(\d+)\s*(?:['′’]|°)(?:\s*(\d+(?:\.\d+)?)\s*(?:["″”]|''|°))?/g,
    (_m, deg: string, min: string, sec?: string) =>
      sec !== undefined ? `${deg}\uE000${min}\uE000${sec}\uE000` : `${deg}\uE000${min}\uE000`,
  );

  s = s.replace(/\|([^|]+)\|/g, 'abs($1)');
  s = s.replace(/\^(?!\()(-?[0-9a-zA-Zπ]+)/g, '^($1)');
  s = s.replace(/\bpi\b/gi, 'π');
  s = s.replace(/\bx\b/g, 'X').replace(/\by\b/g, 'Y');
  s = s.replace(/(\d)x\b/g, '$1X').replace(/(\d)y\b/g, '$1Y');
  s = s.replace(/\s*=\s*\??\s*$/, '');
  s = s.replace(/°/g, '').replace(/\uE000/g, '°');
  s = s.replace(/\s+/g, '');

  return s;
}

const VISION_SYSTEM_PROMPT = `You transcribe handwritten or printed math images and separately identify a calculator-ready expression.
Return ONLY valid JSON with this schema:
{
  "transcription": "<faithful transcription of the entire problem>",
  "expression": "<one calculator-ready expression, or empty string>",
  "mode": "COMP" | "CMPLX" | "STAT" | "BASE-N" | "EQN" | "MATRIX" | "TABLE" | "VECTOR" | "INEQ" | "VERIF" | "DIST" | "RATIO",
  "recommendedMode": "<one supported mode, or empty string>",
  "modeConfidence": 0.0,
  "modeData": { "<mode-specific fields>": "..." },
  "angle": "DEG" | "RAD" | null
}

Mode routing requirements:
- Use COMP for ordinary evaluation and equations with unknowns. Do not auto-solve equations: load them as editable expressions so the user can choose SOLVE.
- Use CMPLX only when the expression genuinely requires complex arithmetic.
- For specialized modes, set mode to that mode ONLY when modeData contains enough clearly read data to prefill its native workflow and modeConfidence is at least 0.85. Otherwise set mode to COMP, set recommendedMode to the best match, and keep the full text and any safe expression for review. Confidence is about the mode and every value to be prefilled, not merely the OCR text.
- modeData formats: TABLE {fExpr,gExpr,start,end,step}; STAT {subMode,rows:[{x,y,freq}]} where subMode is 1-VAR, A+BX, _+CX2, LN_X, E_X, AB_X, AX_B, or INV_X; EQN {type,coefficients} where type is lin2, lin3, quad, or cubic and coefficients are in calculator-entry order; INEQ {degree,relation,coefficients} with degree 2 or 3; MATRIX {matrices:{MatA:[[...]],MatB:[[...]]}}; VECTOR {vectors:{VctA:[...],VctB:[...]}}; DIST {subMode,params:[...]} where subMode is norm-pd, norm-cd, inv-norm, binom-pd, binom-cd, poisson-pd, or poisson-cd; RATIO {form,coefficients} where form is a:b=X:d or a:b=c:X; BASE-N {base} where base is DEC, HEX, BIN, or OCT; VERIF {expression}. Use numeric strings for coefficients/data. Never invent omitted values; if any required value is unclear, recommend the mode instead of activating it.

Transcription requirements:
- Transcribe ALL readable lines of the problem in order: prose, definitions, constraints, every equation/system, initial conditions, and the final question.
- Ignore calculator hardware labels and key legends (for example SHIFT, MODE, MATRIX, sin, or cos) unless they are visibly part of the printed/handwritten problem itself; never present the keypad's button layout as the problem.
- Do not summarize, solve, or omit earlier lines just because the final line looks like a standalone expression.
- Preserve the original mathematical meaning and line breaks. Mark genuinely uncertain handwriting as [unclear] instead of guessing.
- The transcription is for human review and may include notation that the calculator cannot evaluate.
- The separate expression field is only a best-effort single expression that fits this calculator's syntax. Never put only the requested limit/answer there when the image contains a larger problem. If no suitable standalone expression can be selected without losing meaning, return an empty string.

Calcios 2D expression syntax rules (use these exact templates):
- Stacked fraction: frac(num,den)  e.g. (1+sqrt(5))/2 -> frac(1+sqrt(5),2)
- Mixed fraction: mfrac(whole,num,den)
- Square root / cube root / nth root: sqrt(x), cbrt(x), root(n,x)
- Exponents: base^(exp)  e.g. X^(2), 2^(10), e^(X), 10^(3)
- Logarithm base b: logb(base,arg); base-10: log(x); natural log: ln(x)
- Absolute value: abs(x)
- Definite integral from a to b with respect to X: integ(body,a,b)  e.g. integ(cos(X),0,frac(π,2))
- Derivative at X=a: deriv(body,a)
- Summation from X=a to b: sigma(body,a,b)
- Product from X=a to b: prod(body,a,b)
- Trig & inverse trig: sin(x), cos(x), tan(x), asin(x), acos(x), atan(x), sinh(x), cosh(x), tanh(x)
- Operators & constants: +, -, ×, ÷, !, %, nCr, nPr, GCD(a,b), LCM(a,b), π, e
- Single-variable equations to solve: keep '=' with variable X, e.g. 2X+5=13 or X^(2)-5X+6=0. Strip trailing '=' or '=?' if the right side is blank.
- When the selected task is ordinary evaluation, use COMP; use CMPLX for genuine imaginary-number or phasor calculations. Do not replace a specialized mode selected above with COMP/CMPLX.
- Set "angle": "RAD" if trig/calculus clearly uses radians (like π), "DEG" if degrees (°) are shown, otherwise null.`;

async function sendTranscriptionFallbackRequest(
  apiUrl: string,
  model: string,
  apiKey: string,
  dataUrl: string,
): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  return fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: 'Transcribe the complete math problem in reading order: include prose, equations, conditions, initial values, and the final question. Ignore calculator keypad legends such as SHIFT, MODE, MATRIX, sin, and cos unless they are part of the problem text. Do not summarize or solve. Preserve line breaks. Mark uncertain words as [unclear]. Return plain transcription only.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Write out the complete problem exactly as shown. Do not return a blank answer.' },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      temperature: 0,
      max_completion_tokens: 1200,
    }),
  });
}

function cleanTranscription(value: string): string {
  return value
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, '')
    .replace(/\r\n?/g, '\n')
    .trim();
}

function parseModelObject(raw: string): Record<string, unknown> | null {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const value = JSON.parse(jsonMatch ? jsonMatch[0] : raw) as unknown;
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function readTextField(data: Record<string, unknown> | null, keys: readonly string[]): string {
  if (!data) return '';
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'string' && value.trim()) return value;
    if (Array.isArray(value)) {
      const joined = value
        .map((part) => {
          if (typeof part === 'string') return part;
          if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') return part.text;
          return '';
        })
        .filter(Boolean)
        .join('\n');
      if (joined.trim()) return joined;
    }
  }
  return '';
}

function readAssistantContent(payload: unknown): string {
  if (!payload || typeof payload !== 'object' || !('choices' in payload) || !Array.isArray(payload.choices)) return '';
  const firstChoice = payload.choices[0];
  if (!firstChoice || typeof firstChoice !== 'object' || !('message' in firstChoice)) return '';
  const message = firstChoice.message;
  if (!message || typeof message !== 'object' || !('content' in message)) return '';
  const content = message.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') return part.text;
        return '';
      })
      .filter(Boolean)
      .join('\n')
      .trim();
  }
  return '';
}

function lineCount(text: string): number {
  return text.split('\n').filter((line) => line.trim()).length;
}

const SCAN_MODES = ['COMP', 'CMPLX', 'STAT', 'BASE-N', 'EQN', 'MATRIX', 'TABLE', 'VECTOR', 'INEQ', 'VERIF', 'DIST', 'RATIO'] as const;
type ScanMode = typeof SCAN_MODES[number];

function readScanMode(value: unknown): ScanMode | undefined {
  return typeof value === 'string' && (SCAN_MODES as readonly string[]).includes(value)
    ? value as ScanMode
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNumericText(value: unknown): value is string | number {
  if (typeof value === 'number') return Number.isFinite(value);
  return typeof value === 'string' && /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim());
}

function numericList(value: unknown, min: number, max: number): value is Array<string | number> {
  return Array.isArray(value) && value.length >= min && value.length <= max && value.every(isNumericText);
}

function isMatrixData(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const names = Object.keys(value);
  if (names.length === 0 || names.some((name) => !['MatA', 'MatB', 'MatC'].includes(name))) return false;
  return Object.values(value).every((matrix) => Array.isArray(matrix)
    && matrix.length >= 1 && matrix.length <= 4
    && matrix.every((row) => numericList(row, 1, 4))
    && matrix.every((row) => row.length === matrix[0].length));
}

function hasUsableModeData(mode: ScanMode, raw: unknown, expression: string): boolean {
  const data = isRecord(raw) ? raw : {};
  switch (mode) {
    case 'COMP': return Boolean(expression);
    case 'CMPLX': return Boolean(expression);
    case 'BASE-N': return ['DEC', 'HEX', 'BIN', 'OCT'].includes(String(data.base)) && Boolean(expression);
    case 'TABLE': {
      const optionalNumber = (key: string) => data[key] === undefined || isNumericText(data[key]);
      return typeof data.fExpr === 'string' && Boolean(data.fExpr.trim())
        && (data.gExpr === undefined || typeof data.gExpr === 'string')
        && optionalNumber('start') && optionalNumber('end') && optionalNumber('step');
    }
    case 'STAT': {
      const validSubmode = ['1-VAR', 'A+BX', '_+CX2', 'LN_X', 'E_X', 'AB_X', 'AX_B', 'INV_X'].includes(String(data.subMode));
      const rows = data.rows;
      return validSubmode && Array.isArray(rows) && rows.length >= 2 && rows.length <= 80
        && rows.every((row) => {
          if (!isRecord(row) || !isNumericText(row.x)) return false;
          if (data.subMode !== '1-VAR' && !isNumericText(row.y)) return false;
          if (row.freq === undefined) return true;
          const frequency = Number(row.freq);
          return isNumericText(row.freq) && Number.isInteger(frequency) && frequency >= 0;
        });
    }
    case 'EQN': {
      const type = String(data.type);
      const size = type === 'lin2' ? 6 : type === 'lin3' ? 12 : type === 'quad' ? 3 : type === 'cubic' ? 4 : 0;
      return size > 0 && numericList(data.coefficients, size, size);
    }
    case 'INEQ': {
      const size = data.degree === 2 ? 3 : data.degree === 3 ? 4 : 0;
      return size > 0 && ['>', '<', '≥', '≤'].includes(String(data.relation))
        && numericList(data.coefficients, size, size);
    }
    case 'MATRIX': return isMatrixData(data.matrices);
    case 'VECTOR': {
      if (!isRecord(data.vectors)) return false;
      const names = Object.keys(data.vectors);
      return names.length > 0 && names.every((name) => ['VctA', 'VctB', 'VctC'].includes(name))
        && Object.values(data.vectors).every((coords) => numericList(coords, 2, 3));
    }
    case 'DIST': {
      const counts: Record<string, number> = { 'norm-pd': 3, 'norm-cd': 4, 'inv-norm': 3, 'binom-pd': 3, 'binom-cd': 3, 'poisson-pd': 2, 'poisson-cd': 2 };
      const modeCount = counts[String(data.subMode)];
      return Boolean(modeCount) && numericList(data.params, modeCount, modeCount);
    }
    case 'RATIO': return ['a:b=X:d', 'a:b=c:X'].includes(String(data.form)) && numericList(data.coefficients, 3, 3);
    case 'VERIF': return typeof data.expression === 'string' && Boolean(data.expression.trim());
    default: return false;
  }
}

function likelyQuestionOnlyTranscription(text: string): boolean {
  const trimmed = text.trim();
  const englishQuestion = /^(?:find|determine|calculate|evaluate|solve|what\s+is|compute|show\s+that|prove)\b/i.test(trimmed);
  const arabicQuestion = /^(?:احسب|أوجد|اوجد|حدد|حل)(?:\s|$)/.test(trimmed);
  return lineCount(trimmed) === 1 && trimmed.length < 240 && (englishQuestion || arabicQuestion);
}

/** Reject OCR that is predominantly calculator-panel labels rather than a problem. */
function looksLikeCalculatorKeypadNoise(text: string): boolean {
  const tokens = text.toLowerCase().match(/[a-z]+(?:\^-?\d+)?|[a-z]\d+|[0-9]+/g) ?? [];
  if (tokens.length < 6) return false;
  const keyLabels = new Set([
    'shift', 'alpha', 'mode', 'setup', 'opt', 'optn', 'calc', 'table', 'matrix', 'vector',
    'replay', 'menu', 'on', 'off', 'ac', 'del', 'ins', 'sto', 'rcl', 'eng',
  ]);
  const matches = tokens.filter((token) => keyLabels.has(token) || /^(?:sin|cos|tan)\^-?1$/.test(token));
  return new Set(matches).size >= 4 && matches.length / tokens.length >= 0.45;
}

function preferMoreCompleteTranscription(current: string, candidate: string): string {
  if (!candidate) return current;
  if (!current || lineCount(candidate) > lineCount(current) || candidate.length > current.length) return candidate;
  return current;
}

async function sendSingleKeyVisionRequest(
  apiUrl: string,
  model: string,
  apiKey: string,
  dataUrl: string,
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const baseBody: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: VISION_SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Transcribe the complete problem faithfully, then provide a separate calculator-ready expression only if one can be selected without losing the problem context.' },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
    temperature: 0.1,
    max_completion_tokens: 1200,
    response_format: { type: 'json_object' },
  };

  if (model.toLowerCase().includes('qwen3.8')) {
    baseBody.reasoning_effort = 'none';
  }

  let res = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(baseBody),
  });

  if (res.status === 400 && 'reasoning_effort' in baseBody) {
    const fallbackBody = { ...baseBody };
    delete fallbackBody.reasoning_effort;
    res = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(fallbackBody),
    });
  }

  return res;
}

/**
 * Scans a math problem image using the configured Vision endpoint and automatic
 * multi-key failover pool (e.g. GROQ_API_KEY_1 .. GROQ_API_KEY_5).
 */
export async function scanMathFromImage(
  file: Blob,
  options?: VisionRuntimeOptions,
): Promise<ScannedMathResult> {
  const apiUrl = normalizeEndpointUrl(options?.apiUrl ?? getConfiguredEndpointUrl());
  const model = (options?.model ?? getConfiguredModel()).trim() || DEFAULT_GROQ_MODEL;
  const keyPool = (options?.apiKeys ?? getConfiguredKeyPool()).map((k) => k.trim()).filter(Boolean);

  if (keyPool.length === 0 && isDirectGroqHost(apiUrl)) {
    throw new Error('Scanner unavailable (no API keys configured).');
  }

  const dataUrl = await prepareImageDataUrl(file);
  const now = Date.now();
  const candidates =
    keyPool.length > 0 ? orderCandidateKeys(keyPool, now) : [{ key: '', index: 0 }];

  let winningResponse: Response | null = null;
  let winningApiKey = '';
  let lastErrorDetail = 'Vision service temporarily unavailable.';

  for (let attempt = 0; attempt < candidates.length; attempt++) {
    const { key, index } = candidates[attempt];
    let res: Response;
    try {
      res = await sendSingleKeyVisionRequest(apiUrl, model, key, dataUrl);
    } catch (err) {
      lastErrorDetail = err instanceof Error ? err.message : 'Network error';
      if (keyPool.length > 1 && attempt < candidates.length - 1) {
        keyCooldownUntil.set(key, Date.now() + 15_000);
        activeKeyCursor = (index + 1) % keyPool.length;
        continue;
      }
      throw new Error(lastErrorDetail);
    }

    if (res.ok) {
      if (keyPool.length > 0) {
        activeKeyCursor = index;
        keyCooldownUntil.delete(key);
      }
      winningResponse = res;
      winningApiKey = key;
      break;
    }

    let detail = `HTTP ${res.status}`;
    try {
      const errJson = (await res.clone().json()) as { error?: { message?: string } };
      if (errJson?.error?.message) detail = errJson.error.message;
    } catch {
      // ignore parse failure
    }
    lastErrorDetail = detail;

    if (keyPool.length > 1 && shouldFailoverStatus(res.status)) {
      keyCooldownUntil.set(key, Date.now() + parseRetryCooldownMs(res, res.status));
      activeKeyCursor = (index + 1) % keyPool.length;
      continue;
    }

    // Non-failover HTTP status (e.g. 400 invalid image): fail immediately without poisoning healthy API keys
    throw new Error(detail);
  }

  if (!winningResponse) {
    throw new Error(lastErrorDetail);
  }

  const payload: unknown = await winningResponse.json();
  const rawContent = readAssistantContent(payload);
  if (!rawContent) {
    throw new Error('Vision model returned an empty response.');
  }

  const parsed = parseModelObject(rawContent);
  const expressionRaw = readTextField(parsed, ['expression', 'calculator_expression', 'math_expression']);
  const transcriptKeys = [
    'transcription',
    'problemText',
    'problem_text',
    'fullProblem',
    'full_problem',
    'ocr_text',
    'text',
    'problem',
  ] as const;
  let transcription = cleanTranscription(readTextField(parsed, transcriptKeys) || (parsed ? '' : rawContent));
  if (looksLikeCalculatorKeypadNoise(transcription)) transcription = '';

  // Retry when the transcription is missing, answer-only, or mostly calculator-panel labels.
  // A keypad dump is never suitable human-review text, even if the model also proposed an expression.
  if (!transcription || likelyQuestionOnlyTranscription(transcription)) {
    try {
      const fallbackResponse = await sendTranscriptionFallbackRequest(apiUrl, model, winningApiKey, dataUrl);
      if (fallbackResponse.ok) {
        const fallbackContent = readAssistantContent(await fallbackResponse.json());
        if (fallbackContent) {
          const fallbackParsed = parseModelObject(fallbackContent);
          const fallbackTranscription = cleanTranscription(
            readTextField(fallbackParsed, transcriptKeys) || (fallbackParsed ? '' : fallbackContent),
          );
          if (!looksLikeCalculatorKeypadNoise(fallbackTranscription)) {
            transcription = preferMoreCompleteTranscription(transcription, fallbackTranscription);
          }
        }
      }
    } catch {
      // Fall through to the explicit readable-text error or keep the best available transcription.
    }
  }

  if (!transcription) {
    throw new Error('The AI returned no readable text. Try a sharper, closer photo with the whole problem in frame.');
  }

  const rawAngle = typeof parsed?.angle === 'string' ? parsed.angle : null;
  const inferredDeg = /°/.test(expressionRaw);
  const normalizedExpr = normalizeToCalcios2D(expressionRaw);

  const detectedMode = readScanMode(parsed?.mode);
  const recommendedMode = readScanMode(parsed?.recommendedMode);
  const candidateModeData = isRecord(parsed?.modeData) ? parsed.modeData : null;
  const modeConfidence = typeof parsed?.modeConfidence === 'number' ? parsed.modeConfidence : 0;
  const autoFillMode = detectedMode
    && hasUsableModeData(detectedMode, candidateModeData, normalizedExpr)
    && (detectedMode === 'COMP' || detectedMode === 'CMPLX' || (modeConfidence >= 0.85 && modeConfidence <= 1))
    ? detectedMode
    : undefined;
  const isCmplx =
    (detectedMode === 'CMPLX' && Boolean(normalizedExpr)) ||
    normalizedExpr.includes('∠') ||
    /(^|[^a-zA-Z])i([^a-zA-Z]|$)/.test(normalizedExpr);

  const upperAngle = rawAngle ? rawAngle.toUpperCase() : null;
  let angle: AngleUnit | undefined;
  if (upperAngle === 'RAD') angle = 'RAD';
  else if (upperAngle === 'DEG' || inferredDeg) angle = 'DEG';
  else if (/(sin|cos|tan|integ)\(/.test(normalizedExpr) && normalizedExpr.includes('π')) {
    angle = 'RAD';
  }

  const selectedMode: ActiveMode = autoFillMode ?? (isCmplx ? 'CMPLX' : 'COMP');
  const fallbackRecommendation = detectedMode && detectedMode !== 'COMP' && !autoFillMode
    ? detectedMode
    : recommendedMode && recommendedMode !== selectedMode ? recommendedMode : undefined;
  let acceptedModeData: Record<string, unknown> | undefined;
  if (autoFillMode && autoFillMode !== 'COMP' && autoFillMode !== 'CMPLX' && candidateModeData) {
    acceptedModeData = { ...candidateModeData };
    if (autoFillMode === 'TABLE') {
      if (typeof acceptedModeData.fExpr === 'string') acceptedModeData.fExpr = normalizeToCalcios2D(acceptedModeData.fExpr);
      if (typeof acceptedModeData.gExpr === 'string') acceptedModeData.gExpr = normalizeToCalcios2D(acceptedModeData.gExpr);
    }
    if (autoFillMode === 'VERIF' && typeof acceptedModeData.expression === 'string') {
      acceptedModeData.expression = normalizeToCalcios2D(acceptedModeData.expression);
    }
  }

  return {
    expression: normalizedExpr,
    transcription,
    mode: selectedMode,
    ...(fallbackRecommendation ? { recommendedMode: fallbackRecommendation } : {}),
    ...(acceptedModeData ? { modeData: acceptedModeData } : {}),
    angle,
  };
}
