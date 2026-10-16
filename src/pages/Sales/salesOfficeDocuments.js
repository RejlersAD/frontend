import mammoth from 'mammoth/mammoth.browser.js';
import MessageReader from '@kenjiuno/msgreader';
import { rasterPreview } from './salesRasterPreview.js';

const MsgReader = MessageReader.default || MessageReader;
const WORD_BYTES = 8 * 1024 * 1024;
const MESSAGE_BYTES = 4 * 1024 * 1024;
const MAX_ATTACHMENTS = 500;
const MAX_RECIPIENTS = 500;
const encoder = new TextEncoder();
const rasterTypes = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp', 'image/avif']);

function exactBuffer(value) {
  if (value instanceof ArrayBuffer) return value;
  if (ArrayBuffer.isView(value)) return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
  throw new Error('This document could not be read. Download the original to inspect it.');
}

function byteLength(value) { return encoder.encode(value).byteLength; }

function base64(bytes) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 32768) binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
  return btoa(binary);
}

// ZIP validation and cancellable worker execution belong to the caller. The
// returned HTML is untrusted and must pass the preview's sanitizer and sandbox.
export async function parseWord(value) {
  const buffer = exactBuffer(value);
  let imageBytes = 0;
  let imageCount = 0;
  let omittedImages = false;
  const result = await mammoth.convertToHtml({ arrayBuffer: buffer }, {
    externalFileAccess: false,
    includeEmbeddedStyleMap: false,
    convertImage: mammoth.images.imgElement(async image => {
      const omitted = () => {
        omittedImages = true;
        return { alt: `Image omitted from preview${image.altText ? `: ${String(image.altText).slice(0, 512)}` : '. Download the original to view it.'}` };
      };
      const mime = String(image.contentType || '').toLowerCase();
      if (!rasterTypes.has(mime) || ++imageCount > 200) return omitted();
      try {
        const bytes = new Uint8Array(await image.readAsArrayBuffer());
        if (!bytes.length || bytes.length > WORD_BYTES - imageBytes) return omitted();
        imageBytes += bytes.length;
        await rasterPreview(new Blob([bytes]), mime);
        return { src: `data:${mime};base64,${base64(bytes)}` };
      } catch {
        return omitted();
      }
    }),
  });
  if (typeof result.value !== 'string' || byteLength(result.value) > WORD_BYTES) {
    throw new Error('This Word document is too complex for the preview. Download the original to view it.');
  }
  const notices = ['Word preview uses a simplified layout. Download the original for its complete formatting.'];
  if (omittedImages) notices.push('Some images could not be included in this preview.');
  if (result.messages?.length) notices.push('Some document features could not be displayed.');
  return { kind: 'docx', html: result.value, notice: notices.join(' ') };
}

function own(value, key) { return value && Object.hasOwn(value, key) ? value[key] : undefined; }

function text(value, limit = 2048) { return typeof value === 'string' ? value.replace(/\0/g, '').slice(0, limit) : ''; }

function address(value, sender = false) {
  const name = text(own(value, sender ? 'senderName' : 'name'), 512);
  const email = text(own(value, sender ? 'senderSmtpAddress' : 'smtpAddress') || own(value, sender ? 'senderEmail' : 'email'), 512);
  return name && email && name !== email ? `${name} <${email}>` : name || email;
}

function encodingLabel(codepage) {
  const known = {
    65001: 'utf-8', 1200: 'utf-16le', 1201: 'utf-16be', 20127: 'windows-1252',
    28591: 'iso-8859-1', 28592: 'iso-8859-2', 28595: 'iso-8859-5', 28596: 'iso-8859-6',
    28597: 'iso-8859-7', 28598: 'iso-8859-8', 28599: 'iso-8859-9', 28605: 'iso-8859-15',
    932: 'shift_jis', 936: 'gbk', 949: 'euc-kr', 950: 'big5', 54936: 'gb18030',
    20866: 'koi8-r', 21866: 'koi8-u', 874: 'windows-874', 10000: 'macintosh',
  };
  if (Number.isInteger(codepage) && codepage >= 1250 && codepage <= 1258) return `windows-${codepage}`;
  return known[codepage] || '';
}

