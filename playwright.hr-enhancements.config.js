import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/hr-enhancements',
  workers: 1,
  timeout: 90000,
  reporter: 'list',
  use: {
    baseURL: process.env.PW_BASE_URL || 'http://localhost:5173',
    browserName: 'chromium',
    channel: 'chrome',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
})
