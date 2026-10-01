import { defineConfig } from '@playwright/test';
import previewConfig from './playwright.sales-proposal.config.js';

// The Client page uses the real application Layout, Header and Sidebar.
export default defineConfig({
  ...previewConfig,
  testMatch: 'sales-client.spec.js',
  outputDir: 'artifacts/sales-client/results',
});
