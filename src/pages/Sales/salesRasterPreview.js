// Worker-safe leaf: do not import document loaders or the UI here.
export async function rasterPreview(blob, mime) {
  const header = new Uint8Array(await blob.slice(0, 32).arrayBuffer());
  const starts = bytes => bytes.every((value, index) => header[index] === value);
  const ascii = (start, end) => String.fromCharCode(...header.slice(start, end));
  const valid = {
    'image/png': starts([137, 80, 78, 71, 13, 10, 26, 10]),
    'image/jpeg': starts([255, 216, 255]),
    'image/gif': ['GIF87a', 'GIF89a'].includes(ascii(0, 6)),
    'image/webp': ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP',
    'image/bmp': ascii(0, 2) === 'BM',
    'image/avif': ascii(4, 8) === 'ftyp' && ['avif', 'avis'].includes(ascii(8, 12)),
  };
  if (!valid[mime]) throw new Error('This file does not contain a supported image. Download the original to inspect it.');
  return { kind: 'image', blob: blob.slice(0, blob.size, mime) };
}
