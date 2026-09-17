import apiClient from './api.service';
import { buildProcurementPdfFilename } from '../utils/procurementPdfFilename';

const mimeTypes = { pdf: 'application/pdf', word: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };

async function documentResponse(response, order, format) {
  const blob = response.data instanceof Blob ? response.data : new Blob([response.data]);
  if (format === 'pdf' && !(await blob.slice(0, 1024).text()).trimStart().startsWith('%PDF-')) {
    throw new Error('The server did not return a valid purchase order PDF.');
  }
  const fallback = buildProcurementPdfFilename(order?.po_number || 'Purchase-Order-Draft', 'po', order?.po_date);
  const disposition = response.headers?.['content-disposition'] || '';
  const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1]
    || (format === 'word' ? fallback.replace(/\.pdf$/i, '.docx') : fallback);
  return { blob: new Blob([blob], { type: mimeTypes[format] }), filename };
}

export async function purchaseOrderDocumentError(error) {
  let data = error?.response?.data;
  if (data instanceof Blob) {
    const raw = await data.text();
    try { data = JSON.parse(raw); } catch { data = raw.trimStart().startsWith('<') ? null : raw; }
  }
  const describe = value => {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.map(describe).filter(Boolean).join(' ');
    if (value && typeof value === 'object') return Object.entries(value).map(([field, issues]) => `${field.replaceAll('_', ' ')}: ${describe(issues)}`).join(' ');
    return '';
  };
  return describe(data?.detail || data?.error || data?.message || data) || error?.message || 'The purchase order document could not be prepared.';
}

export async function fetchPurchaseOrderDocument(order, format = 'pdf', options = {}) {
  const response = await apiClient.get(`/procurement/orders/${order.id}/export-${format}/`, {
    responseType: 'blob', timeout: 120000, suppressErrorToast: true, ...options,
  });
  return documentResponse(response, order, format);
}

export async function previewPurchaseOrderDocument(snapshot, files, orderId, format = 'pdf', options = {}) {
  const body = new FormData();
  body.append('snapshot', JSON.stringify(snapshot));
  body.append('format', format);
  if (orderId) body.append('order_id', orderId);
  const metadata = [];
  let newFileIndex = 0;
  for (const slot of files) {
    const item = { title: (slot.title || '').trim(), description: (slot.description || '').trim() };
    if (slot.file) {
      item.new_file_index = newFileIndex++;
      body.append('attachments', slot.file);
    } else if (slot.existingAttachment) {
      item.existing_attachment_index = slot.existingAttachmentIndex ?? (snapshot.attachments || []).indexOf(slot.existingAttachment);
      const original = slot.existingAttachment;
      const initialTitle = original.title || original.filename || `Item ${item.existing_attachment_index + 1}`;
      if (slot.title === initialTitle && slot.description === (original.description || '')) {
        delete item.title;
        delete item.description;
      } else {
        item.title = item.title.trim();
        item.description = item.description.trim();
      }
    }
    metadata.push(item);
  }
  body.append('attachment_metadata', JSON.stringify(metadata));
  const response = await apiClient.post('/procurement/orders/preview-document/', body, {
    responseType: 'blob', timeout: 120000, suppressErrorToast: true, ...options,
  });
  return documentResponse(response, snapshot, format);
}

export function downloadPurchaseOrderDocument({ blob, filename }) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
