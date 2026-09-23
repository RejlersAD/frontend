import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// These browser regressions use intercepted API routes; never proxy to a backend.
export default defineConfig({
  root: fileURLToPath(new URL('../', import.meta.url)),
  cacheDir: '.vite/notification-tests',
  plugins: [
    react(),
    {
      name: 'notification-tests-no-service-worker',
      resolveId: id => id === 'virtual:pwa-register' ? '\0notification-tests-pwa' : null,
      load: id => id === '\0notification-tests-pwa' ? 'export const registerSW = () => async () => {}' : null,
    },
  ],
  optimizeDeps: {
    entries: ['tests/fixtures/notification-drawer.html', 'tests/fixtures/approval-queue-access.html', 'tests/fixtures/global-approval.html'],
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) },
    dedupe: ['react', 'react-dom', '@emotion/react', '@emotion/styled'],
  },
  define: {
    __PROD_BACKEND__: 'false',
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify('/api/v1'),
    'import.meta.env.VITE_BACKEND_URL': JSON.stringify('http://127.0.0.1:5194'),
  },
  server: { host: '127.0.0.1', port: 5194, strictPort: true },
})
