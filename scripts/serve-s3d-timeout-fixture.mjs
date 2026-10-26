import { build } from 'esbuild';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

const directory = mkdtempSync(path.join(tmpdir(), 'radai-s3d-timeout-'));
await build({
  entryPoints: ['tests/fixtures/s3d-timeout-recovery.jsx'], outfile: path.join(directory, 'fixture.js'),
  bundle: true, format: 'esm', platform: 'browser',
  define: { 'import.meta.env': '{}', 'process.env.NODE_ENV': '"test"' },
  loader: { '.woff2': 'dataurl', '.woff': 'dataurl' },
  plugins: [{ name: 'inactive-screens', setup(context) {
    context.onResolve({ filter: /\/S3DDataExtractionHub$|\/S3DHistory$/ }, () => ({ path: 'inactive', namespace: 'fixture' }));
    context.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export default function InactiveScreen(){return null;}', loader: 'js' }));
  } }],
});
const server = createServer((request, response) => {
  const asset = request.url === '/fixture.js' ? ['fixture.js', 'text/javascript']
    : request.url === '/fixture.css' ? ['fixture.css', 'text/css'] : null;
  response.setHeader('Content-Type', asset ? asset[1] : 'text/html');
  response.end(asset ? readFileSync(path.join(directory, asset[0]))
    : '<!doctype html><html><head><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>');
});
server.listen(5190, '127.0.0.1');
process.on('exit', () => {
  for (const file of ['fixture.js', 'fixture.css']) rmSync(path.join(directory, file), { force: true });
  rmdirSync(directory);
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit()));
