import { defineConfig } from '@playwright/test';
import process from 'node:process';
import preview from './playwright.sales-opportunity-preview.config.js';

export default defineConfig({
  ...preview,
  testMatch: 'sales-opportunity-office-preview.spec.js',
  outputDir: 'artifacts/opportunity-office-preview/results',
  use: { ...preview.use, baseURL: 'http://127.0.0.1:5198' },
  webServer: {
    command: `"${process.execPath}" node_modules/vite/bin/vite.js --config tests/fixtures/vite.sales-office-preview.config.mjs`,
    url: 'http://127.0.0.1:5198/tests/fixtures/sales-vf-registration.html',
    reuseExistingServer: false,
    timeout: 120000,
  },
});
