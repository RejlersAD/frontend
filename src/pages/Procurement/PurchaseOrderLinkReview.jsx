import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import apiClient from '../../services/api.service';

const failureMessage = error => error.response?.data?.error || error.response?.data?.detail || error.message || 'The purchase order could not be linked.';

export default function PurchaseOrderLinkReview({ requisitionId, poLink, canLink = true, onLinked, onOpen }) {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(null);
  const current = saved || poLink;
  const needsLink = Boolean(current?.manual_link_required);

  useEffect(() => { setSaved(null); setSelectedId(''); }, [requisitionId]);
  useEffect(() => {
    if (!needsLink || !canLink) return undefined;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    apiClient.get('/procurement/orders/', { params: { search: query, page_size: 100 }, signal: controller.signal })
      .then(response => {
        if (controller.signal.aborted) return;
        const rows = Array.isArray(response.data) ? response.data : response.data?.results;
        if (!Array.isArray(rows)) throw new Error('Purchase orders could not be loaded.');
        setOptions(rows);
      })
      .catch(problem => { if (!controller.signal.aborted) setError(failureMessage(problem)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [needsLink, canLink, query, requisitionId]);

  const link = async () => {
    if (!selectedId || !requisitionId || saving) return;
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

  if (['linked', 'already_linked'].includes(current?.status)) return <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900"><span>Linked purchase order: <strong>{current.po_number}</strong></span><Link to={`/procurement/orders/${current.po_id}`} onClick={onOpen} className="rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-semibold text-blue-700">Open purchase order</Link></div>;
  if (!needsLink) return null;
  const runSearch = () => { setSelectedId(''); setQuery(search.trim()); };
  return <section aria-label="Link an existing purchase order" className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
    <h3 className="text-sm font-semibold text-amber-900">Link an existing purchase order</h3>
    <p className="text-sm text-amber-900">{current.message || 'No matching purchase order was found. Select the corresponding order.'}</p>
    {canLink ? <>
      <div className="flex gap-2"><label className="min-w-0 flex-1 text-xs font-semibold text-gray-700">Search purchase orders<input value={search} onChange={event => setSearch(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); runSearch(); } }} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" /></label><button type="button" onClick={runSearch} disabled={loading || saving} className="self-end rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-semibold text-blue-700">Search</button></div>
      <label className="block text-xs font-semibold text-gray-700">Purchase order<select aria-label="Purchase order" value={selectedId} onChange={event => setSelectedId(event.target.value)} disabled={loading || saving} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"><option value="">{loading ? 'Loading purchase orders...' : 'Select purchase order'}</option>{options.map(order => <option key={order.id} value={order.id}>{order.po_number}{order.vendor_name || order.supplier_name ? ` - ${order.vendor_name || order.supplier_name}` : ''}</option>)}</select></label>
      {!loading && !options.length && !error && <p className="text-xs text-amber-900">No purchase orders found. Search another PO number.</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button type="button" onClick={link} disabled={!selectedId || saving || loading} className="h-9 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white disabled:opacity-50">{saving ? 'Linking...' : 'Link purchase order'}</button>
    </> : <p className="text-sm text-amber-900">A user with Purchase Orders access must link this recommendation.</p>}
  </section>;
}

PurchaseOrderLinkReview.propTypes = {
  requisitionId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  poLink: PropTypes.object,
  canLink: PropTypes.bool,
  onLinked: PropTypes.func,
  onOpen: PropTypes.func,
};
