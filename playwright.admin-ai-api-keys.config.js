import { defineConfig } from '@playwright/test'
import process from 'node:process'
const baseURL = 'http://127.0.0.1:5191'
export default defineConfig({
  testDir: './tests/accessibility', testMatch: ['admin-ai-api-keys.spec.js', 'central-ai-extraction.spec.js'], fullyParallel: false, workers: 1, timeout: 60000,
  outputDir: 'artifacts/admin-ai-api-keys/results', reporter: [['list'], ['html', { outputFolder: 'artifacts/admin-ai-api-keys/report', open: 'never' }]],
  use: { baseURL, browserName: 'chromium', channel: 'chrome', viewport: { width: 1366, height: 850 }, trace: 'off', screenshot: 'only-on-failure' },
  webServer: { command: `"${process.execPath}" node_modules/vite/bin/vite.js --config tests/fixtures/vite.admin-ai-api-keys.config.mjs`, url: `${baseURL}/tests/fixtures/admin-ai-api-keys.html`, reuseExistingServer: !process.env.CI, timeout: 120000 },
})
