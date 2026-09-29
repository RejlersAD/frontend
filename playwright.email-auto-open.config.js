import { defineConfig } from '@playwright/test'
import process from 'node:process'
import base from './playwright.email-premium.config.js'

const baseURL = 'http://127.0.0.1:5176'

export default defineConfig({
  ...base,
  use: { ...base.use, baseURL },
  webServer: {
    ...base.webServer,
    command: `"${process.execPath}" node_modules/vite/bin/vite.js --config tests/fixtures/vite.email-auto-open.config.mjs`,
    url: `${baseURL}/tests/fixtures/sales-shared-mailbox-messages.html`,
  },
})
