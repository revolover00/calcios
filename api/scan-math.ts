import { proxyVisionRequest } from '../src/server/groqProxy.js';

interface VercelRequestLike {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

interface VercelResponseLike {
  setHeader(name: string, value: string): void;
  status(code: number): VercelResponseLike;
  json(body: unknown): VercelResponseLike;
}

export const config = {
  api: {
    bodyParser: { sizeLimit: '4mb' },
  },
};

const RATE_WINDOW_MS = 10 * 60_000;
const RATE_LIMIT = 20;
const requestWindows = new Map<string, { startedAt: number; count: number }>();

function headerValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function allowScanRequest(req: VercelRequestLike): boolean {
  const forwardedFor = headerValue(req.headers['x-forwarded-for']);
  const clientIp = forwardedFor.split(',')[0]?.trim() || headerValue(req.headers['x-real-ip']) || 'unknown';
  const now = Date.now();
  if (requestWindows.size > 1000) {
    requestWindows.forEach((entry, ip) => {
      if (now - entry.startedAt >= RATE_WINDOW_MS) requestWindows.delete(ip);
    });
  }
  const window = requestWindows.get(clientIp);
  if (!window || now - window.startedAt >= RATE_WINDOW_MS) {
    if (requestWindows.size >= 5000) {
      const oldestIp = requestWindows.keys().next().value;
      if (oldestIp) requestWindows.delete(oldestIp);
    }
    requestWindows.set(clientIp, { startedAt: now, count: 1 });
    return true;
  }
  if (window.count >= RATE_LIMIT) return false;
  window.count++;
  return true;
}

export default async function handler(req: VercelRequestLike, res: VercelResponseLike): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: { message: 'Method not allowed.' } });
    return;
  }

  if (!allowScanRequest(req)) {
    res.status(429).json({ error: { message: 'Too many scan requests. Try again in a few minutes.' } });
    return;
  }

  const origin = headerValue(req.headers.origin);
  const requestHost = headerValue(req.headers['x-forwarded-host']) || headerValue(req.headers.host);
  if (origin && requestHost) {
    try {
      if (new URL(origin).host !== requestHost.split(',')[0].trim()) {
        res.status(403).json({ error: { message: 'Cross-origin scanner requests are not allowed.' } });
        return;
      }
    } catch {
      res.status(403).json({ error: { message: 'Invalid request origin.' } });
      return;
    }
  }

  const result = await proxyVisionRequest(req.body, process.env);
  res.status(result.status).json(result.body);
}
