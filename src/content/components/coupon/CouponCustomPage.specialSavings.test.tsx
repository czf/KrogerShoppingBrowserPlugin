import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock couponApi and storage before importing the component
vi.mock('../../../utils/couponApi', () => ({
  fetchCoupons: vi.fn(),
  clipCoupon: vi.fn(),
  fetchCouponFull: vi.fn(),
  fetchProductsByUpcs: vi.fn(),
}));
vi.mock('../../../utils/storage', () => ({
  getCouponFilters: vi.fn(),
  setCouponFilters: vi.fn(),
}));

import { fetchCoupons } from '../../../utils/couponApi';
import { getCouponFilters } from '../../../utils/storage';
import { CouponCustomPage } from './CouponCustomPage';

function makeCoupon(id: string, title = 'Sample Coupon') {
  return {
    id,
    imageUrl: 'http://example.com/img.png',
    title,
    shortDescription: title,
    displayDescription: '',
    expirationDate: '2026-01-01T00:00:00Z',
    displayEndDate: '',
    displayStartDate: '',
    addedToCard: false,
    canBeAddedToCard: true,
    canBeRemoved: false,
    categories: [],
    brand: 'Brand',
    brandName: 'Brand',
    krogerCouponNumber: `kc-${id}`,
    specialSavings: [],
    modalities: [],
    requirementDescription: '',
  };
}

describe('CouponCustomPage — specialSavings mapping/race', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies mapped special when mapping appears while user toggles a special', async () => {
    vi.mocked(getCouponFilters).mockResolvedValue([]);

    const initial = {
      coupons: [], hasMore: false, totalCount: 0, newCouponsCount: 0,
      categoryOptions: [], specialSavingsOptions: [], categoriesDropped: false,
    } as Awaited<ReturnType<typeof fetchCoupons>>;

    const withMapping = {
      coupons: [], hasMore: false, totalCount: 0, newCouponsCount: 0,
      categoryOptions: [], specialSavingsOptions: [{ name: 'bonus', displayName: 'Bonus Digital Deals' }], categoriesDropped: false,
    } as Awaited<ReturnType<typeof fetchCoupons>>;

    const mappedApplied = {
      coupons: [makeCoupon('m1', 'Mapped Coupon')], hasMore: false, totalCount: 1, newCouponsCount: 0,
      categoryOptions: [], specialSavingsOptions: [{ name: 'bonus', displayName: 'Bonus Digital Deals' }], categoriesDropped: false,
    } as Awaited<ReturnType<typeof fetchCoupons>>;

    let call = 0;
    vi.mocked(fetchCoupons).mockImplementation(async () => {
      call += 1;
      if (call === 1) return initial; // initial mount
      if (call === 2) return withMapping; // prefetch triggered by toggle (populates mapping)
      return mappedApplied; // final fetch with mapped special
    });

    render(<CouponCustomPage />);

    // Wait for initial load
    await waitFor(() => expect(fetchCoupons).toHaveBeenCalled());

    // Click the fallback special pill (present in the hardcoded list)
    fireEvent.click(screen.getByText('Bonus Digital Deals'));

    // Eventually a fetch should be made with the mapped internal name 'bonus'
    await waitFor(() => expect(fetchCoupons).toHaveBeenCalledWith(expect.objectContaining({ specialSavings: expect.arrayContaining(['bonus']) })));

    // And the mapped coupon from the final call should appear in the UI
    await waitFor(() => expect(screen.getByText('Mapped Coupon')).toBeInTheDocument());
  });
});
