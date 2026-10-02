import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import * as XLSX from 'xlsx';
import { strFromU8, strToU8, unzipSync, zipSync, Zip, ZipDeflate } from 'fflate';
import { OFFICE_PREVIEW_LIMITS as LIMITS, parseWorkbook, validateOfficeZip } from '../src/pages/Sales/salesOfficeWorkbook.js';

const asBuffer = bytes => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
const minimal = kind => ({ '[Content_Types].xml': strToU8('<Types/>'),
  [kind === 'docx' ? 'word/document.xml' : 'xl/workbook.xml']: strToU8(kind === 'docx' ? '<w:document xmlns:w="urn:test"/>' : '<workbook/>') });
const archive = (parts, level = 6) => asBuffer(zipSync(parts, { level }));
const workbook = (sheets, options = {}) => {
  const book = XLSX.utils.book_new();
  for (const [name, sheet] of sheets) XLSX.utils.book_append_sheet(book, sheet, name);
  if (options.hidden) book.Workbook = { Sheets: sheets.map(([name], index) => ({ name, Hidden: index ? 1 : 0 })) };
  return XLSX.write(book, { type: 'array', bookType: 'xlsx', compression: true });
};
const rewrite = (buffer, change) => { const parts = unzipSync(new Uint8Array(buffer)); change(parts); return archive(parts); };
const central = buffer => {
  const view = new DataView(buffer), entries = [];
  for (let at = 0; at + 46 < buffer.byteLength; at++) if (view.getUint32(at, true) === 0x02014b50) {
    entries.push({ central: at, local: view.getUint32(at + 42, true) });
  }
  return entries;
};

test('ZIP guard accepts valid compressed/stored DOCX and XLSX without changing original bytes', () => {
  for (const kind of ['docx', 'xlsx']) for (const level of [0, 6]) {
    const input = archive(minimal(kind), level), before = new Uint8Array(input).slice();
    assert.equal(validateOfficeZip(input, kind), input);
    assert.deepEqual(new Uint8Array(input), before);
  }
});

test('valid streamed ZIP data descriptors are accepted and checked', () => {
  const chunks = [];
  const zip = new Zip((error, chunk) => { if (error) throw error; chunks.push(chunk); });
  for (const [name, content] of Object.entries(minimal('docx'))) {
    const entry = new ZipDeflate(name); zip.add(entry); entry.push(content, true);
  }
  zip.end();
  const input = asBuffer(Buffer.concat(chunks));
  assert.equal(validateOfficeZip(input, 'docx'), input);
  const view = new DataView(input), first = central(input)[0];
  const descriptor = first.local + 30 + view.getUint16(first.local + 26, true)
    + view.getUint16(first.local + 28, true) + view.getUint32(first.central + 20, true);
  view.setUint32(descriptor + 4, 123, true);
  assert.throws(() => validateOfficeZip(input, 'docx'), /invalid/);
});

test('guard refuses missing required parts, random bytes, truncated and corrupt archives', () => {
  const good = archive(minimal('docx'));
  for (const input of [new ArrayBuffer(0), asBuffer(strToU8('not a workbook')), good.slice(0, -1), archive({ 'word/document.xml': strToU8('<doc/>') })]) {
    assert.throws(() => validateOfficeZip(input, 'docx'), /invalid/);
  }
  const corrupt = good.slice(0), view = new DataView(corrupt), first = central(corrupt)[0];
  const start = first.local + 30 + view.getUint16(first.local + 26, true) + view.getUint16(first.local + 28, true);
  new Uint8Array(corrupt)[start] ^= 255;
  assert.throws(() => validateOfficeZip(corrupt, 'docx'), /invalid/);
});

test('actual inflate and CRC reject forged central/local expanded sizes and checksum', () => {
  const input = archive({ ...minimal('xlsx'), 'xl/worksheets/sheet1.xml': strToU8('<worksheet>' + ' '.repeat(2 * 1024 * 1024) + '</worksheet>') });
  const entries = central(input), target = entries.at(-1), view = new DataView(input);
  view.setUint32(target.central + 24, 1, true); view.setUint32(target.local + 22, 1, true);
  assert.throws(() => validateOfficeZip(input, 'xlsx'), /invalid/);
  const badCrc = archive(minimal('docx')), entry = central(badCrc)[0], crcView = new DataView(badCrc);
  crcView.setUint32(entry.central + 16, 1, true); crcView.setUint32(entry.local + 14, 1, true);
  assert.throws(() => validateOfficeZip(badCrc, 'docx'), /invalid/);
});

