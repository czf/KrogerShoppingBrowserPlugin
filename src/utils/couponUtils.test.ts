import { describe, it, expect } from 'vitest';
import { formatExpiry, filterCoupons, sortCoupons, parseStoredFilters, buildStoredFilters } from './couponUtils';
import type { KrogerCoupon } from './couponApi';

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeCoupon(overrides: Partial<KrogerCoupon> = {}): KrogerCoupon {
  return {
    id: 'c1',
    imageUrl: '',
    title: 'Save $1 on Cereal',
    shortDescription: '$1 off cereal',
    displayDescription: '$1 off any cereal',
    expirationDate: '2030-01-01T00:00:00Z',
    displayEndDate: '2030-01-01T00:00:00Z',
    displayStartDate: '2024-01-01T00:00:00Z',
    addedToCard: false,
    canBeAddedToCard: true,
    canBeRemoved: false,
    categories: ['breakfast'],
    brand: 'General Mills',
    brandName: 'General Mills',
    krogerCouponNumber: '12345',
    specialSavings: [],
    modalities: ['IN_STORE', 'PICKUP', 'DELIVERY'],
    requirementDescription: '',
    ...overrides,
  };
}

// ─── formatExpiry ─────────────────────────────────────────────────────────────

describe('formatExpiry', () => {
  it('formats the expiry date as "Exp. Mon DD"', () => {
    const { text } = formatExpiry('2030-06-15T00:00:00Z');
    expect(text).toMatch(/^Exp\. [A-Z][a-z]+ \d+$/);
  });

  it('is not urgent when expiry is far away', () => {
    const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatExpiry(future).urgent).toBe(false);
  });

  it('is urgent when expiry is within 3 days', () => {
    const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatExpiry(soon).urgent).toBe(true);
  });

  it('is urgent when already expired', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(formatExpiry(past).urgent).toBe(true);
  });
});

// ─── filterCoupons ────────────────────────────────────────────────────────────

