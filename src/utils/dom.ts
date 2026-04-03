/** Resolves once `selector` appears in the DOM (or immediately if already present). */
export function waitForElement(selector: string, timeoutMs = 10_000): Promise<Element | null> {
  return new Promise(resolve => {
    const existing = document.querySelector(selector);
    if (existing) { resolve(existing); return; }

    const timer = setTimeout(() => { obs.disconnect(); resolve(null); }, timeoutMs);
    const obs = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) { clearTimeout(timer); obs.disconnect(); resolve(el); }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  });
}

/**
 * Calls `callback` for every existing and future element matching `selector`
 * within `root`. Returns the underlying MutationObserver so callers can
 * disconnect it later.
 *
 * Callbacks for newly-added nodes are deferred via requestAnimationFrame so
 * they run after React's synchronous commit phase, preventing hydration errors.
 */
export function observeSelector(
  selector: string,
  callback: (el: Element) => void,
  root: Element | Document = document,
): MutationObserver {
  const target = root instanceof Document ? root.body : root;
  target.querySelectorAll(selector).forEach(callback);

  const obs = new MutationObserver(mutations => {
    const pending: Element[] = [];
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        const el = node as Element;
        if (el.matches(selector)) pending.push(el);
        el.querySelectorAll(selector).forEach(e => pending.push(e));
      }
    }
    if (pending.length) {
      // Defer until after React's commit phase to avoid hydration conflicts
      requestAnimationFrame(() => pending.forEach(callback));
    }
  });
  obs.observe(target, { childList: true, subtree: true });
  return obs;
}

/** Fires `callback` every time the page URL changes (SPA navigation). */
export function onUrlChange(callback: (url: string) => void): void {
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      callback(lastUrl);
    }
  }).observe(document, { subtree: true, childList: true });
}
