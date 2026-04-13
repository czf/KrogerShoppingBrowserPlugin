import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
vi.mock('./inPageFetch', () => ({ inPageFetch: vi.fn() }));
import { fetchCoupons } from './couponApi';
import { inPageFetch } from './inPageFetch';
const fetch = inPageFetch as unknown as typeof globalThis.fetch;
import type { KrogerCoupon } from './couponApi';

// Stub buildLafHeaders so it doesn't need a real browser session
vi.mock('./laf', () => ({
  buildLafHeaders: vi.fn().mockResolvedValue({ 'x-kroger-channel': 'WEB' }),
  resolveLaf: vi.fn().mockResolvedValue(null),
}));

function makeResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

const STUB_COUPON: KrogerCoupon = {
  id: 'c1',
  shortDescription: 'Test',
  expirationDate: '2026-05-01T00:00:00Z',
  imageUrl: '',
  title: 'Test Coupon',
  displayDescription: '',
  displayEndDate: '2026-04-25T00:00:00Z',
  displayStartDate: '2026-03-01T00:00:00Z',
  addedToCard: false,
  canBeAddedToCard: true,
  canBeRemoved: false,
  categories: [],
  brand: 'TestBrand',
  brandName: 'Test Brand',
  krogerCouponNumber: '123',
  specialSavings: [],
  modalities: [],
  requirementDescription: '',
};

describe('fetchCoupons — response parsing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Clear mocks between tests so call counts don't accumulate across cases
    vi.clearAllMocks();
    // inPageFetch module is mocked above; individual tests set its return values as needed
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('parses hasMore, totalCount, newCouponsCount, categoryOptions from meta', async () => {
    vi.mocked(fetch).mockResolvedValue(makeResponse({
      data: { coupons: [STUB_COUPON] },
      meta: {
        coupons: {
          page: { hasMore: true, offset: 0, size: 24 },
          filterSummaryByType: {
            totalCount: 240,
            newCouponsCount: 50,
            categories: { options: [{ id: 'abc_def', name: 'Beverages' }] },
          },
        },
      },
    }));

    const result = await fetchCoupons({ pageSize: 24 });
    expect(result.coupons).toHaveLength(1);
    expect(result.hasMore).toBe(true);
    expect(result.totalCount).toBe(240);
    expect(result.newCouponsCount).toBe(50);
    expect(result.categoryOptions).toEqual([{ id: 'abc_def', name: 'Beverages' }]);
    expect(result.categoriesDropped).toBe(false);
  });

  it('retries without categories on 500 and sets categoriesDropped', async () => {
    const successBody = {
      data: { coupons: [STUB_COUPON] },
      meta: { coupons: { page: { hasMore: false }, filterSummaryByType: { totalCount: 1, newCouponsCount: 0, categories: { options: [] } } } },
    };
    vi.mocked(fetch)
      .mockResolvedValueOnce(makeResponse({}, 500))
      .mockResolvedValueOnce(makeResponse(successBody));

    const result = await fetchCoupons({ categories: ['electronics'] });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.coupons).toHaveLength(1);
    expect(result.categoriesDropped).toBe(true);
  });

  it('falls back to coupons.length === pageSize when meta.page absent', async () => {
    const coupons = Array.from({ length: 24 }, (_, i) => ({ ...STUB_COUPON, id: String(i) }));
    vi.mocked(fetch).mockResolvedValue(makeResponse({ data: { coupons }, meta: {} }));

    const result = await fetchCoupons({ pageSize: 24 });
    expect(result.hasMore).toBe(true); // 24 === 24
    expect(result.totalCount).toBe(24); // fallback to coupons.length
    expect(result.newCouponsCount).toBe(0);
  });

  it('hasMore is false when last page is partial', async () => {
    const coupons = Array.from({ length: 10 }, (_, i) => ({ ...STUB_COUPON, id: String(i) }));
    vi.mocked(fetch).mockResolvedValue(makeResponse({ data: { coupons }, meta: {} }));

    const result = await fetchCoupons({ pageSize: 24 });
    expect(result.hasMore).toBe(false); // 10 !== 24
  });

  it('returns zeros on non-ok response with no category filter', async () => {
    vi.mocked(fetch).mockResolvedValue(makeResponse({}, 500));

    const result = await fetchCoupons(); // no categories → no retry
    expect(result.coupons).toHaveLength(0);
    expect(result.hasMore).toBe(false);
    expect(result.totalCount).toBe(0);
    expect(result.newCouponsCount).toBe(0);
    expect(result.categoriesDropped).toBe(false);
  });

  it('retries once on 400 then returns zeros', async () => {
    vi.mocked(fetch).mockResolvedValue(makeResponse({}, 400));

    const promise = fetchCoupons();
    await vi.advanceTimersByTimeAsync(1500);
    const result = await promise;

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.coupons).toHaveLength(0);
  });

  it('returns zeros on fetch exception', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

    const result = await fetchCoupons();
    expect(result.coupons).toHaveLength(0);
    expect(result.hasMore).toBe(false);
    expect(result.totalCount).toBe(0);
  });

  it('handles missing data.coupons gracefully', async () => {
    vi.mocked(fetch).mockResolvedValue(makeResponse({
      data: {},
      meta: { coupons: { page: { hasMore: false }, filterSummaryByType: { totalCount: 0, newCouponsCount: 0 } } },
    }));

    const result = await fetchCoupons();
    expect(result.coupons).toHaveLength(0);
    expect(result.hasMore).toBe(false);
    expect(result.totalCount).toBe(0);
  });
});