test('input, expanded-size and entry-count budgets fail before parser allocation', () => {
  assert.throws(() => validateOfficeZip(new ArrayBuffer(LIMITS.bytes + 1), 'xlsx'), /preview limits/);
  const oversized = archive(minimal('docx')), entry = central(oversized)[0], view = new DataView(oversized);
  view.setUint32(entry.central + 24, LIMITS.bytes + 1, true); view.setUint32(entry.local + 22, LIMITS.bytes + 1, true);
  assert.throws(() => validateOfficeZip(oversized, 'docx'), /preview limits/);
  const entries = minimal('docx');
  for (let index = 0; index < LIMITS.entries; index++) entries[`part${index}`] = new Uint8Array(0);
  assert.throws(() => validateOfficeZip(archive(entries), 'docx'), /preview limits/);
});

test('encryption, multidisk, ZIP64 and aliased local entries are unsupported', () => {
  for (const variant of ['encryption', 'multidisk', 'zip64', 'local-zip64', 'alias']) {
    const input = archive(minimal('docx')), view = new DataView(input), entries = central(input);
    if (variant === 'encryption') {
      view.setUint16(entries[0].central + 8, 1, true); view.setUint16(entries[0].local + 6, 1, true);
    } else if (variant === 'multidisk') view.setUint16(input.byteLength - 18, 1, true);
    else if (variant === 'zip64') view.setUint16(entries[0].central + 6, 45, true);
    else if (variant === 'local-zip64') view.setUint16(entries[0].local + 4, 45, true);
    else view.setUint32(entries[1].central + 42, entries[0].local, true);
    assert.throws(() => validateOfficeZip(input, 'docx'), /invalid/, variant);
  }
});

test('dangerous part paths, duplicate names, DTD and UTF16 external entities are refused', () => {
  for (const name of ['../outside', '/absolute', 'word\\document.xml', 'word/%2e%2e/outside', 'constructor/item']) {
    assert.throws(() => validateOfficeZip(archive({ ...minimal('docx'), [name]: strToU8('x') }), 'docx'), /invalid/, name);
  }
  assert.throws(() => validateOfficeZip(archive({ ...minimal('docx'), 'WORD/DOCUMENT.XML': strToU8('<doc/>') }), 'docx'), /invalid/);
  const dtd = '<!DOCTYPE document [<!ENTITY ex SYSTEM "https://attacker.invalid/source">]><document>&ex;</document>';
  for (const xml of [strToU8(dtd), new Uint8Array(Buffer.from('\ufeff' + dtd, 'utf16le'))]) {
    assert.throws(() => validateOfficeZip(archive({ ...minimal('docx'), 'word/document.xml': xml }), 'docx'), /invalid/);
  }
});

test('source cell and sheet count complexity is rejected before workbook parsing', () => {
  const tooManyCells = archive({ ...minimal('xlsx'), 'xl/worksheets/sheet1.xml': strToU8('<worksheet>' + '<c r="A1"/>'.repeat(LIMITS.cells + 1) + '</worksheet>') });
  assert.throws(() => parseWorkbook(tooManyCells), /preview limits/);
  const sheets = '<workbook><sheets>' + '<sheet name="Sheet"/>'.repeat(LIMITS.sheets + 1) + '</sheets></workbook>';
  assert.throws(() => parseWorkbook(archive({ ...minimal('xlsx'), 'xl/workbook.xml': strToU8(sheets) })), /preview limits/);
});

test('many empty rows or shared strings cannot bypass source complexity with a tiny cell count', () => {
  for (const [part, xml] of [
    ['xl/worksheets/sheet1.xml', '<worksheet><sheetData>' + '<row/>'.repeat(LIMITS.sourceRows + 1) + '</sheetData></worksheet>'],
    ['xl/sharedStrings.xml', '<sst>' + '<si/>'.repeat(LIMITS.sharedStrings + 1) + '</sst>'],
  ]) {
    assert.throws(() => parseWorkbook(archive({ ...minimal('xlsx'), [part]: strToU8(xml) })), /preview limits/);
  }
});

test('Office XML element count is bounded before downstream document parsing', () => {
  const document = '<document>' + '<paragraph/>'.repeat(LIMITS.xmlElements + 1) + '</document>';
  assert.throws(() => validateOfficeZip(archive({ ...minimal('docx'), 'word/document.xml': strToU8(document) }), 'docx'), /preview limits/);
});

