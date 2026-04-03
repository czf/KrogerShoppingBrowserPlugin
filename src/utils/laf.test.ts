import { describe, it, expect } from 'vitest';

// We test the staleness logic in isolation by re-implementing it
// (laf.ts uses fetch + window which is hard to unit-test fully without integration setup)

const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry { storeId: string; cachedAt: number }

function isCacheStale(cached: CacheEntry | null, cookieStoreId: string, now: number): boolean {
  if (!cached) return true;
  if (now - cached.cachedAt > CACHE_TTL_MS) return true;
  if (cookieStoreId !== '' && cookieStoreId !== cached.storeId) return true;
  return false;
}

describe('LAF cache staleness', () => {
  const NOW = 1_000_000_000;

  it('is stale when cache is null', () => {
    expect(isCacheStale(null, '12345', NOW)).toBe(true);
  });

  it('is fresh within TTL with matching store', () => {
    const cached = { storeId: '12345', cachedAt: NOW - 60_000 }; // 1 min old
    expect(isCacheStale(cached, '12345', NOW)).toBe(false);
  });

  it('is stale when TTL has expired', () => {
    const cached = { storeId: '12345', cachedAt: NOW - CACHE_TTL_MS - 1 };
    expect(isCacheStale(cached, '12345', NOW)).toBe(true);
  });

  it('is stale when store cookie changed', () => {
    const cached = { storeId: '11111', cachedAt: NOW - 60_000 };
    expect(isCacheStale(cached, '99999', NOW)).toBe(true);
  });

  it('is fresh when cookie is empty (not yet set)', () => {
    const cached = { storeId: '12345', cachedAt: NOW - 60_000 };
    // empty cookie string means we can't compare — treat as fresh
    expect(isCacheStale(cached, '', NOW)).toBe(false);
  });

  it('is fresh exactly at the TTL boundary', () => {
    const cached = { storeId: '12345', cachedAt: NOW - CACHE_TTL_MS };
    expect(isCacheStale(cached, '12345', NOW)).toBe(false);
  });

  it('is stale one millisecond past the TTL', () => {
    const cached = { storeId: '12345', cachedAt: NOW - CACHE_TTL_MS - 1 };
    expect(isCacheStale(cached, '12345', NOW)).toBe(true);
  });
});
