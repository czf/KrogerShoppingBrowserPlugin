import { observeSelector } from '../../utils/dom';

let styleEl: HTMLStyleElement | null = null;
let observer: MutationObserver | null = null;

function hideFeaturedCard(card: Element): void {
  // Hide the card's parent grid-item wrapper so no empty space is left
  const wrapper = card.parentElement;
  if (wrapper && wrapper !== document.body) {
    (wrapper as HTMLElement).style.setProperty('display', 'none', 'important');
  }
}

export function initSearchPage(): void {
  if (styleEl) return;

  // Also inject CSS as a fast first-pass before JS observer fires
  styleEl = document.createElement('style');
  styleEl.dataset.krogerExt = 'search';
  styleEl.textContent =
    '[data-testid^="product-card-"]:has([data-testid="featured-product-tag"]) { display: none !important; }';
  document.body.appendChild(styleEl);

  // JS observer hides the parent wrapper (eliminates the empty grid gap)
  observer = observeSelector(
    '[data-testid^="product-card-"]:has([data-testid="featured-product-tag"])',
    el => hideFeaturedCard(el),
  );
}

export function cleanupSearchPage(): void {
  styleEl?.remove();
  styleEl = null;
  observer?.disconnect();
  observer = null;
}
