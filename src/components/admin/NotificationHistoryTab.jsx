import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Bell, RefreshCw, Search, X } from 'lucide-react';
import analyticsService from '../../services/analyticsService';
import './NotificationHistoryTab.css';

const CHANNELS = [['notification', 'Notification'], ['email', 'Email'], ['teams', 'Teams'], ['web_push', 'Web push'], ['other', 'Other']];
const OUTCOMES = [['recorded', 'Recorded'], ['sent', 'Send recorded'], ['read', 'Marked read'], ['archived', 'Archived'], ['failed', 'Failed'], ['skipped', 'Skipped'], ['unknown', 'Unknown']];
const DELIVERY_STATUSES = ['sent', 'failed', 'skipped', 'not_applicable', 'unknown'];
const READ_STATUSES = { read: 'Marked read', unread: 'Unread' };
const text = value => typeof value === 'string' || typeof value === 'number' ? String(value) : '';
const channelLabel = value => CHANNELS.find(([key]) => key === value)?.[1] || 'Other';
const outcomeLabel = row => row.outcome_label || OUTCOMES.find(([key]) => key === row.outcome)?.[1] || 'Unknown';
const deliveryLabel = row => DELIVERY_STATUSES.includes(row.delivery_status) ? row.delivery_status_label || 'Unknown' : 'Unknown';
const readLabel = row => Object.hasOwn(READ_STATUSES, row.read_status) ? READ_STATUSES[row.read_status] : 'Unknown';
const timestamp = (value, timezone) => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return 'Not recorded';
  try { return date.toLocaleString('en-GB', { timeZone: timezone || 'UTC', dateStyle: 'medium', timeStyle: 'medium' }); }
  catch { return date.toISOString(); }
};

// Keep the details view limited to the public history projection.
function historyRow(row) {
  return {
    id: text(row.id), timestamp: text(row.timestamp), notification_id: text(row.notification_id),
    recipient: { id: text(row.recipient?.id), name: text(row.recipient?.name), email: text(row.recipient?.email), username: text(row.recipient?.username) },
    category: text(row.category), action: text(row.action), event_label: text(row.event_label),
    channel: text(row.channel), outcome: text(row.outcome), outcome_label: text(row.outcome_label), reason_label: text(row.reason_label),
    delivery_status: text(row.delivery_status), delivery_status_label: text(row.delivery_status_label),
    read_status: text(row.read_status),
  };
}

