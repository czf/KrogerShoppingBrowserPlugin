import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchCoupons } from './couponApi';

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

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.useRealTimers();
});

it('sends multiple filter.status entries when statuses provided', async () => {
  vi.mocked(fetch).mockResolvedValue(makeResponse({
    data: { coupons: [] },
    meta: { coupons: { page: { hasMore: false }, filterSummaryByType: { totalCount: 0, newCouponsCount: 0, categories: { options: [] } } } },
  }));

  await fetchCoupons({ statuses: ['active', 'redeemed'] });
  expect(fetch).toHaveBeenCalledTimes(1);
  const calledUrl = (vi.mocked(fetch).mock.calls[0][0] as string);
  expect(calledUrl).toContain('filter.status=active');
  expect(calledUrl).toContain('filter.status=redeemed');
});

it("defaults to 'unclipped' when statuses not provided", async () => {
  vi.mocked(fetch).mockResolvedValue(makeResponse({
    data: { coupons: [] },
    meta: { coupons: { page: { hasMore: false }, filterSummaryByType: { totalCount: 0, newCouponsCount: 0, categories: { options: [] } } } },
  }));

  await fetchCoupons();
  const calledUrl = (vi.mocked(fetch).mock.calls[0][0] as string);
  expect(calledUrl).toContain('filter.status=unclipped');
});
