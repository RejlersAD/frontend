import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { build } from 'esbuild';

const bundled = await build({
  entryPoints: ['src/services/specCustomizationAPI.js'], bundle: true, write: false,
  format: 'esm', platform: 'node', define: { 'import.meta.env': '{}' },
  plugins: [{ name: 'transport-fixture', setup(context) {
    for (const [filter, path] of [[/api\.service$/, 'api'], [/api\.config$/, 'config'],
      [/app\.config$/, 'storage'], [/^axios$/, 'axios']]) {
      context.onResolve({ filter }, () => ({ path, namespace: 'fixture' }));
    }
    context.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ contents: {
      api: 'export default globalThis.__s3dTransport;',
      config: 'export const API_TIMEOUT_UPLOAD = 120000;',
      storage: 'export const STORAGE_KEYS = {ACCESS_TOKEN:"test-access"};',
      axios: 'export default {};',
    }[path], loader: 'js' }));
  } }],
});
let session = 'account-a';
globalThis.localStorage = { getItem: () => session };
const transport = globalThis.__s3dTransport = { get: null, post: async () => ({ data: {} }) };
const { default: api } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { resolve, promise }; };

test('concurrent actual preview consumers share one GET and completed data is not cached', async () => {
  const pending = deferred(); let calls = 0;
  transport.get = () => { calls += 1; return pending.promise; };
  const first = api.getWorkbookPreview('job', 'spec'), second = api.getWorkbookPreview('job', 'spec');
  await Promise.resolve(); assert.equal(calls, 1);
  pending.resolve({ data: { sheets: [] } });
  assert.deepEqual(await first, await second);
  await api.getWorkbookPreview('job', 'spec'); assert.equal(calls, 2);
});
test('different jobs and workbook types remain independent', async () => {
  let calls = 0;
  transport.get = async () => { calls += 1; return { data: {} }; };
  await Promise.all([api.getWorkbookPreview('first', 'spec'), api.getWorkbookPreview('first', 'cat'), api.getWorkbookPreview('second', 'spec')]);
  assert.equal(calls, 3);
});
test('a changed login cannot receive an earlier account preview', async () => {
  const pending = deferred();
  transport.get = () => pending.promise;
  const old = api.getWorkbookPreview('job');
  const denied = assert.rejects(old, { code: 'ERR_CANCELED' });
  await Promise.resolve(); session = 'account-b';
  transport.get = async () => ({ data: { account: 'b' } });
  assert.equal((await api.getWorkbookPreview('job')).account, 'b');
  pending.resolve({ data: { account: 'a' } }); await denied;
});
test('edits invalidate pending reads and a new read sees the saved response', async () => {
  const pending = deferred();
  transport.get = () => pending.promise;
  const old = api.getWorkbookPreview('job');
  const stopped = assert.rejects(old, { code: 'ERR_CANCELED' });
  await Promise.resolve(); await api.batchSaveWorkbookCells('job', []);
  transport.get = async () => ({ data: { edited: true } });
  assert.equal((await api.getWorkbookPreview('job')).edited, true);
  pending.resolve({ data: {} }); await stopped;
});
test('a rejected preview can be retried', async () => {
  transport.get = async () => { throw new Error('Synthetic timeout'); };
  await assert.rejects(api.getWorkbookPreview('job'), /Synthetic timeout/);
  transport.get = async () => ({ data: { ready: true } });
  assert.equal((await api.getWorkbookPreview('job')).ready, true);
});
