import apiClient from './api.service';
import { buildProcurementPdfFilename } from '../utils/procurementPdfFilename';

// The existing document downloader saves a supplied blob without changing its contents.
export { downloadPurchaseOrderDocument as downloadPurchaseRequisitionDocument } from './purchaseOrderDocuments';

const WORD_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export async function fetchPurchaseRequisitionWord(requisition, options = {}) {
  const response = await apiClient.get(`/procurement/requisitions/${requisition.id}/export-word/`, {
    responseType: 'blob', timeout: 120000, suppressErrorToast: true, ...options,
  });
  const blob = response.data instanceof Blob ? response.data : new Blob([response.data]);
  const signature = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
  if (signature.length !== 4 || ![0x50, 0x4b, 0x03, 0x04].every((byte, index) => signature[index] === byte)) {
    throw new Error('The server did not return a valid Purchase Requisition Word document. Please try again.');
  }
  const fallback = buildProcurementPdfFilename(requisition.pr_number || `PR-${requisition.id}`, 'pr', requisition.issued_date || requisition.created_at).replace(/\.pdf$/i, '.docx');
  const disposition = response.headers?.['content-disposition'] || '';
  const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] || fallback;
  return { blob: new Blob([blob], { type: WORD_MIME }), filename };
}

export async function purchaseRequisitionDocumentError(error) {
  let data = error?.response?.data;
  if (data instanceof Blob) {
    try { data = JSON.parse(await data.text()); } catch { data = null; }
  }
  const message = data?.detail || data?.error || data?.message;
  if (typeof message === 'string') return message;
  if (error?.response?.status === 403) return 'You do not have permission to export this Purchase Requisition.';
  return error?.response ? 'The Purchase Requisition Word document could not be downloaded. Please try again.'
    : error?.message || 'The Purchase Requisition Word document could not be downloaded. Please try again.';
}
