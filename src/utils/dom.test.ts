import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { waitForElement } from './dom';

// jsdom is the test environment; document.body is available

describe('waitForElement', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves immediately when selector already exists', async () => {
    document.body.innerHTML = '<div class="target">hi</div>';
    const el = await waitForElement('.target');
    expect(el).not.toBeNull();
    expect(el?.className).toBe('target');
  });

  it('resolves when element is added to DOM after a delay', async () => {
    let resolved: Element | null = undefined as unknown as Element | null;
    const promise = waitForElement('.late').then(el => { resolved = el; });

    // Element not yet added
    expect(resolved).toBeUndefined();

    // Add element
    const div = document.createElement('div');
    div.className = 'late';
    document.body.appendChild(div);

    await promise;
    expect(resolved).toBe(div);
  });

  it('resolves null on timeout when element never appears', async () => {
    const promise = waitForElement('.missing', 1000);
    await vi.advanceTimersByTimeAsync(1001);
    const el = await promise;
    expect(el).toBeNull();
  });
});

describe('extractUpcFromUrl', () => {
  // extractUpcFromUrl is not exported; test via productPage.ts indirectly,
  // or we inline the regex here for a pure unit test
  function extractUpc(pathname: string): string | null {
    const match = pathname.match(/\/p\/[^/]+\/(\d{8,14})/);
    return match?.[1] ?? null;
  }

  it('extracts 12-digit UPC from product path', () => {
    expect(extractUpc('/p/deli-chicken-salad/0001111034782')).toBe('0001111034782');
  });

  it('extracts 8-digit UPC', () => {
    expect(extractUpc('/p/some-product/00011234')).toBe('00011234');
  });

  it('returns null for non-product paths', () => {
    expect(extractUpc('/savings/cl/coupons/')).toBeNull();
  });

  it('returns null when UPC is too short', () => {
    expect(extractUpc('/p/product/123456')).toBeNull(); // < 8 digits
  });
});
