import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import goodsReceiptsService from '../../services/goodsReceipts.service';
import { handoffError } from './PurchaseOrderHandoff';
import { receiptDeletionBlock } from './GoodsReceiptActions';

const deletionError = failure => failure.response?.status === 403 ? (typeof failure.response.data?.detail === 'string' ? failure.response.data.detail : 'You do not have access to delete this receipt.') : handoffError(failure);

export default function GoodsReceiptDeleteDialog({ receipt, onClose, onDeleted, onUnavailable }) {
  const dialog = useRef(null);
  const busy = useRef(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [stale, setStale] = useState(false);
  const [missing, setMissing] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const previous = document.activeElement;
    const element = dialog.current;
    element.showModal();
    element.querySelector('button')?.focus();
    return () => { element.close(); previous?.focus(); };
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setStale(false); setMissing(false); setData(null);
    goodsReceiptsService.retrieve(receipt.id).then(result => {
      if (String(result?.id) !== String(receipt.id)) throw new Error('The requested receipt could not be verified.');
      if (active) setData(result);
    }).catch(failure => {
      if (!active) return;
      if (failure.response?.status === 404) { setMissing(true); setError('This receipt is no longer available. Refresh the register.'); }
      else setError(failure.response?.status === 403 ? 'You do not have access to this receipt.' : handoffError(failure));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [receipt.id, retry]);
  const remove = async () => {
    if (busy.current || !data || receiptDeletionBlock(data) || loading || stale || missing) return;
    busy.current = true; setDeleting(true); setError('');
    try {
      await goodsReceiptsService.remove(data.id, { expected_updated_at: data.updated_at });
      onDeleted(data);
    } catch (failure) {
      if (failure.response?.status === 404) { setMissing(true); setError('This receipt is no longer available. Refresh the register.'); }
      else {
        setError(deletionError(failure));
        if (failure.response?.status === 409) setStale(true);
      }
    } finally { busy.current = false; setDeleting(false); }
  };
  const identity = data || receipt;
  const blocked = data ? receiptDeletionBlock(data) : '';
  return <dialog ref={dialog} aria-labelledby="receipt-delete-title" aria-describedby="receipt-delete-description" onCancel={event => { event.preventDefault(); if (!busy.current) onClose(); }} className="m-auto w-[min(32rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl border border-gray-200 bg-white p-6 text-gray-900 shadow-2xl backdrop:bg-gray-900/60">
    <h2 id="receipt-delete-title" className="text-xl font-semibold">Delete goods receipt?</h2>
    <p className="mt-3 font-semibold">{identity.receipt_number || 'Goods receipt'}</p>
    <p className="mt-1 text-sm text-gray-600">Purchase order: {identity.po_number || 'Not recorded'}</p>
    <p id="receipt-delete-description" className="mt-4 text-sm">This permanently removes the pending receipt and releases its reserved quantities or service value. This cannot be undone.</p>
    {loading && <p role="status" className="mt-4 text-sm">Checking receipt details...</p>}
    {blocked && <p className="mt-4 text-sm text-amber-900">{blocked}</p>}
    {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    <div className="mt-6 flex flex-wrap justify-end gap-3">
      <button type="button" disabled={deleting} onClick={onClose} className="rounded border border-gray-300 px-4 py-2 text-sm disabled:opacity-50">Cancel</button>
      {missing ? <button type="button" onClick={() => onUnavailable(identity)} className="rounded border border-blue-300 px-4 py-2 text-sm text-blue-700">Refresh register</button> : (stale || (!data && !loading)) && <button type="button" disabled={deleting} onClick={() => setRetry(value => value + 1)} className="rounded border border-blue-300 px-4 py-2 text-sm text-blue-700">Refresh receipt details</button>}
      <button type="button" disabled={loading || deleting || stale || missing || !data || !!blocked} onClick={remove} className="rounded bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">{deleting ? 'Deleting...' : 'Delete receipt'}</button>
    </div>
  </dialog>;
}
GoodsReceiptDeleteDialog.propTypes = { receipt: PropTypes.object.isRequired, onClose: PropTypes.func.isRequired, onDeleted: PropTypes.func.isRequired, onUnavailable: PropTypes.func.isRequired };
