import { defineConfig } from '@playwright/test';
import register from './playwright.sales-register.config.js';

export default defineConfig({
  ...register,
  testMatch: 'sales-opportunity-preview.spec.js',
  timeout: 120000,
  outputDir: 'artifacts/opportunity-preview/results',
});
