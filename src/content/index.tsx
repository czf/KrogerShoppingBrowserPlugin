import { getFeatureFlags } from '../utils/storage';
import { onUrlChange } from '../utils/dom';
import { initSearchPage, cleanupSearchPage } from './pages/searchPage';
import { initProductPage, cleanupProductPage } from './pages/productPage';
import { initCouponPage, cleanupCouponPage } from './pages/couponPage';

async function bootstrap(url: string): Promise<void> {
  cleanupSearchPage();
  cleanupProductPage();
  cleanupCouponPage();

  let flags;
  try {
    flags = await getFeatureFlags();
  } catch {
    return; // Extension context invalidated — tab needs a refresh
  }
  const path = new URL(url).pathname;

  if (path.includes('/savings/cl/coupons') || path.includes('/savings/digital-coupons')) {
    if (flags.couponScrollResilience || flags.couponFilterPrefs || flags.couponModalLinks || flags.couponCustomPage) {
      initCouponPage(flags);
    }
  } else if (/\/p\/[^/]+\/\d/.test(path)) {
    if (flags.enhancedProductData) {
      initProductPage();
    }
  } else if (path.includes('/search') || path.includes('/pl/')) {
    if (flags.removeSponsored) {
      initSearchPage();
    }
  }
}

bootstrap(location.href);
onUrlChange(url => bootstrap(url));
