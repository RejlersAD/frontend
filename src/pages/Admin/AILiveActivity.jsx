import React, { useEffect, useState } from 'react';
import { Activity, Pause, Play, RefreshCw, Search, X } from 'lucide-react';
import analyticsService from '../../services/analyticsService';
import './AIAdoptionHelp.css';

const states = { processing: 'AI processing', recent: 'Recent activity', attention: 'Check workflow', quiet: 'No recent signal' };
const readable = value => (value || 'Not observed').replaceAll('_', ' ').replaceAll(':', ' · ');
const time = value => value ? new Date(value).toLocaleString() : 'Not observed in 24 hours';

export default function AILiveActivity() {
  const [data, setData] = useState(null);
  const [search, setSearch] = useState('');
  const [state, setState] = useState('');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [user, setUser] = useState('');
  const [paused, setPaused] = useState(false);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setData(null); setError(''); }, [search, state, page, size, user]);
  useEffect(() => {
    let live = true, timer, controller, inFlight = false;
    const refresh = async () => {
      clearTimeout(timer);
      if (!live || inFlight) return;
      if (document.hidden) return;
      inFlight = true; controller = new AbortController(); setBusy(true);
      try {
        const result = await analyticsService.getAILiveActivity({ search, state, page, page_size: size, ...(user ? { user } : {}) }, { signal: controller.signal });
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
  }, [search, state, page, size, user, paused, revision]);
  const filter = setter => event => { setter(event.target.value); setPage(1); setUser(''); };
  return <section className="ad-panel al-live" aria-label="Live user activity">
    <div className="ad-panel-heading"><div><h2><Activity /> Live user activity</h2><p>Latest recorded signals for each user · rolling 24 hours · separate from the report period above</p></div><div className="al-controls"><span role="status">{error ? 'Update failed' : paused ? 'Auto-refresh paused' : busy ? 'Updating…' : 'Auto-refresh · 15 seconds'}</span><button onClick={() => setPaused(v => !v)} aria-pressed={paused}>{paused ? <Play /> : <Pause />}{paused ? 'Resume live updates' : 'Pause live updates'}</button><button disabled={busy} onClick={() => setRevision(v => v + 1)} aria-label="Refresh live activity"><RefreshCw /></button></div></div>
    <p className="ad-footnote">Recent activity means a signal within five minutes; it does not confirm online presence or productivity. AI processing describes a server job. Jobs running over six hours need checking.</p>
    <div className="al-filters"><label><Search /><input aria-label="Search live users" placeholder="Search user name or email" value={search} onChange={filter(setSearch)} /></label><select aria-label="Live activity state" value={state} onChange={filter(setState)}><option value="">All activity states</option>{Object.entries(states).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select><button onClick={() => { setSearch(''); setState(''); setPage(1); setUser(''); }}>Clear activity filters</button></div>
    {error && <p className="al-error" role="alert">{error}</p>}
    {!data && !error && <p className="ad-footnote" role="status">Loading user activity…</p>}
    {data && <><div className="al-summary"><span>{data.scope} · {data.summary.total} users matching search</span><span>{data.summary.processing} processing · {data.summary.recent} recently active · {data.summary.attention} need a workflow check</span><span>Last received: {time(data.generated_at)}</span></div>
      <div className={`al-layout ${data.selected ? 'al-has-detail' : ''}`}><div className="al-directory"><div className="ad-table-scroll"><table><thead><tr><th>User</th><th>Observed state</th><th>Latest module / action</th><th>Last signal</th><th>AI calls / failed (24h)</th><th>Details</th></tr></thead><tbody>{data.results.map(row => <tr key={row.id} className={user === row.id ? 'ad-selected-row' : ''}><td><button className="ad-row-link" onClick={() => setUser(row.id)}>{row.name}</button><small>{row.email}{!row.account_enabled && ' · Account disabled'}</small></td><td><span className={`al-state al-${row.state}`}>{states[row.state]}</span></td><td>{readable(row.module)}<small>{readable(row.action)} · {row.source}</small></td><td>{time(row.last_signal_at)}</td><td>{row.ai_calls_24h} / {row.failed_ai_calls_24h}<small>{row.events_24h} submitted activity events</small></td><td><button onClick={() => setUser(row.id)} aria-label={`Activity details for ${row.name}`}>View activity</button></td></tr>)}{!data.results.length && <tr><td colSpan="6">No users match these filters.</td></tr>}</tbody></table></div>
      <div className="al-pagination"><span>{data.count ? (data.page - 1) * data.page_size + 1 : 0}–{Math.min(data.page * data.page_size, data.count)} of {data.count} users</span><button disabled={data.page <= 1} onClick={() => setPage(data.page - 1)}>Previous users</button><span>Page {data.page}</span><button disabled={data.page * data.page_size >= data.count} onClick={() => setPage(data.page + 1)}>Next users</button><label>Rows<select aria-label="Live users per page" value={size} onChange={filter(e => setSize(Number(e)))}>{[10, 25, 50].map(n => <option key={n}>{n}</option>)}</select></label></div></div>
      {data.selected && <aside className="al-detail" aria-label="User activity timeline"><header><div><h3>{data.selected.name}</h3><p>{data.selected.email}</p></div><button aria-label="Close user activity" onClick={() => setUser('')}><X /></button></header><p>Latest {data.selected.limit} observations within 24 hours, plus outstanding workflows. Submitted actions and server signals are labeled separately.</p><ol>{data.selected.timeline.map(item => <li key={item.id}><strong>{readable(item.module)} · {readable(item.action)}</strong><span>{item.source} · {readable(item.status)}</span><time dateTime={item.timestamp}>{time(item.timestamp)}</time></li>)}</ol>{!data.selected.timeline.length && <p>No observations for this user in the reporting window.</p>}</aside>}</div></>}
  </section>;
}
