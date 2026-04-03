import { dbg, dbgWarn } from './debug';

interface LafEntry {
  modality: {
    type: string;
    handoffLocation: { storeId: string; facilityId: string };
    handoffAddress?: object;
  };
  sources: Array<{ storeId: string; facilityId: string }>;
  assortmentKeys?: string[];
  listingKeys: string[];
}

interface LafData {
  storeId: string;
  facilityId: string;
  assortmentKeys: string[];
  lafObject: LafEntry[];
  cachedAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let cached: LafData | null = null;

function storeIdFromCookie(): string {
  return document.cookie.match(/DD_modStore=(\d+)/)?.[1] ?? '';
}

function isCacheStale(): boolean {
  if (!cached) return true;
  if (Date.now() - cached.cachedAt > CACHE_TTL_MS) {
    dbg('LAF cache expired (TTL)');
    return true;
  }
  const current = storeIdFromCookie();
  if (current !== '' && current !== cached.storeId) {
    dbg(`LAF cache stale: store changed ${cached.storeId} → ${current}`);
    return true;
  }
  return false;
}

export async function resolveLaf(): Promise<LafData> {
  if (cached && !isCacheStale()) return cached;

  try {
    const res = await fetch('/atlas/v1/modality/preferences?filter.restrictLafToFc=false', {
      method: 'POST',
      headers: { accept: 'application/json, text/plain, */*', 'x-kroger-channel': 'WEB' },
      credentials: 'include',
    });
    if (res.ok) {
      const json = await res.json() as {
        data?: { modalityPreferences?: { lafObject?: LafEntry[] } };
      };
      const lafObject = json?.data?.modalityPreferences?.lafObject;
      if (lafObject?.[0]) {
        const entry = lafObject[0];
        cached = {
          storeId: entry.modality.handoffLocation.storeId,
          facilityId: entry.modality.handoffLocation.facilityId,
          assortmentKeys: entry.assortmentKeys ?? [],
          lafObject,
          cachedAt: Date.now(),
        };
        dbg('LAF resolved via API:', { storeId: cached.storeId, facilityId: cached.facilityId, modalityType: entry.modality.type });
        return cached;
      }
    }
  } catch { /* fall through to cookie fallback */ }

  const storeId = storeIdFromCookie();
  dbgWarn('LAF API failed, falling back to cookie storeId:', storeId);
  cached = { storeId, facilityId: '', assortmentKeys: [], lafObject: [], cachedAt: Date.now() };
  return cached;
}

export async function buildLafHeaders(): Promise<Record<string, string>> {
  const { storeId, facilityId, assortmentKeys, lafObject } = await resolveLaf();

  const laf: LafEntry[] = lafObject.length > 0 ? lafObject : [{
    modality: { type: 'PICKUP', handoffLocation: { storeId, facilityId } },
    sources: [{ storeId, facilityId }],
    ...(assortmentKeys.length > 0 ? { assortmentKeys } : {}),
    listingKeys: [storeId],
  }];

  return {
    accept: 'application/json, text/plain, */*',
    'x-facility-id': facilityId || storeId,
    'x-modality-type': 'PICKUP',
    'x-modality': JSON.stringify({ type: 'PICKUP', locationId: storeId }),
    'x-kroger-channel': 'WEB',
    'x-laf-object': JSON.stringify(laf),
  };
}

/** Call on page navigation to force a fresh LAF fetch. */
export function clearLafCache(): void {
  cached = null;
}

// Clear cache whenever the page changes store or modality
window.addEventListener('__kroger_ext_modality_changed__', () => {
  dbg('LAF cache cleared (modality change event)');
  cached = null;
});
