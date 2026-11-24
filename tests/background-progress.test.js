import test from 'node:test';
import assert from 'node:assert/strict';
import { importProgress, scanProgress } from '../src/pages/Sales/backgroundProgressPresentation.js';

test('queued and opening imports show an indeterminate bar', () => {
  assert.equal(importProgress({ status: 'queued' }).indeterminate, true);
  assert.equal(importProgress({ status: 'running', entries_total: 0 }).indeterminate, true);
});

test('running import reports files done of total', () => {
  const progress = importProgress({ status: 'running', entries_total: 280, processed: 70, skipped: 0, failed: 0 });
  assert.equal(progress.label, 'Extracting 70 of 280 files');
  assert.equal(progress.value, 25);
});

test('finished import summarises extracted and skipped files', () => {
  const progress = importProgress({ status: 'partial', entries_total: 10, processed: 8, skipped: 2, failed: 0 });
  assert.equal(progress.label, 'Extracted 8 files, 2 skipped');
  assert.equal(progress.finished, true);
});

test('scan progress appears only while the scan runs', () => {
  assert.equal(scanProgress({ status: 'completed', counts: { total: 5, queued: 0 } }), null);
  assert.equal(scanProgress({ status: 'running', stale: true, counts: {} }), null);
  const scan = scanProgress({ status: 'running', counts: { total: 200, queued: 50 } });
  assert.equal(scan.label, 'Scanning documents 150 of 200');
  assert.equal(scan.value, 75);
});
