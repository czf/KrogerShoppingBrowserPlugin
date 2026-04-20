Browser-level smoke test for inPageFetch ↔ fetchInterceptor

Purpose

Small manual/instructive smoke test to validate the in-page fetch bridge in a real browser (Chrome) without adding heavy test deps.

Quick steps (manual)

1. Build the extension

   npm run build

2. Load the extension in Chrome

   - Open chrome://extensions
   - Enable "Developer mode"
   - Click "Load unpacked" and select the repository `dist` directory (the built extension)

3. Open a page (e.g., https://www.example.com) and open DevTools (Console)

4. Prime the interceptor by issuing a capture fetch from the page context (this makes the fetchInterceptor capture headers):

   fetch('/atlas/v1/capture', { method: 'GET', headers: { 'x-facility-id': 'F1', 'x-laf-object': 'OBJ1' } });

5. Trigger an in-page proxied fetch (executes in page world, will be relayed to the extension):

   const s = document.createElement('script');
   s.textContent = `fetch('/atlas/v1/proxied/data', { method: 'GET' }).then(r=>r.json()).then(console.log).catch(console.error)`;
   document.documentElement.appendChild(s);

6. Observe results

   - Open the extension's service worker console (chrome://extensions → "background" / Service Worker view) and look for dbg logs indicating the proxied request and header preservation.
   - In the page console you should see the JSON response from the stubbed originalFetch (if the site returned something).

Optional: Automated (Playwright)

If you want an automated smoke test, Playwright is a good choice. Example notes:

1. Install Playwright dev deps and browser runners:

   npm i -D @playwright/test
   npx playwright install chromium

2. Example test (tests/inpagefetch.spec.ts):

   import { test, expect } from '@playwright/test';
   import path from 'path';

   test('inPageFetch bridge smoke', async ({ chromium }) => {
     const userDataDir = path.join(process.cwd(), '.pw-user-data');
     const cr = await chromium.launchPersistentContext(userDataDir, { headless: false });
     const background = path.join(process.cwd(), 'dist');
     // Load unpacked extension using chromium.launchPersistentContext args (see Playwright docs)
     // Navigate to a test page and execute the capture/proxied fetch sequence from the page context.
     await cr.close();
   });

Notes

- This doc describes a small manual verification flow so CI doesn't require adding large browser test deps. If you want automated Playwright tests added to CI, confirm and I'll scaffold test files and package.json scripts (this will add devDependencies and require installing them).