import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/leave', timeout: 120000, workers: 1, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5181', channel: 'chrome', viewport: { width: 1440, height: 900 }, screenshot: 'only-on-failure' },
  webServer: { command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5181', url: 'http://127.0.0.1:5181', reuseExistingServer: true, timeout: 120000 },
})
