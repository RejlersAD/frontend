import { defineConfig } from '@playwright/test';
import preview from './playwright.sales-opportunity-office-preview.config.js';

export default defineConfig({
  ...preview,
  testMatch: 'sales-document-control.spec.js',
  outputDir: 'artifacts/sales-document-control/results',
});