export default function NotificationHistoryTab({ hours = 24, refreshToken }) {
  const [filters, setFilters] = useState({ search: '', channel: '', outcome: '', page_size: 25, page: 1, hours });
  const [search, setSearch] = useState('');
  const [retry, setRetry] = useState(0);
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const requestId = useRef(0);
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);
  const page = filters.hours === hours ? filters.page : 1;
  const { channel, outcome, page_size: pageSize, search: appliedSearch } = filters;
  const queryKey = JSON.stringify([hours, page, pageSize, appliedSearch, channel, outcome]);
  const current = snapshot?.key === queryKey ? snapshot : null;
  const detail = selected?.key === queryKey ? selected.row : null;
  const hasFilters = Boolean(appliedSearch || channel || outcome);
  const changeFilters = change => setFilters(previous => ({ ...previous, ...change, hours, page: change.page ?? 1 }));
  const clearFilters = () => { setSearch(''); changeFilters({ search: '', channel: '', outcome: '' }); };

  useEffect(() => {
    const sequence = ++requestId.current;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    analyticsService.getNotificationHistory({ hours, page, page_size: pageSize, ...(appliedSearch ? { search: appliedSearch } : {}), ...(channel ? { channel } : {}), ...(outcome ? { outcome } : {}) }, { signal: controller.signal })
      .then(response => {
        if (controller.signal.aborted || sequence !== requestId.current) return;
        if (!Array.isArray(response?.results) || !Number.isInteger(response.count) || response.count < 0) throw new Error('Invalid history response');
        if (page > 1 && !response.results.length) { setFilters(previous => ({ ...previous, hours, page: 1 })); return; }
        const rows = response.results.map(historyRow);
        setSnapshot({ key: queryKey, rows, count: response.count, timezone: text(response.timezone) || 'UTC' });
        setSelected(previous => {
          const row = previous?.key === queryKey ? rows.find(item => item.id === previous.row.id) : null;
          return row ? { key: queryKey, row } : null;
        });
      })
      .catch(failure => {
        if (controller.signal.aborted || sequence !== requestId.current) return;
        if (failure?.response?.status === 404 && page > 1) { setFilters(previous => ({ ...previous, hours, page: 1 })); return; }
        if ([401, 403].includes(failure?.response?.status)) {
          setSnapshot(null);
          setSelected(null);
          setError('denied');
        } else setError('failed');
      })
      .finally(() => { if (!controller.signal.aborted && sequence === requestId.current) setLoading(false); });
    return () => controller.abort();
  }, [hours, page, pageSize, appliedSearch, channel, outcome, queryKey, refreshToken, retry]);

  useEffect(() => {
    if (detail) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [detail]);

  return <section className="ac-notification-history ac-panel" aria-labelledby="notification-history-title">
    <div className="ac-panel-heading"><h2 id="notification-history-title"><Bell size={18} />Notification Logs History</h2>{current && <span>Times: {current.timezone}</span>}</div>
    <form className="ac-notification-filters" onSubmit={event => { event.preventDefault(); changeFilters({ search: search.trim() }); }}>
      <label className="ac-notification-search"><span>Recipient or notification ID</span><div><Search size={16} aria-hidden="true" /><input aria-label="Recipient or notification ID" type="search" value={search} maxLength={200} onChange={event => setSearch(event.target.value)} placeholder="Search history" /><button type="submit">Search</button></div></label>
      <label><span>Channel</span><select aria-label="Channel" value={channel} onChange={event => changeFilters({ channel: event.target.value })}><option value="">All channels</option>{CHANNELS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label><span>Outcome</span><select aria-label="Outcome" value={outcome} onChange={event => changeFilters({ outcome: event.target.value })}><option value="">All outcomes</option>{OUTCOMES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <button type="button" className="ac-notification-clear" onClick={clearFilters} disabled={!hasFilters && !search}>Clear filters</button>
    </form>
    {error && <div role="alert" className="ac-notification-error"><AlertCircle size={18} /><p>{error === 'denied' ? 'You do not have access to notification history.' : current ? 'History could not be refreshed. Previous results are shown.' : 'Notification history could not be loaded.'}</p><button type="button" disabled={loading} onClick={() => setRetry(value => value + 1)}><RefreshCw size={14} />Retry</button></div>}
    {loading && <p role="status" className="ac-notification-loading">{current ? 'Refreshing notification history…' : 'Loading notification history…'}</p>}
    {current && <>
      {current.rows.length ? <div className="ac-table-scroll" role="region" aria-label="Notification history results" tabIndex={0}><table>
        <thead><tr>{['Time', 'Recipient', 'Notification ID', 'Category', 'Channel', 'Delivery Status', 'Read Status', 'Outcome', 'Details'].map(title => <th key={title} scope="col">{title}</th>)}</tr></thead>
        <tbody>{current.rows.map(row => <tr key={row.id}>
          <td className="ac-notification-time"><time dateTime={row.timestamp}>{timestamp(row.timestamp, current.timezone)}</time></td>
          <td><strong>{row.recipient.name || row.recipient.username || 'Not recorded'}</strong><small>{row.recipient.email || row.recipient.username}</small></td>
          <td>{row.notification_id || 'Not recorded'}</td><td>{row.category.replaceAll('_', ' ') || 'Not recorded'}</td><td>{channelLabel(row.channel)}</td>
          <td><span className={`ac-notification-outcome ${DELIVERY_STATUSES.includes(row.delivery_status) ? row.delivery_status : 'unknown'}`}>{deliveryLabel(row)}</span></td>
          <td><span className={`ac-notification-outcome ${Object.hasOwn(READ_STATUSES, row.read_status) ? row.read_status : 'unknown'}`}>{readLabel(row)}</span></td>
          <td><span className={`ac-notification-outcome ${OUTCOMES.some(([key]) => key === row.outcome) ? row.outcome : 'unknown'}`}>{outcomeLabel(row)}</span></td>
          <td><button type="button" className="ac-text-button" aria-label={`View event ${row.id}`} onClick={event => { triggerRef.current = event.currentTarget; setSelected({ key: queryKey, row }); }}>View</button></td>
        </tr>)}</tbody>
      </table></div> : <div className="ac-notification-empty"><Bell size={28} /><p>{hasFilters ? 'No notification events match these filters.' : 'No notification events recorded in this period.'}</p>{hasFilters && <button type="button" onClick={clearFilters}>Clear filters</button>}</div>}
      <nav className="ac-notification-pagination" aria-label="Notification history pagination">
        <p aria-live="polite">{current.count ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, current.count)} of ${current.count} events` : '0 events'}</p>
        <label>Rows per page<select aria-label="Rows per page" value={pageSize} onChange={event => changeFilters({ page_size: Number(event.target.value) })}>{[25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}</select></label>
        <div><button type="button" disabled={loading || page <= 1} onClick={() => changeFilters({ page: page - 1 })}>Previous</button><span>Page {page} of {Math.max(1, Math.ceil(current.count / pageSize))}</span><button type="button" disabled={loading || page * pageSize >= current.count} onClick={() => changeFilters({ page: page + 1 })}>Next</button></div>
      </nav>
    </>}
    <dialog ref={dialogRef} className="ac-notification-dialog" aria-labelledby="notification-event-title" onClose={() => { setSelected(null); triggerRef.current?.focus(); }} onClick={event => { if (event.target === event.currentTarget) dialogRef.current.close(); }}>
      {detail && <><div className="ac-panel-heading"><h2 id="notification-event-title">Notification event details</h2><button type="button" aria-label="Close notification event details" autoFocus onClick={() => dialogRef.current.close()}><X size={18} /></button></div>
        <dl>{[
          ['Event ID', detail.id], ['Time', timestamp(detail.timestamp, current?.timezone)], ['Timezone', current?.timezone],
          ['Recipient', detail.recipient.name || detail.recipient.username], ['Email', detail.recipient.email],
          ['Notification ID', detail.notification_id], ['Category', detail.category.replaceAll('_', ' ')],
          ['Event', detail.event_label], ['Channel', channelLabel(detail.channel)], ['Outcome', outcomeLabel(detail)],
          ['Delivery Status', deliveryLabel(detail)], ['Read Status', readLabel(detail)],
          ...(detail.reason_label ? [['Reason', detail.reason_label]] : []),
        ].map(([label, value]) => <React.Fragment key={label}><dt>{label}</dt><dd>{value || 'Not recorded'}</dd></React.Fragment>)}</dl>
      </>}
    </dialog>
  </section>;
}
