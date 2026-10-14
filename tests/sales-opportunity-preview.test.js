import test from 'node:test';
import assert from 'node:assert/strict';
import { filePreviewType, previewContent, TEXT_PREVIEW_BYTES } from '../src/pages/Sales/salesOpportunityPreview.js';

test('active document formats cannot opt into an embedded preview through misleading metadata', () => {
  for (const name of ['unsafe.html', 'unsafe.HTM', 'unsafe.xhtml', 'unsafe.svg', 'unsafe.svgz']) {
    assert.equal(filePreviewType({ name, mime_type: 'application/pdf' }).kind, 'unsupported');
  }
  assert.equal(filePreviewType({ name: 'photo.png', mime_type: 'image/svg+xml' }).kind, 'unsupported');
  assert.equal(filePreviewType({ name: 'spreadsheet.xlsx' }).kind, 'xlsx');
  assert.equal(filePreviewType({ name: 'proposal.DOCX' }).kind, 'docx');
  assert.equal(filePreviewType({ name: 'Client email.msg' }).kind, 'msg');
  assert.equal(filePreviewType({ name: 'archive.zip' }).kind, 'unsupported');
});

test('PDF preview retains exact original bytes and rejects a renamed active document', async () => {
  const bytes = new TextEncoder().encode('%PDF-1.7\noriginal content');
  const result = await previewContent(new Blob([bytes]), filePreviewType({ name: 'Tender.PDF' }));
  assert.equal(result.blob.type, 'application/pdf');
  assert.deepEqual(new Uint8Array(await result.blob.arrayBuffer()), bytes);
  await assert.rejects(previewContent(new Blob(['<html>content</html>']), { kind: 'pdf' }), /readable PDF/);
});

test('raster preview uses a verified MIME type without rewriting original image bytes', async () => {
  const cases = [
    ['png', [137, 80, 78, 71, 13, 10, 26, 10]],
    ['jpg', [255, 216, 255]],
    ['gif', new TextEncoder().encode('GIF89a')],
    ['webp', new TextEncoder().encode('RIFF0000WEBP')],
    ['bmp', new TextEncoder().encode('BM')],
    ['avif', new TextEncoder().encode('0000ftypavif')],
  ];
  for (const [extension, header] of cases) {
    const original = new Uint8Array([...header, 1, 2, 3, 4]);
    const type = filePreviewType({ name: `photo.${extension}` });
    const result = await previewContent(new Blob([original], { type: 'application/octet-stream' }), type);
    assert.equal(result.blob.type, type.mime);
    assert.deepEqual(new Uint8Array(await result.blob.arrayBuffer()), original);
    await assert.rejects(previewContent(new Blob(['<svg onload="alert(1)">']), type), /supported image/);
  }
});

test('text preview returns literal content for escaped rendering', async () => {
  const source = '<script>alert("source, not execution")</script>\nData: العربية';
  assert.deepEqual(await previewContent(new Blob([source]), filePreviewType({ name: 'notes.txt' })), {
    kind: 'text', text: source, truncated: false,
  });
});

test('text preview bounds decoded content and handles a split multibyte character', async () => {
  const prefix = 'x'.repeat(TEXT_PREVIEW_BYTES - 1);
  const result = await previewContent(new Blob([prefix, '€rest']), { kind: 'text' });
  assert.equal(result.truncated, true);
  assert.equal(result.text, prefix);
});

test('binary and malformed UTF-8 content offer download instead of misleading text', async () => {
  await assert.rejects(previewContent(new Blob(['text\0binary']), { kind: 'text' }), /binary data/);
  await assert.rejects(previewContent(new Blob([new Uint8Array([0xff, 0xfe, 0x41, 0])]), { kind: 'text' }), /encoding/);
  await assert.rejects(previewContent(new Blob([new Uint8Array([0xe2, 0x82])]), { kind: 'text' }), /encoding/);
});
