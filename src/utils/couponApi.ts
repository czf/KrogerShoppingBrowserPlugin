import { buildLafHeaders } from './laf';

export interface KrogerCoupon {
  id: string;
  imageUrl: string;
  title: string | null;
  shortDescription: string;
  displayDescription: string;
  expirationDate: string;
  displayEndDate: string;
  displayStartDate: string;
  addedToCard: boolean;
  canBeAddedToCard: boolean;
  canBeRemoved: boolean;
  categories: string[];
  brand: string;
  brandName: string;
  krogerCouponNumber: string;
  upcs?: string[];
  specialSavings: { name: string; displayName: string }[];
  modalities: string[];
  requirementDescription: string;
}

export interface KrogerProductCompact {
  id: string;
  description: string;
  imageUrl: string;
  price: string;
  shareLink: string;
}

export interface FetchCouponsResult {
  coupons: KrogerCoupon[];
  hasMore: boolean;
  totalCount: number;
  newCouponsCount: number;
  categoryOptions: { id: string; name: string }[];
  categoriesDropped: boolean;
}

export async function fetchCoupons({
  categories = [],
  offset = 0,
  pageSize = 24,
  searchString,
}: {
  categories?: string[];
  offset?: number;
  pageSize?: number;
  searchString?: string;
} = {}): Promise<FetchCouponsResult> {
  const params = new URLSearchParams();
  params.append('projections', 'coupons.compact');
  // Both filter.status values must be adjacent or the API returns 400
  params.append('filter.status', 'unclipped');
  params.append('filter.status', 'active');
  params.append('page.size', String(pageSize));
  params.append('page.offset', String(offset));
  // filter.sort and filter.onlyNewCoupons cause 400; omit both and handle client-side
  for (const cat of categories) {
    params.append('filter.category', cat);
  }
  if (searchString) {
    params.append('filter.searchString', searchString);
  }

  try {
    type CouponsJson = {
      data?: { coupons?: KrogerCoupon[] };
      meta?: {
        coupons?: {
          page?: { hasMore?: boolean };
          filterSummaryByType?: {
            totalCount?: number;
            newCouponsCount?: number;
            categories?: { options?: { id: string; name: string }[] };
          };
        };
      };
    };
    const EMPTY: FetchCouponsResult = { coupons: [], hasMore: false, totalCount: 0, newCouponsCount: 0, categoryOptions: [], categoriesDropped: false };
    const parseResponse = (json: CouponsJson, dropped = false): FetchCouponsResult => {
      const coupons = json?.data?.coupons ?? [];
      const page = json?.meta?.coupons?.page;
      const filterSummary = json?.meta?.coupons?.filterSummaryByType;
      return {
        coupons,
        hasMore: page?.hasMore ?? (coupons.length === pageSize),
        totalCount: filterSummary?.totalCount ?? coupons.length,
        newCouponsCount: filterSummary?.newCouponsCount ?? 0,
        categoryOptions: filterSummary?.categories?.options ?? [],
        categoriesDropped: dropped,
      };
    };

    const doFetch = async (p: URLSearchParams) => fetch(`/atlas/v1/savings-coupons/v1/coupons?${p}`, {
      headers: await buildLafHeaders(),
      credentials: 'include',
    });
    let res = await doFetch(params);
    // Retry once on transient 400 (e.g. LAF headers not yet available)
    if (res.status === 400) {
      await new Promise(r => setTimeout(r, 1500));
      res = await doFetch(params);
    }
    // Retry without category filters on 500 (invalid/unavailable category for this store)
    if (res.status === 500 && categories.length > 0) {
      const fallbackParams = new URLSearchParams();
      fallbackParams.append('projections', 'coupons.compact');
      fallbackParams.append('filter.status', 'unclipped');
      fallbackParams.append('filter.status', 'active');
      fallbackParams.append('page.size', String(pageSize));
      fallbackParams.append('page.offset', String(offset));
      if (searchString) {
        fallbackParams.append('filter.searchString', searchString);
      }
      res = await doFetch(fallbackParams);
      if (!res.ok) return EMPTY;
      return parseResponse(await res.json() as CouponsJson, true);
    }
    if (!res.ok) return EMPTY;
    return parseResponse(await res.json() as CouponsJson);
  } catch {
    return { coupons: [], hasMore: false, totalCount: 0, newCouponsCount: 0, categoryOptions: [], categoriesDropped: false };
  }
}

export async function clipCoupon(couponId: string, action: 'CLIP' | 'UNCLIP'): Promise<boolean> {
  try {
    const res = await fetch('/atlas/v1/savings-coupons/v1/clip-unclip', {
      method: 'POST',
      headers: {
        ...await buildLafHeaders(),
        'content-type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ action, couponId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchCouponFull(krogerCouponNumber: string): Promise<string[]> {
  try {
    const params = new URLSearchParams({
      'filter.krogerCouponNumber': krogerCouponNumber,
      'filter.type': 'standard',
      projections: 'coupons.full',
    });
    const res = await fetch(`/atlas/v1/savings-coupons/v1/coupons?${params}`, {
      headers: await buildLafHeaders(),
      credentials: 'include',
    });
    if (!res.ok) return [];
    const json = await res.json() as { data?: { coupons?: Array<{ upcs?: string[] }> } };
    return json?.data?.coupons?.[0]?.upcs ?? [];
  } catch {
    return [];
  }
}

type ProductImage = { size: string; perspective: string; url: string };
type ProductApiItem = {
  id: string;
  item?: {
    description?: string;
    images?: ProductImage[];
    shareLink?: string;
  };
  price?: {
    storePrices?: {
      regular?: {
        defaultDescription?: string;
      };
    };
  };
};

export async function fetchProductsByUpcs(upcs: string[]): Promise<KrogerProductCompact[]> {
  if (upcs.length === 0) return [];

  const batches: string[][] = [];
  for (let i = 0; i < upcs.length; i += 50) {
    batches.push(upcs.slice(i, i + 50));
  }

  const batchResults = await Promise.all(batches.map(async batch => {
    const params = new URLSearchParams({
      'filter.verified': 'true',
      projections: 'items.full,offers.compact',
    });
    for (const upc of batch) {
      params.append('filter.gtin13s', upc);
    }
    try {
      const res = await fetch(`/atlas/v1/product/v2/products?${params}`, {
        headers: await buildLafHeaders(),
        credentials: 'include',
      });
      if (!res.ok) return [] as KrogerProductCompact[];
      const json = await res.json() as { data?: { products?: ProductApiItem[] } };
      const products = json?.data?.products ?? [];
      return products.map(product => {
        const images = product.item?.images ?? [];
        let imageUrl = '';
        const smallFront = images.find(img => img.size === 'small' && img.perspective === 'front');
        if (smallFront) {
          imageUrl = smallFront.url;
        } else {
          const thumbFront = images.find(img => img.size === 'thumbnail' && img.perspective === 'front');
          if (thumbFront) {
            imageUrl = thumbFront.url;
          } else if (images.length > 0) {
            imageUrl = images[0].url;
          }
        }
        return {
          id: product.id,
          description: product.item?.description ?? '',
          imageUrl,
          price: product.price?.storePrices?.regular?.defaultDescription ?? '',
          shareLink: product.item?.shareLink ?? '',
        };
      });
    } catch {
      return [] as KrogerProductCompact[];
    }
  }));

  const flat = batchResults.flat();
  const seen = new Set<string>();
  return flat.filter(p => {
    if (!p.description || seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}
