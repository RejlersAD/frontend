import { defineConfig } from '@playwright/test'
import process from 'node:process'
const baseURL = 'http://127.0.0.1:5192'
export default defineConfig({
  testDir: './tests/accessibility',
  testMatch: ['planning-ai-provider.spec.js', 'planning-byok-readiness.spec.js'],
  workers: 1, timeout: 60000,
  outputDir: 'artifacts/admin-ai-consumers/results', reporter: 'list',
  use: { baseURL, browserName: 'chromium', channel: 'chrome', trace: 'off' },
  webServer: {
    command: `"${process.execPath}" node_modules/vite/bin/vite.js --config tests/fixtures/vite.ai-consumers.config.mjs`,
    url: `${baseURL}/tests/fixtures/admin-ai-api-keys.html`, reuseExistingServer: !process.env.CI, timeout: 120000,
  },
})
