import '@testing-library/jest-dom';

// Stub chrome extension APIs not available in jsdom
globalThis.chrome = {
  storage: {
    sync: {
      get: vi.fn().mockImplementation((_key: unknown, cb: (r: Record<string, unknown>) => void) => cb({})),
      set: vi.fn().mockImplementation((_data: unknown, cb?: () => void) => { if (cb) cb(); }),
    },
  },
  runtime: {
    id: 'test-extension-id',
    lastError: undefined,
  },
} as unknown as typeof chrome;

// Stub __KROGER_DEBUG__ define
(globalThis as Record<string, unknown>).__KROGER_DEBUG__ = false;
