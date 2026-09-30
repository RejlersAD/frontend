import { defineConfig } from '@playwright/test'
import process from 'node:process'

const baseURL = 'http://127.0.0.1:5194'
export default defineConfig({
  testDir: './tests/accessibility', testMatch: 'sales-opportunity-register.spec.js',
  workers: 1, timeout: 45000, outputDir: 'artifacts/opportunity-register/results', reporter: 'list',
  use: { baseURL, browserName: 'chromium', channel: 'chrome', trace: 'retain-on-failure' },
  webServer: {
    command: `"${process.execPath}" node_modules/vite/bin/vite.js --config tests/fixtures/vite.sales-vf.config.mjs`,
    url: `${baseURL}/tests/fixtures/sales-vf-registration.html`,
    reuseExistingServer: !process.env.CI, timeout: 120000,
  },
})
