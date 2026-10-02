import { defineConfig } from '@playwright/test';
import previewConfig from './playwright.sales-proposal.config.js';

// Frameworks render inside the actual application Layout, Header and Sidebar.
export default defineConfig({
  ...previewConfig,
  testMatch: 'sales-framework.spec.js',
  outputDir: 'artifacts/sales-framework/results',
});
