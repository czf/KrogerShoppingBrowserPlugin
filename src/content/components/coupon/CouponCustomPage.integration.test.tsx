import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock couponApi before importing the component so imports resolve to mocks
vi.mock('../../../utils/couponApi', () => ({
  fetchCoupons: vi.fn(),
  clipCoupon: vi.fn(),
  fetchCouponFull: vi.fn(),
  fetchProductsByUpcs: vi.fn(),
}));

import { fetchCoupons, fetchCouponFull, fetchProductsByUpcs } from '../../../utils/couponApi';
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

describe('CouponCustomPage — integration', () => {
  beforeEach(() => {
    // preserve global stub implementations (chrome.*) while clearing call counts
    vi.clearAllMocks();
  });

  it('clicking a category triggers fetchCoupons with that category and preserves category scrollTop', async () => {
    // Initial load with categories (stable response)
    vi.mocked(fetchCoupons).mockResolvedValue({
      coupons: [makeCoupon('c1', 'Fresh Large Ripe Avocado')],
      hasMore: true,
      totalCount: 1,
      newCouponsCount: 0,
      categoryOptions: [
        { id: 'paper_id', name: 'Paper & Plastics' },
        { id: 'electronics_id', name: 'Electronics' },
      ],
      categoriesDropped: false,
    });

    const { container } = render(<CouponCustomPage />);

    // Wait for initial fetch to be invoked
    await waitFor(() => expect(fetchCoupons).toHaveBeenCalled());

    // Find the categories scrolling container (inline style maxHeight: 200px)
    const categoriesContainer = container.querySelector('div[style*="max-height: 200px"]') as HTMLElement;
    expect(categoriesContainer).toBeTruthy();

    // Wait for category rows to render inside the container
    await waitFor(() => expect(categoriesContainer.querySelectorAll('.kext-sidebar-label').length).toBeGreaterThan(0));

    const labelRow = categoriesContainer.querySelector('.kext-sidebar-label') as HTMLElement;
    const labelSpan = labelRow.querySelector('span') as HTMLElement;

    // Simulate scrolled position and click the label text (not the checkbox)
    categoriesContainer.scrollTop = 123;
    fireEvent.click(labelSpan);

    // Expect fetchCoupons was called again and the last call contained the category value (lowercased text)
    await waitFor(() => expect(fetchCoupons).toHaveBeenCalledTimes(2));
    const clickedText = labelSpan.textContent?.trim().toLowerCase();
    expect(fetchCoupons).toHaveBeenLastCalledWith(expect.objectContaining({ categories: expect.arrayContaining([clickedText]) }));

    // Ensure scrollTop was restored after toggle
    await waitFor(() => expect(categoriesContainer.scrollTop).toBe(123));
  });

  it('clicking a coupon opens modal and loads qualifying products via fetchCouponFull + fetchProductsByUpcs', async () => {
    vi.mocked(fetchCoupons).mockResolvedValue({
      coupons: [makeCoupon('c2', 'Test Coupon Title')],
      hasMore: false,
      totalCount: 1,
      newCouponsCount: 0,
      categoryOptions: [],
      categoriesDropped: false,
    });

    vi.mocked(fetchCouponFull).mockResolvedValue(['012345678901']);
    vi.mocked(fetchProductsByUpcs).mockResolvedValue([
      { id: 'p1', description: 'Avocado 3pk', imageUrl: '', price: '$3.99', shareLink: '/p/avocado/012345678901' },
    ]);

    render(<CouponCustomPage />);

    // Wait for coupon to appear
    await waitFor(() => expect(screen.getByText('Test Coupon Title')).toBeInTheDocument());

    // Click the title to open modal
    fireEvent.click(screen.getByText('Test Coupon Title'));

    await waitFor(() => expect(fetchCouponFull).toHaveBeenCalledWith('kc-c2'));
    await waitFor(() => expect(fetchProductsByUpcs).toHaveBeenCalledWith(['012345678901']));

    // Product should be rendered inside modal
    await waitFor(() => expect(screen.getByText('Avocado 3pk')).toBeInTheDocument());
  });

  it('scroll event triggers next-page fetch with increased offset', async () => {
    vi.mocked(fetchCoupons).mockImplementation(({ offset = 0 } = {}) => {
      if (offset === 0) {
        return Promise.resolve({
          coupons: [makeCoupon('c3', 'Page 1 Coupon')],
          hasMore: true,
          totalCount: 2,
          newCouponsCount: 0,
          categoryOptions: [],
          categoriesDropped: false,
        });
      }
      if (offset === 24) {
        return Promise.resolve({
          coupons: [makeCoupon('c4', 'Page 2 Coupon')],
          hasMore: false,
          totalCount: 2,
          newCouponsCount: 0,
          categoryOptions: [],
          categoriesDropped: false,
        });
      }
      return Promise.resolve({ coupons: [], hasMore: false, totalCount: 2, newCouponsCount: 0, categoryOptions: [], categoriesDropped: false });
    });

    const { container } = render(<CouponCustomPage />);

    await waitFor(() => expect(screen.getByText('Page 1 Coupon')).toBeInTheDocument());

    // Find sentinel element (inline style height: 48px)
    await waitFor(() => {
      const sentinel = Array.from(container.querySelectorAll('div')).find(el => (el as HTMLElement).style.height === '48px' || (el as HTMLElement).style.height === '48');
      if (!sentinel) throw new Error('sentinel not found');
    });

    const sentinel = Array.from(container.querySelectorAll('div')).find(el => (el as HTMLElement).style.height === '48px' || (el as HTMLElement).style.height === '48') as HTMLElement;

    // Ensure sentinel reports being in the viewport
    sentinel.getBoundingClientRect = () => ({ top: window.innerHeight - 10, bottom: window.innerHeight + 10, left: 0, right: 0, height: 48, width: 0 });

    window.dispatchEvent(new Event('scroll'));

    // Expect a subsequent fetch with offset set to PAGE_SIZE (24)
    await waitFor(() => expect(fetchCoupons).toHaveBeenCalledWith(expect.objectContaining({ offset: 24 })));
    // And the Page 2 coupon should be rendered eventually
    await waitFor(() => expect(screen.getByText('Page 2 Coupon')).toBeInTheDocument());
  });
});
