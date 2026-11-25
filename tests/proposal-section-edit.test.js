import test from 'node:test';
import assert from 'node:assert/strict';
import {
  editProblem, editableSections, isDirty, moveRow, newRow, sectionForPage, toEditable, toPayload,
} from '../src/pages/Sales/proposalSectionEdit.js';

const blocks = [
  { type: 'part', text: 'INTRODUCTION' },
  { type: 'paragraph', text: 'Rejlers will deliver the study.', citations: ['T1'] },
  { type: 'bullets', text: '', items: ['One', 'Two'], citations: ['T2'] },
  { type: 'table', text: '', columns: ['No.', 'Deliverable'], rows: [['1', 'Report']], citations: [] },
];

test('round trip keeps origins and is clean until edited', () => {
  const rows = toEditable(blocks);
  assert.equal(isDirty(blocks, rows), false);
  assert.deepEqual(toPayload(rows).map((b) => b.ref), [0, 1, 2, 3]);
  rows[1].text = 'Rejlers will deliver the study within six months.';
  assert.equal(isDirty(blocks, rows), true);
  assert.equal(toPayload(rows)[1].text, 'Rejlers will deliver the study within six months.');
});

test('new blocks carry no origin and must be filled in', () => {
  const rows = [...toEditable(blocks), newRow('paragraph')];
  assert.equal(toPayload(rows).at(-1).ref, undefined);
  assert.match(editProblem(rows, 'reason'), /paragraph is empty/);
  rows.at(-1).text = 'Added by the reviewer.';
  assert.equal(editProblem(rows, 'reason'), '');
  assert.match(editProblem(rows, ' '), /reason/);
});

test('markup and empty tables are refused', () => {
  const rows = toEditable(blocks);
  rows[1].text = '<b>bold</b>';
  assert.match(editProblem(rows, 'x'), /plain text/);
  const table = toEditable(blocks);
  table[3].rows = [];
  assert.match(editProblem(table, 'x'), /at least one row/);
});

test('moving rows and finding the section on a page', () => {
  const rows = toEditable(blocks);
  assert.deepEqual(moveRow(rows, 1, 1).map((r) => r.type), ['part', 'bullets', 'paragraph', 'table']);
  assert.equal(moveRow(rows, 0, -1), rows);
  const sections = [{ key: 'qs', pages: [4, 5], kind: 'authored' }, { key: 'cover', pages: [1, 1], kind: 'cover' }];
  assert.equal(sectionForPage(sections, 5).key, 'qs');
  assert.equal(sectionForPage(sections, 9), null);
  assert.deepEqual(editableSections({ sections }).map((s) => s.key), ['qs']);
});
