import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Isolated synthetic-browser server: no backend proxy or production API target.
export default defineConfig({
  plugins: [react()],
  cacheDir: 'artifacts/email-premium/vite-cache',
  optimizeDeps: { entries: ['tests/fixtures/sales-shared-mailbox-messages.html', 'tests/fixtures/sales-mailbox-privacy.html'] },
  server: {
    host: '127.0.0.1', port: 5175, strictPort: true,
    preTransformRequests: false,
    watch: { ignored: ['**/artifacts/**', '**/test-results*/**', '**/playwright-report/**', '**/dist/**'] },
  },
})
