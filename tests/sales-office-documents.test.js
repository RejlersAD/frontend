import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import * as XLSX from 'xlsx';
import MessageReader from '@kenjiuno/msgreader';
import { unzipSync, zipSync } from 'fflate';
import { parseWord, parseMessage } from '../src/pages/Sales/salesOfficeDocuments.js';
import { officeDocument, officeMessage, officePng } from './fixtures/sales-office-files.js';

const { CFB } = XLSX;
const messageWith = callback => {
  const container = CFB.read(officeMessage(), { type: 'buffer' });
  callback(container);
  return CFB.write(container, { type: 'buffer' });
};
const setText = (container, key, value) => CFB.utils.cfb_add(container, key, Buffer.from(`${value}\0`, 'utf16le'));
const directoryEntry = (bytes, name) => {
  const sectorSize = 2 ** bytes.readUInt16LE(30), slots = sectorSize / 4;
  let sector = bytes.readUInt32LE(48), index = 0;
  while (sector !== 0xfffffffe) {
    const offset = (sector + 1) * sectorSize;
    for (let part = 0; part < sectorSize; part += 128, index += 1) {
      const length = bytes.readUInt16LE(offset + part + 64);
      if (bytes.subarray(offset + part, offset + part + Math.max(0, length - 2)).toString('utf16le') === name) return { offset: offset + part, index };
    }
    const fat = bytes.readUInt32LE(76 + Math.floor(sector / slots) * 4);
    sector = bytes.readUInt32LE((fat + 1) * sectorSize + (sector % slots) * 4);
  }
  throw new Error(`Missing synthetic directory entry ${name}`);
};

// Relocate an actual, valid CFB mini-FAT into sector zero. Rewrite every physical
// sector reference while leaving mini-sector numbers and all stream bytes intact.
function miniFatAtZero(bytes) {
  const sectorSize = 2 ** bytes.readUInt16LE(30), slots = sectorSize / 4;
  assert.equal(bytes.readUInt32LE(44), 1);
  assert.equal(bytes.readUInt32LE(72), 0);
  const previous = bytes.readUInt32LE(60);
  assert.ok(previous > 0 && previous < slots);
  const moved = sector => sector === 0 ? previous : sector === previous ? 0 : sector;
  const result = Buffer.from(bytes);
  bytes.copy(result, sectorSize, (previous + 1) * sectorSize, (previous + 2) * sectorSize);
  bytes.copy(result, (previous + 1) * sectorSize, sectorSize, sectorSize * 2);
  for (const position of [48, 60, 68]) result.writeUInt32LE(moved(bytes.readUInt32LE(position)), position);
  for (let index = 0; index < 109; index += 1) result.writeUInt32LE(moved(bytes.readUInt32LE(76 + index * 4)), 76 + index * 4);
  const oldFat = bytes.readUInt32LE(76), newFat = moved(oldFat);
  for (let index = 0; index < slots; index += 1) {
    result.writeUInt32LE(moved(bytes.readUInt32LE((oldFat + 1) * sectorSize + index * 4)), (newFat + 1) * sectorSize + moved(index) * 4);
  }
  for (let sector = bytes.readUInt32LE(48); sector !== 0xfffffffe; sector = bytes.readUInt32LE((oldFat + 1) * sectorSize + sector * 4)) {
    for (let part = 0; part < sectorSize; part += 128) {
      const oldEntry = (sector + 1) * sectorSize + part, type = bytes[oldEntry + 66];
      if (type === 5 || type === 2 && bytes.readUInt32LE(oldEntry + 120) >= 4096) {
        result.writeUInt32LE(moved(bytes.readUInt32LE(oldEntry + 116)), (moved(sector) + 1) * sectorSize + part + 116);
      }
    }
  }
  return result;
}

