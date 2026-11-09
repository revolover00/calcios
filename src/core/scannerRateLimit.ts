export const SCANNER_RATE_LIMIT = 10;
export const SCANNER_RATE_WINDOW_MS = 60 * 60 * 1000;
export const SCANNER_RATE_STORAGE_KEY = 'calcios-scanner-rate-limit-v1';

export interface ScannerQuota {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

type TimestampStorage = Pick<Storage, 'getItem' | 'setItem'>;

let fallbackTimestamps: number[] = [];

function browserStorage(): TimestampStorage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

function readTimestamps(now: number, storage: TimestampStorage | undefined): number[] {
  const floor = now - SCANNER_RATE_WINDOW_MS;
  let values: unknown;
  try {
    if (!storage) {
      values = fallbackTimestamps;
    } else {
      const raw = storage.getItem(SCANNER_RATE_STORAGE_KEY);
      values = raw === null ? [] : JSON.parse(raw);
    }
  } catch {
    values = fallbackTimestamps;
  }
  if (!Array.isArray(values)) return [];
  return values.filter((value): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value <= now && value > floor,
  );
}

function saveTimestamps(values: number[], storage: TimestampStorage | undefined): void {
  fallbackTimestamps = values;
  try {
    storage?.setItem(SCANNER_RATE_STORAGE_KEY, JSON.stringify(values));
  } catch {
    // Keep an in-memory limit if browser storage is disabled or full.
  }
}

export function getScannerQuota(now = Date.now(), storage = browserStorage()): ScannerQuota {
  const timestamps = readTimestamps(now, storage);
  const retryAfterMs = timestamps.length >= SCANNER_RATE_LIMIT
    ? Math.max(0, timestamps[0] + SCANNER_RATE_WINDOW_MS - now)
    : 0;
  return {
    allowed: timestamps.length < SCANNER_RATE_LIMIT,
    remaining: Math.max(0, SCANNER_RATE_LIMIT - timestamps.length),
    retryAfterMs,
  };
}

/** Records one scan attempt and enforces a best-effort per-browser rolling-window quota. */
export function consumeScannerQuota(now = Date.now(), storage = browserStorage()): ScannerQuota {
  const timestamps = readTimestamps(now, storage);
  if (timestamps.length >= SCANNER_RATE_LIMIT) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(0, timestamps[0] + SCANNER_RATE_WINDOW_MS - now),
    };
  }
  timestamps.push(now);
  saveTimestamps(timestamps, storage);
  return { allowed: true, remaining: SCANNER_RATE_LIMIT - timestamps.length, retryAfterMs: 0 };
}

export function resetScannerQuotaForTests(): void {
  fallbackTimestamps = [];
}
