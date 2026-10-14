import { defineConfig } from '@playwright/test';
import register from './playwright.sales-register.config.js';
export default defineConfig({ ...register, timeout: 90000, testMatch: ['sales-opportunity-fidelity.spec.js', 'sales-opportunity-radai-files.spec.js'], outputDir: 'artifacts/opportunity-fidelity/results' });