describe('filterCoupons', () => {
  const coupons = [
    makeCoupon({ id: 'c1', title: 'Save on Cereal', shortDescription: 'cereal deal', brand: 'General Mills', brandName: 'General Mills', modalities: ['IN_STORE'] }),
    makeCoupon({ id: 'c2', title: 'Save on Juice', shortDescription: 'juice deal', brand: 'Tropicana', brandName: 'Tropicana', modalities: ['PICKUP', 'DELIVERY'] }),
    makeCoupon({
      id: 'c3', title: 'Bonus Deal', shortDescription: 'bonus deal', brand: 'Kellogg\'s', brandName: 'Kellogg\'s',
      modalities: ['IN_STORE'],
      specialSavings: [{ name: 'bonus', displayName: 'Bonus Digital Deals' }],
    }),
  ];

  it('returns all coupons when no filters', () => {
    expect(filterCoupons(coupons, {})).toHaveLength(3);
  });

  it('filters by search text on title', () => {
    const result = filterCoupons(coupons, { searchText: 'cereal' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('c1');
  });

  it('filters by search text on brand', () => {
    const result = filterCoupons(coupons, { searchText: 'tropicana' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('c2');
  });

  it('search is case-insensitive', () => {
    expect(filterCoupons(coupons, { searchText: 'CEREAL' })).toHaveLength(1);
  });

  it('filters by modality', () => {
    const result = filterCoupons(coupons, { modalities: ['PICKUP'] });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('c2');
  });

  it('returns coupons matching any of multiple modalities', () => {
    const result = filterCoupons(coupons, { modalities: ['IN_STORE', 'DELIVERY'] });
    expect(result).toHaveLength(3);
  });

  it('filters by special savings', () => {
    const result = filterCoupons(coupons, { specialSavings: ['Bonus Digital Deals'] });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('c3');
  });

  it('excludes brands by partial match', () => {
    const result = filterCoupons(coupons, { excludedBrands: ['general'] });
    expect(result.map(c => c.id)).not.toContain('c1');
    expect(result).toHaveLength(2);
  });

  it('excludes brands case-insensitively', () => {
    const result = filterCoupons(coupons, { excludedBrands: ['TROPICANA'] });
    expect(result.map(c => c.id)).not.toContain('c2');
  });

  it('filters newOnly using displayStartDate', () => {
    const recent = makeCoupon({ id: 'new', displayStartDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() });
    const old = makeCoupon({ id: 'old', displayStartDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString() });
    const result = filterCoupons([recent, old], { newOnly: true });
    expect(result.map(c => c.id)).toContain('new');
    expect(result.map(c => c.id)).not.toContain('old');
  });
});

// ─── sortCoupons ──────────────────────────────────────────────────────────────

describe('sortCoupons', () => {
  const coupons = [
    makeCoupon({ id: 'a', displayStartDate: '2024-01-01T00:00:00Z', expirationDate: '2030-06-01T00:00:00Z' }),
    makeCoupon({ id: 'b', displayStartDate: '2024-03-01T00:00:00Z', expirationDate: '2030-04-01T00:00:00Z' }),
    makeCoupon({ id: 'c', displayStartDate: '2024-02-01T00:00:00Z', expirationDate: '2030-05-01T00:00:00Z' }),
  ];

  it('does not mutate the original array', () => {
    const original = [...coupons];
    sortCoupons(coupons, 'recent');
    expect(coupons.map(c => c.id)).toEqual(original.map(c => c.id));
  });

  it('sorts by most recent displayStartDate first', () => {
    const result = sortCoupons(coupons, 'recent');
    expect(result.map(c => c.id)).toEqual(['b', 'c', 'a']);
  });

  it('sorts by earliest expirationDate first (expiration)', () => {
    const result = sortCoupons(coupons, 'expiration');
    expect(result.map(c => c.id)).toEqual(['b', 'c', 'a']);
  });

  it('returns original order for unknown sort', () => {
    const result = sortCoupons(coupons, 'relevance');
    expect(result.map(c => c.id)).toEqual(['a', 'b', 'c']);
  });
});

// ─── parseStoredFilters / buildStoredFilters ──────────────────────────────────

describe('parseStoredFilters', () => {
  it('parses category entries', () => {
    const { categories } = parseStoredFilters(['breakfast', 'dairy']);
    expect(categories).toEqual(['breakfast', 'dairy']);
  });

  it('parses modality entries', () => {
    const { modalities } = parseStoredFilters(['modality:PICKUP', 'modality:IN_STORE']);
    expect(modalities).toEqual(['PICKUP', 'IN_STORE']);
  });

  it('parses specialSavings entries', () => {
    const { specialSavings } = parseStoredFilters(['special:Bonus Digital Deals']);
    expect(specialSavings).toEqual(['Bonus Digital Deals']);
  });

  it('parses newOnly flag', () => {
    expect(parseStoredFilters(['newOnly:true']).newOnly).toBe(true);
    expect(parseStoredFilters([]).newOnly).toBe(false);
  });

  it('parses sort value', () => {
    expect(parseStoredFilters(['sort:expiration']).sortBy).toBe('expiration');
    expect(parseStoredFilters([]).sortBy).toBe('relevance');
  });

  it('parses excludeBrand entries', () => {
    const { excludedBrands } = parseStoredFilters(['excludeBrand:Nike', 'excludeBrand:Adidas']);
    expect(excludedBrands).toEqual(['Nike', 'Adidas']);
  });

  it('round-trips with buildStoredFilters', () => {
    const original = ['dairy', 'modality:PICKUP', 'special:5X Event', 'newOnly:true', 'sort:recent', 'excludeBrand:Kraft'];
    const parsed = parseStoredFilters(original);
    const rebuilt = buildStoredFilters(parsed);
    // categories come first, then modalities, specials, newOnly, sort, excludes
    expect(rebuilt).toContain('dairy');
    expect(rebuilt).toContain('modality:PICKUP');
    expect(rebuilt).toContain('special:5X Event');
    expect(rebuilt).toContain('newOnly:true');
    expect(rebuilt).toContain('sort:recent');
    expect(rebuilt).toContain('excludeBrand:Kraft');
    expect(rebuilt).toHaveLength(original.length);
  });
});
