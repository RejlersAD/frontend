import { defineConfig } from '@playwright/test'

const baseURL = 'http://127.0.0.1:5194'

export default defineConfig({
  testDir: './tests/accessibility',
  testMatch: ['notification-drawer.spec.js', 'approval-queue-access.spec.js', 'global-approval-eligibility.spec.js'],
  // Cold Vite transforms of shared approval imports can exceed one minute on Windows.
  timeout: 120000,
  workers: 1,
  reporter: 'list',
  outputDir: './test-results-notifications',
  use: {
    baseURL,
    channel: 'chrome',
    viewport: { width: 1440, height: 1000 },
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `"${process.execPath}" node_modules/vite/bin/vite.js --config tests/vite.notifications.config.js --host 127.0.0.1 --port 5194 --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
