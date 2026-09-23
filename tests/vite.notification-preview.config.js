import base from './vite.notifications.config.js'

export default {
  ...base,
  cacheDir: '.vite/notification-preview-tests',
  optimizeDeps: { entries: ['tests/fixtures/notification-preview.html'] },
  define: { ...base.define, 'import.meta.env.VITE_BACKEND_URL': JSON.stringify('http://127.0.0.1:5197') },
  server: { host: '127.0.0.1', port: 5197, strictPort: true },
}
