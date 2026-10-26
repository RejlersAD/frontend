import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/accessibility',
  testMatch: 's3d-builder.spec.js',
  grep: /capability/,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:5188', browserName: 'chromium', trace: 'retain-on-failure' },
  webServer: {
    command: 'node scripts/serve-s3d-capability-fixture.mjs',
    url: 'http://127.0.0.1:5188',
    reuseExistingServer: false,
    timeout: 60000,
  },
});
