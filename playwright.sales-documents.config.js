import { defineConfig } from '@playwright/test';
import register from './playwright.sales-register.config.js';
export default defineConfig({ ...register, testMatch: ['sales-opportunity-documents.spec.js', 'sales-opportunity-workspace.spec.js', 'sales-opportunity-register.spec.js', 'sales-vf-registration.spec.js', 'sales-opportunity-history.spec.js'], outputDir: 'artifacts/opportunity-documents/results' });
