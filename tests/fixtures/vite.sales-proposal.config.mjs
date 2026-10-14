import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  plugins: [react()], cacheDir: 'artifacts/proposal-preview/vite-cache',
  resolve: { alias: { '@': fileURLToPath(new URL('../../src', import.meta.url)) } },
  optimizeDeps: { entries: ['tests/fixtures/sales-proposal-preview.jsx'] },
  server: { host: '127.0.0.1', port: 5197, strictPort: true, preTransformRequests: false,
    fs: { allow: [fileURLToPath(new URL('../../../', import.meta.url))] },
    watch: { ignored: ['**/artifacts/**', '**/test-results*/**', '**/dist/**'] } },
});
