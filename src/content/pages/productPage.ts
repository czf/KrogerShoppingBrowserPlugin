import React from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import type { KrogerProductsResponse } from '../../utils/api';
import { waitForElement } from '../../utils/dom';
import { ProductEnhancementPanel } from '../components/ProductEnhancementPanel';
import { buildLafHeaders } from '../../utils/laf';

let panelRoot: Root | null = null;
let panelContainer: HTMLElement | null = null;

function extractUpcFromUrl(): string | null {
  const match = location.pathname.match(/\/p\/[^/]+\/(\d{8,14})/);
  return match?.[1] ?? null;
}

async function fetchProductData(upc: string): Promise<KrogerProductsResponse | null> {
  const params = new URLSearchParams({
    'filter.gtin13s': upc,
    'filter.verified': 'true',
    projections: 'items.full,offers.compact,nutrition.label,inventory.projected,variantGroupings.compact',
  });

  try {
    const doFetch = async () => fetch(`/atlas/v1/product/v2/products?${params}`, {
      headers: await buildLafHeaders(),
      credentials: 'include',
    });
    let res = await doFetch();
    // Retry once on 400 — LAF headers may not be set at document_idle yet
    if (res.status === 400) {
      await new Promise(r => setTimeout(r, 1500));
      res = await doFetch();
    }
    if (!res.ok) return null;
    return (await res.json()) as KrogerProductsResponse;
  } catch {
    return null;
  }
}

export async function initProductPage(): Promise<void> {
  const upc = extractUpcFromUrl();
  if (!upc) return;

  const anchor = await waitForElement(
    '[data-testid="ProductDetails-header"], [data-testid="price-section"], [data-testid="ItemPage-body"], .ProductDetails, main',
    8_000,
  );
  if (!anchor) return;

  if (document.getElementById('kroger-ext-product-panel')) return;

  panelContainer = document.createElement('div');
  panelContainer.id = 'kroger-ext-product-panel';
  anchor.insertAdjacentElement('afterbegin', panelContainer);

  panelRoot = createRoot(panelContainer);
  panelRoot.render(React.createElement(ProductEnhancementPanel, { upc, state: 'loading' }));

  const data = await fetchProductData(upc);
  const products = data?.data?.products ?? [];
  const product = products.find(p => p.item?.upc === upc) ?? products[0];

  panelRoot.render(
    React.createElement(ProductEnhancementPanel, {
      upc,
      state: product ? 'loaded' : 'error',
      product,
    }),
  );
}

export function cleanupProductPage(): void {
  panelRoot?.unmount();
  panelContainer?.remove();
  panelRoot = null;
  panelContainer = null;
}
