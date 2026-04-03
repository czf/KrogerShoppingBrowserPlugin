import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import webExtension from 'vite-plugin-web-extension'

export default defineConfig(({ mode }) => ({
  define: {
    __KROGER_DEBUG__: mode === 'debug',
  },
  plugins: [
    react(),
    webExtension({
      manifest: 'manifest.json',
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
}))
