import { dbg, dbgWarn } from './debug';

const REQ_EVT = '__kroger_ext_request__';
const RES_EVT = '__kroger_ext_response__';

export interface InPageFetchResult<T = unknown> {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string | null;
}

function makeRequestId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function headersToRecord(h?: HeadersInit): Record<string, string> {
  const out: Record<string, string> = {};
  if (!h) return out;
  if (h instanceof Headers) {
    h.forEach((v, k) => { out[k.toLowerCase()] = v; });
  } else if (Array.isArray(h)) {
    for (const [k, v] of h) out[k.toLowerCase()] = String(v);
  } else {
    for (const [k, v] of Object.entries(h)) out[k.toLowerCase()] = String(v);
  }
  return out;
}

export async function inPageFetch(input: RequestInfo | URL, init?: RequestInit, timeoutMs = 30000): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof Request ? input.url : input.toString();
  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET'))?.toUpperCase() ?? 'GET';
  const headers = headersToRecord(init?.headers ?? (input instanceof Request ? input.headers : undefined));

  let body: unknown = init?.body;
  if (!body && input instanceof Request) {
    try {
      body = await input.clone().text();
    } catch (err) { dbgWarn('[inPageFetch] failed to read request body', err); }
  }

  const requestId = makeRequestId();

  return await new Promise(resolve => {
    const onResponse = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      // Debug: log responses coming from the page world
      try { dbg('[inPageFetch] onResponse', { requestId: detail.requestId, status: detail.status }); } catch (err) { dbgWarn('[inPageFetch] onResponse debug error', err); }
      if (detail.requestId !== requestId) return;
      window.removeEventListener(RES_EVT, onResponse as EventListener);

      const status = detail.status ?? 0;
      const data = detail.data ?? null;

      let bodyInit: BodyInit | null = null;
      let contentType = 'application/json;charset=UTF-8';

      if (data === null || typeof data === 'undefined') {
        bodyInit = null;
      } else if (typeof data === 'string') {
        bodyInit = data;
        contentType = 'text/plain;charset=UTF-8';
      } else {
        try {
          bodyInit = JSON.stringify(data);
        } catch (err) {
          bodyInit = String(data);
          contentType = 'text/plain;charset=UTF-8';
          dbgWarn('[inPageFetch] JSON.stringify failed', err);
        }
      }

      if (status === 0) {
        // Network failure or error from main world; represent as a network error Response
        resolve(Response.error());
        return;
      }

      const res = new Response(bodyInit, {
        status,
        headers: { 'content-type': contentType },
      });

      resolve(res);
    };

    window.addEventListener(RES_EVT, onResponse as EventListener);

    // Dispatch the request to the main world
    try { dbg('[inPageFetch] dispatch', { requestId, url, method, headers }); } catch (err) { dbgWarn('[inPageFetch] dispatch debug error', err); }
    window.dispatchEvent(new CustomEvent(REQ_EVT, {
      detail: {
        requestId,
        request: {
          url,
          method,
          headers,
          body,
          credentials: init?.credentials ?? 'include',
        },
      },
    }));

    // Timeout fallback
    setTimeout(() => {
      window.removeEventListener(RES_EVT, onResponse as EventListener);
      try { dbg('[inPageFetch] timeout', { requestId }); } catch (err) { dbgWarn('[inPageFetch] timeout debug error', err); }
      resolve(Response.error());
    }, timeoutMs);
  });
}

export default inPageFetch;
