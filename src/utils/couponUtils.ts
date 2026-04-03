import type { KrogerCoupon } from './couponApi';

export interface ExpiryResult {
  text: string;
  urgent: boolean;
}

export function formatExpiry(displayEndDate: string): ExpiryResult {
  const date = new Date(displayEndDate);
  const text = 'Exp. ' + date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const diffMs = date.getTime() - Date.now();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return { text, urgent: diffDays <= 3 };
}

export function filterCoupons(
  coupons: KrogerCoupon[],
  opts: {
    searchText?: string;
    modalities?: string[];
    specialSavings?: string[];
    excludedBrands?: string[];
    newOnly?: boolean;
    newOnlyCutoffMs?: number; // defaults to 10 days
  },
): KrogerCoupon[] {
  const {
    searchText = '',
    modalities = [],
    specialSavings = [],
    excludedBrands = [],
    newOnly = false,
    newOnlyCutoffMs = 10 * 24 * 60 * 60 * 1000,
  } = opts;

  let result = coupons;

  if (searchText.trim()) {
    const q = searchText.toLowerCase();
    result = result.filter(c =>
      c.title?.toLowerCase().includes(q) ||
      c.shortDescription.toLowerCase().includes(q) ||
      c.brand.toLowerCase().includes(q),
    );
  }

  if (modalities.length > 0) {
    result = result.filter(c => modalities.some(m => c.modalities.includes(m)));
  }

  if (specialSavings.length > 0) {
    result = result.filter(c =>
      c.specialSavings.some(s => specialSavings.includes(s.displayName)),
    );
  }

  if (excludedBrands.length > 0) {
    const excluded = excludedBrands.map(b => b.toLowerCase());
    result = result.filter(c => {
      const brand = (c.brandName || c.brand).toLowerCase();
      return !excluded.some(ex => brand.includes(ex));
    });
  }

  if (newOnly) {
    const cutoff = Date.now() - newOnlyCutoffMs;
    result = result.filter(c => new Date(c.displayStartDate).getTime() >= cutoff);
  }

  return result;
}

export function sortCoupons(coupons: KrogerCoupon[], sort: string): KrogerCoupon[] {
  if (sort === 'recent') {
    return [...coupons].sort((a, b) =>
      new Date(b.displayStartDate).getTime() - new Date(a.displayStartDate).getTime(),
    );
  }
  if (sort === 'expiration') {
    return [...coupons].sort((a, b) =>
      new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime(),
    );
  }
  return coupons;
}

export function parseStoredFilters(saved: string[]): {
  categories: string[];
  modalities: string[];
  specialSavings: string[];
  excludedBrands: string[];
  newOnly: boolean;
  sortBy: string;
} {
  const categories: string[] = [];
  const modalities: string[] = [];
  const specialSavings: string[] = [];
  const excludedBrands: string[] = [];
  let newOnly = false;
  let sortBy = 'relevance';

  for (const f of saved) {
    if (f.startsWith('modality:')) modalities.push(f.slice('modality:'.length));
    else if (f.startsWith('special:')) specialSavings.push(f.slice('special:'.length));
    else if (f === 'newOnly:true') newOnly = true;
    else if (f.startsWith('sort:')) sortBy = f.slice('sort:'.length);
    else if (f.startsWith('excludeBrand:')) excludedBrands.push(f.slice('excludeBrand:'.length));
    else categories.push(f);
  }

  return { categories, modalities, specialSavings, excludedBrands, newOnly, sortBy };
}

export function buildStoredFilters(opts: {
  categories: string[];
  modalities: string[];
  specialSavings: string[];
  excludedBrands: string[];
  newOnly: boolean;
  sortBy: string;
}): string[] {
  return [
    ...opts.categories,
    ...opts.modalities.map(m => `modality:${m}`),
    ...opts.specialSavings.map(s => `special:${s}`),
    ...(opts.newOnly ? ['newOnly:true'] : []),
    `sort:${opts.sortBy}`,
    ...opts.excludedBrands.map(b => `excludeBrand:${b}`),
  ];
}
