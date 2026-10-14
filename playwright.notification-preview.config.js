import { defineConfig } from '@playwright/test'

const baseURL = 'http://127.0.0.1:5197'
export default defineConfig({
  testDir: './tests/accessibility',
  testMatch: ['notification-preview.spec.js'],
  timeout: 120000,
  workers: 1,
  reporter: 'list',
  outputDir: './test-results-notification-preview',
  use: {
    baseURL, channel: 'chrome', viewport: { width: 1440, height: 1000 },
    serviceWorkers: 'block', trace: 'retain-on-failure', screenshot: 'only-on-failure',
  },
  webServer: {
    command: `"${process.execPath}" node_modules/vite/bin/vite.js --config tests/vite.notification-preview.config.js --host 127.0.0.1 --port 5197 --strictPort`,
    url: baseURL, reuseExistingServer: false, timeout: 120000,
  },
})
