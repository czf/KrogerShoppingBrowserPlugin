import { describe, it, expect, vi } from 'vitest';

describe('inPageFetch <-> fetchInterceptor smoke', () => {
  it('forwards requests to main world and preserves captured headers', async () => {
    const calls: Array<{ input: string; init?: unknown }> = [];

    // Stub global fetch so fetchInterceptor captures the originalFetch binding
    (globalThis as unknown as { fetch?: (input: RequestInfo, init?: RequestInit) => Promise<Response> }).fetch = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input?.url?.toString?.() ?? String(input);
      calls.push({ input: url, init });
      return new Response(JSON.stringify({ echoedUrl: url }), { status: 200, headers: { 'content-type': 'application/json' } });
    });

    // Import fetchInterceptor after stubbing fetch so it binds originalFetch to our stub
    await import('./fetchInterceptor');

    // Trigger a page fetch that includes atlas/v1 to capture headers in the interceptor
    await (globalThis as unknown as { fetch?: (input: RequestInfo, init?: RequestInit) => Promise<Response> }).fetch?.('/atlas/v1/capture', { method: 'GET', headers: { 'x-facility-id': 'F1', 'x-laf-object': 'OBJ1' } });

    // Import inPageFetch and call it; it should dispatch the request and receive a proxied response
    const { inPageFetch } = await import('../utils/inPageFetch');
    const res = await inPageFetch('/atlas/v1/proxied/data', { method: 'GET' });

    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data).toBeDefined();
    expect(String(data?.echoedUrl)).toContain('/atlas/v1/proxied/data');

    // Ensure the proxied originalFetch received the captured header
    const proxied = calls.find(c => String(c.input).includes('/atlas/v1/proxied/data'));
    expect(proxied).toBeTruthy();
    const hdrs: any = (proxied!.init as any)?.headers ?? {};
    const facility = hdrs['x-facility-id'] ?? hdrs['X-Facility-Id'] ?? hdrs['x-facility-id'.toLowerCase()];
    expect(facility).toBe('F1');
  });
});
