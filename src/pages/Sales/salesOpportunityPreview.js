import { rasterPreview } from './salesRasterPreview.js';

export const TEXT_PREVIEW_BYTES = 256 * 1024;
const imageTypes = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', avif: 'image/avif' };
const textExtensions = new Set(['txt', 'csv', 'tsv', 'md', 'log', 'json', 'xml', 'yaml', 'yml', 'ini']);
const officeTypes = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  msg: 'application/vnd.ms-outlook',
};

export function filePreviewType(file) {
  const extension = String(file?.name || '').split('.').at(-1).toLowerCase();
  const mime = String(file?.mime_type || '').split(';')[0].toLowerCase();
  if (['html', 'htm', 'xhtml', 'svg', 'svgz'].includes(extension) || ['text/html', 'application/xhtml+xml', 'image/svg+xml'].includes(mime)) return { kind: 'unsupported' };
  const officeKind = Object.keys(officeTypes).find(kind => kind === extension || officeTypes[kind] === mime);
  if (officeKind) return { kind: officeKind };
  if (extension === 'pdf' || mime === 'application/pdf') return { kind: 'pdf', mime: 'application/pdf' };
  const imageMime = imageTypes[extension] || Object.values(imageTypes).find(value => value === mime);
  if (imageMime) return { kind: 'image', mime: imageMime };
  if (textExtensions.has(extension) || ['text/plain', 'text/csv', 'application/json'].includes(mime)) return { kind: 'text' };
  return { kind: 'unsupported' };
}

export async function previewContent(blob, type, { signal } = {}) {
  if (Object.hasOwn(officeTypes, type.kind)) {
    const { parseOfficeFile } = await import('./salesOfficePreview.js');
    return parseOfficeFile(blob, type.kind, { signal });
  }
  const header = new Uint8Array(await blob.slice(0, 32).arrayBuffer());
  const ascii = (start, end) => String.fromCharCode(...header.slice(start, end));
  if (type.kind === 'pdf') {
    if (ascii(0, 5) !== '%PDF-') throw new Error('This file does not contain a readable PDF. Download the original to inspect it.');
    return { kind: 'pdf', blob: blob.slice(0, blob.size, 'application/pdf') };
  }
  if (type.kind === 'image') return rasterPreview(blob, type.mime);
  if (type.kind === 'text') {
    const truncated = blob.size > TEXT_PREVIEW_BYTES;
    const bytes = await blob.slice(0, TEXT_PREVIEW_BYTES).arrayBuffer();
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes, { stream: truncated }); }
    catch { throw new Error('This text encoding cannot be previewed. Download the original to read it.'); }
    if (text.includes('\0')) throw new Error('This file contains binary data. Download the original to inspect it.');
    return { kind: 'text', text, truncated };
  }
  return { kind: 'unsupported' };
}
