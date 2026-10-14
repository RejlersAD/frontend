import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { inlineLocalCssImports } from './ui-check-support.mjs';

const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('application stylesheet includes shared typography without browser imports', async () => {
  const filename = path.join(frontend, 'src/index.css');
  const css = await inlineLocalCssImports(await readFile(filename, 'utf8'), filename);
  assert.match(css, /@layer radai-table-typography/);
  assert.match(css, /@tailwind utilities/);
  assert.doesNotMatch(css, /@import\s/);
});

test('nested imports retain order and use the injected immutable reader', async () => {
  const root = path.resolve('fixture/index.css');
  const files = new Map([
    [path.resolve('fixture/base.css'), '@import "./nested/colors.css"; .base { color: navy; }'],
    [path.resolve('fixture/nested/colors.css'), '.tokens { color: blue; }'],
  ]);
  const reads = [];
  const css = await inlineLocalCssImports('@import "./base.css"; .last { color: red; }', root, async file => {
    reads.push(file);
    assert.ok(files.has(file));
    return files.get(file);
  });
  assert.equal(reads.length, 2);
  assert.ok(css.indexOf('.tokens') < css.indexOf('.base'));
  assert.ok(css.indexOf('.base') < css.indexOf('.last'));
  assert.doesNotMatch(css, /@import\s/);
});

test('cycles, network imports and unhandled import modifiers fail explicitly', async () => {
  const root = path.resolve('fixture/index.css');
  await assert.rejects(inlineLocalCssImports('@import "./index.css";', root, async () => '@import "./index.css";'), /Circular fixture CSS import/);
  for (const css of ['@import "https://example.test/style.css";', '@import "./base.css" screen;', '@import url("./base.css");']) {
    await assert.rejects(inlineLocalCssImports(css, root), /plain relative paths/);
  }
  await assert.rejects(inlineLocalCssImports('@import "./absent.css";', root), { code: 'ENOENT' });
});
