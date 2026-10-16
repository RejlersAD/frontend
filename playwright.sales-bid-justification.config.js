import { defineConfig } from '@playwright/test';
import register from './playwright.sales-register.config.js';

export default defineConfig({ ...register, testMatch: 'sales-bid-justification.spec.js', timeout: 90000, outputDir: 'artifacts/sales-bid-justification/results' });
