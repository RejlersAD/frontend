import test from 'node:test';
import assert from 'node:assert/strict';
import { validateWorkbookBlob, workbookDownloadError } from '../src/utils/workbookDownload.js';

test('download errors decode the server JSON inside a Blob', async () => {
  const error = { message: 'Request failed with status code 409', response: { data: new Blob([JSON.stringify({ error: 'Wait for extraction to finish.' })]) } };
  assert.equal(await workbookDownloadError(error), 'Wait for extraction to finish.');
});

test('JSON errors and empty responses cannot be saved as XLSX files', async () => {
  await assert.rejects(validateWorkbookBlob(new Blob()), /empty workbook/);
  await assert.rejects(validateWorkbookBlob(new Blob([JSON.stringify({ error: 'No component rows available.' })])), /No component rows/);
});

test('ZIP workbook blobs pass validation without changing their bytes', async () => {
  const workbook = new Blob([new Uint8Array([0x50, 0x4b, 0x03, 0x04])]);
  assert.equal(await validateWorkbookBlob(workbook), workbook);
});
