import { test } from 'node:test';
import assert from 'node:assert/strict';
import { responseFilename } from '../src/utils/downloadFilename.js';
import { WORKSPACE_FOLDERS, documentDate, documentType, fileSize, publicationLabel, queuedUploadFiles, retargetUploadQueue, sharePointUrl, uploadFileError, uploadTransferPercent, validateWorkspace, workspaceError } from '../src/pages/Sales/salesOpportunityWorkspace.js';

const root = 'https://rejlerssverige.sharepoint.com/sites/Sales/Opportunities/Q-102101';
const ready = () => ({ opportunity_id: 'one', status: 'ready', web_url: root, can_manage: true, can_upload: true, folders: WORKSPACE_FOLDERS.map(folder => ({ ...folder, web_url: `${root}/${folder.name}`, item_count: null })) });
test('only HTTPS SharePoint links are rendered', () => {
  assert.equal(sharePointUrl(root), root);
  for (const value of ['javascript:alert(1)', 'http://rejlerssverige.sharepoint.com/path', 'https://sharepoint.com.evil.test', 'https://user:pass@rejlerssverige.sharepoint.com', '//rejlerssverige.sharepoint.com/path', null]) assert.equal(sharePointUrl(value), '');
});
test('ready status requires every unique canonical folder and safe links', () => {
  const valid = ready();
  assert.equal(validateWorkspace(valid, 'one').status, 'ready');
  assert.throws(() => validateWorkspace({ ...valid, folders: [] }, 'one'));
  assert.throws(() => validateWorkspace({ ...valid, folders: valid.folders.map(() => valid.folders[0]) }, 'one'));
  assert.throws(() => validateWorkspace({ ...valid, web_url: 'https://evil.test' }, 'one'));
});
test('responses cannot be assigned to a different opportunity', () => {
  assert.throws(() => validateWorkspace(ready(), 'two'));
  assert.throws(() => validateWorkspace({ results: [] }, 'one'));
});
test('unknown counts remain null while confirmed empty counts remain zero', () => {
  const value = ready();
  value.folders[0].item_count = 0;
  value.folders[1].item_count = -1;
  const parsed = validateWorkspace(value, 'one');
  assert.equal(parsed.folders[0].item_count, 0);
  assert.equal(parsed.folders[1].item_count, null);
  assert.equal(parsed.folders[2].item_count, null);
});
test('unconfigured templates do not acquire upload authority', () => {
  const parsed = validateWorkspace({ opportunity_id: 'one', status: 'not_configured', folders: [], can_upload: 'true' }, 'one');
  assert.equal(parsed.can_upload, false);
  assert.ok(parsed.folders.every(folder => folder.item_count === null));
});

test('RADAI attachment readiness and access do not depend on SharePoint configuration', () => {
  const parsed = validateWorkspace({ opportunity_id: 'one', status: 'not_configured', folders: [], can_upload: false, radai_storage: {
    status: 'ready', can_upload: true, max_upload_bytes: 10485760,
    folders: WORKSPACE_FOLDERS.map(folder => ({ key: folder.key, item_count: 0 })),
  } }, 'one');
  assert.equal(parsed.can_upload, false);
  assert.equal(parsed.radai_storage.can_upload, true);
  assert.equal(parsed.radai_storage.status, 'ready');
  assert.ok(parsed.radai_storage.folders.every(folder => folder.item_count === 0 && folder.web_url === ''));
});

test('incomplete RADAI count mappings cannot claim ready storage or acquire upload authority', () => {
  const base = { opportunity_id: 'one', status: 'not_configured', folders: [] };
  assert.throws(() => validateWorkspace({ ...base, radai_storage: { status: 'ready', can_upload: true, folders: [] } }, 'one'));
  assert.throws(() => validateWorkspace({ ...base, radai_storage: { status: 'ready', can_upload: true, folders: WORKSPACE_FOLDERS.map(folder => ({ key: folder.key, item_count: null })) } }, 'one'));
  const unavailable = validateWorkspace({ ...base, radai_storage: { status: 'unavailable', can_upload: 'true', folders: [] } }, 'one');
  assert.equal(unavailable.radai_storage.can_upload, false);
  assert.ok(unavailable.radai_storage.folders.every(folder => folder.item_count === null));
});

test('custom folder tags share their canonical value across storage views without acquiring edit access', () => {
  const base = ready();
  base.folders[1] = { ...base.folders[1], tag: 'Client issue 2', tag_token: 'signed-tender' };
  base.can_edit_tags = true;
  base.radai_storage = { status: 'ready', can_upload: false, folders: WORKSPACE_FOLDERS.map(folder => ({ key: folder.key, item_count: 0, tag: 'Incorrect storage-specific tag' })) };
  const parsed = validateWorkspace(base, 'one');
  assert.equal(parsed.can_edit_tags, true);
  assert.equal(parsed.folders[1].tag, 'Client issue 2');
  assert.equal(parsed.radai_storage.folders[1].tag, 'Client issue 2');
  assert.equal(parsed.radai_storage.folders[1].tag_token, 'signed-tender');
  assert.equal(parsed.radai_storage.folders[0].tag, '');
  assert.equal(validateWorkspace({ ...base, can_edit_tags: 'true' }, 'one').can_edit_tags, false);
  assert.equal(validateWorkspace(ready(), 'one').can_edit_tags, false);
});
test('file validation and denied errors remain actionable', () => {
  assert.equal(workspaceError({ response: { data: { file: ['File exceeds the maximum.'] } } }, 'Fallback'), 'File exceeds the maximum.');
  assert.match(workspaceError({ response: { status: 403 } }, 'Fallback'), /permission/);
  assert.equal(fileSize(null), 'Size unavailable');
  assert.equal(fileSize(1024), '1.0 KB');
});

