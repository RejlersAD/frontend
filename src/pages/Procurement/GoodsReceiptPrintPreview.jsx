import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { PrinterIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { BRANDING_CONFIG } from '../../config/branding.config';

const textOrDash = (value) => value === null || value === undefined || value === '' ? '—' : String(value);

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const quantity = (value) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 4 });

const printFileName = (receipt) => {
  const poNumber = receipt?.po_number || 'No_PO_Number';
  return `Goods_Receipt_${poNumber}`.replace(/[\\/:*?"<>|]/g, '-');
};

const ReceiptDocument = ({ receipt }) => {
  const lines = Array.isArray(receipt.lines) ? receipt.lines : [];
  const totals = lines.reduce((result, line) => ({
    delivered: result.delivered + Number(line.delivered_quantity || 0),
    accepted: result.accepted + Number(line.accepted_quantity || 0),
    rejected: result.rejected + Number(line.rejected_quantity || 0),
  }), { delivered: 0, accepted: 0, rejected: 0 });

  return (
    <div className="gr-document-content bg-white text-gray-950">
      <header className="border-b-2 border-gray-900 pb-3">
        <div className="flex items-start justify-between gap-6">
          <div>
            <img src={BRANDING_CONFIG.logo.print.path} alt={BRANDING_CONFIG.logo.print.alt} className="h-14 w-14 object-contain" />
            <p className="mt-2 text-[8px] leading-3 text-gray-600">
              {BRANDING_CONFIG.contact.address.full}<br />
              Tel: {BRANDING_CONFIG.contact.phone.display}
            </p>
          </div>
          <div className="text-right">
            <h1 className="text-[21px] font-bold tracking-[0.12em]">GOODS RECEIPT NOTE</h1>
            <p className="mt-1 text-[9px] font-semibold text-gray-600">Receiving & Inspection Record</p>
            <p className="mt-1 text-[7px] uppercase tracking-wide text-gray-500">Controlled Document</p>
          </div>
        </div>
      </header>

      <table className="mt-3 w-full border-collapse text-[8.5px]">
        <tbody>
          <tr><th className="w-[17%] border border-gray-400 bg-gray-100 px-2 py-1.5 text-left">GR Number</th><td className="w-[33%] border border-gray-400 px-2 py-1.5 font-bold">{textOrDash(receipt.receipt_number)}</td><th className="w-[17%] border border-gray-400 bg-gray-100 px-2 py-1.5 text-left">Receipt Date</th><td className="w-[33%] border border-gray-400 px-2 py-1.5">{formatDate(receipt.receipt_date)}</td></tr>
          <tr><th className="border border-gray-400 bg-gray-100 px-2 py-1.5 text-left">PO Number</th><td className="border border-gray-400 px-2 py-1.5">{textOrDash(receipt.po_number)}</td><th className="border border-gray-400 bg-gray-100 px-2 py-1.5 text-left">Status</th><td className="border border-gray-400 px-2 py-1.5 uppercase">{textOrDash(receipt.status_display || receipt.status)}</td></tr>
          <tr><th className="border border-gray-400 bg-gray-100 px-2 py-1.5 text-left">Project</th><td className="border border-gray-400 px-2 py-1.5">{textOrDash(receipt.project_number)}</td><th className="border border-gray-400 bg-gray-100 px-2 py-1.5 text-left">Delivery Note</th><td className="border border-gray-400 px-2 py-1.5">{textOrDash(receipt.delivery_note_number)}</td></tr>
        </tbody>
      </table>

      <div className="gr-print-block mt-3 grid grid-cols-2 gap-3 text-[8.5px]">
        <section className="border border-gray-400"><h2 className="bg-gray-900 px-2 py-1.5 font-bold uppercase tracking-wide text-white">Supplier / Vendor</h2><div className="min-h-[56px] px-3 py-2"><p className="font-bold">{textOrDash(receipt.vendor_name)}</p><p className="mt-1 text-gray-700">{textOrDash(receipt.po_title)}</p></div></section>
        <section className="border border-gray-400"><h2 className="bg-gray-900 px-2 py-1.5 font-bold uppercase tracking-wide text-white">Receiving Information</h2><div className="min-h-[56px] px-3 py-2 leading-4"><p><span className="font-semibold">Received by:</span> {textOrDash(receipt.received_by_name)}</p><p><span className="font-semibold">Inspector:</span> {textOrDash(receipt.inspector_name)}</p><p><span className="font-semibold">Inspection agency:</span> {textOrDash(receipt.inspection_agency)}</p></div></section>
      </div>

      <table className="mt-3 w-full border-collapse text-[8px]">
        <thead><tr className="bg-gray-900 text-white"><th className="w-[6%] border border-gray-500 px-1 py-2">Line</th><th className="w-[34%] border border-gray-500 px-2 py-2 text-left">Description</th><th className="w-[9%] border border-gray-500 px-1 py-2">UOM</th><th className="w-[11%] border border-gray-500 px-1 py-2 text-right">Delivered</th><th className="w-[11%] border border-gray-500 px-1 py-2 text-right">Accepted</th><th className="w-[11%] border border-gray-500 px-1 py-2 text-right">Rejected</th><th className="w-[18%] border border-gray-500 px-2 py-2 text-left">Traceability / Remarks</th></tr></thead>
        <tbody>
          {lines.map((line) => <tr key={line.id}><td className="border border-gray-400 px-1 py-2 text-center align-top">{line.line_number}</td><td className="border border-gray-400 px-2 py-2 align-top">{textOrDash(line.description)}</td><td className="border border-gray-400 px-1 py-2 text-center align-top">{textOrDash(line.unit_of_measure)}</td><td className="border border-gray-400 px-1 py-2 text-right align-top">{quantity(line.delivered_quantity)}</td><td className="border border-gray-400 px-1 py-2 text-right align-top">{quantity(line.accepted_quantity)}</td><td className="border border-gray-400 px-1 py-2 text-right align-top">{quantity(line.rejected_quantity)}</td><td className="border border-gray-400 px-2 py-2 align-top">{[line.batch_number && `Batch: ${line.batch_number}`, line.heat_number && `Heat: ${line.heat_number}`, line.rejection_reason].filter(Boolean).join(' · ') || '—'}</td></tr>)}
          <tr className="font-bold"><td colSpan={3} className="border border-gray-500 bg-gray-100 px-2 py-2 text-right">Totals</td><td className="border border-gray-500 px-1 py-2 text-right">{quantity(totals.delivered)}</td><td className="border border-gray-500 px-1 py-2 text-right">{quantity(totals.accepted)}</td><td className="border border-gray-500 px-1 py-2 text-right">{quantity(totals.rejected)}</td><td className="border border-gray-500 px-2 py-2" /></tr>
        </tbody>
      </table>

      <section className="gr-print-block mt-3 border border-gray-400 text-[8.5px]"><h2 className="bg-gray-100 px-2 py-1.5 font-bold uppercase tracking-wide">Inspection & Documentation</h2><div className="grid grid-cols-3 border-t border-gray-400"><div className="border-r border-gray-400 px-2 py-2"><span className="font-semibold">Visual inspection:</span> {receipt.visual_inspection_passed === true ? 'Passed' : receipt.visual_inspection_passed === false ? 'Failed' : 'Pending'}</div><div className="border-r border-gray-400 px-2 py-2"><span className="font-semibold">Dimensional check:</span> {receipt.dimensional_check_passed === true ? 'Passed' : receipt.dimensional_check_passed === false ? 'Failed' : 'Pending'}</div><div className="px-2 py-2"><span className="font-semibold">Material verification:</span> {receipt.material_verification_passed === true ? 'Passed' : receipt.material_verification_passed === false ? 'Failed' : 'Pending'}</div></div><div className="border-t border-gray-400 px-2 py-2"><span className="font-semibold">Inspection report:</span> {textOrDash(receipt.inspection_report_number)} <span className="ml-5 font-semibold">Notes:</span> {textOrDash(receipt.inspection_notes || receipt.notes)}</div></section>

      <section className="gr-print-block mt-5 grid grid-cols-3 gap-7 text-[8.5px]"><div className="min-h-[62px] border-t border-gray-500 pt-2"><p className="font-bold">Received By</p><p>{textOrDash(receipt.received_by_name)}</p><p>Date: {formatDate(receipt.receipt_date)}</p></div><div className="min-h-[62px] border-t border-gray-500 pt-2"><p className="font-bold">Inspected By</p><p>{textOrDash(receipt.inspector_name || receipt.inspected_by_name)}</p><p>Date: {formatDate(receipt.inspected_at)}</p></div><div className="min-h-[62px] border-t border-gray-500 pt-2"><p className="font-bold">Warehouse / Project Acceptance</p><p>Name / Signature:</p><p>Date:</p></div></section>

      <footer className="gr-print-footer mt-4 flex items-center justify-between border-t border-gray-400 pt-1 text-[7px] text-gray-500"><span>RADAI Procurement · Goods Receipt Record</span><span>GR: {textOrDash(receipt.receipt_number)} · Page 1 of 1</span></footer>
    </div>
  );
};

const GoodsReceiptPrintPreview = ({ receipt, onClose }) => {
  useEffect(() => {
    if (!receipt) return undefined;
    const previousTitle = document.title;
    document.title = printFileName(receipt);
    return () => { document.title = previousTitle; };
  }, [receipt]);

  if (!receipt) return null;
  const suggestedFileName = `${printFileName(receipt)}.pdf`;
  return (
    <>
      <div className="fixed inset-0 z-[90] overflow-y-auto bg-black/70 p-4 print:hidden">
        <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between rounded-lg bg-gray-900 px-4 py-3 text-white shadow-xl">
          <div><p className="font-semibold">RADAI Goods Receipt Print Preview</p><p className="text-xs text-gray-300">A4 portrait · Save as: {suggestedFileName}</p></div>
          <div className="flex gap-2"><button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium hover:bg-indigo-700"><PrinterIcon className="h-4 w-4" />Print / Save PDF</button><button type="button" onClick={onClose} className="inline-flex items-center gap-1.5 rounded-md border border-gray-600 px-3 py-2 text-sm hover:bg-gray-800"><XMarkIcon className="h-4 w-4" />Close</button></div>
        </div>
        <div className="mx-auto min-h-[297mm] w-[210mm] bg-white p-[11mm] shadow-2xl"><ReceiptDocument receipt={receipt} /></div>
      </div>
      {createPortal(<><style>{`.gr-print-document{display:none}@page{size:A4 portrait;margin:11mm 10mm 12mm}@media print{html,body{background:#fff!important;height:auto!important;overflow:visible!important}body>*{display:none!important}body>.gr-print-document{display:block!important;position:static!important;width:100%!important;margin:0!important;padding:0!important}.gr-print-document,.gr-print-document *{visibility:visible!important;box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}.gr-print-document table{width:100%;border-collapse:collapse}.gr-print-document thead{display:table-header-group}.gr-print-document tr,.gr-print-block,.gr-print-footer{break-inside:avoid;page-break-inside:avoid}}`}</style><section className="gr-print-document" aria-label="Printable goods receipt"><ReceiptDocument receipt={receipt} /></section></>, document.body)}
    </>
  );
};

export default GoodsReceiptPrintPreview;
