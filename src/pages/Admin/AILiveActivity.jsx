import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Activity, Pause, Play, RefreshCw, Search, X, Users, AlertTriangle, Clock, Info, ExternalLink, ChevronLeft, ChevronRight, ChevronsUpDown, MoreHorizontal } from 'lucide-react';
import analyticsService from '../../services/analyticsService';
import './AILiveActivity.css';

const states = { processing: 'Processing', recent: 'Recently active', attention: 'Needs workflow check', quiet: 'No recent signal' };
const readable = value => value ? value.replaceAll('_', ' ').replaceAll(':', ' · ').replace(/\bai\b/gi, 'AI') : 'Not observed';
const time = value => value ? new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'No signal in 24 hours';
const clock = value => value ? new Date(value).toLocaleTimeString() : 'Not received';
const relative = value => {
  if (!value) return 'No recent signal';
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  return minutes < 1 ? 'a few seconds ago' : minutes < 60 ? `${minutes} min ago` : `${Math.floor(minutes / 60)} hours ago`;
};
function Status({ state = 'quiet' }) { return <span className={`al-state al-${state}`}><i />{states[state]}</span>; }
Status.propTypes = { state: PropTypes.string };
function Timeline({ items }) {
  return items?.length ? <ol className="al-timeline">{items.map(item => <li key={item.id}><time dateTime={item.timestamp}>{clock(item.timestamp)}</time><div><strong>{readable(item.action)}</strong><span>{readable(item.module)}</span><small>{item.source} · {readable(item.status)}</small></div></li>)}</ol> : <p className="al-empty">No observations in this reporting window.</p>;
}
Timeline.propTypes = { items: PropTypes.array };

