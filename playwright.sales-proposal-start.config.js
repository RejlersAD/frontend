import { defineConfig } from '@playwright/test';
import register from './playwright.sales-proposal-register.config.js';

export default defineConfig({ ...register, testMatch: 'sales-proposal-start-ai.spec.js', timeout: 90000, outputDir: 'artifacts/sales-proposal-start/results' });
