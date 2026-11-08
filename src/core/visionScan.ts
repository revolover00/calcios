import type { AngleUnit } from './value';

export const DEFAULT_GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
export const DEFAULT_GROQ_MODEL = 'qwen/qwen3.8-27b';
const VISION_STORAGE_KEY = 'calcios-vision-config-v1';

export interface VisionConfig {
  apiUrl: string;
  model: string;
  apiKey: string;
}

export interface ScannedMathResult {
  expression: string;
  mode: 'COMP' | 'CMPLX';
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

export function getEnvVisionDefaults(): VisionConfig {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  return {
    apiUrl: normalizeEndpointUrl(env.VITE_GROQ_API_URL ?? DEFAULT_GROQ_API_URL),
    model: (env.VITE_GROQ_MODEL ?? DEFAULT_GROQ_MODEL).trim() || DEFAULT_GROQ_MODEL,
    apiKey: (env.VITE_GROQ_API_KEY ?? '').trim(),
  };
}

export function loadVisionConfig(): VisionConfig {
  const defaults = getEnvVisionDefaults();
  try {
    const raw = window.localStorage.getItem(VISION_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<VisionConfig>;
    return {
      apiUrl: parsed.apiUrl?.trim() ? normalizeEndpointUrl(parsed.apiUrl) : defaults.apiUrl,
      model: parsed.model?.trim() ? parsed.model.trim() : defaults.model,
      apiKey: parsed.apiKey?.trim() ? parsed.apiKey.trim() : defaults.apiKey,
    };
  } catch {
    return defaults;
  }
}

export function saveVisionConfig(patch: Partial<VisionConfig>): VisionConfig {
  const current = loadVisionConfig();
  const next: VisionConfig = {
    apiUrl: patch.apiUrl !== undefined ? normalizeEndpointUrl(patch.apiUrl) : current.apiUrl,
    model: patch.model !== undefined ? (patch.model.trim() || DEFAULT_GROQ_MODEL) : current.model,
    apiKey: patch.apiKey !== undefined ? patch.apiKey.trim() : current.apiKey,
  };
  try {
    window.localStorage.setItem(VISION_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
  return next;
}

export function isDirectGroqHost(apiUrl: string): boolean {
  try {
    const u = new URL(apiUrl);
    return u.hostname.endsWith('groq.com');
  } catch {
    return apiUrl.includes('groq.com');
  }
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
  const m = s.slice(i).match(/^([^\s^_\\]+)/);
  if (!m) return null;
  return { content: m[1], nextIdx: i + m[1].length };
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
            const dxMatch = tail.match(/^(.+?)\s*(?:\\,)?\s*d[xX]\b/);
            if (dxMatch) {
              const afterDx = high.nextIdx + dxMatch[0].length;
              s = `${s.slice(0, intMatch.index)}integ(${dxMatch[1].trim()},${low.content.trim()},${high.content.trim()})${s.slice(afterDx)}`;
              changed = true;
              continue;
            }
          }
        }
      }
    }

