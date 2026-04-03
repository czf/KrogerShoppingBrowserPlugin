/**
 * Runs in MAIN world (document_start) to wrap window.fetch.
 * Responsibilities:
 *   - Capture request headers from any /atlas/v1/ call for later reuse
 *   - Relay product and coupon API responses to the ISOLATED world
 *   - Relay coupon fetch failures so the ISOLATED world can show a retry UI
 *   - Service fetch-on-behalf requests from the ISOLATED world (which cannot
 *     replicate the exact headers the page uses)
 */

const EVT = {
  HEADERS_CAPTURED: '__kroger_ext_headers__',
  API_DATA: '__kroger_ext_data__',
  API_RESPONSE: '__kroger_ext_response__',
  COUPON_ERROR: '__kroger_ext_coupon_error__',
  REQUEST: '__kroger_ext_request__',
  MODALITY_CHANGED: '__kroger_ext_modality_changed__',
} as const;

const HEADER_KEYS = [
  'x-facility-id',
  'x-laf-object',
  'x-kroger-channel',
  'x-modality',
  'x-modality-type',
  'x-location-id',
];

const capturedHeaders: Record<string, string> = {};
const originalFetch = window.fetch.bind(window);

// ─── Header capture helpers ────────────────────────────────────────────────

function headersToRecord(h: HeadersInit): Record<string, string> {
  const out: Record<string, string> = {};
  if (h instanceof Headers) {
    h.forEach((v, k) => { out[k.toLowerCase()] = v; });
  } else if (Array.isArray(h)) {
    for (const [k, v] of h) out[k.toLowerCase()] = v;
  } else {
    for (const [k, v] of Object.entries(h)) out[k.toLowerCase()] = String(v);
  }
  return out;
}

function captureHeaders(init?: RequestInit, req?: Request): boolean {
  const raw = init?.headers ?? req?.headers;
  if (!raw) return false;
  const record = headersToRecord(raw as HeadersInit);
  let changed = false;
  for (const key of HEADER_KEYS) {
    if (record[key] && record[key] !== capturedHeaders[key]) {
      capturedHeaders[key] = record[key];
      changed = true;
    }
  }
  return changed;
}

// ─── Patched fetch ─────────────────────────────────────────────────────────

window.fetch = async function (
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const url =
    typeof input === 'string' ? input
    : input instanceof Request ? input.url
    : input.toString();

  if (!url.includes('/atlas/v1/')) {
    return originalFetch(input, init);
  }

  // Capture headers from this outgoing request
  const req = input instanceof Request ? input : undefined;
  if (captureHeaders(init, req)) {
    if (__KROGER_DEBUG__) console.log('[KrogerExt] Headers captured:', { ...capturedHeaders });
    window.dispatchEvent(
      new CustomEvent(EVT.HEADERS_CAPTURED, { detail: { ...capturedHeaders } }),
    );
  }

  let response: Response;
  try {
    response = await originalFetch(input, init);
  } catch (err) {
    if (url.includes('/savings-coupons')) {
      window.dispatchEvent(
        new CustomEvent(EVT.COUPON_ERROR, {
          detail: { url, error: String(err) },
        }),
      );
    }
    throw err;
  }

  if (!response.ok && url.includes('/savings-coupons')) {
    window.dispatchEvent(
      new CustomEvent(EVT.COUPON_ERROR, {
        detail: { url, status: response.status },
      }),
    );
    return response;
  }

  // Relay product and coupon responses to ISOLATED world
  if (url.includes('/product/v2/products') || url.includes('/savings-coupons')) {
    response.clone().json().then(data => {
      window.dispatchEvent(new CustomEvent(EVT.API_DATA, { detail: { url, data } }));
    }).catch(() => {/* ignore parse errors */});
  }

  // Notify ISOLATED world when modality/store changes
  if (url.includes('/modality/preferences') && (init?.method ?? 'GET').toUpperCase() === 'POST' && response.ok) {
    if (__KROGER_DEBUG__) console.log('[KrogerExt] Modality change detected, dispatching cache-clear event');
    window.dispatchEvent(new CustomEvent(EVT.MODALITY_CHANGED));
  }

  return response;
};

// ─── Fetch-on-behalf requests from ISOLATED world ─────────────────────────

window.addEventListener(EVT.REQUEST, async (e: Event) => {
  const detail = (e as CustomEvent<{
    requestId: string;
    action: string;
    upc?: string;
    upcs?: string[];
  }>).detail;

  const { requestId, action, upc, upcs } = detail;

  const respond = (data: unknown, error: string | null) =>
    window.dispatchEvent(
      new CustomEvent(EVT.API_RESPONSE, { detail: { requestId, data, error } }),
    );

  try {
    const params = new URLSearchParams({
      'filter.verified': 'true',
      projections: 'items.full,offers.compact,nutrition.label,inventory.projected,variantGroupings.compact',
    });

    if (action === 'fetchProduct' && upc) {
      params.set('filter.gtin13s', upc);
    } else if (action === 'fetchProductsByUPCs' && upcs?.length) {
      upcs.forEach(u => params.append('filter.gtin13s', u));
    } else {
      respond(null, 'Unknown action or missing params');
      return;
    }

    const res = await originalFetch(`/atlas/v1/product/v2/products?${params}`, {
      headers: {
        accept: 'application/json, text/plain, */*',
        ...capturedHeaders,
      },
      credentials: 'include',
    });

    respond(await res.json(), null);
  } catch (err) {
    respond(null, String(err));
  }
});
