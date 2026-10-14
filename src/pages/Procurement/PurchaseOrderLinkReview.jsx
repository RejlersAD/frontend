import React, { useEffect, useId, useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import apiClient from '../../services/api.service';
import PurchaseOrderPdfImport from './PurchaseOrderPdfImport';

const failureMessage = error => error.response?.data?.error || error.response?.data?.detail || error.message || 'The purchase order could not be linked.';

export default function PurchaseOrderLinkReview({ requisitionId, poLink, canLink = true, canUpload = false, canImportRequisition = false, onLinked, onOpen, onUploadOpenChange }) {
  const [search, setSearch] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [retry, setRetry] = useState(0);
  const optionsId = useId();
  const [options, setOptions] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [saved, setSaved] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const current = saved || poLink;
  const needsLink = Boolean(current?.manual_link_required);

  useEffect(() => { setSaved(null); setSelectedId(''); }, [requisitionId]);
  useEffect(() => {
    if (!needsLink || !canLink) return undefined;
    const controller = new AbortController();
    setLoading(true);
    setLoadError('');
    const timer = window.setTimeout(() => apiClient.get('/procurement/orders/', { params: { search: search.trim(), page_size: 100 }, signal: controller.signal })
      .then(response => {
        if (controller.signal.aborted) return;
        const rows = Array.isArray(response.data) ? response.data : response.data?.results;
        if (!Array.isArray(rows)) throw new Error('Purchase orders could not be loaded.');
        setOptions(rows);
      })
      .catch(problem => { if (!controller.signal.aborted) { setOptions([]); setSelectedId(''); setLoadError(failureMessage(problem)); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); }), 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [needsLink, canLink, search, retry, requisitionId]);

  const link = async () => {
    if (!selectedId || !requisitionId || saving || loading || loadError || !options.some(order => String(order.id) === selectedId)) return;
    setSaving(true);
    setError('');
    try {
      const response = await apiClient.post(`/procurement/requisitions/${requisitionId}/link-purchase-order/`, { purchase_order_id: selectedId });
      const next = response.data?.po_link;
      if (!['linked', 'already_linked'].includes(next?.status)) throw new Error(next?.message || 'The purchase order was not linked.');
      setSaved(next);
      onLinked?.(next);
    } catch (problem) { setError(failureMessage(problem)); }
    finally { setSaving(false); }
  };

  const changeUpload = open => { setUploadOpen(open); onUploadOpenChange?.(open); };
  const selectOrder = order => { setSelectedId(String(order.id)); setSearch(order.po_number); setShowOptions(false); setError(''); };
  const imported = result => {
    const next = result?.po_link;
    if (!result?.purchase_order_id || String(result.pr_id) !== String(requisitionId)
      || !['linked', 'already_linked'].includes(next?.status) || next.manual_link_required !== false
      || String(next.po_id) !== String(result.purchase_order_id)) return;
    changeUpload(false);
    setSaved(next);
    onLinked?.(next);
  };

  if (['linked', 'already_linked'].includes(current?.status)) return <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900"><span>Linked purchase order: <strong>{current.po_number}</strong></span><Link to={`/procurement/orders/${current.po_id}`} onClick={onOpen} className="rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-semibold text-blue-700">Open purchase order</Link></div>;
  if (!needsLink) return null;
  return <section aria-label="Link an existing purchase order" className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
    <h3 className="text-sm font-semibold text-amber-900">{canUpload ? 'Upload or link a purchase order' : 'Link an existing purchase order'}</h3>
    <p className="text-sm text-amber-900">{current.message || (canUpload ? 'Upload the signed PO or select the corresponding purchase order.' : 'No matching purchase order was found. Select the corresponding order.')}</p>
    {(canLink || canUpload) && <div className="flex gap-2">{canLink && <label className="min-w-0 flex-1 text-xs font-semibold text-gray-700">Purchase order<input role="combobox" aria-label="Purchase order" aria-autocomplete="list" aria-expanded={showOptions} aria-controls={optionsId} aria-activedescendant={showOptions && options[activeIndex] ? `${optionsId}-${activeIndex}` : undefined} value={search} disabled={saving} placeholder="Type to search existing purchase orders" autoComplete="off"
      onChange={event => { setSearch(event.target.value); setSelectedId(''); setOptions([]); setLoading(true); setShowOptions(true); setActiveIndex(0); }}
      onFocus={() => setShowOptions(true)} onBlur={() => setShowOptions(false)}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); setShowOptions(false); }
        else if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); setShowOptions(true); setActiveIndex(index => Math.max(0, Math.min(options.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))); }
        else if (event.key === 'Enter') { event.preventDefault(); if (showOptions && !loading && options[activeIndex]) selectOrder(options[activeIndex]); }
      }} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" /></label>}{canUpload && <button type="button" onClick={() => changeUpload(true)} disabled={saving || !requisitionId} className="self-end rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-semibold text-blue-700">Upload Signed PO</button>}</div>}
    {canLink ? <>
      {loading && <p role="status" className="text-xs text-gray-600">Loading purchase orders...</p>}
      {showOptions && !loading && options.length > 0 && <div id={optionsId} role="listbox" aria-label="Purchase orders" className="max-h-48 overflow-y-auto rounded-lg border border-gray-300 bg-white p-1">{options.map((order, index) => <button id={`${optionsId}-${index}`} key={order.id} type="button" role="option" tabIndex={-1} aria-selected={selectedId === String(order.id)} onMouseDown={event => event.preventDefault()} onClick={() => selectOrder(order)} className={`block w-full rounded px-3 py-2 text-left text-sm text-gray-800 hover:bg-blue-50 ${index === activeIndex ? 'bg-blue-50' : ''}`}>{order.po_number}{order.vendor_name || order.supplier_name ? ` - ${order.vendor_name || order.supplier_name}` : ''}</button>)}</div>}
      {!loading && !options.length && !loadError && <p className="text-xs text-amber-900">No purchase orders found. Search another PO number.</p>}
      {loadError && <p role="alert" className="text-sm text-red-700">{loadError} <button type="button" disabled={saving || loading} onClick={() => setRetry(value => value + 1)} className="font-semibold underline">Retry purchase orders</button></p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button type="button" onClick={link} disabled={!selectedId || !options.some(order => String(order.id) === selectedId) || Boolean(loadError) || saving || loading} className="h-9 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white disabled:opacity-50">{saving ? 'Linking...' : 'Link purchase order'}</button>
    </> : !canUpload && <p className="text-sm text-amber-900">A user with Purchase Orders access must link this recommendation.</p>}
    {uploadOpen && <PurchaseOrderPdfImport isOpen requisitionId={requisitionId} canReconcile={canUpload && canLink} canEditDocument={canLink} canUploadPurchaseOrder={canUpload} canImportRequisition={canImportRequisition} onClose={() => changeUpload(false)} onImported={imported} />}
  </section>;
}

PurchaseOrderLinkReview.propTypes = {
  requisitionId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  poLink: PropTypes.object,
  canLink: PropTypes.bool,
  canUpload: PropTypes.bool,
  canImportRequisition: PropTypes.bool,
  onLinked: PropTypes.func,
  onOpen: PropTypes.func,
  onUploadOpenChange: PropTypes.func,
};