    // \sum_{x=low}^{high} body
    const sumMatch = s.match(/\\sum\s*_/);
    if (sumMatch && sumMatch.index !== undefined) {
      const uIdx = s.indexOf('_', sumMatch.index);
      const lowRaw = readSubOrSupBound(s, uIdx + 1);
      if (lowRaw) {
        let j = lowRaw.nextIdx;
        while (j < s.length && /\s/.test(s[j])) j++;
        if (s[j] === '^') {
          const high = readSubOrSupBound(s, j + 1);
          if (high) {
            const lowClean = lowRaw.content.replace(/^[a-zA-Z]\s*=\s*/, '').trim();
            const body = s.slice(high.nextIdx).trim();
            s = `${s.slice(0, sumMatch.index)}sigma(${body},${lowClean},${high.content.trim()})`;
            changed = true;
            continue;
          }
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

    // \log_{b}{x} or \log_{b}(x)
    const logbBrace = s.match(/\\log\s*_\s*\{/);
    if (logbBrace && logbBrace.index !== undefined) {
      const bIdx = s.indexOf('{', logbBrace.index);
      const gb = extractBraceGroup(s, bIdx);
      if (gb) {
        let j = gb.nextIdx;
        while (j < s.length && /\s/.test(s[j])) j++;
        if (s[j] === '{') {
          const gx = extractBraceGroup(s, j);
          if (gx) {
            s = `${s.slice(0, logbBrace.index)}logb(${gb.content},${gx.content})${s.slice(gx.nextIdx)}`;
            changed = true;
            continue;
          }
        } else if (s[j] === '(') {
          s = `${s.slice(0, logbBrace.index)}logb(${gb.content},${s.slice(j + 1)}`;
          changed = true;
          continue;
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
  // Strip markdown code fences or $$ wrappers
  s = s.replace(/^```[a-zA-Z]*\s*/, '').replace(/\s*```$/, '');
  s = s.replace(/^\$\$?/, '').replace(/\$\$?$/, '').trim();

  s = replaceLatexConstructs(s);

  // Standard LaTeX & Unicode math symbol replacements
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

  // Convert |expr| (non-nested bars) into abs(expr)
  s = s.replace(/\|([^|]+)\|/g, 'abs($1)');

  // Bare caret exponents like X^2 or )^3 -> X^(2), )^(3)
  s = s.replace(/\^(?!\()(-?[0-9a-zA-Zπ]+)/g, '^($1)');

  // Replace standalone pi -> π and standalone lowercase x/y variable -> X/Y
  s = s.replace(/\bpi\b/gi, 'π');
  s = s.replace(/\bx\b/g, 'X').replace(/\by\b/g, 'Y');
  // Also handle implicit coefficient like 2x -> 2X, 3y -> 3Y (without touching 0x hex or exp)
  s = s.replace(/(\d)x\b/g, '$1X').replace(/(\d)y\b/g, '$1Y');

  // Remove trailing " = ?" or trailing "=" when nothing follows
  s = s.replace(/\s*=\s*\??\s*$/, '');
  // Remove degrees symbol if numeric trig argument (handled via angle unit)
  s = s.replace(/°/g, '');
  // Collapse whitespace
  s = s.replace(/\s+/g, '');

  return s;
}

const VISION_SYSTEM_PROMPT = `You convert an image of a handwritten or printed mathematical problem into a JSON object for the Calcios 2D scientific calculator.
Return ONLY valid JSON with this exact schema:
{
  "expression": "<Calcios 2D expression>",
  "mode": "COMP" | "CMPLX",
  "angle": "DEG" | "RAD" | null
}

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
- Complex numbers: set "mode": "CMPLX" when imaginary i or phasor ∠ is used (e.g. (1+i)÷(1-i)). Otherwise "mode": "COMP".
- Set "angle": "RAD" if trig/calculus clearly uses radians (like π), "DEG" if degrees (°) are shown, otherwise null.`;

export async function scanMathFromImage(
  file: Blob,
  overrideConfig?: Partial<VisionConfig>,
): Promise<ScannedMathResult> {
  const cfg = { ...loadVisionConfig(), ...overrideConfig };
  const apiUrl = normalizeEndpointUrl(cfg.apiUrl);
  const model = cfg.model.trim() || DEFAULT_GROQ_MODEL;
  const apiKey = cfg.apiKey.trim();

  if (!apiKey && isDirectGroqHost(apiUrl)) {
    throw new Error('Missing Groq API key. Configure VITE_GROQ_API_KEY in GitHub Environments or API Settings.');
  }

  const dataUrl = await prepareImageDataUrl(file);

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
          { type: 'text', text: 'Extract the mathematical problem from this image as Calcios JSON.' },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
    temperature: 0.1,
    max_completion_tokens: 300,
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

  // Fallback retry if a custom model/proxy rejects reasoning_effort
  if (res.status === 400 && 'reasoning_effort' in baseBody) {
    const fallbackBody = { ...baseBody };
    delete fallbackBody.reasoning_effort;
    res = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(fallbackBody),
    });
  }

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const errJson = (await res.json()) as { error?: { message?: string } };
      if (errJson?.error?.message) detail = errJson.error.message;
    } catch {
      // ignore parse failure
    }
    throw new Error(detail);
  }

  const payload = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const rawContent = payload.choices?.[0]?.message?.content?.trim() ?? '';
  if (!rawContent) {
    throw new Error('Vision model returned an empty response.');
  }

  let parsed: { expression?: string; mode?: string; angle?: string | null };
  try {
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawContent) as {
      expression?: string;
      mode?: string;
      angle?: string | null;
    };
  } catch {
    parsed = { expression: rawContent };
  }

  const rawAngle = parsed.angle ?? null;
  const inferredDeg = /°/.test(parsed.expression ?? '');
  const normalizedExpr = normalizeToCalcios2D(parsed.expression ?? '');
  if (!normalizedExpr) {
    throw new Error('No math problem detected in image.');
  }

  const isCmplx =
    parsed.mode === 'CMPLX' ||
    normalizedExpr.includes('∠') ||
    /(^|[^a-zA-Z])i([^a-zA-Z]|$)/.test(normalizedExpr);

  const upperAngle = rawAngle ? rawAngle.toUpperCase() : null;
  let angle: AngleUnit | undefined;
  if (upperAngle === 'RAD') angle = 'RAD';
  else if (upperAngle === 'DEG' || inferredDeg) angle = 'DEG';
  else if (/(sin|cos|tan|integ)\(/.test(normalizedExpr) && normalizedExpr.includes('π')) {
    angle = 'RAD';
  }

  return {
    expression: normalizedExpr,
    mode: isCmplx ? 'CMPLX' : 'COMP',
    angle,
  };
}