function messageFields(buffer, ansiEncoding) {
  const reader = new MsgReader(buffer);
  let hasAnsi = false;
  reader.parserConfig = {
    ansiEncoding,
    propertyObserver: (_fields, tag) => { if ((tag & 0xffff) === 0x001e) hasAnsi = true; },
  };
  return { fields: reader.getFileData(), hasAnsi };
}

function decodedHtml(fields, notices) {
  const html = own(fields, 'bodyHtml');
  if (typeof html === 'string') return html;
  const bytes = own(fields, 'html');
  if (!(bytes instanceof Uint8Array) || !bytes.length) return '';
  if (bytes.byteLength > MESSAGE_BYTES) {
    notices.push('The HTML message body is too large to preview. Download the original to read it.');
    return '';
  }
  const codepage = own(fields, 'internetCodepage') || own(fields, 'messageCodepage');
  let label = encodingLabel(codepage);
  if (codepage && !label) {
    notices.push('The message body uses an unsupported text encoding. Download the original to read it.');
    return '';
  }
  // A UTF-8 BOM or valid UTF-8 without a declared code page is deterministic;
  // otherwise expose the limitation rather than silently changing characters.
  if (!label) label = bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf-16le'
    : bytes[0] === 0xfe && bytes[1] === 0xff ? 'utf-16be' : 'utf-8';
  try { return new TextDecoder(label, { fatal: true }).decode(bytes); }
  catch {
    notices.push('The message body could not be decoded. Download the original to read it.');
    return '';
  }
}

