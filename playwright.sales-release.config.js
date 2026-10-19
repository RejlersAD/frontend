import { defineConfig } from '@playwright/test';
import register from './playwright.sales-register.config.js';

export default defineConfig({
  ...register,
  testMatch: ['sales-bid-justification.spec.js', 'sales-opportunity-analysis.spec.js'],
  timeout: 180000,
  outputDir: 'artifacts/sales-release-browser/results',
});
