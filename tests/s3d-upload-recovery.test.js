import test from 'node:test';
import assert from 'node:assert/strict';
import { findAcceptedS3DUpload } from '../src/utils/s3dUploadRecovery.js';

const file = { name: 'PMS.pdf', size: 83_210_821 };
const startedAt = Date.parse('2026-10-26T12:00:00Z');
const job = { id: 'owned-job', status: 'processing', created_at: '2026-10-26T12:00:01Z',
  document_meta: { original_filename: file.name, file_size_bytes: file.size } };

test('recovers a uniquely matching accepted upload while extraction continues', () => {
  assert.equal(findAcceptedS3DUpload([job], file, startedAt), job);
  assert.equal(findAcceptedS3DUpload([{ ...job, status: 'completed' }], file, startedAt).id, job.id);
});
test('never resumes an old attempt or different source', () => {
  for (const candidate of [
    { ...job, created_at: '2026-10-26T11:59:59Z' },
    { ...job, document_meta: { ...job.document_meta, original_filename: 'other.pdf' } },
    { ...job, document_meta: { ...job.document_meta, file_size_bytes: 1 } },
    { ...job, created_at: 'invalid' }, { ...job, status: 'failed' },
  ]) assert.equal(findAcceptedS3DUpload([candidate], file, startedAt), null);
});
test('ambiguous matching attempts require explicit History selection', () => {
  assert.equal(findAcceptedS3DUpload([job, { ...job, id: 'another' }], file, startedAt), null);
  assert.equal(findAcceptedS3DUpload([], file, startedAt), null);
});
