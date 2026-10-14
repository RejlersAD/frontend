export const OFFICE_PREVIEW_MAX_BYTES = 128 * 1024 * 1024;
export const OFFICE_PREVIEW_TIMEOUT_MS = 30000;

export async function parseOfficeFile(blob, kind, { signal } = {}) {
  if (signal?.aborted) throw new DOMException('Preview closed.', 'AbortError');
  if (blob.size > OFFICE_PREVIEW_MAX_BYTES) throw new Error('This file is too large for the browser preview. Download the original to open it.');
  const buffer = await blob.arrayBuffer();
  if (signal?.aborted) throw new DOMException('Preview closed.', 'AbortError');
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./salesOfficePreview.worker.js', import.meta.url), { type: 'module', name: 'Opportunity file preview' });
    let settled = false;
    const finish = (value, failure = false) => {
      if (settled) return;
      settled = true; clearTimeout(timer); signal?.removeEventListener('abort', abort); worker.terminate();
      if (failure) reject(value); else resolve(value);
    };
    const abort = () => finish(new DOMException('Preview closed.', 'AbortError'), true);
    const timer = setTimeout(() => finish(new Error('This document took too long to preview. Download the original to open it.'), true), OFFICE_PREVIEW_TIMEOUT_MS);
    signal?.addEventListener('abort', abort, { once: true });
    worker.onmessage = event => {
      if (event.data?.error) finish(new Error(event.data.error), true);
      else if (event.data?.content?.kind !== kind) finish(new Error('The document preview could not be verified.'), true);
      else finish(event.data.content);
    };
    worker.onerror = event => { event.preventDefault(); finish(new Error('The document could not be previewed. Retry or download the original.'), true); };
    worker.onmessageerror = () => finish(new Error('The document preview could not be read. Download the original.'), true);
    try { worker.postMessage({ kind, buffer }, [buffer]); }
    catch { finish(new Error('The document could not be loaded for preview. Download the original.'), true); }
  });
}
