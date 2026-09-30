import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
export default defineConfig({
  plugins: [react()], cacheDir: 'artifacts/admin-ai-consumers/vite-cache',
  optimizeDeps: { entries: ['tests/fixtures/simple-planning-harness.jsx', 'tests/fixtures/retained-planning-harness.jsx'] },
  server: {
    host: '127.0.0.1', port: 5192, strictPort: true, preTransformRequests: false,
    fs: { allow: [fileURLToPath(new URL('../../../', import.meta.url))] },
    watch: { ignored: ['**/artifacts/**', '**/test-results*/**', '**/playwright-report/**', '**/dist/**'] },
  },
})
