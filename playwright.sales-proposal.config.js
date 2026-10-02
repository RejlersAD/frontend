import { defineConfig } from '@playwright/test';
import process from 'node:process';
const baseURL = 'http://127.0.0.1:5197';
export default defineConfig({
  testDir: './tests/accessibility', testMatch: 'sales-proposal-preview.spec.js',
  workers: 1, timeout: 90000, outputDir: 'artifacts/proposal-preview/results', reporter: 'list',
  use: { baseURL, browserName: 'chromium', channel: 'chrome', trace: 'retain-on-failure' },
  webServer: {
    command: `"${process.execPath}" node_modules/vite/bin/vite.js --config tests/fixtures/vite.sales-proposal.config.mjs`,
    url: `${baseURL}/tests/fixtures/sales-proposal-preview.html`,
    reuseExistingServer: !process.env.CI, timeout: 120000,
  },
});
