import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { XCircleIcon, PrinterIcon } from '@heroicons/react/24/outline';
import apiClient from '../../services/api.service';
import goodsReceiptsService from '../../services/goodsReceipts.service';
import { BRANDING_CONFIG } from '../../config/branding.config';
import GoodsReceiptWorkspace from '../../components/Procurement/GoodsReceiptWorkspace';
import GoodsReceiptDeleteDialog from '../../components/Procurement/GoodsReceiptDeleteDialog';
import { receiptConfirmationBlock, receiptDeletionBlock } from '../../components/Procurement/GoodsReceiptActions';
import AIReceiptCreator from './AIReceiptCreator';
import { handoffError } from '../../components/Procurement/PurchaseOrderHandoff';
import { receiptDisplayItems, receiptReviewAttachment, receiptReviewDate as receiptDate, receiptReviewStatus } from '../../components/Procurement/goodsReceiptReviewPresentation';

class ReceiptCreatorErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Goods Receipt creator failed to render:', error, info);
  }

  componentDidUpdate(previousProps) {
    if (!previousProps.isOpen && this.props.isOpen && this.state.error) {
      this.setState({ error: null });
    }
  }

  handleClose = () => {
    this.setState({ error: null });
    this.props.onClose();
  };

  render() {
    if (!this.props.isOpen) return this.props.children;
    if (!this.state.error) return this.props.children;
    return createPortal(
      <div className="fixed inset-0 z-[110] flex items-center justify-center bg-gray-900/70 p-4">
        <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
          <h2 className="text-lg font-semibold text-red-700">Unable to open Goods Receipt form</h2>
          <p className="mt-2 text-sm text-gray-600">The form encountered invalid receipt or purchase-order data. Close it and refresh the receipt list.</p>
          <pre className="mt-4 max-h-32 overflow-auto rounded bg-gray-100 p-3 text-xs text-gray-700">{this.state.error.message}</pre>
          <button type="button" onClick={this.handleClose} className="mt-4 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Close</button>
        </div>
      </div>,
      document.body
    );
  }
}

ReceiptCreatorErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

const receiptText = (value) => (
  value === null || value === undefined || value === '' ? '—' : String(value)
);

const listText = (value) => {
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  return receiptText(value);
};

const inspectionResult = value => value === false ? 'RECORDED FAIL' : 'NOT VERIFIED';

const receiptItems = receiptDisplayItems;

