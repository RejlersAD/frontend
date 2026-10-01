import { Inflate } from 'fflate';
import * as XLSX from 'xlsx';

export const OFFICE_PREVIEW_LIMITS = Object.freeze({
  bytes: 128 * 1024 * 1024, entries: 4096, sheets: 50, rows: 2000,
  columns: 100, cells: 100000, cellText: 10000, textBytes: 4 * 1024 * 1024,
  sourceRows: 100000, sharedStrings: 100000, xmlElements: 500000,
});

const invalid = () => new Error('This Office file is invalid or uses an unsupported archive format. Download the original to inspect it.');
const complex = () => new Error('This Office file is too complex for the preview limits. Download the original to view all content.');
const encoder = new TextEncoder();
const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  return crc >>> 0;
});

function crcChunk(crc, data) {
  for (const byte of data) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255];
  return crc;
}

function partName(bytes) {
  let name;
  try { name = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw invalid(); }
  const segments = name.replace(/\/$/, '').split('/');
  if (!name || name.startsWith('/') || /[\\:]/.test(name)
      || Array.from(name).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
      || /%(?:2e|2f|5c|00)/i.test(name)
      || segments.some(segment => !segment || ['.', '..', '__proto__', 'constructor', 'prototype'].includes(segment.toLowerCase()))) throw invalid();
  return name;
}

function checkExtra(view, start, size) {
  const end = start + size;
  while (start < end) {
    if (start + 4 > end) throw invalid();
    const id = view.getUint16(start, true), length = view.getUint16(start + 2, true);
    if (id === 1 || id === 0x9901 || start + 4 + length > end) throw invalid(); // ZIP64 / AES.
    start += 4 + length;
  }
}

function decodeXml(chunks, length) {
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  const encoding = bytes[0] === 0xff && bytes[1] === 0xfe || bytes[0] === 60 && bytes[1] === 0
    ? 'utf-16le' : bytes[0] === 0xfe && bytes[1] === 0xff || bytes[0] === 0 && bytes[1] === 60 ? 'utf-16be' : 'utf-8';
  let xml;
  try { xml = new TextDecoder(encoding, { fatal: true }).decode(bytes); } catch { throw invalid(); }
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml) || xml.includes('\0')) throw invalid();
  return xml;
}

