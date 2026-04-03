import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getFeatureFlags, setFeatureFlags, getCouponFilters, setCouponFilters, DEFAULT_FLAGS } from './storage';

// chrome stub is set up in src/test/setup.ts

describe('getFeatureFlags', () => {
  it('returns DEFAULT_FLAGS merged with stored values', async () => {
    vi.mocked(chrome.storage.sync.get).mockImplementation((_key, cb) => {
      (cb as (r: Record<string, unknown>) => void)({ krogerExtFlags: { couponCustomPage: true } });
    });
    const flags = await getFeatureFlags();
    expect(flags.couponCustomPage).toBe(true);
    expect(flags.removeSponsored).toBe(DEFAULT_FLAGS.removeSponsored); // other flags stay default
  });

  it('returns DEFAULT_FLAGS when storage is empty', async () => {
    vi.mocked(chrome.storage.sync.get).mockImplementation((_key, cb) => {
      (cb as (r: Record<string, unknown>) => void)({});
    });
    const flags = await getFeatureFlags();
    expect(flags).toEqual(DEFAULT_FLAGS);
  });

  it('returns DEFAULT_FLAGS when chrome context is invalid', async () => {
    vi.mocked(chrome.storage.sync.get).mockImplementation(() => {
      throw new Error('No extension context');
    });
    const flags = await getFeatureFlags();
    expect(flags).toEqual(DEFAULT_FLAGS);
  });
});

describe('setFeatureFlags', () => {
  it('merges with existing flags before saving', async () => {
    vi.mocked(chrome.storage.sync.get).mockImplementation((_key, cb) => {
      (cb as (r: Record<string, unknown>) => void)({ krogerExtFlags: { couponCustomPage: false } });
    });
    let saved: unknown;
    vi.mocked(chrome.storage.sync.set).mockImplementation((data, cb) => {
      saved = data;
      if (cb) (cb as () => void)();
    });

    await setFeatureFlags({ couponCustomPage: true });

    expect((saved as Record<string, unknown>)['krogerExtFlags']).toMatchObject({
      couponCustomPage: true,
      removeSponsored: DEFAULT_FLAGS.removeSponsored,
    });
  });
});

describe('getCouponFilters', () => {
  it('returns stored array', async () => {
    vi.mocked(chrome.storage.sync.get).mockImplementation((_key, cb) => {
      (cb as (r: Record<string, unknown>) => void)({ krogerExtCouponFilters: ['sort:expiration', 'modality:IN_STORE'] });
    });
    const filters = await getCouponFilters();
    expect(filters).toEqual(['sort:expiration', 'modality:IN_STORE']);
  });

  it('returns empty array when nothing stored', async () => {
    vi.mocked(chrome.storage.sync.get).mockImplementation((_key, cb) => {
      (cb as (r: Record<string, unknown>) => void)({});
    });
    const filters = await getCouponFilters();
    expect(filters).toEqual([]);
  });

  it('returns empty array when stored value is not an array', async () => {
    vi.mocked(chrome.storage.sync.get).mockImplementation((_key, cb) => {
      (cb as (r: Record<string, unknown>) => void)({ krogerExtCouponFilters: 'bad' });
    });
    const filters = await getCouponFilters();
    expect(filters).toEqual([]);
  });
});

describe('setCouponFilters', () => {
  it('persists the provided array', async () => {
    let saved: unknown;
    vi.mocked(chrome.storage.sync.set).mockImplementation((data, cb) => {
      saved = data;
      if (cb) (cb as () => void)();
    });

    await setCouponFilters(['sort:expiration', 'modality:IN_STORE']);

    expect((saved as Record<string, unknown>)['krogerExtCouponFilters']).toEqual([
      'sort:expiration',
      'modality:IN_STORE',
    ]);
  });
});

// Reset mocks to defaults between tests so they don't bleed
beforeEach(() => {
  vi.mocked(chrome.storage.sync.get).mockImplementation((_key, cb) => {
    (cb as (r: Record<string, unknown>) => void)({});
  });
  vi.mocked(chrome.storage.sync.set).mockImplementation((_data, cb) => {
    if (cb) (cb as () => void)();
  });
});
