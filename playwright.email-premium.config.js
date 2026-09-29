import { defineConfig } from '@playwright/test'
import process from 'node:process'
import base from './playwright.config.js'

const baseURL = 'http://127.0.0.1:5175'

export default defineConfig({
  ...base,
  use: { ...base.use, baseURL },
  webServer: {
    command: `"${process.execPath}" node_modules/vite/bin/vite.js --config tests/fixtures/vite.email-premium.config.mjs`,
    url: `${baseURL}/tests/fixtures/sales-shared-mailbox-messages.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
