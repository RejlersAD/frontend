import { build } from 'esbuild';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

// Compile the actual upload component and API client, without starting the
// unrelated application router, PWA, or provider/storage services.
const directory = mkdtempSync(path.join(tmpdir(), 'radai-s3d-capabilities-'));
await build({
  entryPoints: ['tests/fixtures/s3d-local-capabilities.jsx'],
  outfile: path.join(directory, 'fixture.js'),
  bundle: true, format: 'esm', platform: 'browser',
  define: { 'import.meta.env': '{}', 'process.env.NODE_ENV': '"test"' },
  loader: { '.woff2': 'dataurl', '.woff': 'dataurl' },
});
const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>S3D capability checks</title><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>';
const server = createServer((request, response) => {
  const asset = request.url === '/fixture.js' ? ['fixture.js', 'text/javascript']
    : request.url === '/fixture.css' ? ['fixture.css', 'text/css'] : null;
  response.setHeader('Content-Type', asset ? asset[1] : 'text/html');
  response.end(asset ? readFileSync(path.join(directory, asset[0])) : html);
});
server.listen(5188, '127.0.0.1', () => console.log('S3D capability fixture ready on 5188'));
const cleanup = () => {
  for (const file of ['fixture.js', 'fixture.css']) rmSync(path.join(directory, file), { force: true });
  rmdirSync(directory);
};
process.on('exit', cleanup);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit()));
