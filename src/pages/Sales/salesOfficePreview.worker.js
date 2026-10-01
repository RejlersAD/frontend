import { Buffer } from 'buffer';

// MSG's character decoders need the browser Buffer implementation. No filesystem,
// network, process or other Node runtime is exposed to document parsers.
globalThis.Buffer = Buffer;

self.onmessage = async ({ data }) => {
  try {
    if (!(data?.buffer instanceof ArrayBuffer) || !['xlsx', 'docx', 'msg'].includes(data.kind)) throw new Error('Unsupported document preview.');
    let content;
    if (data.kind === 'xlsx') {
      const { parseWorkbook } = await import('./salesOfficeWorkbook.js');
      content = parseWorkbook(data.buffer);
    } else {
      if (data.kind === 'docx') {
        const { validateOfficeZip } = await import('./salesOfficeWorkbook.js');
        validateOfficeZip(data.buffer, 'docx');
      }
      const { parseWord, parseMessage } = await import('./salesOfficeDocuments.js');
      content = data.kind === 'docx' ? await parseWord(data.buffer) : await parseMessage(data.buffer);
    }
    self.postMessage({ content });
  } catch (failure) {
    const message = typeof failure?.message === 'string' && /^This (?:Office file|Word document|Outlook message|file|document)/.test(failure.message)
      ? failure.message : 'This file could not be previewed. Download the original to inspect it.';
    self.postMessage({ error: message });
  }
};