/** Validate actual expanded data before handing the unchanged buffer to a parser. */
export function validateOfficeZip(arrayBuffer, kind) {
  if (!(arrayBuffer instanceof ArrayBuffer) || !['xlsx', 'docx'].includes(kind)) throw invalid();
  const bytes = new Uint8Array(arrayBuffer), view = new DataView(arrayBuffer);
  if (bytes.length > OFFICE_PREVIEW_LIMITS.bytes) throw complex();
  if (bytes.length < 22) throw invalid();
  let end = -1;
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 65557); at--) {
    if (view.getUint32(at, true) === 0x06054b50 && at + 22 + view.getUint16(at + 20, true) === bytes.length) { end = at; break; }
  }
  if (end < 0 || view.getUint16(end + 4, true) || view.getUint16(end + 6, true)) throw invalid();
  const count = view.getUint16(end + 10, true), centralSize = view.getUint32(end + 12, true);
  const centralStart = view.getUint32(end + 16, true);
  if (count > OFFICE_PREVIEW_LIMITS.entries) throw complex();
  if (!count || count !== view.getUint16(end + 8, true) || centralStart + centralSize !== end) throw invalid();
  let at = centralStart, declaredTotal = 0;
  const entries = [], names = new Set();
  for (let index = 0; index < count; index++) {
    if (at + 46 > end || view.getUint32(at, true) !== 0x02014b50) throw invalid();
    const flags = view.getUint16(at + 8, true), method = view.getUint16(at + 10, true);
    const crc = view.getUint32(at + 16, true), compressed = view.getUint32(at + 20, true), expanded = view.getUint32(at + 24, true);
    const nameSize = view.getUint16(at + 28, true), extraSize = view.getUint16(at + 30, true), commentSize = view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true), next = at + 46 + nameSize + extraSize + commentSize;
    if (next > end || flags & ~0x80e || ![0, 8].includes(method) || view.getUint16(at + 34, true)
        || view.getUint16(at + 6, true) >= 45 || [compressed, expanded, local].includes(0xffffffff)
        || ((view.getUint32(at + 38, true) >>> 16) & 0xf000) === 0xa000) throw invalid();
    declaredTotal += expanded;
    if (declaredTotal > OFFICE_PREVIEW_LIMITS.bytes) throw complex();
    const name = partName(bytes.subarray(at + 46, at + 46 + nameSize));
    if (names.has(name.toLowerCase())) throw invalid();
    names.add(name.toLowerCase());
    checkExtra(view, at + 46 + nameSize, extraSize);
    if (local + 30 > centralStart || view.getUint32(local, true) !== 0x04034b50
        || view.getUint16(local + 4, true) !== view.getUint16(at + 6, true)
        || view.getUint16(local + 6, true) !== flags || view.getUint16(local + 8, true) !== method) throw invalid();
    const localNameSize = view.getUint16(local + 26, true), localExtraSize = view.getUint16(local + 28, true);
    const dataStart = local + 30 + localNameSize + localExtraSize, dataEnd = dataStart + compressed;
    if (dataEnd > centralStart || dataStart > centralStart
        || partName(bytes.subarray(local + 30, local + 30 + localNameSize)) !== name) throw invalid();
    checkExtra(view, local + 30 + localNameSize, localExtraSize);
    for (const [position, expected] of [[14, crc], [18, compressed], [22, expanded]]) {
      const actual = view.getUint32(local + position, true);
      if (actual !== expected && (!(flags & 8) || actual !== 0)) throw invalid();
    }
    let localEnd = dataEnd;
    if (flags & 8) {
      if (localEnd + 12 > centralStart) throw invalid();
      if (view.getUint32(localEnd, true) === 0x08074b50) localEnd += 4;
      if (localEnd + 12 > centralStart || view.getUint32(localEnd, true) !== crc
          || view.getUint32(localEnd + 4, true) !== compressed || view.getUint32(localEnd + 8, true) !== expanded) throw invalid();
      localEnd += 12;
    }
    entries.push({ name, method, crc, compressed, expanded, local, dataStart, dataEnd, localEnd });
    at = next;
  }
  if (at !== end) throw invalid();
  let previous = 0;
  for (const entry of [...entries].sort((a, b) => a.local - b.local)) {
    if (entry.local !== previous) throw invalid();
    previous = entry.localEnd;
  }
  if (previous !== centralStart) throw invalid();
  const required = ['[Content_Types].xml', kind === 'xlsx' ? 'xl/workbook.xml' : 'word/document.xml'];
  if (required.some(name => !entries.some(entry => entry.name === name && entry.expanded > 0))) throw invalid();
  let total = 0, cells = 0, sheets = 0, sourceRows = 0, sharedStrings = 0, elements = 0;
  for (const entry of entries) {
    let length = 0, crc = 0xffffffff;
    const xmlChunks = /\.(?:xml|rels|vml)$/i.test(entry.name) ? [] : null;
    const consume = chunk => {
      length += chunk.length; total += chunk.length;
      if (length > entry.expanded) throw invalid();
      if (total > OFFICE_PREVIEW_LIMITS.bytes) throw complex();
      crc = crcChunk(crc, chunk);
      if (xmlChunks) xmlChunks.push(chunk);
    };
    try {
      if (entry.method === 0) {
        if (entry.compressed !== entry.expanded) throw invalid();
        consume(bytes.subarray(entry.dataStart, entry.dataEnd));
      } else {
        // A small compressed push bounds each transient inflate allocation even
        // when forged ZIP size metadata conceals a highly compressible payload.
        const inflater = new Inflate(consume);
        for (let offset = entry.dataStart; offset < entry.dataEnd; offset += 1024) {
          const stop = Math.min(offset + 1024, entry.dataEnd);
          inflater.push(bytes.subarray(offset, stop), stop === entry.dataEnd);
        }
        if (!entry.compressed) throw invalid();
      }
    } catch (failure) {
      if (failure?.message?.includes('preview limits')) throw failure;
      throw invalid();
    }
    if (length !== entry.expanded || ((crc ^ 0xffffffff) >>> 0) !== entry.crc) throw invalid();
    if (xmlChunks) {
      const xml = decodeXml(xmlChunks, length);
      // Conservative XML-token bounds apply before a parser constructs its
      // object graph. Empty rows/shared strings can be expensive despite a tiny
      // cell count. Namespaced names are covered without rewriting any XML.
      for (const match of xml.matchAll(/<([^!?/\s][^<>\s/]*)(?=[\s/>])/g)) {
        if (++elements > OFFICE_PREVIEW_LIMITS.xmlElements) throw complex();
        if (kind !== 'xlsx') continue;
        const name = match[1].split(':').at(-1);
        if (name === 'c' && ++cells > OFFICE_PREVIEW_LIMITS.cells) throw complex();
        if (name === 'sheet' && ++sheets > OFFICE_PREVIEW_LIMITS.sheets) throw complex();
        if (name === 'row' && ++sourceRows > OFFICE_PREVIEW_LIMITS.sourceRows) throw complex();
        if (name === 'si' && ++sharedStrings > OFFICE_PREVIEW_LIMITS.sharedStrings) throw complex();
      }
    }
  }
  return arrayBuffer;
}

