export async function workbookDownloadError(error) {
  let data = error?.response?.data;
  if (data && typeof data.text === 'function') {
    try { data = JSON.parse(await data.text()); } catch { data = null; }
  }
  const detail = data?.error || data?.detail;
  return typeof detail === 'string' ? detail : error?.message || 'The workbook download could not be completed.';
}

export async function validateWorkbookBlob(blob) {
  if (!blob || !blob.size || typeof blob.arrayBuffer !== 'function') {
    throw new Error('The server returned an empty workbook. Please retry.');
  }
  const bytes = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    const message = await workbookDownloadError({ response: { data: blob } });
    throw new Error(message === 'The workbook download could not be completed.'
      ? 'The server did not return a valid XLSX workbook.' : message);
  }
  return blob;
}
