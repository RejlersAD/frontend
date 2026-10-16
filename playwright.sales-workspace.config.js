import { defineConfig } from '@playwright/test';
import base from './playwright.sales-register.config.js';
export default defineConfig({ ...base, testMatch: 'sales-opportunity-workspace.spec.js', outputDir: 'artifacts/opportunity-workspace/results' });
