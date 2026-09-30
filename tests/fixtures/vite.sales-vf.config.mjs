import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
export default defineConfig({
  plugins: [react()], cacheDir: 'artifacts/vf-registration/vite-cache',
  optimizeDeps: { entries: ['tests/fixtures/sales-vf-registration.jsx', 'tests/fixtures/sales-shared-mailbox-messages.jsx', 'tests/fixtures/sales-opportunity-history.jsx'] },
  server: { host: '127.0.0.1', port: 5194, strictPort: true, preTransformRequests: false,
    fs: { allow: [fileURLToPath(new URL('../../../', import.meta.url))] },
    watch: { ignored: ['**/artifacts/**', '**/test-results*/**', '**/dist/**'] } },
})
