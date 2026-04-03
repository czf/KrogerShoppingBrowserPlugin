import React from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import type { FeatureFlags } from '../../utils/storage';
import { getCouponFilters, setCouponFilters } from '../../utils/storage';
import { observeSelector, waitForElement } from '../../utils/dom';
import { CouponCustomPage } from '../components/coupon/CouponCustomPage';

const COUPON_CARD_SELECTOR = '[data-testid^="couponCard-"], [data-testid^="CouponCard-"], [data-testid^="digitalCoupon"]';

let filterObserver: MutationObserver | null = null;
let modalObserver: MutationObserver | null = null;
let filterSaveTimer: ReturnType<typeof setTimeout> | null = null;
let retryBanner: HTMLElement | null = null;
let customPageRoot: Root | null = null;
let customPageContainer: HTMLElement | null = null;
let nativeMainEl: HTMLElement | null = null;

// ─── Custom Page ───────────────────────────────────────────────────────────

async function mountCustomPage(): Promise<void> {
  const main = await waitForElement('main', 15_000) as HTMLElement | null;
  if (!main?.parentElement) return;

  nativeMainEl = main;
  main.style.display = 'none';

  customPageContainer = document.createElement('div');
  customPageContainer.id = 'kroger-ext-coupon-custom-page';
  main.parentElement.insertBefore(customPageContainer, main);

  customPageRoot = createRoot(customPageContainer);
  customPageRoot.render(React.createElement(CouponCustomPage));
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function extractUpcFromImageSrc(src: string): string | null {
  const match = src.match(/\/images\/\w+\/\w+\/(\d{8,14})(?:[?#]|$)/);
  return match?.[1] ?? null;
}

// ─── Filter Preferences ────────────────────────────────────────────────────

let restoreInProgress = false;

async function restoreFilters(): Promise<void> {
  // Guard against concurrent calls (e.g., from setupFilterPrefs + setupFilterObserver)
  if (restoreInProgress) return;
  restoreInProgress = true;
  try {
    const saved = await getCouponFilters();
    if (!saved.length) return;

    // Wait for coupon cards to appear — this confirms the React app has finished
    // its initialization (data fetched, state stable) before we touch the filters.
    await waitForElement(COUPON_CARD_SELECTOR, 10_000);
    await new Promise<void>(r => requestAnimationFrame(() => r()));

    document.querySelectorAll<HTMLInputElement>('input[data-testid^="Filter-by-"]').forEach(input => {
      const name = input.getAttribute('data-testid')!.replace('Filter-by-', '');
      if (saved.includes(name) && !input.checked) input.click();
    });
  } finally {
    restoreInProgress = false;
  }
}

function setupFilterObserver(): void {
  const persist = () => {
    if (filterSaveTimer) clearTimeout(filterSaveTimer);
    filterSaveTimer = setTimeout(() => {
      const active: string[] = [];
      document.querySelectorAll<HTMLInputElement>('input[data-testid^="Filter-by-"]:checked').forEach(el => {
        active.push(el.getAttribute('data-testid')!.replace('Filter-by-', ''));
      });
      setCouponFilters(active);
    }, 500);
  };

  // After observerReady, newly-added filter inputs mean React remounted (e.g. same-URL
  // nav link click). Debounce to handle all inputs arriving in one batch.
  let observerReady = false;
  let remountRestoreTimer: ReturnType<typeof setTimeout> | null = null;

  filterObserver = observeSelector('input[data-testid^="Filter-by-"]', el => {
    el.addEventListener('change', persist);
    if (observerReady) {
      if (remountRestoreTimer) clearTimeout(remountRestoreTimer);
      remountRestoreTimer = setTimeout(() => restoreFilters(), 100);
    }
  });

  // Mark initial querySelectorAll phase as done after first render cycle
  requestAnimationFrame(() => { observerReady = true; });
}

async function setupFilterPrefs(): Promise<void> {
  const firstFilter = await waitForElement('input[data-testid^="Filter-by-"]', 8_000);
  if (!firstFilter) return;
  await restoreFilters();
  setupFilterObserver();
}

// ─── Coupon Modal Product Links ────────────────────────────────────────────

function injectProductLink(item: Element): void {
  if (item.querySelector('.kroger-ext-link')) return;

  const img = item.querySelector<HTMLImageElement>('img[src*="/product/images/"]');
  const upc = extractUpcFromImageSrc(img?.src ?? '');
  if (!upc) return;

  const descEl = item.querySelector<HTMLElement>('[data-testid="cart-page-item-description"]');
  const slug = slugify(descEl?.innerText?.trim() ?? 'product');
  const label = descEl?.innerText?.trim() ?? 'View product';

  // Stretched-link overlay: covers the card but sits below the right-side button area
  const itemEl = item as HTMLElement;
  itemEl.style.position = 'relative';

  // Lift the right-side buttons above the link overlay
  const rightPanel = itemEl.querySelector<HTMLElement>('.flex.justify-end');
  if (rightPanel) {
    rightPanel.style.position = 'relative';
    rightPanel.style.zIndex = '2';
  }

  const link = document.createElement('a');
  link.href = `/p/${slug}/${upc}`;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.className = 'kroger-ext-link';
  link.setAttribute('aria-label', `View product page: ${label}`);
  Object.assign(link.style, {
    position: 'absolute',
    inset: '0',
    zIndex: '1',
    borderRadius: 'inherit',
    cursor: 'pointer',
  });

  itemEl.appendChild(link);
}

function setupModalLinks(): void {
  modalObserver = observeSelector('[data-testid^="list-style-product-card-"]', el => {
    injectProductLink(el);
  });
}

// ─── Scroll Resilience ─────────────────────────────────────────────────────

const STALL_TIMEOUT_MS= 6_000;  // seconds at bottom with no new items → show banner

function showRetryBanner(): void {
  if (retryBanner) return;

  retryBanner = document.createElement('div');
  Object.assign(retryBanner.style, {
    position: 'fixed',
    bottom: '24px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: '99999',
    backgroundColor: '#fef3c7',
    border: '1px solid #d97706',
    borderRadius: '8px',
    padding: '12px 20px',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '14px',
    color: '#92400e',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  });

  const msg = document.createElement('span');
  msg.textContent = '⚠️ Coupon loading stalled.';

  const btn = document.createElement('button');
  btn.textContent = 'Retry';
  Object.assign(btn.style, {
    padding: '4px 12px',
    backgroundColor: '#d97706',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '13px',
  });
  btn.onclick = () => {
    retryBanner?.remove();
    retryBanner = null;
    // Nudge the page's own infinite scroll by briefly scrolling up then back down
    window.scrollBy(0, -300);
    setTimeout(() => window.scrollBy(0, 400), 300);
  };

  const close = document.createElement('button');
  close.textContent = '✕';
  Object.assign(close.style, {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#92400e',
    fontSize: '16px',
    padding: '0 4px',
  });
  close.onclick = () => { retryBanner?.remove(); retryBanner = null; };

  retryBanner.append(msg, btn, close);
  document.body.appendChild(retryBanner);
}

function setupScrollResilience(): void {
  let cardCount = 0;
  let stallTimer: ReturnType<typeof setTimeout> | null = null;
  let sentinel: HTMLElement | null = null;
  let io: IntersectionObserver | null = null;

  const countCards = () => document.querySelectorAll(COUPON_CARD_SELECTOR).length;

  // MutationObserver: when new cards arrive, dismiss stall timer/banner
  const mutObs = new MutationObserver(() => {
    const n = countCards();
    if (n > cardCount) {
      cardCount = n;
      if (stallTimer) { clearTimeout(stallTimer); stallTimer = null; }
      retryBanner?.remove(); retryBanner = null;
    }
  });
  mutObs.observe(document.body, { childList: true, subtree: true });

  // Wait for first card, then attach IntersectionObserver sentinel at the list bottom
  waitForElement(COUPON_CARD_SELECTOR, 20_000).then(firstCard => {
    if (!firstCard) return;
    cardCount = countCards();

    sentinel = document.createElement('div');
    sentinel.style.height = '1px';
    (firstCard.parentElement ?? document.body).appendChild(sentinel);

    io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        // User has scrolled to the bottom — start stall timer
        stallTimer = setTimeout(() => {
          if (countCards() === cardCount) showRetryBanner();
        }, STALL_TIMEOUT_MS);
      } else {
        if (stallTimer) { clearTimeout(stallTimer); stallTimer = null; }
      }
    }, { rootMargin: '0px 0px 100px 0px' });

    io.observe(sentinel);
  });

  // Expose cleanup handles
  (setupScrollResilience as unknown as { cleanup?: () => void }).cleanup = () => {
    mutObs.disconnect();
    io?.disconnect();
    sentinel?.remove();
    if (stallTimer) clearTimeout(stallTimer);
  };
}

// ─── Entry / Cleanup ───────────────────────────────────────────────────────

export function initCouponPage(flags: FeatureFlags): void {
  if (flags.couponCustomPage) {
    mountCustomPage();
    return;
  }
  if (flags.couponFilterPrefs) setupFilterPrefs();
  if (flags.couponModalLinks) setupModalLinks();
  if (flags.couponScrollResilience) setupScrollResilience();
}

export function cleanupCouponPage(): void {
  // Custom page cleanup
  customPageRoot?.unmount();
  customPageRoot = null;
  customPageContainer?.remove();
  customPageContainer = null;
  if (nativeMainEl) {
    nativeMainEl.style.display = '';
    nativeMainEl = null;
  }

  // Native page cleanup
  filterObserver?.disconnect(); filterObserver = null;
  modalObserver?.disconnect(); modalObserver = null;
  // Flush any pending filter save immediately so navigation doesn't lose the selection
  if (filterSaveTimer !== null) {
    clearTimeout(filterSaveTimer);
    filterSaveTimer = null;
    const active: string[] = [];
    document.querySelectorAll<HTMLInputElement>('input[data-testid^="Filter-by-"]:checked').forEach(el => {
      active.push(el.getAttribute('data-testid')!.replace('Filter-by-', ''));
    });
    setCouponFilters(active);
  }
  retryBanner?.remove(); retryBanner = null;
}
