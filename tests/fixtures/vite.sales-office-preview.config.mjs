import { defineConfig, mergeConfig } from 'vite';
import sales from './vite.sales-vf.config.mjs';
import { officePreviewDependencies } from '../../scripts/office-preview-aliases.mjs';

export default defineConfig(mergeConfig(sales, {
  cacheDir: 'artifacts/opportunity-office-preview/vite-cache',
  optimizeDeps: { include: officePreviewDependencies },
  server: { port: 5198, hmr: false, watch: null },
}));
