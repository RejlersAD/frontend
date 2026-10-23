import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/accessibility',
  testMatch: ['executive-tab-access.spec.js', 'executive-finance-pipeline.spec.js'],
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5196', browserName: 'chromium', channel: 'chrome', viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' },
  webServer: {
    command: 'node scripts/serve-executive-access-tests.mjs',
    url: 'http://127.0.0.1:5196/tests/fixtures/executive-access-editor.html',
    reuseExistingServer: false,
    timeout: 120000,
  },
});
