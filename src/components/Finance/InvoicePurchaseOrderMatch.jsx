import { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import financeService from '../../services/finance.service';
import { PurchaseOrderSelector, handoffError } from '../Procurement/PurchaseOrderHandoff';

export default function InvoicePurchaseOrderMatch({ invoice, onSaved }) {
  const [order, setOrder] = useState(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [stale, setStale] = useState(false);
  const [version, setVersion] = useState(invoice.updated_at);
  const [allowed, setAllowed] = useState(invoice.capabilities?.can_allocate_purchase_order === true);
  const pending = useRef(false);
  const refresh = async () => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try {
      const current = await financeService.getInvoice(invoice.id);
      if (String(current?.id) !== String(invoice.id) || !current.updated_at) throw new Error('Invoice details could not be verified.');
      setVersion(current.updated_at); setAllowed(current.capabilities?.can_allocate_purchase_order === true); setStale(false); setConfirmed(false);
    } catch (requestError) { setError(handoffError(requestError)); }
    finally { pending.current = false; setBusy(false); }
  };
  const submit = async event => {
    event.preventDefault();
    if (pending.current || stale || !allowed) return;
    if (!order || !confirmed || !reason.trim() || !/^\d+(?:\.\d+)?$/.test(amount) || !/[1-9]/.test(amount)) { setError('Select a PO, enter an amount and reason, and confirm the match.'); return; }
    pending.current = true; setBusy(true); setError('');
    try {
      const result = await financeService.allocatePurchaseOrder(invoice.id, { purchase_order_id: order.id, allocated_amount: amount, reason: reason.trim(), confirm_po_match: true, expected_updated_at: version });
      if (String(result?.invoice?.id) !== String(invoice.id)) throw new Error('The invoice match response could not be verified. Refresh the invoice before trying again.');
      onSaved(result.invoice);
    } catch (requestError) { setError(handoffError(requestError)); if (requestError?.response?.status === 409) setStale(true); }
    finally { pending.current = false; setBusy(false); }
  };
  return <form onSubmit={submit} className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3" aria-label="Confirm purchase order match" aria-busy={busy}>
    <fieldset disabled={busy} className="space-y-3"><PurchaseOrderSelector fetchPage={financeService.getPurchaseOrderOptions} value={order?.id} disabled={busy || !allowed} onChange={selected => { setOrder(selected); setConfirmed(false); }} />
      <label className="block text-sm">Allocated amount ({invoice.currency})<input type="number" min="0" step="any" value={amount} onChange={event => { setAmount(event.target.value); setConfirmed(false); }} required className="mt-1 w-full rounded border border-slate-300 p-2" /></label>
      <label className="block text-sm">Matching reason<textarea required value={reason} onChange={event => { setReason(event.target.value); setConfirmed(false); }} className="mt-1 w-full rounded border border-slate-300 p-2" /></label>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />I confirm this purchase order and allocated amount.</label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {!allowed && <p role="status">Matching is unavailable for this invoice.</p>}
      {stale && <button type="button" className="incoming-review-button" onClick={refresh}>Refresh invoice details</button>}
      <button type="submit" className="incoming-review-button incoming-review-button--primary" disabled={busy || stale || !allowed || !confirmed || !order || !version}>{busy ? 'Saving match…' : 'Confirm PO match'}</button>
    </fieldset>
  </form>;
}
InvoicePurchaseOrderMatch.propTypes = { invoice: PropTypes.object.isRequired, onSaved: PropTypes.func.isRequired };
