import { beforeEach, describe, expect, it } from 'vitest';
import {
  consumeScannerQuota,
  getScannerQuota,
  resetScannerQuotaForTests,
  SCANNER_RATE_LIMIT,
  SCANNER_RATE_STORAGE_KEY,
  SCANNER_RATE_WINDOW_MS,
} from './scannerRateLimit';

function makeStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe('scanner rolling-window rate limit', () => {
  beforeEach(resetScannerQuotaForTests);

  it('allows the configured number of scans and blocks any additional scan in the hour', () => {
    const storage = makeStorage();
    const now = 1_000_000;
    for (let i = 0; i < SCANNER_RATE_LIMIT; i++) {
      expect(consumeScannerQuota(now + i, storage).allowed).toBe(true);
    }
    const blocked = consumeScannerQuota(now + SCANNER_RATE_LIMIT, storage);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterMs).toBe(SCANNER_RATE_WINDOW_MS - SCANNER_RATE_LIMIT);
    expect(getScannerQuota(now + SCANNER_RATE_LIMIT, storage).allowed).toBe(false);
  });

  it('restores quota as old scan attempts expire from the rolling hour', () => {
    const storage = makeStorage();
    const first = 2_000_000;
    for (let i = 0; i < SCANNER_RATE_LIMIT; i++) consumeScannerQuota(first + i, storage);

    const afterExpiry = first + SCANNER_RATE_WINDOW_MS + SCANNER_RATE_LIMIT;
    expect(getScannerQuota(afterExpiry, storage).allowed).toBe(true);
    expect(consumeScannerQuota(afterExpiry, storage)).toMatchObject({ allowed: true, remaining: 9 });
  });

  it('ignores malformed and future timestamps rather than locking scanning indefinitely', () => {
    const storage = makeStorage();
    storage.setItem(SCANNER_RATE_STORAGE_KEY, JSON.stringify(['invalid', 5_001, 9_000]));
    expect(getScannerQuota(5_000, storage)).toMatchObject({ allowed: true, remaining: SCANNER_RATE_LIMIT });
  });
});
