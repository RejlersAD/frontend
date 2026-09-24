import base from './vite.notifications.config.js'

export default {
  ...base,
  cacheDir: '.vite/notification-center-tests',
  optimizeDeps: { entries: ['tests/fixtures/notification-center.html', 'tests/fixtures/notification-preview.html', 'tests/fixtures/notification-drawer.html'] },
  define: { ...base.define, 'import.meta.env.VITE_BACKEND_URL': JSON.stringify('http://127.0.0.1:5218') },
  server: { host: '127.0.0.1', port: 5218, strictPort: true, watch: { ignored: ['**/test-results*/**', '**/playwright-report/**'] } },
}
