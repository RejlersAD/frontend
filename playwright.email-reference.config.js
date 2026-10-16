import { defineConfig } from '@playwright/test'
import process from 'node:process'
import base from './playwright.email-premium.config.js'

const baseURL = 'http://127.0.0.1:5186'

export default defineConfig({
  ...base,
  timeout: 90000,
  testMatch: 'sales-*.spec.js',
  outputDir: 'artifacts/email-reference/results',
  reporter: [['list'], ['html', { outputFolder: 'artifacts/email-reference/report', open: 'never' }]],
  use: { ...base.use, baseURL, timezoneId: 'Asia/Dubai' },
  webServer: {
    ...base.webServer,
    command: `"${process.execPath}" node_modules/vite/bin/vite.js --config tests/fixtures/vite.email-reference.config.mjs`,
    url: `${baseURL}/tests/fixtures/sales-shared-mailbox-messages.html`,
  },
})
