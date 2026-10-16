import { Buffer } from 'node:buffer';
import * as XLSX from 'xlsx';
import { zipSync, strToU8 } from 'fflate';

// Synthetic, real-format documents. No customer data or external delivery.
export const officePng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

export function officeWorkbook({ rows = 4, columns = 4 } = {}) {
  const data = [['Metric', 'Saved value', 'Owner', 'Notes']];
  for (let row = 2; row <= Math.max(4, rows); row += 1) {
    data.push([row === 2 ? 'Cached zero' : row === 3 ? 'Uncached formula' : `Estimate row ${row}`, row, 'Synthetic planner', `Source row ${row}`]);
  }
  for (const [rowIndex, row] of data.entries()) {
    for (let column = 4; column < columns; column += 1) row.push(rowIndex === 0 ? `Column ${column + 1}` : `R${rowIndex + 1}C${column + 1}`);
  }
  const sheet = XLSX.utils.aoa_to_sheet(data);
  sheet.B2 = { t: 'n', f: '1-1', v: 0, z: '0.00' };
  sheet.B3 = { t: 'n', f: '2+2' };
  sheet.D4 = { t: 's', v: 'External workbook reference', l: { Target: 'https://preview-external.example/workbook-link' } };
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Estimate');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['Notes', 'Original source'],
    ['Second sheet content', 'Recorded engineering assumptions'],
    ['Literal content', '<script>window.officePreviewExecuted=true</script>'],
  ]), 'Notes');
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer', compression: true });
}

const xml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const paragraph = text => `<w:p><w:r><w:t xml:space="preserve">${xml(text)}</w:t></w:r></w:p>`;
const drawing = (id, external = false) => `<w:p><w:r><w:drawing><wp:inline><wp:extent cx="952500" cy="952500"/><wp:docPr id="${external ? 2 : 1}" name="${external ? 'Remote image' : 'Embedded diagram'}" descr="${external ? 'Remote image' : 'Embedded diagram'}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="Diagram"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:${external ? 'link' : 'embed'}="${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="952500" cy="952500"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;

export function officeDocument({ malicious = true, image = true, bodyText = 'Synthetic Word scope for the opportunity.' } = {}) {
  const files = {
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="document" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/styles.xml': '<?xml version="1.0"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr></w:style></w:styles>',
    'word/_rels/document.xml.rels': `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="styles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="diagram" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/diagram.png"/><Relationship Id="unsafe" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="javascript:window.officePreviewExecuted=true" TargetMode="External"/><Relationship Id="remote" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://preview-external.example/document-link" TargetMode="External"/><Relationship Id="remoteImage" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="https://preview-external.example/document-image.png" TargetMode="External"/></Relationships>`,
    'word/document.xml': `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Engineering scope document</w:t></w:r></w:p>${paragraph(bodyText)}<w:tbl><w:tr><w:tc>${paragraph('Deliverable')}</w:tc><w:tc>${paragraph('Owner')}</w:tc></w:tr><w:tr><w:tc>${paragraph('Design report')}</w:tc><w:tc>${paragraph('Process team')}</w:tc></w:tr></w:tbl>${image ? drawing('diagram') : ''}${malicious ? `<w:p><w:hyperlink r:id="unsafe"><w:r><w:t>Unsafe link label</w:t></w:r></w:hyperlink></w:p><w:p><w:hyperlink r:id="remote"><w:r><w:t>Remote link label</w:t></w:r></w:hyperlink></w:p>${paragraph('<script>window.officePreviewExecuted=true</script>')}${drawing('remoteImage', true)}` : ''}<w:sectPr/></w:body></w:document>`,
  };
  const entries = Object.fromEntries(Object.entries(files).map(([name, text]) => [name, strToU8(text)]));
  if (image) entries['word/media/diagram.png'] = officePng;
  return Buffer.from(zipSync(entries, { level: 6 }));
}

const property = (tag, value) => {
  const entry = Buffer.alloc(16);
  entry.writeUInt32LE(tag, 0);
  entry.writeUInt32LE(6, 4);
  if (typeof value === 'bigint') entry.writeBigUInt64LE(value, 8);
  else entry.writeUInt32LE(value, 8);
  return entry;
};