// MS-CFB stores stream lengths and allocation chains in attacker-controlled
// directory/FAT records. Validate those records without reading stream payloads
// before MsgReader allocates them. The root mini stream backs small streams and
// is excluded from the aggregate to avoid counting their content twice.
function validateMessageContainer(buffer) {
  const invalid = () => new Error('This Outlook message has an invalid storage structure. Download the original to inspect it.');
  const complex = () => new Error('This Outlook message is too complex for the preview. Download the original to read it.');
  const END = 0xfffffffe, FREE = 0xffffffff, FAT = 0xfffffffd, DIFAT = 0xfffffffc;
  if (buffer.byteLength > 128 * 1024 * 1024) throw complex();
  if (buffer.byteLength < 512) throw invalid();
  const view = new DataView(buffer);
  const major = view.getUint16(26, true), shift = view.getUint16(30, true);
  if (!((major === 3 && shift === 9) || (major === 4 && shift === 12))
    || view.getUint16(28, true) !== 0xfffe || view.getUint16(32, true) !== 6
    || view.getUint32(56, true) !== 4096) throw invalid();
  const sectorSize = 2 ** shift, slots = sectorSize / 4;
  if (buffer.byteLength % sectorSize !== 0) throw invalid();
  const sectorCount = buffer.byteLength / sectorSize - 1;
  const fatCount = view.getUint32(44, true), difatCount = view.getUint32(72, true);
  if (!fatCount || fatCount > sectorCount || difatCount > sectorCount) throw invalid();
  const sectorOffset = sector => {
    if (!Number.isInteger(sector) || sector < 0 || sector >= sectorCount) throw invalid();
    return (sector + 1) * sectorSize;
  };
  const occupied = new Set(), fatSectors = [];
  const reserve = sector => {
    sectorOffset(sector);
    if (occupied.has(sector)) throw invalid();
    occupied.add(sector);
  };
  const addFat = sector => {
    // MsgReader reads the declared prefix verbatim. Do not compact a FREE
    // hole into a different FAT order than the parser will subsequently use.
    if (sector === FREE) {
      if (fatSectors.length < fatCount) throw invalid();
      return;
    }
    reserve(sector); fatSectors.push(sector);
    if (fatSectors.length > fatCount) throw invalid();
  };
  for (let index = 0; index < 109; index += 1) addFat(view.getUint32(76 + 4 * index, true));
  const difatSectors = [];
  let difat = view.getUint32(68, true);
  for (let index = 0; index < difatCount; index += 1) {
    reserve(difat); difatSectors.push(difat);
    const offset = sectorOffset(difat);
    for (let item = 0; item < slots - 1; item += 1) addFat(view.getUint32(offset + item * 4, true));
    difat = view.getUint32(offset + sectorSize - 4, true);
  }
  if (![END, FREE].includes(difat) || fatSectors.length !== fatCount) throw invalid();
  const nextFat = sector => {
    sectorOffset(sector);
    const table = fatSectors[Math.floor(sector / slots)];
    if (table === undefined) throw invalid();
    return view.getUint32(sectorOffset(table) + (sector % slots) * 4, true);
  };
  if (fatSectors.some(sector => nextFat(sector) !== FAT) || difatSectors.some(sector => nextFat(sector) !== DIFAT)) throw invalid();
  const chain = (start, expected, maximum = sectorCount, next = nextFat, taken = occupied) => {
    if (expected === 0) {
      if (![END, FREE].includes(start)) throw invalid();
      return [];
    }
    const result = [];
    for (let sector = start; sector !== END; sector = next(sector)) {
      if (sector >= maximum || taken.has(sector) || result.length >= maximum || (expected !== undefined && result.length >= expected)) throw invalid();
      taken.add(sector); result.push(sector);
    }
    if (expected !== undefined && result.length !== expected) throw invalid();
    return result;
  };
  const directory = chain(view.getUint32(48, true));
  if (!directory.length || directory.length * sectorSize / 128 > 4096) throw complex();
  const directoryCount = view.getUint32(40, true);
  if (major === 3 ? directoryCount !== 0 : directoryCount !== directory.length) throw invalid();
  const entries = [];
  let aggregate = 0;
  for (const sector of directory) {
    const offset = sectorOffset(sector);
    for (let part = 0; part < sectorSize; part += 128) {
      const at = offset + part, type = view.getUint8(at + 66), nameBytes = view.getUint16(at + 64, true);
      if (![0, 1, 2, 5].includes(type)) throw invalid();
      if (type && (nameBytes < 2 || nameBytes > 64 || nameBytes % 2 || view.getUint16(at + nameBytes - 2, true) !== 0)) throw invalid();
      const size = view.getUint32(at + 120, true), highSize = view.getUint32(at + 124, true);
      if ((type === 2 || type === 5) && (highSize || size > buffer.byteLength)) throw invalid();
      if (type === 2) aggregate += size;
      if (aggregate > buffer.byteLength) throw invalid();
      entries.push({ type, size, start: view.getUint32(at + 116, true),
        left: view.getUint32(at + 68, true), right: view.getUint32(at + 72, true), child: view.getUint32(at + 76, true) });
    }
  }
  const root = entries[0];
  if (root?.type !== 5 || root.left !== FREE || root.right !== FREE || entries.slice(1).some(entry => entry.type === 5)) throw invalid();
  // Child and sibling edges form a tree. Repeated nodes, cross-parent aliases,
  // invalid indices and excessive nesting would otherwise recurse indefinitely.
  const seen = new Set([0]), pending = root.child === FREE ? [] : [{ index: root.child, depth: 1 }];
  while (pending.length) {
    const { index, depth } = pending.pop();
    if (depth > 64) throw complex();
    if (index >= entries.length || seen.has(index) || ![1, 2].includes(entries[index].type)) throw invalid();
    seen.add(index);
    const entry = entries[index];
    for (const sibling of [entry.left, entry.right]) if (sibling !== FREE) pending.push({ index: sibling, depth });
    if (entry.child !== FREE) {
      if (entry.type !== 1) throw invalid();
      pending.push({ index: entry.child, depth: depth + 1 });
    }
  }
  if (entries.some((entry, index) => entry.type && !seen.has(index))) throw invalid();
  chain(root.start, Math.ceil(root.size / sectorSize));
  const miniCount = view.getUint32(64, true);
  if (miniCount > sectorCount) throw invalid();
  const miniStart = view.getUint32(60, true);
  // CFB permits sector zero here, but MsgReader 1.28.0's sbatDataReader treats
  // zero as absent. Refuse this layout instead of showing zero-padded content.
  if (miniCount && miniStart === 0) throw new Error('This Outlook message uses a storage layout that cannot be previewed. Download the original to read it.');
  const miniFat = chain(miniStart, miniCount);
  const miniSectors = Math.ceil(root.size / 64), occupiedMini = new Set();
  const nextMini = index => {
    const sector = miniFat[Math.floor(index / slots)];
    if (sector === undefined) throw invalid();
    return view.getUint32(sectorOffset(sector) + (index % slots) * 4, true);
  };
  for (const entry of entries) {
    if (entry.type !== 2) continue;
    if (entry.size >= 4096) chain(entry.start, Math.ceil(entry.size / sectorSize));
    else {
      const sectors = chain(entry.start, Math.ceil(entry.size / 64), miniSectors, nextMini, occupiedMini);
      if (sectors.some((sector, index) => sector * 64 + Math.min(64, entry.size - index * 64) > root.size)) throw invalid();
    }
  }
}

