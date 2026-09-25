import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { XMarkIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import goodsReceiptsService from '../../services/goodsReceipts.service';
import { PurchaseOrderSelector, handoffError } from '../../components/Procurement/PurchaseOrderHandoff';
import { buildReceivingLines, localReceiptDate, receivingLinePreview, receiptOperation } from './receiptHandoff';

const availableOrders = params => goodsReceiptsService.availableOrders({ ...params, queue: 'awaiting' });
const emptyForm = () => ({ delivery_note_number: '', receipt_date: localReceiptDate(), notes: '', reason: '' });
const inputClass = 'mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm';

export default function AIReceiptCreator({ isOpen, onClose, onReceiptCreated, initialOrder = null, reconciliation = false }) {
  const dialogRef = useRef(null);
  const busyRef = useRef(false);
  const operation = useRef(null);
  const [order, setOrder] = useState(initialOrder);
  const [summary, setSummary] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [stale, setStale] = useState(false);
  const [retry, setRetry] = useState(0);
  const [reviewed, setReviewed] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const close = useCallback(() => { if (!busyRef.current) onCloseRef.current(); }, []);

  useEffect(() => {
    if (!isOpen) return;
    setOrder(initialOrder); setSummary(null); setForm(emptyForm()); setDrafts({}); setError(''); setStale(false); setReviewed(false); operation.current = null;
  }, [isOpen, initialOrder]);
  useEffect(() => {
    if (!isOpen || !order?.id) return undefined;
    let active = true;
    setLoading(true); setSummary(null);
    goodsReceiptsService.receivingSummary(order.id).then(data => {
      if (!active) return;
      if (!Array.isArray(data?.lines) || !data.po_updated_at) throw new Error('Receipt balances are unavailable.');
      setSummary(data); setStale(false);
    }).catch(requestError => { if (active) setError(handoffError(requestError)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isOpen, order?.id, retry]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const elements = () => [...(dialogRef.current?.querySelectorAll('button,input,select,textarea,[tabindex="0"]') || [])].filter(element => !element.matches(':disabled') && element.getClientRects().length);
    const frame = requestAnimationFrame(() => elements()[0]?.focus());
    const keydown = event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
      if (event.key !== 'Tab') return;
      const controls = elements();
      if (!controls.length) { event.preventDefault(); dialogRef.current?.focus(); }
      else if (event.shiftKey && (document.activeElement === controls[0] || !dialogRef.current?.contains(document.activeElement))) { event.preventDefault(); controls.at(-1).focus(); }
      else if (!event.shiftKey && (document.activeElement === controls.at(-1) || !dialogRef.current?.contains(document.activeElement))) { event.preventDefault(); controls[0].focus(); }
    };
    document.addEventListener('keydown', keydown, true);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('keydown', keydown, true); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, [isOpen, close]);

  const change = (name, value) => { setForm(current => ({ ...current, [name]: value })); setReviewed(false); };
  const submit = async event => {
    event.preventDefault();
    if (busyRef.current || loading || stale) return;
    setError('');
    try {
      if (!order?.id || !summary?.po_updated_at || (reconciliation ? summary.can_reconcile !== true : summary.can_record !== true)) throw new Error('This purchase order is not available for receipt.');
      if (!form.receipt_date) throw new Error('Enter a receipt date.');
      const items = buildReceivingLines(summary, drafts);
      if (reconciliation && !form.reason.trim()) throw new Error('Enter a reconciliation reason.');
      if (reconciliation && !reviewed) throw new Error('Review and confirm this receipt reconciliation.');
      const payload = { ...form, purchase_order: order.id, status: 'pending', expected_po_updated_at: summary.po_updated_at, items_received: items };
      for (const key of ['dimensional_check_passed', 'visual_inspection_passed', 'material_verification_passed', 'quality_check_passed']) payload[key] = null;
      if (!reconciliation) delete payload.reason;
      operation.current = receiptOperation(operation.current, payload);
      busyRef.current = true; setBusy(true);
      const receipt = await goodsReceiptsService.create({ ...payload, operation_key: operation.current.key }, reconciliation);
      if (!receipt?.id || String(receipt.purchase_order) !== String(order.id) || receipt.operation_key !== operation.current.key || !['pending', 'accepted', 'partial', 'rejected'].includes(receipt.status)) throw new Error('The receipt response could not be verified. Refresh before recording again.');
      onReceiptCreated(receipt); onClose();
    } catch (requestError) { setError(handoffError(requestError)); if (requestError?.response?.status === 409) setStale(true); }
    finally { busyRef.current = false; setBusy(false); }
  };
  if (!isOpen) return null;
  const service = summary?.basis === 'service_value';
  const title = reconciliation ? 'Reconcile receipt evidence' : service ? 'Record service acceptance' : 'Record goods receipt';
  const allowed = reconciliation ? summary?.can_reconcile === true : summary?.can_record === true;
  return createPortal(<div ref={dialogRef} tabIndex={-1} className="fixed inset-0 z-[100] overflow-y-auto bg-gray-900/70 p-4 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="receipt-create-title" aria-busy={busy}>
    <div className="relative mx-auto max-w-5xl overflow-hidden rounded-xl bg-white shadow-2xl">
      <header className="flex items-center justify-between bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 text-white"><h2 id="receipt-create-title" className="flex items-center gap-3 text-xl font-semibold"><DocumentTextIcon className="h-6 w-6" />{title}</h2><button type="button" aria-label="Close receipt creator" onClick={close} disabled={busy}><XMarkIcon className="h-6 w-6" /></button></header>
      <form onSubmit={submit}><fieldset disabled={busy} className="min-w-0 p-6"><div className="space-y-5">
        {initialOrder || reconciliation ? <div><p className="mb-1 text-sm text-gray-600">Purchase Order</p><strong>{order?.po_number}</strong><p className="text-sm text-gray-600">{order?.vendor_name}</p></div> : <PurchaseOrderSelector label="Purchase Order" fetchPage={availableOrders} value={order?.id} onChange={selected => { setOrder(selected); setDrafts({}); setSummary(null); setError(''); setStale(false); }} disabled={busy} />}
        {loading && <p role="status">Loading receipt balances…</p>}
        {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
        {order && (stale || (!summary && !loading)) && <button type="button" className={inputClass} onClick={() => { setError(''); setReviewed(false); setRetry(value => value + 1); }}>Refresh receipt balances</button>}
        {summary && !allowed && <p role="status" className="text-amber-800">{summary.blocked_reason || 'This purchase order is not available for receipt.'}</p>}
        {order && summary && <>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">Delivery Note / Reference<input maxLength={100} className={inputClass} value={form.delivery_note_number} onChange={event => change('delivery_note_number', event.target.value)} /></label>
            <label className="block text-sm">Receipt Date <span aria-hidden="true">*</span><input type="date" required className={inputClass} value={form.receipt_date} onChange={event => change('receipt_date', event.target.value)} /></label>
          </div>
          {summary.lines.length ? <div><h3 className="mb-3 text-sm font-semibold">{service ? `Service value (${order.currency || summary.currency || ''})` : 'Purchase order lines'}</h3><div className="overflow-x-auto"><table className="w-full min-w-[740px] text-left text-sm">
            <caption className="sr-only">{service ? 'Service value lines' : 'Purchase order lines'}</caption>
            <thead className="bg-gray-50"><tr>{['Description', 'Ordered', 'Previously Received', service ? 'Received Value' : 'Received Quantity', 'Balance Remaining', 'Line Status'].map(label => <th key={label} scope="col" className="p-2">{label}</th>)}</tr></thead>
            <tbody>{summary.lines.map(line => {
              const received = drafts[line.line_id]?.received ?? '';
              const preview = receivingLinePreview(line, received);
              return <tr key={line.line_id} className="border-b border-gray-200">
                <th scope="row" className="p-2 font-medium">{line.description}<small className="block font-normal text-gray-600">{service ? order.currency || summary.currency : line.uom}</small></th>
                <td className="p-2 tabular-nums">{line.ordered}</td>
                <td className="p-2 tabular-nums">{preview.previouslyReceived ?? '—'}{Number(line.pending) > 0 && <small className="block text-gray-600">{line.pending} awaiting confirmation</small>}</td>
                <td className="p-2"><input aria-label={`Received ${service ? 'value' : 'quantity'} for ${line.description}`} disabled={!allowed} type="number" min="0" max={line.available} step="any" value={received} onChange={event => { const value = event.target.value; setDrafts(current => ({ ...current, [line.line_id]: { received: value } })); setReviewed(false); }} className="w-28 rounded border border-gray-300 p-2 disabled:bg-gray-50" /></td>
                <td className="p-2 tabular-nums">{preview.balance ?? '—'}</td>
                <td className="p-2"><span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${preview.status === 'Complete' ? 'bg-green-50 text-green-800' : preview.status === 'Partial' ? 'bg-orange-50 text-orange-800' : 'bg-gray-100 text-gray-700'}`}><span aria-hidden="true" className={`h-2 w-2 rounded-full ${preview.status === 'Complete' ? 'bg-green-600' : preview.status === 'Partial' ? 'bg-orange-500' : 'bg-gray-400'}`} />{preview.status || 'Check quantity'}</span>{preview.awaitingConfirmation && <small className="mt-1 block text-gray-600">Awaiting confirmation</small>}</td>
              </tr>;
            })}</tbody>
          </table></div><p className="mt-2 text-xs text-gray-600">Partial / Complete describes received coverage. Delivery confirmation is a separate step.</p></div> : <p role="status" className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">No receivable lines are available for this purchase order.</p>}
          <label className="block text-sm">Remarks<textarea rows={3} className={inputClass} value={form.notes} onChange={event => change('notes', event.target.value)} /></label>
          {reconciliation && <section className="rounded-md border border-amber-200 bg-amber-50 p-4"><label className="block text-sm">Reconciliation reason<textarea required className={inputClass} value={form.reason} onChange={event => change('reason', event.target.value)} /></label><label className="mt-3 flex items-start gap-2 text-sm"><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} />I reviewed the quantities or service value and confirm this receipt evidence.</label></section>}
        </>}
      </div></fieldset><footer className="flex flex-wrap justify-between gap-3 border-t bg-gray-50 px-6 py-4"><button type="button" disabled={busy} onClick={close} className="rounded-md border bg-white px-4 py-2">Cancel</button><button type="submit" disabled={busy || loading || stale || !allowed || !summary?.lines.length || (reconciliation && !reviewed)} className="rounded-md bg-indigo-600 px-5 py-2 text-white disabled:opacity-50">{busy ? 'Recording…' : reconciliation ? 'Record reconciliation' : 'Record receipt'}</button></footer></form>
    </div>
  </div>, document.body);
}
AIReceiptCreator.propTypes = { isOpen: PropTypes.bool, onClose: PropTypes.func.isRequired, onReceiptCreated: PropTypes.func.isRequired, initialOrder: PropTypes.object, reconciliation: PropTypes.bool };
