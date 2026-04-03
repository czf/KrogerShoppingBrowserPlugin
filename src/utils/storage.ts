export interface FeatureFlags {
  removeSponsored: boolean;
  enhancedProductData: boolean;
  couponScrollResilience: boolean;
  couponFilterPrefs: boolean;
  couponModalLinks: boolean;
  couponCustomPage: boolean;
}

export const DEFAULT_FLAGS: FeatureFlags = {
  removeSponsored: true,
  enhancedProductData: true,
  couponScrollResilience: true,
  couponFilterPrefs: true,
  couponModalLinks: true,
  couponCustomPage: false,
};

const KEY_FLAGS = 'krogerExtFlags';
const KEY_COUPON_FILTERS = 'krogerExtCouponFilters';

function isContextValid(): boolean {
  try {
    return !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

export function getFeatureFlags(): Promise<FeatureFlags> {
  if (!isContextValid()) return Promise.resolve(DEFAULT_FLAGS);
  return new Promise(resolve => {
    try {
      chrome.storage.sync.get(KEY_FLAGS, result => {
        if (chrome.runtime.lastError) { resolve(DEFAULT_FLAGS); return; }
        resolve({ ...DEFAULT_FLAGS, ...(result[KEY_FLAGS] ?? {}) });
      });
    } catch {
      resolve(DEFAULT_FLAGS);
    }
  });
}

export function setFeatureFlags(flags: Partial<FeatureFlags>): Promise<void> {
  if (!isContextValid()) return Promise.resolve();
  return getFeatureFlags().then(
    current => new Promise(resolve => {
      try {
        chrome.storage.sync.set({ [KEY_FLAGS]: { ...current, ...flags } }, () => {
          if (chrome.runtime.lastError) { resolve(); return; }
          resolve();
        });
      } catch {
        resolve();
      }
    }),
  );
}

export function getCouponFilters(): Promise<string[]> {
  if (!isContextValid()) return Promise.resolve([]);
  return new Promise(resolve => {
    try {
      chrome.storage.sync.get(KEY_COUPON_FILTERS, result => {
        if (chrome.runtime.lastError) { resolve([]); return; }
        const val = result[KEY_COUPON_FILTERS];
        resolve(Array.isArray(val) ? val : []);
      });
    } catch {
      resolve([]);
    }
  });
}

export function setCouponFilters(active: string[]): Promise<void> {
  if (!isContextValid()) return Promise.resolve();
  return new Promise(resolve => {
    try {
      chrome.storage.sync.set({ [KEY_COUPON_FILTERS]: active }, () => {
        if (chrome.runtime.lastError) { resolve(); return; }
        resolve();
      });
    } catch {
      resolve();
    }
  });
}
