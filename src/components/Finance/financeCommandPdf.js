import { currencyBalance, currencyPositions, financeControls, financeDate, financeKpis, financeMoney, financeProcesses } from './financeCommandPresentation';

export async function exportFinanceCommandPdf(data, currency) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const ink = [11, 29, 64]; const muted = [76, 99, 135]; const blue = [7, 93, 239];
  let y = 16;
  const plain = value => String(value ?? 'Not recorded').replaceAll('—', 'Not available').replaceAll('–', '-').replaceAll('·', '|');
  const header = () => {
    doc.setTextColor(...ink); doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text('REJLERS | RADAI', 12, 14);
    doc.setFontSize(10); doc.text('Finance Command Center', 285, 14, { align: 'right' });
    doc.setDrawColor(220, 229, 241); doc.line(12, 19, 285, 19); y = 27;
  };
  const ensure = height => { if (y + height > 191) { doc.addPage(); header(); } };
  const heading = title => { ensure(15); doc.setTextColor(...ink); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text(title, 12, y); y += 6; };
  const paragraph = text => { const lines = doc.splitTextToSize(plain(text), 270); ensure(lines.length * 4 + 4); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...muted); doc.text(lines, 12, y); y += lines.length * 4 + 4; };
  const table = (titles, rows, widths) => {
    const drawRow = (cells, head = false) => {
      doc.setFont('helvetica', head ? 'bold' : 'normal'); doc.setFontSize(8);
      const wrapped = cells.map((cell, index) => doc.splitTextToSize(plain(cell), widths[index] - 5));
      const height = Math.max(...wrapped.map(lines => lines.length), 1) * 4 + 4;
      ensure(height); let x = 12;
      if (head) { doc.setFillColor(240, 246, 253); doc.rect(x, y - 3, 273, height, 'F'); }
      doc.setTextColor(...(head ? ink : muted));
      wrapped.forEach((lines, index) => { doc.text(lines, x + 2, y + 1); x += widths[index]; });
      doc.setDrawColor(220, 229, 241); doc.line(12, y + height - 3, 285, y + height - 3); y += height;
    };
    drawRow(titles, true); rows.forEach(row => drawRow(row)); y += 6;
  };
  header();
  paragraph(`As at ${financeDate(data.as_of_date)} | Selected currency: ${currency} | Generated ${financeDate(data.generated_at, true)}. Current invoice positions; no currency conversion applied.`);
  heading('Financial outcomes');
  table(['Metric', 'Position', 'Basis'], financeKpis(data, currency).map(card => [card.label, card.text, card.reason]), [55, 48, 170]);
  heading('Financial actions required - across currencies');
  table(['Action', 'Queue size', 'Owner / due date'], (data.actions || []).map(action => [action.label, `${action.count} invoices`, 'Not recorded']), [173, 40, 60]);
  if (!data.actions?.length) paragraph('No recorded actionable queues, or the relevant source is unavailable. See source coverage below.');
  heading('Receivables ageing');
  const ageing = currencyBalance(data.sources?.receivables, currency);
  if (ageing.status === 'available') table(['Age', 'Outstanding', 'Invoice count'], (ageing.buckets || []).map(bucket => [bucket.label || bucket.id, financeMoney(bucket.amount, currency), bucket.count]), [105, 105, 63]);
  else paragraph('Ageing balances are unavailable or incomplete for this currency.');
  heading('Entity and currency position');
  table(['Currency', 'A/R outstanding', 'A/P outstanding', 'Net invoice exposure', 'Oldest past due'], currencyPositions(data).map(row => [row.currency, financeMoney(row.receivables, row.currency), financeMoney(row.payables, row.currency), financeMoney(row.net, row.currency), financeDate(row.oldest_due_date)]), [28, 65, 65, 65, 50]);
  heading('Process health');
  table(['Process', 'Recorded status', 'Basis'], financeProcesses(data).map(row => [row.label, row.count === null ? 'Not available' : `${row.count} ${row.suffix}`, row.definition]), [55, 48, 170]);
  heading('Forecast and controls');
  table(['Control', 'Value', 'Definition'], financeControls(data).map(row => [row.label, row.value, row.definition]), [55, 48, 170]);
  heading('Source coverage');
  Object.values(data.sources || {}).forEach(source => paragraph(`${source.source}: ${source.status}. Last record update: ${financeDate(source.source_updated_at, true)}. ${source.reason || ''}`));
  paragraph(data.trends?.reason || 'Historical cash and working capital data is not connected.');
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) { doc.setPage(page); doc.setFontSize(8); doc.setTextColor(...blue); doc.text('RADAI | Finance management report', 12, 202); doc.setTextColor(...muted); doc.text(`${page} / ${pageCount}`, 285, 202, { align: 'right' }); }
  doc.save(`RADAI-finance-${data.as_of_date || 'current'}-${currency}.pdf`);
}
