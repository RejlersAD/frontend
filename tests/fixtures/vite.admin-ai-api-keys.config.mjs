import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()], cacheDir: 'artifacts/admin-ai-api-keys/vite-cache',
  optimizeDeps: { entries: ['tests/fixtures/admin-ai-api-keys.html', 'tests/fixtures/central-ai-extraction.html'] },
  server: { host: '127.0.0.1', port: 5191, strictPort: true, preTransformRequests: false, watch: { ignored: ['**/artifacts/**', '**/test-results*/**', '**/playwright-report/**', '**/dist/**'] } },
})
