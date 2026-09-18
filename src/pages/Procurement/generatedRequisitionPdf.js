const PAPER_WIDTH = 740;
const MARGIN = 6;

/** Fit the complete generated form inside one A4 page, preserving its aspect ratio. */
export function fitGeneratedRequisitionImage(canvas, pageWidth, pageHeight) {
  if (!(canvas.width > 0 && canvas.height > 0)) throw new Error('The requisition preview is empty.');
  const scale = Math.min((pageWidth - MARGIN * 2) / canvas.width, (pageHeight - MARGIN * 2) / canvas.height);
  const width = canvas.width * scale;
  return { x: (pageWidth - width) / 2, y: MARGIN, width, height: canvas.height * scale };
}

/** Only generated forms use this renderer. Uploaded originals bypass it entirely. */
export async function buildGeneratedRequisitionPdf(source, properties = {}) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'), import('jspdf'),
  ]);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  Object.assign(host.style, { position: 'fixed', left: '-10000px', top: '0', width: `${PAPER_WIDTH}px`, background: '#fff', pointerEvents: 'none' });
  const copy = source.cloneNode(true);
  Object.assign(copy.style, { transform: 'none', width: `${PAPER_WIDTH}px`, height: 'auto', minHeight: '0', padding: '0', overflow: 'visible', boxSizing: 'border-box' });
  host.appendChild(copy);
  document.body.appendChild(host);
  try {
    await document.fonts?.ready;
    await Promise.all(Array.from(copy.querySelectorAll('img')).map(async image => {
      if (image.decode) {
        try { await image.decode(); } catch { /* Preserve the document text when an image is unavailable. */ }
      }
    }));
    // Remove blank writing space and generous screen padding before reducing
    // the form's scale. Paragraphs and approval rows always retain their text.
    const fullPageHeight = PAPER_WIDTH * (pageHeight - MARGIN * 2) / (pageWidth - MARGIN * 2);
    if (copy.scrollHeight > fullPageHeight) {
      copy.querySelectorAll('article > section').forEach(section => { section.style.minHeight = '0'; });
      copy.querySelectorAll('article .py-2, article .py-3').forEach(cell => {
        cell.style.paddingTop = '4px';
        cell.style.paddingBottom = '8px';
      });
      copy.querySelectorAll('article .min-h-\\[38px\\]').forEach(row => { row.style.minHeight = '0'; });
      copy.querySelectorAll('article .mt-5, article .mt-4').forEach(paragraph => { paragraph.style.marginTop = '6px'; });
    }
    copy.querySelectorAll('article .grid > *, article .whitespace-pre-wrap').forEach(cell => {
      cell.style.minWidth = '0';
      cell.style.overflowWrap = 'anywhere';
    });
    const canvas = await html2canvas(copy, {
      backgroundColor: '#ffffff', scale: 2, useCORS: true, logging: false,
      windowWidth: 1200, scrollX: 0, scrollY: 0,
      width: copy.scrollWidth, height: copy.scrollHeight,
    });
    const bounds = fitGeneratedRequisitionImage(canvas, pageWidth, pageHeight);
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', bounds.x, bounds.y, bounds.width, bounds.height, undefined, 'FAST');
    pdf.setProperties(properties);
    return pdf;
  } finally {
    host.remove();
  }
}