function rangeFor(sheet) {
  const reference = sheet['!fullref'] || sheet['!ref'];
  if (!reference) return { rows: 0, columns: 0 };
  if (!/^[A-Z]{1,3}[1-9]\d{0,6}(?::[A-Z]{1,3}[1-9]\d{0,6})?$/.test(reference)) throw invalid();
  const range = XLSX.utils.decode_range(reference);
  if (range.e.r >= 1048576 || range.e.c >= 16384 || range.s.r > range.e.r || range.s.c > range.e.c) throw invalid();
  return { rows: range.e.r + 1, columns: range.e.c + 1 };
}

/** Local worker-safe values only. Never emits HTML, hyperlink targets or recalculations. */
export function parseWorkbook(arrayBuffer) {
  validateOfficeZip(arrayBuffer, 'xlsx');
  let workbook;
  try {
    workbook = XLSX.read(arrayBuffer, { type: 'array', dense: false, sheetRows: OFFICE_PREVIEW_LIMITS.rows,
      sheets: Array.from({ length: OFFICE_PREVIEW_LIMITS.sheets }, (_, index) => index),
      cellFormula: true, cellHTML: false, cellText: true, sheetStubs: true, bookVBA: false, bookDeps: false, WTF: true });
  } catch { throw invalid(); }
  if (!workbook.SheetNames?.length || workbook.SheetNames.length > OFFICE_PREVIEW_LIMITS.sheets) throw invalid();
  let usedCells = 0, usedText = 0, shortened = 0;
  const text = value => {
    const source = String(value ?? '');
    let result = source.slice(0, OFFICE_PREVIEW_LIMITS.cellText).replace(/[\ud800-\udbff]$/, '');
    if (result !== source) shortened++;
    const size = encoder.encode(result).length;
    if (usedText + size > OFFICE_PREVIEW_LIMITS.textBytes) return null;
    usedText += size;
    return result;
  };
  // Reserve labels before cell output so later sheet names remain usable when
  // the shared text budget is exhausted by earlier sheet values.
  const metadata = workbook.SheetNames.map(name => {
    const sheet = workbook.Sheets[name] || {}, total = rangeFor(sheet), before = shortened;
    const width = Math.min(total.columns, OFFICE_PREVIEW_LIMITS.columns);
    const displayName = text(name);
    const columns = Array.from({ length: width }, (_, column) => text(XLSX.utils.encode_col(column)));
    if (displayName == null || columns.some(column => column == null)) throw complex();
    return { sheet, total, width, displayName, columns, clippedName: before !== shortened };
  });
  const sheets = metadata.map(({ sheet, total, width, displayName, columns, clippedName }, index) => {
    const count = width ? Math.min(total.rows, OFFICE_PREVIEW_LIMITS.rows,
      Math.floor((OFFICE_PREVIEW_LIMITS.cells - usedCells) / width)) : 0;
    const rows = [];
    let truncated = clippedName || count < total.rows || width < total.columns;
    rowLoop: for (let row = 0; row < count; row++) {
      const cells = [];
      for (let column = 0; column < width; column++) {
        const cell = sheet[XLSX.utils.encode_cell({ r: row, c: column })];
        const formula = typeof cell?.f === 'string' ? cell.f : undefined;
        const missingResult = formula !== undefined && (cell.t === 'z' || cell.v == null || typeof cell.v === 'number' && Number.isNaN(cell.v));
        const before = shortened;
        const value = text(missingResult ? 'No saved result' : cell?.w ?? cell?.v ?? '');
        const formulaText = formula === undefined ? undefined : text(formula);
        if (value == null || formulaText === null) { truncated = true; break rowLoop; }
        if (shortened !== before) truncated = true;
        cells.push({ text: value, ...(formula !== undefined ? { formula: formulaText } : {}), ...(missingResult ? { missingResult: true } : {}) });
      }
      rows.push({ number: row + 1, cells });
      usedCells += width;
    }
    return { name: displayName, hidden: !!workbook.Workbook?.Sheets?.[index]?.Hidden,
      columns, rows, totalRows: total.rows, totalColumns: total.columns, truncated };
  });
  const truncated = shortened > 0 || sheets.some(sheet => sheet.truncated);
  return { kind: 'xlsx', sheets, ...(truncated ? { notice: 'This preview is truncated by row, column, cell or text limits. Download the original to view all content.' } : {}) };
}
