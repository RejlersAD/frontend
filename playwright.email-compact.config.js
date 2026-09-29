import { defineConfig } from '@playwright/test'
import process from 'node:process'
import base from './playwright.email-reference.config.js'

const baseURL = 'http://127.0.0.1:5188'

export default defineConfig({
  ...base,
  outputDir: 'artifacts/email-compact/results',
  reporter: [['list'], ['html', { outputFolder: 'artifacts/email-compact/report', open: 'never' }]],
  use: { ...base.use, baseURL },
  webServer: {
    ...base.webServer,
    command: `"${process.execPath}" node_modules/vite/bin/vite.js --config tests/fixtures/vite.email-compact.config.mjs`,
    url: `${baseURL}/tests/fixtures/sales-shared-mailbox-messages.html`,
  },
})
