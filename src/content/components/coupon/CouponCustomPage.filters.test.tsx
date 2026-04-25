
import { render, screen, waitFor } from '@testing-library/react';
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

type FetchResult = Awaited<ReturnType<typeof fetchCoupons>>;
type FetchArgs = Parameters<typeof fetchCoupons>[0];

interface TestCoupon {
  id: string;
  title: string;
  brandName: string;
  merchantName: string;
  savingsText: string;
  priceText: string;
  imageUrl: string;
}

function makeCoupon(id: string, title: string, brand: string): TestCoupon {
  return {
    id,
    title,
    brandName: brand,
    merchantName: brand,
    savingsText: '$1.00',
    priceText: '$3.99',
    imageUrl: '',
  };
}

describe('CouponCustomPage - filters integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies preselected modalities and onlyNew server-side, excludes brand client-side and does not send excludedBrands to API', async () => {
    // Preselected persisted filters: exclude brand Acme, modality IN_STORE, special savings mapped to 'Bonus Digital Deals', and onlyNew true
    vi.mocked(getCouponFilters).mockResolvedValue([
      'excludeBrand:Acme',
      'modality:IN_STORE',
      'special:Bonus Digital Deals',
      'newOnly:true',
    ]);

    // fetchCoupons returns meta that includes the mapping for the special savings option
    vi.mocked(fetchCoupons).mockResolvedValue({
      coupons: [makeCoupon('c1', 'Acme Coupon', 'Acme'), makeCoupon('c2', 'Other Coupon', 'Other')],
      hasMore: false,
      totalCount: 2,
      newCouponsCount: 0,
      categoryOptions: [],
      specialSavingsOptions: [{ name: 'bonus', displayName: 'Bonus Digital Deals' }],
      categoriesDropped: false,
    } as unknown as FetchResult);

    render(<CouponCustomPage />);

    await waitFor(() => expect(fetchCoupons).toHaveBeenCalled());

    const calls = vi.mocked(fetchCoupons).mock.calls.map((c) => c[0] as FetchArgs | undefined);

    // Ensure a call included the modality and onlyNew
    expect(calls.some((a) => (a?.modalities?.includes('IN_STORE')) ?? false)).toBe(true);
    expect(calls.some((a) => a?.onlyNew === true)).toBe(true);

    // Ensure specialSavings was sent as the internal name 'bonus' (mapped from displayName)
    expect(calls.some((a) => (a?.specialSavings?.includes('bonus')) ?? false)).toBe(true);

    // Ensure excludedBrands is never sent to the API
    for (const a of calls) {
      expect(Object.prototype.hasOwnProperty.call(a as object, 'excludedBrands')).toBe(false);
    }

    // UI should not display the excluded brand coupon (client-side exclusion)
    await waitFor(() => {
      expect(screen.queryByText('Acme Coupon')).not.toBeInTheDocument();
      expect(screen.getByText('Other Coupon')).toBeInTheDocument();
    });
  });

  it('preselected specialSavings that are not available in initial meta are shown preselected but not applied to API calls', async () => {
    vi.mocked(getCouponFilters).mockResolvedValue(['special:5X Event']);

    // initial response has no specialSavingsOptions (mapping not available)
    vi.mocked(fetchCoupons).mockResolvedValue({
      coupons: [makeCoupon('c1', 'Test Coupon', 'Brand')],
      hasMore: false,
      totalCount: 1,
      newCouponsCount: 0,
      categoryOptions: [],
      specialSavingsOptions: [],
      categoriesDropped: false,
    } as unknown as FetchResult);

    render(<CouponCustomPage />);

    await waitFor(() => expect(fetchCoupons).toHaveBeenCalled());

    const calls = vi.mocked(fetchCoupons).mock.calls.map((c) => c[0] as FetchArgs | undefined);

    // No call should include a non-empty specialSavings array (because mapping wasn't available)
    expect(calls.every((a) => !(a?.specialSavings && a.specialSavings.length > 0))).toBe(true);

    // The UI should show the preselected special pill (dashed or preselected state) - at least the label should be present
    // The component renders the special savings chips by their display names; ensure the preselected text is present
    expect(screen.getAllByText('5X Event').length).toBeGreaterThan(0);
  });
});
