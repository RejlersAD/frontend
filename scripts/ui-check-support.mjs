import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright-core';

// Historical redesign snapshots are local review artifacts, not required test fixtures.
// Functional, source-state, accessibility and geometry checks run independently of them.
export const historicalGuardsEnabled = (...modes) => process.argv.includes('--snapshot-guards') || modes.some(Boolean);
export const checkArtifacts = (frontend, name) => path.resolve(process.env.UI_CHECK_ARTIFACTS_ROOT || path.join(frontend, '../artifacts'), name);

export async function loadSnapshot(frontend, filename, enabled = true) {
  if (!enabled) return [];
  let rows;
  try { rows = JSON.parse((await readFile(filename, 'utf8')).replace(/^\uFEFF/, '')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    throw new Error(`Historical snapshot required for this mode: ${filename}. Run the normal command without --snapshot-guards or baseline/polish flags for portable functional checks.`, { cause: error });
  }
  return rows.map(row => {
    const relative = String(row.RelativePath || String(row.Path).replaceAll('\\', '/').split('/frontend/').at(-1)).replaceAll('\\', '/');
    assert.ok(/^(src|public)\//.test(relative), `Snapshot must identify a frontend source path: ${relative}`);
    return { ...row, RelativePath: relative, Path: path.join(frontend, relative) };
  });
}

export async function snapshotSources(frontend, files) {
  return Promise.all(files.map(async file => ({ RelativePath: file, Path: path.join(frontend, file),
    Hash: createHash('sha256').update(await readFile(path.join(frontend, file))).digest('hex').toUpperCase() })));
}

export async function sidebarWidth(frontend) {
  const source = await readFile(path.join(frontend, 'src/config/layout.config.js'), 'utf8');
  const width = Number(source.match(/widthClass:\s*'w-\[(\d+)px\]'/)?.[1]);
  assert.ok(Number.isFinite(width) && width > 72, 'Expanded sidebar width is configured');
  return width;
}

export async function launchBrowser() {
  const options = { headless: true, ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}) };
  try { return await chromium.launch(options); }
  catch (error) {
    if (process.env.PW_CHANNEL) throw error;
    // A local Chrome installation also works; CI can install Playwright Chromium.
    try { return await chromium.launch({ headless: true, channel: 'chrome' }); }
    catch { throw new Error('Install a browser with npx playwright install chromium, or set PW_CHANNEL to an installed browser channel.', { cause: error }); }
  }
}
