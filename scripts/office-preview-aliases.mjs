import { fileURLToPath } from 'node:url';

// Narrow browser implementations needed by the MSG decoder's dependencies.
export const officePreviewAliases = {
  buffer: fileURLToPath(new URL('../node_modules/buffer/index.js', import.meta.url)),
  string_decoder: fileURLToPath(new URL('../node_modules/string_decoder/lib/string_decoder.js', import.meta.url)),
};

// Discover lazy worker dependencies at startup, rather than reload the active
// opportunity when Vite sees the first protected Office preview.
export const officePreviewDependencies = ['buffer', 'string_decoder', 'fflate', 'xlsx', 'mammoth/mammoth.browser.js', '@kenjiuno/msgreader'];