test('workbook preview preserves formatted values, hidden sheets and original bytes', () => {
  const sheet = XLSX.utils.aoa_to_sheet([['Description', 'Amount', 'Date'], ['Pipe', 1250.5, 45658]]);
  sheet.B2.z = '#,##0.00'; sheet.C2.z = 'yyyy-mm-dd';
  const input = workbook([['Estimate', sheet], ['Internal', XLSX.utils.aoa_to_sheet([['Hidden data']])]], { hidden: true });
  const before = new Uint8Array(input).slice(), result = parseWorkbook(input);
  assert.equal(result.kind, 'xlsx'); assert.equal(result.sheets.length, 2);
  assert.deepEqual(result.sheets[0].columns, ['A', 'B', 'C']);
  assert.equal(result.sheets[0].rows[1].cells[1].text, '1,250.50');
  assert.equal(result.sheets[0].rows[1].cells[2].text, '2025-01-01');
  assert.equal(result.sheets[1].hidden, true);
  assert.equal(result.sheets[0].totalRows, 2); assert.equal(result.sheets[0].totalColumns, 3);
  assert.equal(result.sheets[0].truncated, false);
  assert.deepEqual(new Uint8Array(input), before);
});

test('formulas are never recalculated, cached zero survives and uncached formulas are explicit', () => {
  const sheet = XLSX.utils.aoa_to_sheet([[0, 0, 'click', '<script>literal</script>']]);
  sheet.A1.f = '1-1'; sheet.C1.f = 'HYPERLINK("https://attacker.invalid","click")';
  sheet.D1.l = { Target: 'https://attacker.invalid' };
  const input = rewrite(workbook([['Values', sheet]]), parts => {
    parts['xl/worksheets/sheet1.xml'] = strToU8(strFromU8(parts['xl/worksheets/sheet1.xml']).replace(/<c r="B1"[^>]*>[\s\S]*?<\/c>/, '<c r="B1"><f>SUM(2,3)</f></c>'));
  });
  const cells = parseWorkbook(input).sheets[0].rows[0].cells;
  assert.deepEqual(cells[0], { text: '0', formula: '1-1' });
  assert.deepEqual(cells[1], { text: 'No saved result', formula: 'SUM(2,3)', missingResult: true });
  assert.deepEqual(cells[2], { text: 'click', formula: 'HYPERLINK("https://attacker.invalid","click")' });
  assert.deepEqual(cells[3], { text: '<script>literal</script>' });
  assert.ok(cells.every(cell => !('html' in cell) && !('hyperlink' in cell) && !('l' in cell)));
});

test('row/column and aggregate displayed-cell caps retain original dimensions and truncation', () => {
  const sheet = { A1: { t: 's', v: 'First' }, CW2001: { t: 's', v: 'Outside preview' }, '!ref': 'A1:CW2001' };
  const result = parseWorkbook(workbook([['Large grid', sheet]]));
  const first = result.sheets[0];
  assert.equal(first.totalRows, 2001); assert.equal(first.totalColumns, 101);
  assert.equal(first.columns.length, 100); assert.equal(first.columns.at(-1), 'CV');
  assert.equal(first.rows.length, 1000); assert.equal(first.rows.at(-1).number, 1000);
  assert.equal(first.truncated, true); assert.match(result.notice, /truncated/);
  assert.equal(first.rows.reduce((sum, row) => sum + row.cells.length, 0), LIMITS.cells);
});

test('each cell and aggregate UTF8 text are bounded with visible truncation', () => {
  const long = '界'.repeat(12000), data = Array.from({ length: 180 }, () => [long]);
  const result = parseWorkbook(workbook([['Text', XLSX.utils.aoa_to_sheet(data)]]));
  const sheet = result.sheets[0];
  assert.equal(sheet.rows[0].cells[0].text.length, LIMITS.cellText);
  assert.ok(sheet.rows.length < 180);
  const allText = sheet.name + sheet.columns.join('') + sheet.rows.flatMap(row => row.cells.map(cell => cell.text)).join('');
  assert.ok(new TextEncoder().encode(allText).length <= LIMITS.textBytes);
  assert.equal(sheet.truncated, true); assert.match(result.notice, /truncated/);
});

test('empty sheets remain explicit without manufactured rows or values', () => {
  const result = parseWorkbook(workbook([['Empty', {}]]));
  assert.deepEqual(result.sheets[0], { name: 'Empty', hidden: false, columns: [], rows: [], totalRows: 0, totalColumns: 0, truncated: false });
});
