import { build } from 'esbuild';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';

// Bundle actual components into isolated synthetic fixtures. This avoids the
// unrelated application dependency scan and never proxies to a live backend.
const output = resolve('node_modules/.cache/executive-access-tests');
await build({
  entryPoints: ['tests/fixtures/executive-access-editor.jsx', 'tests/fixtures/executive-finance-pipeline.jsx'],
  outdir: output,
  bundle: true,
  format: 'esm',
  jsx: 'automatic',
  loader: { '.woff2': 'file', '.woff': 'file' },
  define: { 'import.meta.env': JSON.stringify({ DEV: true, MODE: 'test' }) },
});
const fixtures = {
  '/tests/fixtures/executive-access-editor.html': ['executive-access-editor', 'root'],
  '/tests/fixtures/executive-finance-pipeline.html': ['executive-finance-pipeline', 'executive-pipeline-test'],
};
createServer(async (request, response) => {
  const path = new URL(request.url, 'http://127.0.0.1:5196').pathname;
  const fixture = fixtures[path];
  if (fixture) {
    response.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
    response.end(`<!doctype html><html lang="en"><head><meta charset="UTF-8"><title>Executive access fixture</title><link rel="stylesheet" href="/__fixtures__/${fixture[0]}.css"></head><body><div id="${fixture[1]}"></div><script type="module" src="/__fixtures__/${fixture[0]}.js"></script></body></html>`);
    return;
  }
  if (/^\/__fixtures__\/[\w.-]+$/.test(path)) {
    try {
      const file = path.slice('/__fixtures__/'.length);
      const bytes = await readFile(resolve(output, file));
      response.writeHead(200, { 'Content-Type': file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : 'font/woff2' });
      response.end(bytes);
      return;
    } catch { /* Return 404 for unknown fixture assets. */ }
  }
  response.writeHead(404);
  response.end();
}).listen(5196, '127.0.0.1', () => process.stdout.write('Executive access fixtures ready on 5196\n'));