// MSG parsing is synchronous: invoke only inside the caller's disposable worker,
// whose timeout can stop corrupt CFB chain traversal. Never return attachment
// bytes, raw MAPI properties, nested messages, or parser error payloads.
export function parseMessage(value) {
  const buffer = exactBuffer(value);
  const header = new Uint8Array(buffer, 0, Math.min(8, buffer.byteLength));
  if (![0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every((byte, index) => header[index] === byte)) {
    throw new Error('This file does not contain a readable Outlook message. Download the original to inspect it.');
  }
  validateMessageContainer(buffer);
  const notices = [];
  let { fields, hasAnsi } = messageFields(buffer, 'windows-1252');
  if (own(fields, 'error') || own(fields, 'dataType') !== 'msg'
    || !['messageClass', 'subject', 'body', 'bodyHtml', 'senderName', 'senderEmail'].some(key => typeof own(fields, key) === 'string' && own(fields, key).trim())) {
    throw new Error('This file does not contain a readable Outlook message. Download the original to inspect it.');
  }
  const messageCodepage = own(fields, 'messageCodepage');
  if (hasAnsi && messageCodepage && messageCodepage !== 1252) {
    const label = encodingLabel(messageCodepage);
    if (!label) throw new Error('This Outlook message uses an unsupported text encoding. Download the original to read it.');
    fields = messageFields(buffer, label).fields;
  } else if (hasAnsi && !messageCodepage) {
    notices.push('The message does not declare its text encoding; ANSI fields use Windows-1252.');
  }
  const recipients = Array.isArray(own(fields, 'recipients')) ? own(fields, 'recipients') : [];
  const attachments = Array.isArray(own(fields, 'attachments')) ? own(fields, 'attachments') : [];
  if (recipients.length > MAX_RECIPIENTS) notices.push(`Showing the first ${MAX_RECIPIENTS} recipients.`);
  if (attachments.length > MAX_ATTACHMENTS) notices.push(`Showing the first ${MAX_ATTACHMENTS} attachments.`);
  const recipientList = kind => recipients.slice(0, MAX_RECIPIENTS).filter(item => own(item, 'recipType') === kind).map(item => address(item)).filter(Boolean).join('; ');
  const originalBody = own(fields, 'body');
  let bodyText = typeof originalBody === 'string' && originalBody.trim() ? originalBody : '';
  let bodyHtml = bodyText ? '' : decodedHtml(fields, notices);
  if (bodyText && byteLength(bodyText) > MESSAGE_BYTES) {
    const bytes = encoder.encode(bodyText);
    bodyText = new TextDecoder().decode(bytes.subarray(0, MESSAGE_BYTES - 65536), { stream: true });
    notices.push('The message body is truncated. Download the original for the complete message.');
  }
  if (bodyHtml && byteLength(bodyHtml) > MESSAGE_BYTES) {
    bodyHtml = '';
    notices.push('The HTML message body is too large to preview. Download the original to read it.');
  }
  if (!bodyText && !bodyHtml && own(fields, 'compressedRtf')?.length) {
    notices.push('This message contains an RTF body that cannot be previewed. Download the original to read it.');
  } else if (!bodyText && !bodyHtml && !notices.some(notice => notice.includes('body'))) {
    notices.push('No readable message body is available. Download the original to inspect it.');
  }
  const result = {
    kind: 'msg', subject: text(own(fields, 'subject'), 4096), sender: address(fields, true),
    to: recipientList('to'), cc: recipientList('cc'),
    date: text(own(fields, 'clientSubmitTime') || own(fields, 'messageDeliveryTime'), 128),
    bodyText, bodyHtml,
    attachments: attachments.slice(0, MAX_ATTACHMENTS).map(item => ({
      name: text(own(item, 'fileName') || own(item, 'fileNameShort') || own(item, 'name'), 1024) || 'Unnamed attachment',
      size: Number.isSafeInteger(own(item, 'contentLength')) && own(item, 'contentLength') >= 0 ? own(item, 'contentLength') : null,
    })),
    ...(notices.length ? { notice: notices.join(' ') } : {}),
  };
  if (byteLength(JSON.stringify(result)) > MESSAGE_BYTES && result.bodyHtml) {
    result.bodyHtml = '';
    notices.push('The HTML message body is too large to preview. Download the original to read it.');
    result.notice = notices.join(' ');
  }
  while (byteLength(JSON.stringify(result)) > MESSAGE_BYTES && result.bodyText) {
    result.bodyText = result.bodyText.slice(0, Math.floor(result.bodyText.length / 2)).replace(/[\uD800-\uDBFF]$/, '');
    if (!notices.some(notice => notice.includes('body is truncated'))) notices.push('The message body is truncated. Download the original for the complete message.');
    result.notice = notices.join(' ');
  }
  if (byteLength(JSON.stringify(result)) > MESSAGE_BYTES) {
    throw new Error('This Outlook message is too complex for the preview. Download the original to read it.');
  }
  return result;
}

// ---------------------------------------------------------------------------
// EML (RFC 5322 / MIME) preview.
//
// .eml is the textual MIME serialization of an Internet mail message (the form
// produced by Outlook "Save As", Gmail exports, etc.), unlike .msg which is a
// binary MS-CFB compound file. It is parsed with a small, dependency-free MIME
// reader and returned in the same shape as parseMessage so the shared
// Outlook-message renderer displays it. The worker's timeout still bounds input.
const EML_BYTES = 8 * 1024 * 1024;
const EML_INLINE_IMAGE_BYTES = 2 * 1024 * 1024;

function emlLatin1(buffer) {
  const bytes = new Uint8Array(buffer);
  let out = '';
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return out;
}

function emlRawBytes(str) {
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i += 1) out[i] = str.charCodeAt(i) & 0xff;
  return out;
}

