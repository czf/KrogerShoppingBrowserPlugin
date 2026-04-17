/**
 * Runs in MAIN world (document_start) to wrap window.fetch.
 * Responsibilities:
 *   - Capture request headers from any /atlas/v1/ call for later reuse
 *   - Relay product and coupon API responses to the ISOLATED world
 *   - Relay coupon fetch failures so the ISOLATED world can show a retry UI
 *   - Service fetch-on-behalf requests from the ISOLATED world (which cannot
 *     replicate the exact headers the page uses)
 */

import { dbg } from '../utils/debug';

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
    for (const [k, v] of h) out[k.toLowerCase()] = String(v);
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
    dbg('[KrogerExt] Headers captured:', { ...capturedHeaders });
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
    dbg('[KrogerExt] Modality change detected, dispatching cache-clear event');
    window.dispatchEvent(new CustomEvent(EVT.MODALITY_CHANGED));
  }

  return response;
};

// ─── Fetch-on-behalf requests from ISOLATED world ─────────────────────────

interface RequestEventDetail {
  requestId?: string;
  action?: string;
  request?: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    credentials?: string;
    body?: unknown;
  };
  upc?: string;
  upcs?: string[];
}

window.addEventListener(EVT.REQUEST, async (e: Event) => {
  const detail = (e as CustomEvent<RequestEventDetail>).detail;
  const requestId = detail?.requestId;
  const action = detail?.action as string | undefined;
  const request = detail?.request as RequestEventDetail['request'] | undefined;

  const respond = (payload: { ok: boolean; status: number; data?: unknown; error?: string | null }) =>
    window.dispatchEvent(new CustomEvent(EVT.API_RESPONSE, { detail: { requestId, ...payload } }));

  try {
    // Legacy action-based handling for product APIs
    if (action) {
      const params = new URLSearchParams({
        'filter.verified': 'true',
        projections: 'items.full,offers.compact,nutrition.label,inventory.projected,variantGroupings.compact',
      });

      if (action === 'fetchProduct' && detail.upc) {
        params.set('filter.gtin13s', detail.upc);
      } else if (action === 'fetchProductsByUPCs' && detail.upcs?.length) {
        detail.upcs.forEach((u: string) => params.append('filter.gtin13s', u));
      } else {
        respond({ ok: false, status: 0, data: null, error: 'Unknown action or missing params' });
        return;
      }

      const res = await originalFetch(`/atlas/v1/product/v2/products?${params}`, {
        headers: {
          accept: 'application/json, text/plain, */*',
          ...capturedHeaders,
        },
        credentials: 'include',
      });

      let data = null;
      try { data = await res.clone().json(); } catch { /* ignore parse errors */ }

      respond({ ok: res.ok, status: res.status, data, error: res.ok ? null : String(data) });
      return;
    }

    // Generic request handling (from ISOLATED world)
    if (!request || !request.url) {
      respond({ ok: false, status: 0, data: null, error: 'Unknown request format' });
      return;
    }

    const method = (request?.method ?? 'GET').toUpperCase();
    const headers = { ...(request?.headers ?? {}), accept: 'application/json, text/plain, */*', ...capturedHeaders };
    const credentials = (request?.credentials as RequestCredentials | undefined) ?? 'include';
    const fetchOpts: RequestInit = { method, headers, credentials };
    if (request && request.body !== undefined && request.body !== null) fetchOpts.body = request.body as BodyInit;

    try {
      const res = await originalFetch(request.url, fetchOpts);

      let data: unknown = null;
      try {
        const ct = res.headers.get('content-type') ?? '';
        if (ct.includes('application/json')) data = await res.clone().json();
        else data = await res.clone().text();
      } catch { /* ignore parse errors */ }

      // Notify ISOLATED world when modality/store changes
      if (request.url.includes('/modality/preferences') && method === 'POST' && res.ok) {
        dbg('[KrogerExt] Modality change detected, dispatching cache-clear event');
        window.dispatchEvent(new CustomEvent(EVT.MODALITY_CHANGED));
      }

      // Signal coupon errors to ISOLATED world
      if (!res.ok && request.url.includes('/savings-coupons')) {
        window.dispatchEvent(
          new CustomEvent(EVT.COUPON_ERROR, { detail: { url: request.url, status: res.status } }),
        );
      }

      respond({ ok: res.ok, status: res.status, data, error: res.ok ? null : String(data) });
    } catch (err) {
      if (request.url.includes('/savings-coupons')) {
        window.dispatchEvent(
          new CustomEvent(EVT.COUPON_ERROR, { detail: { url: request.url, error: String(err) } }),
        );
      }
      respond({ ok: false, status: 0, data: null, error: String(err) });
    }
  } catch (err) {
    respond({ ok: false, status: 0, data: null, error: String(err) });
  }
});