export function officeMessage({ html = false, bodyText, bodyHtml } = {}) {
  const { CFB } = XLSX;
  const container = CFB.utils.cfb_new();
  const add = (path, value) => CFB.utils.cfb_add(container, path, value);
  const text = (path, value) => add(path, Buffer.from(`${value}\0`, 'utf16le'));
  const headers = Buffer.alloc(32);
  for (const offset of [8, 12, 16, 20]) headers.writeUInt32LE(1, offset);
  headers.writeUInt32LE(2, 8);
  headers.writeUInt32LE(2, 16);
  const sent = BigInt(Date.parse('2026-10-01T08:00:00Z') + 11644473600000) * 10000n;
  add('__properties_version1.0', Buffer.concat([headers, property(0x3FDE0003, 65001), property(0x00390040, sent)]));
  text('__substg1.0_001A001F', 'IPM.Note');
  text('__substg1.0_0037001F', 'Synthetic bid clarification');
  text('__substg1.0_0C1A001F', 'Synthetic sender');
  text('__substg1.0_0C1F001F', 'sender@example.invalid');
  text('__substg1.0_0E04001F', 'Proposal reviewer');
  text('__substg1.0_0E03001F', 'Copied reviewer');
  text('__substg1.0_007D001F', 'From: Synthetic sender <sender@example.invalid>\r\nTo: Proposal reviewer <reviewer@example.invalid>\r\nCc: Copied reviewer <copy@example.invalid>\r\nDate: Thu, 01 Oct 2026 08:00:00 +0000\r\nSubject: Synthetic bid clarification\r\n');
  if (html || bodyHtml !== undefined) {
    add('__substg1.0_10130102', Buffer.from(bodyHtml ?? '<h1>Client clarification</h1><p>Review the attached scope before submission.</p><script>window.officePreviewExecuted=true</script><img src="https://preview-external.example/tracker.png" onerror="window.officePreviewExecuted=true"><a href="javascript:window.officePreviewExecuted=true">Unsafe mail link</a><a href="https://preview-external.example/mail-link">Remote mail link</a><iframe src="https://preview-external.example/frame"></iframe>'));
  }
  if (!html || bodyText !== undefined) text('__substg1.0_1000001F', bodyText ?? 'Please review the synthetic scope.\r\n<script>window.officePreviewExecuted=true</script>\r\nThe attachment remains part of this original message.');
  const recipient = '__recip_version1.0_#00000000/';
  add(`${recipient}__properties_version1.0`, Buffer.concat([Buffer.alloc(8), property(0x0C150003, 1)]));
  text(`${recipient}__substg1.0_3001001F`, 'Proposal reviewer');
  text(`${recipient}__substg1.0_3002001F`, 'SMTP');
  text(`${recipient}__substg1.0_3003001F`, 'reviewer@example.invalid');
  const copied = '__recip_version1.0_#00000001/';
  add(`${copied}__properties_version1.0`, Buffer.concat([Buffer.alloc(8), property(0x0C150003, 2)]));
  text(`${copied}__substg1.0_3001001F`, 'Copied reviewer');
  text(`${copied}__substg1.0_3002001F`, 'SMTP');
  text(`${copied}__substg1.0_3003001F`, 'copy@example.invalid');
  const attachment = '__attach_version1.0_#00000000/';
  add(`${attachment}__properties_version1.0`, Buffer.concat([Buffer.alloc(8), property(0x37050003, 1), property(0x0E200003, 28)]));
  text(`${attachment}__substg1.0_3707001F`, 'Scope_attachment.txt');
  add(`${attachment}__substg1.0_37010102`, Buffer.from('Synthetic attachment content'));
  return CFB.write(container, { type: 'buffer' });
}

export function officeSources() {
  return [
    { key: 'workbook', name: 'Engineering_estimate.xlsx', mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', bytes: officeWorkbook() },
    { key: 'document', name: 'Engineering_scope.docx', mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', bytes: officeDocument() },
    { key: 'message', name: 'Bid_clarification.msg', mime_type: 'application/vnd.ms-outlook', bytes: officeMessage() },
    { key: 'htmlmessage', name: 'Client_clarification.msg', mime_type: 'application/vnd.ms-outlook', bytes: officeMessage({ html: true }) },
  ];
}