function emlDecode(bytes, charset) {
  if (!bytes || !bytes.length) return '';
  const label = String(charset || '').trim().toLowerCase();
  if (!label || label === 'default' || label === 'us-ascii' || label === 'ascii') {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  }
  try { return new TextDecoder(label, { fatal: false }).decode(bytes); }
  catch { try { return new TextDecoder('utf-8', { fatal: false }).decode(bytes); } catch { return ''; } }
}

function emlBase64(str) {
  try { return emlRawBytes(atob(str.replace(/\s/g, ''))); }
  catch { return new Uint8Array(0); }
}

function emlQp(str) {
  const bytes = [];
  for (let i = 0; i < str.length; ) {
    const ch = str[i];
    if (ch === '=' && i + 2 < str.length && /[0-9A-Fa-f]/.test(str[i + 1]) && /[0-9A-Fa-f]/.test(str[i + 2])) {
      bytes.push(parseInt(str[i + 1] + str[i + 2], 16)); i += 3;
    } else if (ch === '=' && i + 2 < str.length && str[i + 1] === '\r' && str[i + 2] === '\n') {
      i += 3;
    } else if (ch === '=' && i + 1 < str.length && str[i + 1] === '\n') {
      i += 2;
    } else {
      bytes.push(str.charCodeAt(i) & 0xff); i += 1;
    }
  }
  return new Uint8Array(bytes);
}

function emlParams(value) {
  const params = {};
  if (!value) return params;
  const parts = String(value).split(';');
  for (let i = 1; i < parts.length; i += 1) {
    const segment = parts[i].trim();
    const eq = segment.indexOf('=');
    if (eq === -1) continue;
    let key = segment.slice(0, eq).trim().toLowerCase();
    let val = segment.slice(eq + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1).replace(/\\(.)/g, '$1');
    else if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    params[key] = val;
  }
  return params;
}

function emlHeaders(headerStr) {
  const headers = {};
  let current = null;
  for (const rawLine of headerStr.replace(/\r\n/g, '\n').split('\n')) {
    if (rawLine.startsWith(' ') || rawLine.startsWith('\t')) {
      if (current) headers[current] = (headers[current] || '') + ' ' + rawLine.trim();
    } else {
      const c = rawLine.indexOf(':');
      if (c === -1) { current = null; continue; }
      const name = rawLine.slice(0, c).trim().toLowerCase();
      const value = rawLine.slice(c + 1).trim();
      current = name;
      headers[name] = headers[name] === undefined ? value : headers[name] + ', ' + value;
    }
  }
  return headers;
}

