const MODULE_LABELS = {
  po: 'Purchase_Order',
  purchase_order: 'Purchase_Order',
  pr: 'Purchase_Requisition',
  purchase_requisition: 'Purchase_Requisition',
};

const formatDatePart = (value) => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  const parsed = value ? new Date(value) : new Date();
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const buildProcurementPdfFilename = (documentNumber, moduleName, documentDate) => {
  const moduleLabel = MODULE_LABELS[String(moduleName || '').trim().toLowerCase()];
  if (!moduleLabel) throw new Error(`Unsupported procurement PDF module: ${moduleName}`);

  const safeNumber = String(documentNumber || moduleName || 'document')
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^[._-]+|[._-]+$/g, '') || String(moduleName).toUpperCase();

  return `${safeNumber}_${moduleLabel}_${formatDatePart(documentDate)}.pdf`;
};
