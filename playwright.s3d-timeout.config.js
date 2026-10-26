import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/accessibility', testMatch: 's3d-timeout-recovery.spec.js', workers: 1,
  reporter: [['list']], use: { baseURL: 'http://127.0.0.1:5190', browserName: 'chromium' },
  webServer: { command: 'node scripts/serve-s3d-timeout-fixture.mjs', url: 'http://127.0.0.1:5190',
    reuseExistingServer: false, timeout: 60000 },
});
