import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import './PurchaseOrderHandoff.css';

export function handoffError(error) {
  if (error?.response?.status === 403) return 'You do not have access to these purchase orders.';
  if (error?.response?.status === 409) return 'This record changed. Refresh its details before trying again.';
  const data = error?.response?.data;
  const messages = value => typeof value === 'string' ? value : Array.isArray(value) ? value.map(messages).join(' ') : value && typeof value === 'object' ? Object.values(value).map(messages).join(' ') : '';
  return messages(data) || error?.message || 'Purchase orders could not be loaded.';
}

export function usePurchaseOrderPage(fetchPage, search, page, refreshKey, filtersKey = '') {
  const [state, setState] = useState({ loading: true, error: '', rows: [], count: 0 });
  useEffect(() => {
    let active = true;
    setState({ loading: true, error: '', rows: [], count: 0 });
    const timer = setTimeout(async () => {
      try {
        const data = await fetchPage({ search, page, page_size: 20, ...JSON.parse(filtersKey || '{}') });
        if (!Array.isArray(data?.results) || !Number.isInteger(data.count)) throw new Error('Purchase orders could not be loaded.');
        if (active) setState({ loading: false, error: '', rows: data.results, count: data.count });
      } catch (error) { if (active) setState({ loading: false, error: handoffError(error), rows: [], count: 0 }); }
    }, search ? 250 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [fetchPage, search, page, refreshKey, filtersKey]);
  return state;
}

function Pagination({ page, count, loading, onPage }) {
  return <div className="po-handoff-pagination"><button type="button" disabled={loading || page <= 1} onClick={() => onPage(page - 1)}>Previous PO page</button><span>Page {page} of {Math.max(1, Math.ceil(count / 20))}</span><button type="button" disabled={loading || page * 20 >= count} onClick={() => onPage(page + 1)}>Next PO page</button></div>;
}
Pagination.propTypes = { page: PropTypes.number, count: PropTypes.number, loading: PropTypes.bool, onPage: PropTypes.func };

export function PurchaseOrderSelector({ fetchPage, value, onChange, disabled = false, filters = {}, label = 'Select purchase order', initialOrder = null }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState(initialOrder);
  const filterKey = JSON.stringify(filters);
  useEffect(() => { setPage(1); }, [fetchPage, filterKey]);
  const { rows, count, loading, error } = usePurchaseOrderPage(fetchPage, search, page, retry, filterKey);
  const current = selected && String(selected.id) === String(value) ? selected : initialOrder && String(initialOrder.id) === String(value) ? initialOrder : null;
  const options = current && !rows.some(row => String(row.id) === String(current.id)) ? [current, ...rows] : rows;
  return <div className="po-handoff-selector" aria-busy={loading}>
    <label>Search purchase orders<input type="search" value={search} disabled={disabled} onChange={event => { setSearch(event.target.value); setPage(1); }} /></label>
    <label>{label}<select value={value || ''} disabled={disabled || loading || !!error} onChange={event => { const order = options.find(row => String(row.id) === event.target.value) || null; setSelected(order); onChange(order); }}><option value="">Choose a purchase order</option>{options.map(order => <option key={order.id} value={order.id} disabled={!!order.allocation_issue || order.remaining_amount === null || /^0+(?:\.0+)?$/.test(String(order.remaining_amount))}>{order.po_number} · {order.vendor_name}</option>)}</select></label>
    {loading && <p role="status">Loading purchase orders…</p>}
    {error && <p role="alert">{error} <button type="button" disabled={disabled} onClick={() => setRetry(value => value + 1)}>Retry purchase orders</button></p>}
    {!loading && !error && !rows.length && <p>No eligible purchase orders {search ? 'match this search.' : 'are available.'}</p>}
    <Pagination page={page} count={count} loading={loading || disabled} onPage={setPage} />
  </div>;
}
PurchaseOrderSelector.propTypes = { fetchPage: PropTypes.func.isRequired, value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), onChange: PropTypes.func.isRequired, disabled: PropTypes.bool, filters: PropTypes.object, label: PropTypes.string, initialOrder: PropTypes.object };

export default function PurchaseOrderHandoff({ title, fetchPage, onSelect, actionLabel, kind = 'receipt', reloadKey = 0 }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  useEffect(() => { setPage(1); }, [reloadKey, fetchPage, retry]);
  const { rows, count, loading, error } = usePurchaseOrderPage(fetchPage, search, page, `${reloadKey}:${retry}`);
  return <section className="po-handoff" aria-label={title} aria-busy={loading}>
    <header><h2>{title}</h2><button type="button" onClick={() => setRetry(value => value + 1)} disabled={loading}>Refresh purchase orders</button></header>
    <label className="po-handoff-search">Search purchase orders<input type="search" placeholder="PO number, supplier or description" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></label>
    {loading ? <p role="status">Loading purchase orders…</p> : error ? <p role="alert">{error}<button type="button" onClick={() => setRetry(value => value + 1)}>Try again</button></p> : !rows.length ? <p>{search ? 'No purchase orders match this search.' : kind === 'reconciliation' ? 'No completed purchase orders need receipt reconciliation.' : kind === 'invoice' ? 'No purchase orders are awaiting a supplier invoice.' : 'No purchase orders are awaiting receipt or service acceptance.'}</p> :
      <div className="po-handoff-table"><table><thead><tr><th>Purchase order</th><th>Supplier</th><th>Status</th><th>{kind === 'invoice' ? 'Unallocated value' : 'Remaining receipt'}</th><th>Action</th></tr></thead><tbody>{rows.map(order => {
        const allowed = kind === 'invoice' ? order.can_import_invoice === true : kind === 'reconciliation' ? order.receiving?.can_reconcile === true : order.receiving?.can_record === true;
        return <tr key={order.id}><td><a href={`/procurement/orders/${encodeURIComponent(order.id)}`}>{order.po_number}</a><small>{order.title}</small></td><td>{order.vendor_name || 'Not recorded'}</td><td>{String(order.status || '').replaceAll('_', ' ')}{kind !== 'invoice' && <small>Receipt: {{ none: 'Not received', pending: 'Awaiting inspection', partial: 'Partially received', complete: 'Fully received', blocked: 'Needs review' }[order.receiving?.status] || 'Not assessed'}</small>}</td><td>{kind === 'invoice' ? order.remaining_amount === null ? 'Needs review' : `${order.currency} ${order.remaining_amount}` : (order.receiving?.lines || []).map(line => <div key={line.line_id}>{line.description}: {line.remaining} {order.receiving.basis === 'service_value' ? order.currency : line.uom}</div>)}{order.allocation_issue && <small>{order.allocation_issue}</small>}{order.receiving?.blocked_reason && <small>{order.receiving.blocked_reason}</small>}</td><td><button type="button" disabled={!allowed} onClick={() => onSelect(order)}>{actionLabel}</button>{!allowed && !order.receiving?.blocked_reason && <small>Action unavailable</small>}</td></tr>;
      })}</tbody></table></div>}
    <Pagination page={page} count={count} loading={loading} onPage={setPage} />
  </section>;
}
PurchaseOrderHandoff.propTypes = { title: PropTypes.string.isRequired, fetchPage: PropTypes.func.isRequired, onSelect: PropTypes.func.isRequired, actionLabel: PropTypes.string.isRequired, kind: PropTypes.string, reloadKey: PropTypes.number };
