 
export const dbg: (...args: unknown[]) => void = __KROGER_DEBUG__
  ? (...args) => console.log('[KrogerExt]', ...args)
  : () => {};

export const dbgWarn: (...args: unknown[]) => void = __KROGER_DEBUG__
  ? (...args) => console.warn('[KrogerExt]', ...args)
  : () => {};
