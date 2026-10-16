// Attachment names come from the authenticated response, including a file renamed
// after metadata was read. RFC 5987 names take precedence over the ASCII fallback.
export function responseFilename(disposition) {
  if (!disposition) return '';
  let filename = '';
  const extended = String(disposition).match(/(?:^|;)\s*filename\*\s*=\s*UTF-8'[^']*'([^;]+)/i);
  if (extended) {
    try { filename = decodeURIComponent(extended[1].trim()); } catch { throw new Error('The download filename could not be verified. Please refresh the document.'); }
  } else {
    const quoted = String(disposition).match(/(?:^|;)\s*filename\s*=\s*"((?:[^"\\]|\\.)*)"/i);
    const plain = String(disposition).match(/(?:^|;)\s*filename\s*=\s*([^;\s]+)/i);
    filename = quoted ? quoted[1].replace(/\\(.)/g, '$1') : plain?.[1] || '';
  }
  if (!filename || filename === '.' || filename === '..' || /[/\\]/.test(filename) || [...filename].some(character => character.codePointAt(0) < 32 || character.codePointAt(0) === 127)) {
    throw new Error('The download filename could not be verified. Please refresh the document.');
  }
  return filename;
}