export default function AILiveActivity() {
  const [data, setData] = useState(null);
  const [search, setSearch] = useState('');
  const [state, setState] = useState('');
  const [module, setModule] = useState('');
  const [ordering, setOrdering] = useState('signal');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [user, setUser] = useState('');
  const [detailTab, setDetailTab] = useState('overview');
  const [limit, setLimit] = useState(20);
  const [pendingSelection, setPendingSelection] = useState('');
  const [paused, setPaused] = useState(false);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setData(null); setError(''); }, [search, state, module, ordering, page, size]);
  useEffect(() => {
    let live = true, timer, controller, inFlight = false;
    const refresh = async () => {
      clearTimeout(timer);
      if (!live || inFlight || document.hidden) return;
      inFlight = true; controller = new AbortController(); setBusy(true);
      try {
        const result = await analyticsService.getAILiveActivity({ search, state, module, ordering, timeline_limit: limit, page, page_size: size, ...(user ? { user } : {}) }, { signal: controller.signal });
        if (live) { setData(result); setError(''); }
      } catch (err) {
        if (live && err.code !== 'ERR_CANCELED') setError('Live activity could not be updated. Displayed observations may be stale.');
      } finally {
        inFlight = false;
        if (live) { setBusy(false); if (!paused && !document.hidden) timer = setTimeout(refresh, 15000); }
      }
    };
    const visibility = () => { clearTimeout(timer); if (!document.hidden && !paused) refresh(); };
    timer = setTimeout(refresh, 250);
    document.addEventListener('visibilitychange', visibility);
    return () => { live = false; clearTimeout(timer); controller?.abort(); document.removeEventListener('visibilitychange', visibility); };
  }, [search, state, module, ordering, page, size, user, limit, paused, revision]);
  useEffect(() => {
    if (pendingSelection && data?.page === page && data.results.length) {
      setUser(String(pendingSelection === 'first' ? data.results[0].id : data.results.at(-1).id)); setPendingSelection('');
    }
  }, [data, page, pendingSelection]);
  const selectUser = id => { setUser(String(id)); setDetailTab('overview'); setLimit(20); };
  const filter = setter => event => { setter(event.target.value); setPage(1); setUser(''); setPendingSelection(''); };
  const reset = () => { setSearch(''); setState(''); setModule(''); setPage(1); setUser(''); setPendingSelection(''); };
  const rows = data?.results || [];
  const selected = data?.selected?.id === user ? data.selected : null;
  const current = selected ? { ...rows.find(row => row.id === user), ...selected } : null;
  const summary = data?.summary;
  const pages = Math.max(1, Math.ceil((data?.count || 0) / size));
  const currentPage = data?.page || page;
  const index = rows.findIndex(row => row.id === user);
  const position = (currentPage - 1) * size + index + 1;
  const changePage = next => { setPage(next); setUser(''); };
  const adjacent = direction => {
    if (rows[index + direction]) selectUser(rows[index + direction].id);
    else { setPendingSelection(direction > 0 ? 'first' : 'last'); setPage(currentPage + direction); setUser(''); }
  };
  const sort = key => { setOrdering(previous => previous === key ? `-${key}` : key); setPage(1); setUser(''); };
  const pageNumbers = Array.from(new Set([1, ...Array.from({ length: 5 }, (_, i) => currentPage - 2 + i).filter(n => n > 1 && n < pages), pages])).sort((a, b) => a - b);
  const measurementHelp = () => document.querySelector('.ad-knowledge-trigger')?.click();
  return <section className={`al-workspace al-live ${user || pendingSelection ? 'al-with-detail' : ''}`} aria-label="Live user activity">
    <div className="al-main">
      <header className="al-heading"><div className="al-title"><Activity /><div><h2>Live user activity</h2><p>Latest recorded user signals · Rolling 24 hours</p></div></div><div className="al-controls"><span className={`al-live-indicator ${paused || error ? 'al-muted' : ''}`} role="status"><i />{error ? 'Update failed' : paused ? 'Paused' : 'Live'}</span><span className="al-cadence">Refreshes every 15 seconds</span><button onClick={() => setPaused(v => !v)} aria-label={paused ? 'Resume live updates' : 'Pause live updates'} aria-pressed={paused}>{paused ? <Play /> : <Pause />}{paused ? 'Resume updates' : 'Pause updates'}</button><button disabled={busy} onClick={() => setRevision(v => v + 1)} aria-label="Refresh live activity"><RefreshCw className={busy ? 'al-spinning' : ''} /></button></div></header>
      <div className="al-notice"><Info /><span>Recent activity means a signal received within five minutes. It does not confirm online presence or productivity. <button onClick={measurementHelp}>How activity is measured <ExternalLink /></button></span></div>
      <div className="al-summary">{[{ icon: Users, value: summary?.total, label: 'Users monitored', target: '', tone: 'blue' }, { icon: Activity, value: summary?.recent, label: 'Recently active', target: 'recent', tone: 'green' }, { icon: RefreshCw, value: summary?.processing, label: 'Processing', target: 'processing', tone: 'blue' }, { icon: AlertTriangle, value: summary?.attention, label: 'Needs workflow check', target: 'attention', tone: 'amber' }].map(({icon: Icon, value, label, target, tone}) => <button key={label} className={`al-metric al-tone-${tone}`} onClick={() => { setState(target); setPage(1); setUser(''); }} aria-pressed={state === target}><Icon /><span><strong>{value ?? '—'}</strong><small>{label}</small></span></button>)}<span className="al-received"><Clock />Last received {clock(data?.generated_at)}</span></div>
      <div className="al-filters"><label><Search /><input aria-label="Search live users" placeholder="Search by user name or email" value={search} onChange={filter(setSearch)} /></label><select aria-label="Live activity state" value={state} onChange={filter(setState)}><option value="">All activity states</option>{Object.entries(states).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select><select aria-label="Live activity module" value={module} onChange={filter(setModule)}><option value="">All modules</option>{Array.from(new Set([...(data?.modules || []), ...(module ? [module] : [])])).map(value => <option key={value} value={value}>{readable(value)}</option>)}</select><button disabled={!search && !state && !module} onClick={reset} aria-label="Clear activity filters">Reset filters</button></div>
      <p className="al-result-count">{data ? `${data.count} results` : 'Loading user activity…'}{module && ' · Signals for selected module'}</p>
      {error && <p className="al-error" role="alert">{error}</p>}
      <div className="al-table-scroll"><table aria-label="Live user directory" aria-busy={busy}><thead><tr><th className="al-select-column"><span className="sr-only">Select user</span></th><th aria-sort={ordering === 'user' ? 'ascending' : ordering === '-user' ? 'descending' : 'none'}><button onClick={() => sort('user')}>User <ChevronsUpDown /></button></th><th aria-sort={ordering === 'state' ? 'ascending' : ordering === '-state' ? 'descending' : 'none'}><button onClick={() => sort('state')}>Status <ChevronsUpDown /></button></th><th>Latest activity <Info aria-label="Latest recorded module and action" /></th><th aria-sort={ordering === 'latest' ? 'descending' : ordering === '-latest' ? 'ascending' : 'none'}><button onClick={() => sort('latest')}>Last signal <ChevronsUpDown /></button></th><th>AI requests (24h) <Info aria-label="Server AI calls; submitted activity events are counted separately" /></th><th>Actions</th></tr></thead><tbody>{rows.map(row => <tr key={row.id} className={user === row.id ? 'al-selected' : ''} onClick={() => selectUser(row.id)}><td><input type="checkbox" aria-label={`Select ${row.name}`} checked={user === row.id} onClick={event => event.stopPropagation()} onChange={() => user === row.id ? setUser('') : selectUser(row.id)} /></td><td><button className="al-user-name" onClick={event => { event.stopPropagation(); selectUser(row.id); }}>{row.name}</button><small>{row.email}{!row.account_enabled && ' · Account disabled'}</small></td><td><Status state={row.state} /></td><td><strong>{readable(row.module)}</strong><small>{row.module ? `${readable(row.action)} · ${row.source}` : 'Not observed'}</small></td><td><strong>{time(row.last_signal_at)}</strong>{row.last_signal_at && <small>{relative(row.last_signal_at)}</small>}</td><td><strong>{row.ai_calls_24h} calls</strong><small>{row.failed_ai_calls_24h} failed · {row.events_24h} events</small></td><td><button className="al-row-action" onClick={event => { event.stopPropagation(); selectUser(row.id); }} aria-label={`Activity details for ${row.name}`}><MoreHorizontal /></button></td></tr>)}{!rows.length && <tr><td colSpan="7" className="al-empty">{data ? 'No users match these filters.' : error ? 'Activity unavailable. Retry using refresh.' : 'Loading user activity…'}</td></tr>}</tbody></table></div>
      <footer className="al-pagination"><span>Showing {data?.count ? (currentPage - 1) * size + 1 : 0}–{Math.min(currentPage * size, data?.count || 0)} of {data?.count ?? '—'} users</span><select aria-label="Live users per page" value={size} onChange={filter(value => setSize(Number(value)))}>{[10, 25, 50].map(n => <option key={n} value={n}>{n} per page</option>)}</select><nav aria-label="Live users pages"><button disabled={currentPage <= 1 || !data} onClick={() => changePage(currentPage - 1)} aria-label="Previous users"><ChevronLeft /></button>{pageNumbers.map((n, i) => <React.Fragment key={n}>{i > 0 && n > pageNumbers[i - 1] + 1 && <span>…</span>}<button aria-label={`Users page ${n}`} aria-current={currentPage === n ? 'page' : undefined} onClick={() => changePage(n)}>{n}</button></React.Fragment>)}<button disabled={currentPage >= pages || !data} onClick={() => changePage(currentPage + 1)} aria-label="Next users"><ChevronRight /></button></nav></footer>
    </div>
    {(user || pendingSelection) && <aside className="al-detail" aria-label="User activity timeline"><header><h3>User activity details</h3><div><button disabled={!current || position <= 1 || index < 0} onClick={() => adjacent(-1)} aria-label="Previous user details"><ChevronLeft /></button><span>{current && index >= 0 ? `${position} of ${data.count}` : 'Loading…'}</span><button disabled={!current || position >= data.count || index < 0} onClick={() => adjacent(1)} aria-label="Next user details"><ChevronRight /></button><button aria-label="Close user activity" onClick={() => { setUser(''); setPendingSelection(''); }}><X /></button></div></header>
      {current ? <><div className="al-person"><div><h3>{current.name}</h3><p>{current.email}</p></div><Status state={current.state} /><p className="al-person-signal"><Clock />Last signal {relative(current.last_signal_at)}</p></div><nav className="al-detail-tabs" aria-label="User activity detail views">{[['overview', 'Overview'], ['activity', 'Activity log'], ['requests', 'AI requests']].map(([key, label]) => <button key={key} aria-current={detailTab === key ? 'page' : undefined} onClick={() => setDetailTab(key)}>{label}</button>)}</nav><div className="al-detail-body">
        {detailTab === 'overview' ? <><section><h4>Current signal</h4><dl><dt>Status</dt><dd><Status state={current.state} /></dd><dt>Received</dt><dd>{time(current.last_signal_at)}</dd><dt>Source</dt><dd>{current.source || 'Not observed'}</dd></dl></section><section><h4>Latest activity</h4><dl><dt>Module</dt><dd>{readable(current.module)}</dd><dt>Action</dt><dd>{readable(current.action)}</dd><dt>Observation</dt><dd>{current.source || 'Not observed'}</dd></dl></section><section><h4>24-hour summary</h4><dl><dt>AI calls</dt><dd>{current.ai_calls_24h ?? 'Not reported'}</dd><dt>Failed</dt><dd>{current.failed_ai_calls_24h ?? 'Not reported'}</dd><dt>Activity events</dt><dd>{current.events_24h ?? 'Not reported'}</dd><dt>Outstanding workflow checks</dt><dd>{current.workflow_checks ?? 'Not reported'}</dd></dl></section><section><h4>Recent timeline</h4><Timeline items={current.timeline?.slice(0, 3)} /></section></> : <section><h4>{detailTab === 'activity' ? 'Activity log' : 'AI requests'}</h4><p className="al-limit">Latest {current.limit} {detailTab === 'activity' ? 'submitted events' : 'server AI requests'} · rolling 24 hours{module && ` · ${readable(module)}`}</p><Timeline items={detailTab === 'activity' ? current.activity_log || current.timeline?.filter(item => item.source === 'Submitted activity') : current.ai_requests || current.timeline?.filter(item => item.source === 'Server AI request')} /></section>}
      </div><div className="al-detail-footer"><p><Info />Activity signals indicate recorded application events and do not confirm online presence or productivity.</p><div><button onClick={() => { setLimit(100); setDetailTab('activity'); }}>View activity history</button>{current.profile_id ? <a href={`/admin/users/${current.profile_id}`} className="al-primary">Open user profile</a> : <button disabled>Profile unavailable</button>}</div></div></> : <p className="al-empty" role="status">{error ? 'Could not load user details. Refresh to retry.' : 'Loading user details…'}</p>}
    </aside>}
  </section>;
}
