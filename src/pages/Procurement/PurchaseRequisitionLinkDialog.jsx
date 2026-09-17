import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import apiClient from '../../services/api.service';

const messageFor = (error, fallback) => {
  const data = error.response?.data;
  return (typeof data === 'string' ? data : data?.error || data?.detail || data?.po_link?.message || Object.values(data || {}).flat().find(value => typeof value === 'string')) || error.message || fallback;
};

export default function PurchaseRequisitionLinkDialog({ order, onClose, onLinked }) {
  const dialogRef = useRef(null), savingRef = useRef(false);
  const [search, setSearch] = useState(''), [retry, setRetry] = useState(0);
  const [options, setOptions] = useState([]), [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(''), [saveError, setSaveError] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError('');
    const timer = window.setTimeout(() => {
      apiClient.get('/procurement/orders/available-requisitions/', {
        params: { search: search.trim(), limit: 100 }, signal: controller.signal,
      }).then(({ data }) => {
        if (controller.signal.aborted) return;
        const rows = Array.isArray(data) ? data : data?.results;
        if (!Array.isArray(rows)) throw new Error('Purchase recommendations could not be loaded.');
        setOptions(rows);
        setSelectedId(value => rows.some(row => String(row.id) === value) ? value : '');
      }).catch(error => {
        if (!controller.signal.aborted) {
          setOptions([]);
          setLoadError(messageFor(error, 'Purchase recommendations could not be loaded.'));
        }
      }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [search, retry]);

  const link = async event => {
    event.preventDefault();
    const recommendation = options.find(row => String(row.id) === selectedId);
    if (!recommendation || loading || loadError || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError('');
    try {
      const { data } = await apiClient.post(`/procurement/requisitions/${selectedId}/link-purchase-order/`, { purchase_order_id: order.id });
      if (!['linked', 'already_linked'].includes(data?.po_link?.status)) throw new Error(data?.po_link?.message || 'The recommendation could not be linked.');
      onLinked(recommendation);
    } catch (error) {
      setSaveError(messageFor(error, 'The recommendation could not be linked.'));
    } finally { savingRef.current = false; setSaving(false); }
  };

  return <dialog ref={dialogRef} aria-label='Link purchase recommendation' className='m-auto max-h-[calc(100vh-32px)] w-[min(640px,calc(100vw-32px))] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/50'
    onCancel={event => { if (savingRef.current) event.preventDefault(); else onClose(); }}>
    <form onSubmit={link}>
      <header className='border-b border-slate-200 px-6 py-5'><h2 id='po-pr-link-title' className='text-lg font-bold'>Link purchase recommendation</h2><p className='mt-1 text-sm text-slate-600'>Select the existing recommendation for <strong>{order.po_number}</strong>.</p></header>
      <div className='space-y-4 px-6 py-5'>
        <p className='rounded-lg bg-blue-50 p-3 text-sm text-blue-900'>This records the PR link. The order status, signed evidence and commercial values stay unchanged.</p>
        <label className='block text-sm font-semibold'>Search recommendations<input type='search' value={search} disabled={saving} onChange={event => { setSearch(event.target.value); setSelectedId(''); setSaveError(''); }} placeholder='Search PR number, supplier or description' className='mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 font-normal' /></label>
        <label className='block text-sm font-semibold'>Purchase recommendation<select value={selectedId} disabled={loading || saving || Boolean(loadError)} onChange={event => { setSelectedId(event.target.value); setSaveError(''); }} className='mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal'>
          <option value=''>{loading ? 'Loading recommendations...' : 'Select a recommendation'}</option>
          {options.map(row => <option key={row.id} value={row.id}>{row.pr_number}{row.product_service || row.title ? ` — ${row.product_service || row.title}` : ''}</option>)}
        </select></label>
        {loading && <p role='status' className='text-sm text-slate-600'>Loading purchase recommendations...</p>}
        {!loading && !loadError && <p className='text-sm text-slate-600'>{options.length ? `${options.length} recommendation${options.length === 1 ? '' : 's'} shown. Search to find older records.` : 'No recommendations found. Try another PR number or description.'}</p>}
        {loadError && <div role='alert' className='rounded-lg bg-red-50 p-3 text-sm text-red-700'>{loadError} <button type='button' onClick={() => setRetry(value => value + 1)} className='font-semibold underline'>Retry recommendations</button></div>}
        {saveError && <p role='alert' className='rounded-lg bg-red-50 p-3 text-sm text-red-700'>{saveError}</p>}
      </div>
      <footer className='flex justify-end gap-3 border-t border-slate-200 px-6 py-4'><button type='button' disabled={saving} onClick={onClose} className='rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-50'>Cancel</button><button type='submit' disabled={!selectedId || loading || saving || Boolean(loadError)} className='rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50'>{saving ? 'Linking...' : 'Link recommendation'}</button></footer>
    </form>
  </dialog>;
}

PurchaseRequisitionLinkDialog.propTypes = {
  order: PropTypes.shape({ id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired, po_number: PropTypes.string }).isRequired,
  onClose: PropTypes.func.isRequired,
  onLinked: PropTypes.func.isRequired,
};
