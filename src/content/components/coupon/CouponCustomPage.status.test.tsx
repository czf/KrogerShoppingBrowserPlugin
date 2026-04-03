import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock couponApi before importing the component so imports resolve to mocks
vi.mock('../../../utils/couponApi', () => ({
  fetchCoupons: vi.fn(),
  clipCoupon: vi.fn(),
  fetchCouponFull: vi.fn(),
  fetchProductsByUpcs: vi.fn(),
}));

import { fetchCoupons } from '../../../utils/couponApi';
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

describe('CouponCustomPage — status filters & scroll-to-top', () => {
  beforeEach(() => {
    // preserve global stub implementations while clearing call counts
    vi.clearAllMocks();
  });

  it('toggling status checkboxes triggers fetchCoupons with statuses array', async () => {
    vi.mocked(fetchCoupons).mockResolvedValue({
      coupons: [makeCoupon('s1', 'Status Test Coupon')],
      hasMore: false,
      totalCount: 1,
      newCouponsCount: 0,
      categoryOptions: [],
      categoriesDropped: false,
    });

    render(<CouponCustomPage />);

    await waitFor(() => expect(fetchCoupons).toHaveBeenCalled());

    const activeCheckbox = screen.getByLabelText('Active') as HTMLInputElement;
    fireEvent.click(activeCheckbox);

    await waitFor(() => expect(fetchCoupons).toHaveBeenCalledTimes(2));
    expect(fetchCoupons).toHaveBeenLastCalledWith(expect.objectContaining({ statuses: expect.arrayContaining(['active', 'unclipped']) }));
  });

  it('shows scroll-to-top and clicking it calls window.scrollTo', async () => {
    vi.mocked(fetchCoupons).mockResolvedValue({
      coupons: [makeCoupon('s2', 'Scroll Test Coupon')],
      hasMore: false,
      totalCount: 1,
      newCouponsCount: 0,
      categoryOptions: [],
      categoriesDropped: false,
    });

    render(<CouponCustomPage />);

    await waitFor(() => expect(fetchCoupons).toHaveBeenCalled());

    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const originalScrollY = window.scrollY;
    Object.defineProperty(window, 'scrollY', { value: 500, configurable: true });
    window.dispatchEvent(new Event('scroll'));

    await waitFor(() => expect(screen.getByLabelText('Scroll to top')).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText('Scroll to top'));
    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });

    scrollToSpy.mockRestore();
    Object.defineProperty(window, 'scrollY', { value: originalScrollY, configurable: true });
  });
});
