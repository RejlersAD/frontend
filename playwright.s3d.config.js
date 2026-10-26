import { defineConfig } from '@playwright/test';
import process from 'node:process';

const port = 5187;
export default defineConfig({
  testDir: './tests/accessibility',
  testMatch: /s3d-(builder|reference-intelligence|controlled-release|preview-design)\.spec\.js/,
  timeout: Number(process.env.S3D_TEST_TIMEOUT_MS || 240000),
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: 'chromium',
    channel: process.env.S3D_TEST_BROWSER_CHANNEL === 'chromium' ? undefined : 'chrome',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 120000,
  },
});