function emlSplitHeadersBody(raw) {
  const crlf = raw.indexOf('\r\n\r\n');
  let idx, sepLen;
  if (crlf !== -1) { idx = crlf; sepLen = 4; }
  else {
    const lf = raw.indexOf('\n\n');
    if (lf !== -1) { idx = lf; sepLen = 2; }
    else return { headers: raw, body: '' };
  }
  return { headers: raw.slice(0, idx), body: raw.slice(idx + sepLen) };
}

function emlSplitMultipart(body, boundary) {
  const escaped = boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('\\r?\\n--' + escaped + '(--)?', 'g');
  const haystack = '\n' + body;
  const cuts = [];
  let m;
  while ((m = re.exec(haystack)) !== null) cuts.push({ start: m.index, end: m.index + m[0].length, close: !!m[1] });
  const parts = [];
  for (let i = 0; i < cuts.length; i += 1) {
    if (cuts[i].close) continue;
    const end = i + 1 < cuts.length ? cuts[i + 1].start : haystack.length;
    const part = haystack.slice(cuts[i].end, end).replace(/\r?\n$/, '');
    if (part) parts.push(part);
  }
  return parts;
}

function emlParsePart(raw) {
  const { headers: headerStr, body } = emlSplitHeadersBody(raw);
  const headers = emlHeaders(headerStr);
  const ct = (headers['content-type'] || '').trim();
  const base = ct ? ct.split(';')[0].trim().toLowerCase() : 'text/plain';
  const params = emlParams(ct);
  if (base.startsWith('multipart/')) {
    const boundary = params.boundary;
    if (!boundary) return { kind: 'multipart', subtype: '', headers, params, parts: [] };
    return { kind: 'multipart', subtype: base.split('/')[1] || '', headers, params, parts: emlSplitMultipart(body, boundary).map(s => emlParsePart(s)).filter(Boolean) };
  }
  return { kind: 'leaf', headers, body, params, transferEncoding: (headers['content-transfer-encoding'] || '7bit').trim().toLowerCase(), contentType: base };
}

function emlLeaves(node, out) {
  if (node.kind === 'multipart') node.parts.forEach(p => emlLeaves(p, out));
  else out.push(node);
}

function emlLeafBytes(leaf) {
  const transfer = leaf.transferEncoding;
  if (transfer === 'base64') return emlBase64(leaf.body);
  if (transfer === 'quoted-printable') return emlQp(leaf.body);
  return emlRawBytes(leaf.body);
}

function emlSplitAddresses(raw) {
  const parts = [];
  let cur = ''; let inQuote = false; let inAngle = false; let inParen = false;
  for (const ch of raw) {
    if (ch === '"' && !inAngle && !inParen) inQuote = !inQuote;
    else if (ch === '(' && !inAngle && !inQuote) inParen = true;
    else if (ch === ')' && inParen) inParen = false;
    else if (ch === '<' && !inQuote && !inParen) inAngle = true;
    else if (ch === '>' && inAngle) inAngle = false;
    if (ch === ',' && !inQuote && !inAngle && !inParen) { parts.push(cur); cur = ''; }
    else cur += ch;
  }
  parts.push(cur);
  return parts;
}

function emlFormatAddress(raw) {
  const decoded = emlDecodeHeader(raw);
  const angle = /<([^>]*)>/.exec(decoded);
  let email = ''; let name = '';
  if (angle) { email = angle[1].trim(); name = decoded.slice(0, angle.index).trim(); }
  else { email = decoded.trim(); name = ''; }
  if (name.startsWith('"') && name.endsWith('"')) name = name.slice(1, -1);
  name = name.trim();
  email = email.replace(/[<>]/g, '').trim();
  if (name && email) return `${name} <${email}>`;
  return email || name;
}

function emlFormatAddresses(raw) {
  const parts = emlSplitAddresses(raw || '');
  if (parts.length > MAX_RECIPIENTS) parts.length = MAX_RECIPIENTS;
  return parts.map(segment => emlFormatAddress(segment)).filter(Boolean).join(', ');
}

function emlDecodeWord(charset, encoding, encoded) {
  const bytes = encoding === 'b' ? emlBase64(encoded) : emlQp(encoded);
  return emlDecode(bytes, charset);
}

