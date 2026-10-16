import { defineConfig } from '@playwright/test';
import register from './playwright.sales-register.config.js';

export default defineConfig({ ...register, testMatch: 'sales-opportunity-analysis.spec.js', timeout: 90000,
  outputDir: 'artifacts/opportunity-analysis/browser' });
