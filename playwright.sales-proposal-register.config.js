import { defineConfig } from '@playwright/test';
import previewConfig from './playwright.sales-proposal.config.js';

// Reuse the existing real Layout/Header/Sidebar fixture and warmed App graph.
export default defineConfig({
  ...previewConfig,
  testMatch: 'sales-proposal-register.spec.js',
  outputDir: 'artifacts/proposal-register/results',
});
