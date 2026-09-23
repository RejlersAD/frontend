import base from './vite.notifications.config.js'

// Exercise the actual App with intercepted requests and no backend proxy.
// Match production's Emotion/MUI deduplication for this full-app entry.
export default {
  ...base,
  cacheDir: '.vite/po-approval-tests',
  optimizeDeps: {
    entries: ['index.html'],
    include: [
      '@emotion/styled', '@emotion/react', '@mui/styled-engine',
      '@mui/private-theming', '@mui/system', '@mui/system/createTheme',
      '@mui/material', '@mui/material/styles', '@mui/x-data-grid',
    ],
  },
  resolve: {
    ...base.resolve,
    dedupe: [
      ...base.resolve.dedupe, '@mui/material', '@mui/private-theming',
      '@mui/styled-engine', '@mui/system',
    ],
  },
  define: { ...base.define, 'import.meta.env.VITE_BACKEND_URL': JSON.stringify('http://127.0.0.1:5197') },
  server: { host: '127.0.0.1', port: 5197, strictPort: true },
}
