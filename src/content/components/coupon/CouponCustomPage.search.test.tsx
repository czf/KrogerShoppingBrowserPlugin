import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock couponApi before importing the component so imports resolve to mocks
vi.mock('../../../utils/couponApi', () => ({
  fetchCoupons: vi.fn().mockResolvedValue({
    coupons: [], hasMore: false, totalCount: 0, newCouponsCount: 0, categoryOptions: [], categoriesDropped: false,
  }),
  clipCoupon: vi.fn(),
  fetchCouponFull: vi.fn(),
  fetchProductsByUpcs: vi.fn(),
}));

import { fetchCoupons } from '../../../utils/couponApi';
import { CouponCustomPage } from './CouponCustomPage';

describe('CouponCustomPage — search input integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls fetchCoupons with filter.searchString after debounce', async () => {
    render(<CouponCustomPage />);
    const input = screen.getByPlaceholderText('Search coupons...');
    fireEvent.change(input, { target: { value: 'banana' } });
    // advance past the debounce (300ms)
    await vi.advanceTimersByTimeAsync(350);

    expect(fetchCoupons).toHaveBeenCalled();
    expect(fetchCoupons).toHaveBeenLastCalledWith(expect.objectContaining({ searchString: 'banana' }));
  });
});