function emlDecodeHeader(value) {
  if (!value) return '';
  const re = /=\?([^? ]+?)\?([QBqb])\?([^?]*)\?=/g;
  let result = ''; let last = 0; let m;
  while ((m = re.exec(value)) !== null) {
    result += value.slice(last, m.index);
    result += emlDecodeWord(m[1], m[2].toLowerCase(), m[3]);
    last = m.index + m[0].length;
  }
  result += value.slice(last);
  return result.replace(/\s+/g, ' ').trim();
}

function emlFormatDate(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value || '';
  try { return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Dubai' }).format(parsed); } catch { return value; }
}

export function parseEml(value) {
  const buffer = exactBuffer(value);
  if (buffer.byteLength > EML_BYTES) throw new Error('This file is too large for the email preview. Download the original to open it.');
  if (buffer.byteLength < 5) throw new Error('This file does not contain a readable email message. Download the original to inspect it.');
  const notices = [];
  const node = emlParsePart(emlLatin1(buffer));
  const headers = node.headers || {};
  const leaves = [];
  emlLeaves(node, leaves);
  let htmlBody = '';
  let textBody = '';
  const attachments = [];
  const cidMap = {};
  for (const leaf of leaves) {
    const cd = (leaf.headers['content-disposition'] || '').toLowerCase();
    const fileName = own(emlParams(leaf.headers['content-disposition'] || ''), 'filename') || own(leaf.params, 'filename') || '';
    const rawCid = own(leaf.headers, 'content-id');
    const cid = rawCid ? rawCid.replace(/[<>]/g, '').trim() : '';
    const mimeType = leaf.contentType;
    if (mimeType.startsWith('image/') && cid) {
      const bytes = emlLeafBytes(leaf);
      if (bytes.length <= EML_INLINE_IMAGE_BYTES) {
        const mime = mimeType === 'image/jpg' ? 'image/jpeg' : mimeType;
        cidMap[cid] = `data:${mime};base64,${base64(bytes)}`;
      }
      continue;
    }
    if (cd === 'attachment' || fileName) {
      attachments.push({ name: fileName || 'attachment', size: null, type: mimeType });
      continue;
    }
    const bytes = emlLeafBytes(leaf);
    const charset = own(leaf.params, 'charset') || 'utf-8';
    const decoded = emlDecode(bytes, charset);
    if (mimeType === 'text/html' && !htmlBody) htmlBody = decoded;
    else if (mimeType === 'text/plain' && !textBody) textBody = decoded;
    else if (mimeType.startsWith('text/') && !textBody) textBody = decoded;
  }
  let bodyHtml = '';
  let bodyText = '';
  if (htmlBody.trim()) {
    bodyHtml = htmlBody.replace(/\bsrc\s*=\s*(?:"cid:([^"]+)"|'cid:([^']+)'|cid:([^\s>'"]+))/gi, (match, a, b, c) => {
      const uri = cidMap[(a || b || c).trim()];
      return uri ? `src="${uri}"` : match;
    });
  } else if (textBody) {
    bodyText = textBody;
  }
  if (bodyHtml && byteLength(bodyHtml) > MESSAGE_BYTES) {
    bodyHtml = '';
    notices.push('The HTML body is too large to preview. Download the original to read it.');
  }
  if (!bodyHtml && bodyText && byteLength(bodyText) > MESSAGE_BYTES) {
    const bytes = encoder.encode(bodyText);
    bodyText = new TextDecoder().decode(bytes.subarray(0, MESSAGE_BYTES - 65536), { stream: true });
    notices.push('The message body is truncated. Download the original for the complete message.');
  }
  if (attachments.length > MAX_ATTACHMENTS) {
    attachments.length = MAX_ATTACHMENTS;
    notices.push(`Showing the first ${MAX_ATTACHMENTS} attachments.`);
  }
  return {
    kind: 'eml',
    subject: text(emlDecodeHeader(own(headers, 'subject') || ''), 4096),
    sender: emlFormatAddresses(own(headers, 'from') || ''),
    to: emlFormatAddresses(own(headers, 'to') || ''),
    cc: own(headers, 'cc') ? emlFormatAddresses(own(headers, 'cc')) : '',
    date: emlFormatDate(emlDecodeHeader(own(headers, 'date') || '')),
    bodyText,
    bodyHtml,
    attachments,
    ...(notices.length ? { notice: notices.join(' ') } : {}),
  };
}
