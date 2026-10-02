import { defineConfig } from '@playwright/test';
import previewConfig from './playwright.sales-proposal.config.js';

// Render Forecast through the unchanged application Layout, Header and Sidebar.
export default defineConfig({
  ...previewConfig,
  testMatch: 'sales-forecast.spec.js',
  outputDir: 'artifacts/sales-forecast/results',
});
