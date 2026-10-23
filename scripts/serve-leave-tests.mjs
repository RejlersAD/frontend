import { createServer } from 'vite'
import react from '@vitejs/plugin-react'

// Exercise the real leave component without scanning unrelated application pages
// or proxying synthetic browser fixtures to a live backend.
const server = await createServer({
  configFile: false,
  plugins: [react(), {
    name: 'leave-fixture-readiness',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url === '/') { response.end('Leave fixtures ready'); return }
        next()
      })
    },
  }],
  cacheDir: 'node_modules/.vite-leave-tests',
  optimizeDeps: { entries: ['tests/leave/harness.html'] },
  server: { host: '127.0.0.1', port: 5181, strictPort: true },
})
await server.listen()