test('document labels distinguish storage publication from review and preserve unknown values', () => {
  assert.equal(publicationLabel('published'), 'Published');
  assert.equal(publicationLabel('checkout'), 'Checked out');
  assert.equal(publicationLabel('approved'), 'Not available');
  assert.deepEqual(documentDate(null), { date: 'Not available', time: '' });
  assert.equal(documentDate('2026-10-01T05:20:00Z').time, '09:20');
  assert.equal(documentType({ name: 'SCOPE.DOCX' }).tone, 'word');
  assert.equal(documentType({ name: 'schedule.pdf' }).tone, 'pdf');
  assert.equal(documentType({ name: 'README' }).label, 'Document');
  assert.equal(documentType({ name: 'Proposal', is_folder: true }).tone, 'folder');
});

test('download filenames use current Unicode response names and reject unsafe headers', () => {
  assert.equal(responseFilename('attachment; filename="renamed.pdf"'), 'renamed.pdf');
  assert.equal(responseFilename("attachment; filename=old.docx; filename*=UTF-8''R%C3%A9vis%C3%A9e.pdf"), 'Révisée.pdf');
  assert.equal(responseFilename(null), '');
  assert.throws(() => responseFilename('attachment; filename="../scope.pdf"'));
  assert.throws(() => responseFilename("attachment; filename*=UTF-8''bad%ZZ.pdf"));
  assert.throws(() => responseFilename('attachment; filename="bad\r\nname.pdf"'));
});

test('optional upload limits and compression capability stay provider-specific', () => {
  const base = ready();
  base.max_upload_bytes = null;
  base.radai_storage = { status: 'ready', can_upload: true, max_upload_bytes: null, automatic_compression: 'lossless_if_smaller', folders: WORKSPACE_FOLDERS.map(folder => ({ key: folder.key, item_count: 0 })) };
  const parsed = validateWorkspace(base, 'one');
  assert.equal(parsed.max_upload_bytes, null);
  assert.equal(parsed.radai_storage.max_upload_bytes, null);
  assert.equal(parsed.radai_storage.automatic_compression, 'lossless_if_smaller');
  assert.equal(validateWorkspace({ ...base, radai_storage: { ...base.radai_storage, automatic_compression: true } }, 'one').radai_storage.automatic_compression, null);
  for (const limit of [null, undefined, 0]) assert.equal(uploadFileError({ size: 1024 ** 3, name: 'engineering-model.bin' }, limit), '');
  assert.equal(uploadFileError({ size: 20 }, 20), '');
  assert.match(uploadFileError({ size: 21 }, 20), /maximum/);
  assert.match(uploadFileError({ size: 0 }, null), /nonempty/);
});

test('destination changes rotate only unsaved identities and retain each original file', () => {
  let sequence = 0;
  const nextId = () => `request-${++sequence}`;
  const files = [{ name: 'model.dwg', size: 40 }, { name: 'scope.pdf', size: 20 }, { name: 'sheet.xlsx', size: 30 }];
  const queue = queuedUploadFiles(files, nextId);
  queue[0] = { ...queue[0], status: 'succeeded', destination: 'Tender in RADAI' };
  queue[1] = { ...queue[1], status: 'failed', error: 'Network unavailable' };
  const moved = retargetUploadQueue(queue, nextId);
  assert.equal(moved[0], queue[0]);
  for (const index of [1, 2]) {
    assert.equal(moved[index].file, files[index]);
    assert.equal(moved[index].id, queue[index].id);
    assert.notEqual(moved[index].requestId, queue[index].requestId);
    assert.equal(moved[index].status, 'pending');
    assert.equal(moved[index].error, '');
  }
  assert.equal(new Set(queue.map(item => item.requestId)).size, 3);
});

test('transfer progress is derived from known byte totals without inventing completion', () => {
  assert.equal(uploadTransferPercent({ loaded: 1, total: 4 }), 25);
  assert.equal(uploadTransferPercent({ loaded: 399, total: 400 }), 99);
  assert.equal(uploadTransferPercent({ loaded: 400, total: 400 }), 100);
  assert.equal(uploadTransferPercent({ loaded: 420, total: 400 }), 100);
  for (const event of [{ loaded: 4 }, { loaded: 4, total: 0 }, { loaded: -1, total: 4 }, null]) assert.equal(uploadTransferPercent(event), null);
});
