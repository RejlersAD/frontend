import { defineConfig } from 'vite'
import base from './vite.email-premium.config.mjs'

export default defineConfig({
  ...base,
  cacheDir: 'artifacts/email-reference/vite-cache',
  server: { ...base.server, port: 5186 },
})