test('Word semantic preview retains real headings, table values and verified embedded raster bytes', async () => {
  const result = await parseWord(officeDocument({ malicious: false }));
  assert.equal(result.kind, 'docx');
  assert.match(result.html, /<h1>Engineering scope document<\/h1>/);
  assert.match(result.html, /<table>.*Design report.*Process team.*<\/table>/s);
  const image = result.html.match(/src="data:image\/png;base64,([^"]+)"/);
  assert.ok(image);
  assert.deepEqual(Buffer.from(image[1], 'base64'), officePng);
  assert.match(result.notice, /simplified layout/);
});

test('Word keeps useful content when external resources are blocked and leaves rich HTML explicitly untrusted', async () => {
  const previousFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = () => { requests += 1; throw new Error('External requests must not occur'); };
  try {
    const result = await parseWord(officeDocument());
    assert.equal(requests, 0);
    assert.match(result.html, /Design report/);
    assert.match(result.html, /Unsafe link label/);
    assert.match(result.html, /&lt;script&gt;/);
    assert.doesNotMatch(result.html, /src="https?:/);
    assert.match(result.notice, /could not be (included|displayed)/);
    // URL removal belongs to the caller's sanitizer; this layer must not hide
    // that conversion output remains untrusted.
    assert.match(result.html, /href="javascript:/);
  } finally { globalThis.fetch = previousFetch; }
});

test('Word omits a falsely labelled raster image with readable alternative text', async () => {
  const files = unzipSync(officeDocument({ malicious: false }));
  files['word/media/diagram.png'] = new TextEncoder().encode('<svg onload="alert(1)"></svg>');
  const result = await parseWord(zipSync(files));
  assert.match(result.html, /Image omitted from preview/);
  assert.doesNotMatch(result.html, /data:image\//);
  assert.match(result.html, /Design report/);
  assert.match(result.notice, /Some images/);
});

test('Word rejects corrupt packages and bounds UTF-8 preview output', async () => {
  await assert.rejects(parseWord(new Uint8Array([1, 2, 3, 4])));
  const document = officeDocument({ malicious: false, image: false, bodyText: 'x'.repeat(8 * 1024 * 1024 + 1) });
  await assert.rejects(parseWord(document), /too complex for the preview/);
});

test('MSG parses the actual envelope and plain body while exposing only attachment metadata', () => {
  const result = parseMessage(officeMessage());
  assert.equal(result.kind, 'msg');
  assert.equal(result.subject, 'Synthetic bid clarification');
  assert.equal(result.sender, 'Synthetic sender <sender@example.invalid>');
  assert.equal(result.to, 'Proposal reviewer <reviewer@example.invalid>');
  assert.match(result.date, /2026/);
  assert.match(result.bodyText, /<script>window.officePreviewExecuted=true<\/script>/);
  assert.equal(result.bodyHtml, '');
  assert.deepEqual(result.attachments, [{ name: 'Scope_attachment.txt', size: 28 }]);
  assert.equal(Object.hasOwn(result, 'headers'), false);
  assert.equal(Object.hasOwn(result.attachments[0], 'content'), false);
});

test('MSG decodes rich UTF-8 body and prefers a genuine plain body when both exist', () => {
  const html = '<h1>Clarification</h1><p>العربية €</p><img src="https://preview-external.example/tracker">';
  const rich = parseMessage(officeMessage({ html: true, bodyHtml: html }));
  assert.equal(rich.bodyHtml, html);
  assert.equal(rich.bodyText, '');
  const plain = parseMessage(officeMessage({ html: true, bodyHtml: html, bodyText: 'Authoritative plain body' }));
  assert.equal(plain.bodyText, 'Authoritative plain body');
  assert.equal(plain.bodyHtml, '');
});

test('MSG handles declared HTML encodings and exposes malformed decoding rather than replacement text', () => {
  const encoded = messageWith(container => {
    CFB.utils.cfb_del(container, '__substg1.0_1000001F');
    const props = CFB.find(container, '__properties_version1.0').content;
    props.writeUInt32LE(1252, 40);
    CFB.utils.cfb_add(container, '__substg1.0_10130102', Buffer.from([60, 112, 62, 128, 60, 47, 112, 62]));
  });
  assert.equal(parseMessage(encoded).bodyHtml, '<p>€</p>');
  const invalid = messageWith(container => {
    CFB.utils.cfb_del(container, '__substg1.0_1000001F');
    CFB.utils.cfb_add(container, '__substg1.0_10130102', Buffer.from([0xff, 0xfe, 0xff]));
  });
  const result = parseMessage(invalid);
  assert.equal(result.bodyHtml, '');
  assert.match(result.notice, /could not be decoded/);
});

test('MSG rejects non-message OLE containers and truncated binary content', () => {
  const container = CFB.utils.cfb_new();
  CFB.utils.cfb_add(container, 'WordDocument', Buffer.from('not a message'));
  assert.throws(() => parseMessage(CFB.write(container, { type: 'buffer' })), /readable Outlook message/);
  assert.throws(() => parseMessage(Buffer.from('not MSG')), /readable Outlook message/);
  assert.throws(() => parseMessage(officeMessage().subarray(0, 64)));
});

test('tiny MSG with a huge claimed stream is rejected before the library can allocate it', () => {
  const bytes = Buffer.from(officeMessage());
  assert.ok(bytes.length < 16 * 1024);
  const body = directoryEntry(bytes, '__substg1.0_1000001F');
  bytes.writeUInt32LE(0x70000000, body.offset + 120);
  const Reader = MessageReader.default || MessageReader;
  const original = Reader.prototype.getFileData;
  let parsed = false;
  Reader.prototype.getFileData = () => { parsed = true; throw new Error('Unexpected unsafe parsing'); };
  try {
    assert.throws(() => parseMessage(bytes), /invalid storage structure/);
    assert.equal(parsed, false);
  } finally { Reader.prototype.getFileData = original; }
});

test('valid sector-zero mini-FAT layout offers download instead of silently truncating the body', () => {
  const original = officeMessage({ bodyText: 'Message content longer than a single mini sector. '.repeat(6) });
  const relocated = miniFatAtZero(original);
  assert.equal(relocated.readUInt32LE(60), 0);
  const body = container => Buffer.from(CFB.find(CFB.read(container, { type: 'buffer' }), '__substg1.0_1000001F').content);
  // Independent CFB reader proves this is a valid relocation with unchanged
  // complete message content, not merely a corrupted header that should fail.
  assert.deepEqual(body(relocated), body(original));
  assert.ok(body(relocated).byteLength > 64);
  assert.throws(() => parseMessage(relocated), /storage layout that cannot be previewed.*Download/);
});

test('a FREE hole in the declared FAT prefix is rejected before the parser follows a different table', () => {
  const bytes = Buffer.from(officeMessage());
  assert.equal(bytes.readUInt32LE(44), 1);
  bytes.writeUInt32LE(bytes.readUInt32LE(76), 80);
  bytes.writeUInt32LE(0xffffffff, 76);
  const Reader = MessageReader.default || MessageReader;
  const original = Reader.prototype.getFileData;
  let parsed = false;
  Reader.prototype.getFileData = () => { parsed = true; throw new Error('Unexpected unsafe parsing'); };
  try {
    assert.throws(() => parseMessage(bytes), /invalid storage structure/);
    assert.equal(parsed, false);
  } finally { Reader.prototype.getFileData = original; }
});

test('MSG rejects cyclic directory, FAT and mini-FAT chains before parser traversal', () => {
  const tree = Buffer.from(officeMessage());
  const body = directoryEntry(tree, '__substg1.0_1000001F');
  tree.writeUInt32LE(body.index, body.offset + 68);
  assert.throws(() => parseMessage(tree), /invalid storage structure/);

  const fat = Buffer.from(officeMessage());
  const sectorSize = 2 ** fat.readUInt16LE(30), slots = sectorSize / 4;
  const directory = fat.readUInt32LE(48);
  const table = fat.readUInt32LE(76 + Math.floor(directory / slots) * 4);
  fat.writeUInt32LE(directory, (table + 1) * sectorSize + (directory % slots) * 4);
  assert.throws(() => parseMessage(fat), /invalid storage structure/);

  const mini = Buffer.from(officeMessage());
  const miniBody = directoryEntry(mini, '__substg1.0_1000001F');
  const miniStart = mini.readUInt32LE(miniBody.offset + 116);
  const miniTable = mini.readUInt32LE(60);
  assert.ok(miniStart < slots);
  mini.writeUInt32LE(miniStart, (miniTable + 1) * sectorSize + miniStart * 4);
  assert.throws(() => parseMessage(mini), /invalid storage structure/);
});

test('MSG rejects overlapping stream sectors instead of counting aliased source bytes twice', () => {
  const bytes = Buffer.from(officeMessage({ html: true, bodyText: 'A'.repeat(5000), bodyHtml: '<p>' + 'B'.repeat(10000) + '</p>' }));
  const body = directoryEntry(bytes, '__substg1.0_1000001F');
  const html = directoryEntry(bytes, '__substg1.0_10130102');
  bytes.writeUInt32LE(bytes.readUInt32LE(body.offset + 116), html.offset + 116);
  assert.throws(() => parseMessage(bytes), /invalid storage structure/);
});

test('legitimate small streams are not counted twice with their backing root mini stream', () => {
  const bytes = messageWith(container => {
    for (let index = 0; index < 24; index += 1) setText(container, `__substg1.0_${(0x6000 + index).toString(16)}001F`, 'x'.repeat(1000));
  });
  assert.equal(parseMessage(bytes).subject, 'Synthetic bid clarification');
});

test('MSG ANSI properties use the declared code page instead of silently treating bytes as Latin-1', () => {
  const bytes = messageWith(container => {
    CFB.utils.cfb_del(container, '__substg1.0_1000001F');
    CFB.utils.cfb_add(container, '__substg1.0_1000001E', Buffer.from([0xcf, 0xf0, 0xe8, 0xe2, 0xe5, 0xf2, 0]));
    const property = Buffer.alloc(16);
    property.writeUInt32LE(0x3FFD0003, 0);
    property.writeUInt32LE(6, 4);
    property.writeUInt32LE(1251, 8);
    CFB.utils.cfb_add(container, '__properties_version1.0', Buffer.concat([CFB.find(container, '__properties_version1.0').content, property]));
  });
  assert.equal(parseMessage(bytes).bodyText, 'Привет');
});

test('RTF-only message keeps its envelope with an explicit missing-body explanation', () => {
  const bytes = messageWith(container => {
    CFB.utils.cfb_del(container, '__substg1.0_1000001F');
    CFB.utils.cfb_add(container, '__substg1.0_10090102', Buffer.from('synthetic opaque compressed RTF'));
  });
  const result = parseMessage(bytes);
  assert.equal(result.subject, 'Synthetic bid clarification');
  assert.equal(result.bodyText, '');
  assert.equal(result.bodyHtml, '');
  assert.match(result.notice, /RTF body that cannot be previewed/);
});

test('MSG caps attachment metadata visibly and returns bounded body output without splitting Unicode', () => {
  const bytes = messageWith(container => {
    for (let index = 1; index <= 500; index += 1) {
      const prefix = `__attach_version1.0_#${index.toString(16).padStart(8, '0')}/`;
      CFB.utils.cfb_add(container, `${prefix}__properties_version1.0`, Buffer.alloc(8));
      setText(container, `${prefix}__substg1.0_3707001F`, `Attachment-${index}.txt`);
    }
    setText(container, '__substg1.0_1000001F', '👷'.repeat(1024 * 1024 + 20));
  });
  const result = parseMessage(bytes);
  assert.equal(result.attachments.length, 500);
  assert.match(result.notice, /first 500 attachments/);
  assert.match(result.notice, /body is truncated/);
  assert.ok(Buffer.byteLength(JSON.stringify(result)) <= 4 * 1024 * 1024);
  assert.equal(result.bodyText.includes('\ufffd'), false);
  assert.ok(result.bodyText.endsWith('👷'));
});
