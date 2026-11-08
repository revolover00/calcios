import type { AngleUnit } from './value';

declare const __CALCIOS_KEY_POOL__: number[][] | undefined;
declare const __CALCIOS_GROQ_URL__: string | undefined;
declare const __CALCIOS_GROQ_MODEL__: string | undefined;

export const DEFAULT_GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
export const DEFAULT_GROQ_MODEL = 'qwen/qwen3.8-27b';

export interface VisionRuntimeOptions {
  apiUrl?: string;
  model?: string;
  apiKeys?: string[];
}

export interface ScannedMathResult {
  expression: string;
  mode: 'COMP' | 'CMPLX';
  angle?: AngleUnit;
}

export function encodeKeyShard(key: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < key.length; i++) {
    out.push(key.charCodeAt(i) ^ 0x5a ^ (i & 0x1f));
  }
  return out;
}

export function decodeKeyShard(shard: readonly number[]): string {
  let out = '';
  for (let i = 0; i < shard.length; i++) {
    out += String.fromCharCode(shard[i] ^ 0x5a ^ (i & 0x1f));
  }
  return out;
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
  const definedUrl = typeof __CALCIOS_GROQ_URL__ === 'string' ? __CALCIOS_GROQ_URL__ : '';
  const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  return normalizeEndpointUrl(definedUrl || metaEnv.VITE_GROQ_API_URL || DEFAULT_GROQ_API_URL);
}

export function getConfiguredModel(): string {
  const definedModel = typeof __CALCIOS_GROQ_MODEL__ === 'string' ? __CALCIOS_GROQ_MODEL__.trim() : '';
  const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  return definedModel || (metaEnv.VITE_GROQ_MODEL ?? '').trim() || DEFAULT_GROQ_MODEL;
}

export function getConfiguredKeyPool(): string[] {
  const keys: string[] = [];
  if (typeof __CALCIOS_KEY_POOL__ !== 'undefined' && Array.isArray(__CALCIOS_KEY_POOL__)) {
    for (const shard of __CALCIOS_KEY_POOL__) {
      const decoded = decodeKeyShard(shard).trim();
      if (decoded) keys.push(decoded);
    }
  }
  const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  for (let i = 1; i <= 5; i++) {
    const k = (metaEnv[`VITE_GROQ_API_KEY_${i}`] ?? '').trim();
    if (k) keys.push(k);
  }
  const csv = (metaEnv.VITE_GROQ_API_KEYS ?? '').trim();
  if (csv) {
    for (const part of csv.split(',')) {
      const trimmed = part.trim();
      if (trimmed) keys.push(trimmed);
    }
  }
  const single = (metaEnv.VITE_GROQ_API_KEY ?? '').trim();
  if (single) keys.push(single);

  return Array.from(new Set(keys));
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

  s = s.replace(/\|([^|]+)\|/g, 'abs($1)');
  s = s.replace(/\^(?!\()(-?[0-9a-zA-Zπ]+)/g, '^($1)');
  s = s.replace(/\bpi\b/gi, 'π');
  s = s.replace(/\bx\b/g, 'X').replace(/\by\b/g, 'Y');
  s = s.replace(/(\d)x\b/g, '$1X').replace(/(\d)y\b/g, '$1Y');
  s = s.replace(/\s*=\s*\??\s*$/, '');
  s = s.replace(/°/g, '');
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
  let lastErrorDetail = 'Vision service temporarily unavailable.';

  for (let attempt = 0; attempt < candidates.length; attempt++) {
    const { key, index } = candidates[attempt];
    try {
      const res = await sendSingleKeyVisionRequest(apiUrl, model, key, dataUrl);
      if (res.ok) {
        if (keyPool.length > 0) {
          activeKeyCursor = index;
          keyCooldownUntil.delete(key);
        }
        winningResponse = res;
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

      throw new Error(detail);
    } catch (err) {
      lastErrorDetail = err instanceof Error ? err.message : 'Network error';
      // On network failure when multiple keys exist, try next key before giving up
      if (keyPool.length > 1 && attempt < candidates.length - 1 && !(err instanceof Error && err.message.startsWith('HTTP 400'))) {
        keyCooldownUntil.set(key, Date.now() + 15_000);
        activeKeyCursor = (index + 1) % keyPool.length;
        continue;
      }
      if (attempt === candidates.length - 1) {
        throw new Error(lastErrorDetail);
      }
    }
  }

  if (!winningResponse) {
    throw new Error(lastErrorDetail);
  }

  const payload = (await winningResponse.json()) as {
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