const ReceiptPrintContent = ({ receipt, printDate }) => {
  const items = receiptItems(receipt);
  const status = receiptReviewStatus(receipt).label.toUpperCase();

  return (
    <div className="gr-paper bg-white text-gray-950">
      <header className="flex items-start justify-between gap-6 border-b-2 border-gray-900 pb-3">
        <div>
          <img src="/assets/procurement/rejlers-pr-po-logo.png" alt={BRANDING_CONFIG.logo.primary.alt} className="h-10 w-auto object-contain" />
          <p className="mt-2 max-w-[360px] text-[8px] leading-3 text-gray-600">
            {BRANDING_CONFIG.brand.companyFull}<br />
            {BRANDING_CONFIG.contact.address.full}<br />
            Tel: {BRANDING_CONFIG.contact.phone.display}
          </p>
        </div>
        <div className="text-right">
          <h1 className="text-[21px] font-bold tracking-[0.12em]">{items.some(item => item.basis === 'service_value') ? 'SERVICE ACCEPTANCE' : 'GOODS RECEIPT NOTE'}</h1>
          <p className="mt-1 text-[9px] font-semibold text-gray-600">Receiving & Quality Inspection Record</p>
          <p className="mt-2 text-[11px] font-bold">{receiptText(receipt?.receipt_number)}</p>
        </div>
      </header>

      <table className="mt-3 w-full border-collapse text-[8.5px]">
        <tbody>
          <tr>
            <th className="w-[17%] border border-gray-400 bg-gray-100 px-2 py-1.5 text-left">GRN Number</th>
            <td className="w-[33%] border border-gray-400 px-2 py-1.5 font-bold">{receiptText(receipt?.receipt_number)}</td>
            <th className="w-[17%] border border-gray-400 bg-gray-100 px-2 py-1.5 text-left">Receipt Date</th>
            <td className="w-[33%] border border-gray-400 px-2 py-1.5">{receiptDate(receipt?.receipt_date)}</td>
          </tr>
          <tr>
            <th className="border border-gray-400 bg-gray-100 px-2 py-1.5 text-left">PO Number</th>
            <td className="border border-gray-400 px-2 py-1.5">{receiptText(receipt?.po_number)}</td>
            <th className="border border-gray-400 bg-gray-100 px-2 py-1.5 text-left">Delivery Note</th>
            <td className="border border-gray-400 px-2 py-1.5">{receiptText(receipt?.delivery_note_number)}</td>
          </tr>
          <tr>
            <th className="border border-gray-400 bg-gray-100 px-2 py-1.5 text-left">Received By</th>
            <td className="border border-gray-400 px-2 py-1.5">{receiptText(receipt?.received_by_name)}</td>
            <th className="border border-gray-400 bg-gray-100 px-2 py-1.5 text-left">Receipt Status</th>
            <td className="border border-gray-400 px-2 py-1.5 font-bold">{status}</td>
          </tr>
          <tr>
            <th className="border border-gray-400 bg-gray-100 px-2 py-1.5 text-left">Confirmation By</th>
            <td className="border border-gray-400 px-2 py-1.5">{receiptText(receipt?.confirmation?.responsible_user_name)}</td>
            <th className="border border-gray-400 bg-gray-100 px-2 py-1.5 text-left">Confirmed At</th>
            <td className="border border-gray-400 px-2 py-1.5">{receiptDate(receipt?.confirmation?.confirmed_at, true)}</td>
          </tr>
          <tr>
            <th className="border border-gray-400 bg-gray-100 px-2 py-1.5 text-left">Technical Inspector</th>
            <td className="border border-gray-400 px-2 py-1.5">{receiptText(receipt?.inspector_name)}</td>
            <th className="border border-gray-400 bg-gray-100 px-2 py-1.5 text-left">Inspection Agency</th>
            <td className="border border-gray-400 px-2 py-1.5">{receiptText(receipt?.inspection_agency)}</td>
          </tr>
          <tr>
            <th className="border border-gray-400 bg-gray-100 px-2 py-1.5 text-left">Module</th>
            <td className="border border-gray-400 px-2 py-1.5">Procurement · Goods Receipt</td>
            <th className="border border-gray-400 bg-gray-100 px-2 py-1.5 text-left">Print Date</th>
            <td className="border border-gray-400 px-2 py-1.5">{receiptDate(printDate)}</td>
          </tr>
        </tbody>
      </table>

      <section className="gr-print-block mt-3">
        <h2 className="bg-gray-900 px-2 py-1.5 text-[9px] font-bold uppercase tracking-wide text-white">{items.some(item => item.basis === 'service_value') ? 'Service acceptance value' : 'Items Received'}</h2>
        <table className="w-full border-collapse text-[8px]">
          <thead>
            <tr className="bg-gray-100">
              <th className="w-[6%] border border-gray-400 px-1 py-1.5 text-center">No.</th>
              <th className="w-[43%] border border-gray-400 px-2 py-1.5 text-left">Description</th>
              <th className="w-[10%] border border-gray-400 px-1 py-1.5 text-center">UOM</th>
              <th className="w-[11%] border border-gray-400 px-1 py-1.5 text-right">Ordered</th>
              <th className="w-[11%] border border-gray-400 px-1 py-1.5 text-right">Received</th>
              <th className="w-[11%] border border-gray-400 px-1 py-1.5 text-right">Accepted</th>
              <th className="w-[8%] border border-gray-400 px-1 py-1.5 text-right">Rejected</th>
            </tr>
          </thead>
          <tbody>
            {items.length ? items.map((item, index) => (
              <tr key={`${receiptText(item.po_line_id)}-${index}`}>
                <td className="border border-gray-400 px-1 py-2 text-center align-top">{receiptText(item.line_number || index + 1)}</td>
                <td className="border border-gray-400 px-2 py-2 align-top">{receiptText(item.item || item.description)}</td>
                <td className="border border-gray-400 px-1 py-2 text-center align-top">{receiptText(item.uom || item.unit)}</td>
                <td className="border border-gray-400 px-1 py-2 text-right align-top">{receiptText(item.ordered_qty)}</td>
                <td className="border border-gray-400 px-1 py-2 text-right align-top">{receiptText(item.received_qty ?? item.quantity)}</td>
                <td className="border border-gray-400 px-1 py-2 text-right align-top">{receiptText(item.accepted_qty)}</td>
                <td className="border border-gray-400 px-1 py-2 text-right align-top">{receiptText(item.rejected_qty)}</td>
              </tr>
            )) : (
              <tr><td colSpan="7" className="border border-gray-400 px-2 py-5 text-center text-gray-500">No item breakdown recorded.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="gr-print-block mt-3">
        <h2 className="bg-gray-900 px-2 py-1.5 text-[9px] font-bold uppercase tracking-wide text-white">Quality Inspection Results</h2>
        <table className="w-full border-collapse text-[8.5px]">
          <thead><tr className="bg-gray-100"><th className="border border-gray-400 px-2 py-1.5 text-left">Inspection</th><th className="border border-gray-400 px-2 py-1.5 text-center">Result</th><th className="border border-gray-400 px-2 py-1.5 text-left">Reference / Remarks</th></tr></thead>
          <tbody>
            <tr><td className="border border-gray-400 px-2 py-1.5">Visual inspection</td><td className="border border-gray-400 px-2 py-1.5 text-center font-bold">{inspectionResult(receipt?.visual_inspection_passed, receipt)}</td><td className="border border-gray-400 px-2 py-1.5">{receiptText(receipt?.inspection_report_number)}</td></tr>
            <tr><td className="border border-gray-400 px-2 py-1.5">Dimensional inspection</td><td className="border border-gray-400 px-2 py-1.5 text-center font-bold">{inspectionResult(receipt?.dimensional_check_passed, receipt)}</td><td className="border border-gray-400 px-2 py-1.5">—</td></tr>
            <tr><td className="border border-gray-400 px-2 py-1.5">Material verification / PMI</td><td className="border border-gray-400 px-2 py-1.5 text-center font-bold">{inspectionResult(receipt?.material_verification_passed, receipt)}</td><td className="border border-gray-400 px-2 py-1.5">Heat No(s): {listText(receipt?.heat_numbers)}</td></tr>
            <tr><td className="border border-gray-400 px-2 py-1.5">Non-destructive testing (NDT)</td><td className="border border-gray-400 px-2 py-1.5 text-center font-bold">{receipt?.ndt_performed ? 'PERFORMED' : 'NOT PERFORMED'}</td><td className="border border-gray-400 px-2 py-1.5">{receiptText(receipt?.ndt_results)}</td></tr>
            <tr><td className="border border-gray-400 px-2 py-1.5">Overall quality disposition</td><td className="border border-gray-400 px-2 py-1.5 text-center font-bold">{inspectionResult(receipt?.quality_check_passed, receipt)}</td><td className="border border-gray-400 px-2 py-1.5">{receiptText(receipt?.inspection_notes)}</td></tr>
          </tbody>
        </table>
      </section>

      <section className="gr-print-block mt-3 grid grid-cols-2 gap-3 text-[8.5px]">
        <div className="border border-gray-400">
          <h2 className="bg-gray-100 px-2 py-1.5 font-bold uppercase">Documents & Traceability</h2>
          <div className="space-y-1 border-t border-gray-400 px-3 py-2">
            <p><span className="font-semibold">Certificates:</span> {listText(receipt?.certificates_received)}</p>
            <p><span className="font-semibold">Heat numbers:</span> {listText(receipt?.heat_numbers)}</p>
            <p><span className="font-semibold">Attachments:</span> {Array.isArray(receipt?.attachments) ? receipt.attachments.length : 0}</p>
          </div>
        </div>
        <div className="border border-gray-400">
          <h2 className="bg-gray-100 px-2 py-1.5 font-bold uppercase">Remarks</h2>
          <p className="min-h-[56px] whitespace-pre-wrap border-t border-gray-400 px-3 py-2">{receiptText(receipt?.notes || receipt?.inspection_notes)}</p>
        </div>
      </section>

      <section className="gr-print-block mt-7 grid grid-cols-3 gap-6 text-[8.5px]">
        <div className="border-t border-gray-600 pt-2"><p className="font-bold">Received By</p><p>{receiptText(receipt?.received_by_name)}</p><p className="mt-3">Date: {receiptDate(receipt?.receipt_date)}</p></div>
        <div className="border-t border-gray-600 pt-2"><p className="font-bold">Delivery Confirmed By</p><p>{receiptText(receipt?.confirmation?.confirmed_by_name)}</p><p className="mt-3">Date: {receiptDate(receipt?.confirmation?.confirmed_at, true)}</p></div>
        <div className="border-t border-gray-600 pt-2"><p className="font-bold">Technical Inspector</p><p>{receiptText(receipt?.inspector_name)}</p><p>{receiptText(receipt?.inspection_agency)}</p></div>
      </section>

      <footer className="gr-print-footer mt-6 flex justify-between border-t border-gray-400 pt-1 text-[7px] text-gray-500">
        <span>Controlled document · Procurement / Goods Receipt · Printed {receiptDate(printDate)}</span>
        <span>GRN: {receiptText(receipt?.receipt_number)} · Page <span className="gr-page-number" /></span>
      </footer>
    </div>
  );
};

ReceiptPrintContent.propTypes = {
  receipt: PropTypes.object.isRequired,
  printDate: PropTypes.string.isRequired,
};

const ReceiptManagement = () => {
  const [reloadKey, setReloadKey] = useState(0);
  const [showAICreator, setShowAICreator] = useState(false);
  const [initialOrder, setInitialOrder] = useState(null);
  const [reconciliation, setReconciliation] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [confirmationNotes, setConfirmationNotes] = useState('');
  const [decisionFields, setDecisionFields] = useState({});
  const [decisionStale, setDecisionStale] = useState(false);
  const actionBusy = useRef(false);
  const [creatorError, setCreatorError] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [deletingReceipt, setDeletingReceipt] = useState(null);
  const [receiptMessage, setReceiptMessage] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [actionError, setActionError] = useState('');
  const [acceptingId, setAcceptingId] = useState(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [printDate, setPrintDate] = useState(() => new Date().toISOString());
  const detailSequence = useRef(0);
  const detailRef = useRef(null);
  const printRef = useRef(null);
  const trapDialog = event => {
    if (event.key === 'Escape') { event.preventDefault(); if (acceptingId) return; if (showPrintPreview) setShowPrintPreview(false); else setSelectedReceipt(null); }
    if (event.key !== 'Tab') return;
    const elements = [...event.currentTarget.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')].filter(element => element.getClientRects().length);
    if (event.shiftKey && document.activeElement === elements[0]) { event.preventDefault(); elements.at(-1)?.focus(); }
    else if (!event.shiftKey && document.activeElement === elements.at(-1)) { event.preventDefault(); elements[0]?.focus(); }
  };
  const selectedReceiptId = selectedReceipt?.id;
  const hasTechnicalChanges = Object.keys(decisionFields).length > 0 || Boolean(rejectReason.trim());
  useEffect(() => {
    const modal = deletingReceipt ? null : showPrintPreview ? printRef.current : selectedReceiptId ? detailRef.current : null;
    if (!modal) return undefined;
    const previous = document.activeElement;
    modal.querySelector('button:not(:disabled)')?.focus();
    return () => previous?.focus();
  }, [showPrintPreview, selectedReceiptId, deletingReceipt]);
  useEffect(() => () => { detailSequence.current += 1; }, []);
  const openReceiptDetails = async (receipt, preserveInput = false) => {
    const sequence = ++detailSequence.current;
    setShowPrintPreview(false); setSelectedReceipt(receipt); setDetailLoading(true); setDetailError(''); setActionError('');
    if (!preserveInput) { setRejectReason(''); setDecisionFields({}); setConfirmationNotes(''); }
    setDecisionStale(false);
    try {
      const data = await goodsReceiptsService.retrieve(receipt.id);
      if (sequence !== detailSequence.current) return;
      if (String(data?.id) !== String(receipt.id)) throw new Error('The requested receipt could not be verified.');
      setSelectedReceipt(current => current?.id === receipt.id ? data : current);
    } catch (error) { if (sequence === detailSequence.current) setDetailError(error.response?.status === 403 ? 'You do not have access to this receipt.' : 'Receipt details could not be loaded.'); }
    finally { if (sequence === detailSequence.current) setDetailLoading(false); }
  };
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('receipt');
    if (id) openReceiptDetails({ id });
  }, []);
  const recordReceipt = (capabilities, order = null, reconcile = false) => {
    setCreatorError('');
    if (capabilities?.create !== true && !(order && (reconcile ? order.receiving?.can_reconcile : order.receiving?.can_record))) { setCreatorError('You do not have access to record this receipt.'); return; }
    if (!order && capabilities?.read_purchase_orders !== true) { setCreatorError('Purchase order access is required to select an order.'); return; }
    setInitialOrder(order); setReconciliation(reconcile); setShowAICreator(true);
  };
  const handleReceiptCreated = () => { setReloadKey(value => value + 1); };
  const openDelete = receipt => { if (!actionBusy.current) setDeletingReceipt(receipt); };
  const removedReceipt = (receipt, deleted = true) => {
    detailSequence.current += 1;
    setDeletingReceipt(null);
    setSelectedReceipt(current => current?.id === receipt.id ? null : current);
    setShowPrintPreview(false);
    setReloadKey(value => value + 1);
    setReceiptMessage(deleted ? `Receipt ${receipt.receipt_number || ''} deleted.` : 'Receipt no longer available. The register has been refreshed.');
  };
  const confirmDelivery = async receipt => {
    if (receipt.confirmation?.can_confirm !== true || actionBusy.current || decisionStale || hasTechnicalChanges || detailLoading || detailError || receipt.status !== 'pending') return;
    actionBusy.current = true;
    setAcceptingId(receipt.id); setActionError('');
    try {
      const data = await goodsReceiptsService.confirmDelivery(receipt.id, { expected_updated_at: receipt.updated_at, ...(confirmationNotes.trim() ? { notes: confirmationNotes.trim() } : {}) });
      if (String(data?.id) !== String(receipt.id) || !data.confirmation?.confirmed_at) throw new Error('Delivery confirmation could not be verified. Refresh the receipt details.');
      setSelectedReceipt(current => current?.id === receipt.id ? data : current);
      setReloadKey(value => value + 1);
      window.requestAnimationFrame(() => {
        if (detailRef.current?.dataset.receiptId === String(receipt.id)) detailRef.current.querySelector('button[aria-label="Close"]')?.focus();
      });
    } catch (error) {
      setActionError(error.response?.status === 403 ? (typeof error.response.data?.detail === 'string' ? error.response.data.detail : 'You do not have access to confirm this delivery.') : handoffError(error));
      if (error.response?.status === 409) setDecisionStale(true);
    } finally { actionBusy.current = false; setAcceptingId(null); }
  };
  const acceptReceipt = async (receipt, reject = false) => {
    if ((reject ? receipt.capabilities?.reject !== true : receipt.capabilities?.accept !== true) || actionBusy.current || decisionStale || receipt.status !== 'pending') return;
    if (reject && !rejectReason.trim()) { setActionError('Enter a rejection reason.'); return; }
    actionBusy.current = true;
    setAcceptingId(receipt.id); setActionError('');
    try {
      const response = await apiClient.post(`/procurement/receipts/${receipt.id}/${reject ? 'reject_delivery' : 'accept'}/`, { expected_updated_at: receipt.updated_at, ...Object.fromEntries(Object.entries(decisionFields).map(([key, value]) => [key, value === '' ? null : value === 'true'])), ...(reject ? { reason: rejectReason.trim() } : {}) });
      if (String(response.data?.id) !== String(receipt.id)) throw new Error('The receipt response could not be verified.');
      setSelectedReceipt(current => current?.id === receipt.id ? response.data : current);
      setReloadKey(value => value + 1);
      window.requestAnimationFrame(() => {
        if (detailRef.current?.dataset.receiptId === String(receipt.id)) detailRef.current.querySelector('button[aria-label="Close"]')?.focus();
      });
    } catch (error) { setActionError(handoffError(error)); if (error.response?.status === 409) setDecisionStale(true); }
    finally { actionBusy.current = false; setAcceptingId(null); }
  };
  const openPrintPreview = () => { if (selectedReceipt?.capabilities?.export !== true) return; setPrintDate(new Date().toISOString()); setShowPrintPreview(true); };
  const reviewPrint = receipt => { if (receipt.capabilities?.export !== true) return; setSelectedReceipt(receipt); setDetailLoading(false); setDetailError(''); setPrintDate(new Date().toISOString()); setShowPrintPreview(true); };
  const printReceipt = () => {
    const originalTitle = document.title;
    document.title = `${String(selectedReceipt?.po_number || 'Goods-Receipt').replace(/[^a-zA-Z0-9_-]+/g, '-')}_Goods-Receipt_${printDate.slice(0, 10)}`;
    const restoreTitle = () => { document.title = originalTitle; window.removeEventListener('afterprint', restoreTitle); };
    window.addEventListener('afterprint', restoreTitle); window.print(); window.setTimeout(restoreTitle, 60000);
  };
  return <>
    <div aria-hidden={Boolean(selectedReceipt || deletingReceipt)} inert={selectedReceipt || deletingReceipt ? '' : undefined}><GoodsReceiptWorkspace onRecord={recordReceipt} onOpen={openReceiptDetails} onDelete={openDelete} onPrint={reviewPrint} reloadKey={reloadKey} /></div>
    {receiptMessage && <div role="status" className="fixed bottom-5 left-1/2 z-50 max-w-lg -translate-x-1/2 rounded-lg border border-blue-200 bg-white p-4 text-sm text-blue-900 shadow-xl">{receiptMessage}<button type="button" aria-label="Dismiss receipt update" onClick={() => setReceiptMessage('')} className="ml-3 font-semibold">Close</button></div>}
    {deletingReceipt && <GoodsReceiptDeleteDialog receipt={deletingReceipt} onClose={() => setDeletingReceipt(null)} onDeleted={removedReceipt} onUnavailable={receipt => removedReceipt(receipt, false)} />}
    {creatorError && <div role="alert" className="fixed bottom-5 left-1/2 z-50 max-w-lg -translate-x-1/2 rounded-lg border border-blue-200 bg-white p-4 text-sm text-blue-900 shadow-xl">{creatorError}{creatorError && <button type="button" aria-label="Dismiss receipt message" onClick={() => setCreatorError('')} className="ml-3 font-semibold">Close</button>}</div>}
      {selectedReceipt && createPortal(
        <>
          <style>{`
            .gr-print-document { display: none; }
            @page { size: A4 portrait; margin: 10mm 10mm 12mm; }
            @media print {
              html, body { background: #fff !important; height: auto !important; overflow: visible !important; }
              body { margin: 0 !important; padding: 0 !important; font-family: Arial, Helvetica, sans-serif; }
              body > * { display: none !important; }
              body > .gr-print-document {
                display: block !important;
                position: static !important;
                width: 100% !important;
                height: auto !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow: visible !important;
              }
              .gr-print-document, .gr-print-document * {
                visibility: visible !important;
                box-sizing: border-box;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .gr-print-document table { width: 100%; border-collapse: collapse; }
              .gr-print-document thead { display: table-header-group; }
              .gr-print-document tr, .gr-print-block { break-inside: avoid; page-break-inside: avoid; }
              .gr-print-footer { break-inside: avoid; page-break-inside: avoid; }
              .gr-page-number::after { content: counter(page); }
            }
          `}</style>
          <section className="gr-print-document" aria-label="Printable goods receipt note">
            <ReceiptPrintContent receipt={selectedReceipt} printDate={printDate} />
          </section>
        </>,
        document.body
      )}
      {selectedReceipt && !showPrintPreview && !deletingReceipt && (
        <div ref={detailRef} data-receipt-id={selectedReceipt.id} onKeyDown={trapDialog} className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="receipt-detail-title">
          <div className="flex min-h-screen items-center justify-center p-4">
            <button
              type="button"
              aria-label="Close receipt details"
              className="fixed inset-0 bg-gray-900/60"
              disabled={!!acceptingId} onClick={() => { if (!acceptingId) { setShowPrintPreview(false); setSelectedReceipt(null); } }}
            />
            <div className="relative flex max-h-[calc(100dvh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
              <div className="flex items-center justify-between bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 text-white">
                <div>
                  <h2 id="receipt-detail-title" className="text-xl font-semibold">{receiptItems(selectedReceipt).some(item => item.basis === 'service_value') ? 'Service Acceptance Details' : 'Goods Receipt Details'}</h2>
                  <p className="mt-1 text-sm text-indigo-100">
                    {selectedReceipt.receipt_number || `GR-${selectedReceipt.id}`}
                  </p>
                </div>
                <button type="button" disabled={!!acceptingId} onClick={() => { if (!acceptingId) { setShowPrintPreview(false); setSelectedReceipt(null); } }} className="rounded-lg p-1 hover:bg-white/20" aria-label="Close">
                  <XCircleIcon className="h-7 w-7" />
                </button>
              </div>

              {detailLoading ? (
                <div className="py-16 text-center">
                  <div className="inline-block h-10 w-10 animate-spin rounded-full border-b-2 border-indigo-600" />
                  <p className="mt-3 text-sm text-gray-500">Loading receipt details...</p>
                </div>
              ) : detailError ? <div role="alert" className="p-8 text-red-700"><p>{detailError}</p><button type="button" onClick={() => openReceiptDetails(selectedReceipt)} className="mt-3 rounded border px-3 py-2">Retry receipt details</button></div> : (
                <div role="region" aria-label="Receipt details and evidence" tabIndex={0} className="min-h-0 flex-1 overflow-y-auto p-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {[
                      ['PO Number', selectedReceipt.po_number],
                      ['Receipt Date', receiptDate(selectedReceipt.receipt_date)],
                      ['Received By', selectedReceipt.received_by_name],
                      ['Delivery Note', selectedReceipt.delivery_note_number],
                      ['Delivery Confirmation By', selectedReceipt.confirmation?.responsible_user_name],
                      ...(selectedReceipt.confirmation?.confirmed_at ? [['Confirmed By', selectedReceipt.confirmation.confirmed_by_name], ['Confirmed At', receiptDate(selectedReceipt.confirmation.confirmed_at, true)]] : []),
                      ['Technical Inspector', selectedReceipt.inspector_name],
                      ['Inspection Agency', selectedReceipt.inspection_agency],
                      ['Inspection Report', selectedReceipt.inspection_report_number],
                      ['Status', receiptReviewStatus(selectedReceipt).label],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
                        <p className="mt-1 text-sm font-medium text-gray-900">{value || 'Not recorded'}</p>
                      </div>
                    ))}
                  </div>

                {selectedReceipt.status === 'pending' && <section className="mt-6 w-full rounded-lg border border-blue-200 bg-blue-50 p-4" aria-label="Delivery confirmation">
                  <h3 className="text-sm font-semibold text-gray-900">Delivery confirmation</h3>
                  <p className="mt-1 text-sm text-gray-700">{selectedReceipt.confirmation?.responsible_user_name ? `${selectedReceipt.confirmation.responsible_user_name} recorded this receipt and is responsible for confirming delivery.` : 'The person who recorded this receipt is responsible for confirming delivery.'}</p>
                  {selectedReceipt.confirmation?.can_confirm === true ? <>
                    <label className="mt-3 block text-sm">Confirmation notes (optional)<textarea maxLength={4000} rows={2} value={confirmationNotes} onChange={event => setConfirmationNotes(event.target.value)} disabled={!!acceptingId} className="mt-1 w-full rounded border border-gray-300 p-2" /></label>
                    <p className="mt-2 text-xs text-gray-600">Confirms the recorded quantities or service value and locks this receipt. Technical checks remain unverified unless separately evidenced.</p>
                    {hasTechnicalChanges && <p className="mt-2 text-sm text-amber-900">Technical review entries are unsaved. Complete that review or <button type="button" disabled={!!acceptingId} onClick={() => { setDecisionFields({}); setRejectReason(''); }} className="underline">clear technical review entries</button> before confirming delivery.</p>}

                  </> : <p className="mt-2 text-sm text-amber-900">{selectedReceipt.confirmation?.blocked_reason || 'Delivery confirmation availability could not be verified. Refresh the receipt details.'}</p>}
                  {selectedReceipt.purchase_order && <a href={`/procurement/orders/${encodeURIComponent(selectedReceipt.purchase_order)}`} className="mt-3 inline-block text-sm text-blue-700 underline">Open purchase order{selectedReceipt.po_number ? ` ${selectedReceipt.po_number}` : ''}</a>}
                </section>}

                  <div className="mt-6">
                    <h3 className="text-sm font-semibold text-gray-900">Quality inspection</h3>
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
                      {[
                        ['Overall', selectedReceipt.quality_check_passed],
                        ['Dimensional', selectedReceipt.dimensional_check_passed],
                        ['Visual', selectedReceipt.visual_inspection_passed],
                        ['Material', selectedReceipt.material_verification_passed],
                      ].map(([label, passed]) => (
                        <div key={label} className={`rounded-lg border p-3 text-center ${passed === false ? 'border-red-200 bg-red-50 text-red-800' : 'border-gray-200 bg-gray-50 text-gray-700'}`}>
                          <p className="text-xs font-medium">{label}</p>
                          <p className="mt-1 font-semibold">{inspectionResult(passed, selectedReceipt)}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-lg border border-gray-200 p-4">
                      <h3 className="text-sm font-semibold text-gray-900">{receiptItems(selectedReceipt).some(item => item.basis === 'service_value') ? 'Service acceptance value' : 'Items received'}</h3>
                      {receiptItems(selectedReceipt).length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {receiptItems(selectedReceipt).map((item, index) => (
                            <div key={index} className="rounded bg-gray-50 p-3 text-sm text-gray-700">
                              <p className="font-medium text-gray-900">{receiptText(item.item || item.description || `Item ${index + 1}`)}</p>
                              <p className="mt-1">Ordered: {receiptText(item.ordered_qty)} · Received: {receiptText(item.received_qty ?? item.quantity)} · Accepted: {receiptText(item.accepted_qty)} {receiptText(item.uom)}</p>
                            </div>
                          ))}
                        </div>
                      ) : <p className="mt-2 text-sm text-gray-500">No item breakdown recorded.</p>}
                    </div>
                    <div className="rounded-lg border border-gray-200 p-4">
                      <h3 className="text-sm font-semibold text-gray-900">Compliance and traceability</h3>
                      <dl className="mt-3 space-y-2 text-sm">
                        <div><dt className="font-medium text-gray-700">Certificates</dt><dd className="text-gray-600">{listText(selectedReceipt.certificates_received)}</dd></div>
                        <div><dt className="font-medium text-gray-700">Heat numbers</dt><dd className="text-gray-600">{listText(selectedReceipt.heat_numbers)}</dd></div>
                        <div><dt className="font-medium text-gray-700">NDT performed</dt><dd className="text-gray-600">{selectedReceipt.ndt_performed ? 'Yes' : 'No'}</dd></div>
                        {selectedReceipt.ndt_results && <div><dt className="font-medium text-gray-700">NDT results</dt><dd className="text-gray-600">{receiptText(selectedReceipt.ndt_results)}</dd></div>}
                      </dl>
                    </div>
                  </div>

                  <div className="mt-6 space-y-3">
                {selectedReceipt.status === 'pending' && (selectedReceipt.capabilities?.accept === true || selectedReceipt.capabilities?.reject === true) && <div className="grid w-full gap-3 sm:grid-cols-2"><h3 className="text-sm font-semibold sm:col-span-2">Technical inspection review</h3>{[['quality_check_passed', 'Overall quality'], ['dimensional_check_passed', 'Dimensional check'], ['visual_inspection_passed', 'Visual inspection'], ['material_verification_passed', 'Material verification']].map(([key, label]) => <label key={key} className="text-sm">{label}<select value={decisionFields[key] ?? (selectedReceipt[key] === true ? 'true' : selectedReceipt[key] === false ? 'false' : '')} onChange={event => setDecisionFields(current => ({ ...current, [key]: event.target.value }))} disabled={!!acceptingId} className="mt-1 w-full rounded border p-2"><option value="">Not assessed</option><option value="true">Passed</option><option value="false">Failed</option></select></label>)}</div>}
                {selectedReceipt.status === 'pending' && selectedReceipt.capabilities?.reject === true && <div className="w-full"><label className="block text-sm">Rejection reason<textarea value={rejectReason} onChange={event => setRejectReason(event.target.value)} disabled={!!acceptingId} className="mt-1 w-full rounded border border-gray-300 p-2" /></label><button type="button" disabled={!!acceptingId || decisionStale || !rejectReason.trim() || detailLoading || !!detailError} onClick={() => acceptReceipt(selectedReceipt, true)} className="mt-2 rounded border border-red-300 px-3 py-2 text-red-700">Reject receipt</button></div>}
                  </div>

                  <section className="mt-6 rounded-lg border border-gray-200 p-4" aria-label="Receipt attachments">
                    <h3 className="text-sm font-semibold text-gray-900">Attachments</h3>
                    <ul className="mt-3 space-y-2">{(Array.isArray(selectedReceipt.attachments) ? selectedReceipt.attachments : []).map(receiptReviewAttachment).filter(Boolean).map((attachment, index) => <li key={index} className="break-all text-sm">{attachment.url ? <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">{attachment.name}</a> : <span>{attachment.name} · Document link unavailable</span>}</li>)}</ul>
                    {(!Array.isArray(selectedReceipt.attachments) || !selectedReceipt.attachments.length) && <p className="mt-2 text-sm text-gray-600">No attachments recorded.</p>}
                  </section>

                  {(selectedReceipt.inspection_notes || selectedReceipt.notes) && (
                    <div className="mt-6 rounded-lg border border-gray-200 p-4">
                      <h3 className="text-sm font-semibold text-gray-900">Notes</h3>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">{receiptText(selectedReceipt.inspection_notes || selectedReceipt.notes)}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
                {actionError && <p role="alert" className="w-full text-sm text-red-700">{actionError}</p>}
                {decisionStale && <button type="button" disabled={!!acceptingId} onClick={() => openReceiptDetails(selectedReceipt, true)} className="rounded border px-3 py-2">Refresh receipt details</button>}
                {!detailLoading && !detailError && <>
                  <button type="button" onClick={() => confirmDelivery(selectedReceipt)} disabled={!!acceptingId || decisionStale || hasTechnicalChanges || !!receiptConfirmationBlock(selectedReceipt)} aria-describedby={receiptConfirmationBlock(selectedReceipt) ? 'receipt-confirm-block' : undefined} className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50">{acceptingId ? 'Confirming...' : 'Confirm delivery'}</button>
                  <button type="button" onClick={() => openDelete(selectedReceipt)} disabled={!!acceptingId || decisionStale || !!receiptDeletionBlock(selectedReceipt)} aria-describedby={receiptDeletionBlock(selectedReceipt) ? 'receipt-delete-block' : undefined} className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">Delete receipt</button>
                  {receiptConfirmationBlock(selectedReceipt) && <p id="receipt-confirm-block" className="w-full text-sm text-amber-900">{receiptConfirmationBlock(selectedReceipt)}</p>}
                  {receiptDeletionBlock(selectedReceipt) && <p id="receipt-delete-block" className="w-full text-sm text-amber-900">{receiptDeletionBlock(selectedReceipt)}</p>}
                </>}
                <button type="button" onClick={openPrintPreview} disabled={!!acceptingId || detailLoading || !!detailError || selectedReceipt.capabilities?.export !== true} className="inline-flex items-center rounded-md border border-indigo-300 bg-white px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50">
                  <PrinterIcon className="mr-2 h-4 w-4" />
                  Print Preview
                </button>
                {selectedReceipt.status === 'pending' && selectedReceipt.capabilities?.accept === true && !detailError && !detailLoading && (
                  <button type="button" onClick={() => acceptReceipt(selectedReceipt)} disabled={acceptingId === selectedReceipt.id || decisionStale} className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50">
                    {acceptingId === selectedReceipt.id ? 'Accepting...' : 'Accept receipt'}
                  </button>
                )}
                <button type="button" disabled={!!acceptingId} onClick={() => { if (!acceptingId) { setShowPrintPreview(false); setSelectedReceipt(null); } }} className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* A4 Print Preview */}
      {selectedReceipt && showPrintPreview && (
        <div ref={printRef} onKeyDown={trapDialog} className="fixed inset-0 z-[60] overflow-y-auto bg-gray-900/80" role="dialog" aria-modal="true" aria-labelledby="gr-print-preview-title">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-700 bg-gray-900 px-4 py-3 text-white shadow-lg sm:px-6">
            <div>
              <h2 id="gr-print-preview-title" className="font-semibold">Print Preview · Goods Receipt Note</h2>
              <p className="text-xs text-gray-300">A4 portrait · {selectedReceipt.po_number} · Printed {receiptDate(printDate)}</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={printReceipt} className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
                <PrinterIcon className="mr-2 h-4 w-4" />
                Print / Save PDF
              </button>
              <button type="button" onClick={() => setShowPrintPreview(false)} className="rounded-md border border-gray-600 px-4 py-2 text-sm font-medium hover:bg-gray-800">Close Preview</button>
            </div>
          </div>
          <div className="mx-auto my-6 w-[210mm] min-h-[297mm] bg-white p-[10mm] shadow-2xl">
            <ReceiptPrintContent receipt={selectedReceipt} printDate={printDate} />
          </div>
        </div>
      )}


    <ReceiptCreatorErrorBoundary isOpen={showAICreator} onClose={() => setShowAICreator(false)}>
      <AIReceiptCreator isOpen={showAICreator} onClose={() => setShowAICreator(false)} onReceiptCreated={handleReceiptCreated} initialOrder={initialOrder} reconciliation={reconciliation} />
    </ReceiptCreatorErrorBoundary>
  </>;
};
export default ReceiptManagement;
