import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Search, ChevronLeft, ChevronRight, X, FileText, ShieldCheck, Info, ExternalLink } from 'lucide-react';

const fmt = value => value == null ? 'Not reported' : new Intl.NumberFormat().format(value);
const usd = value => value == null ? 'Not reported' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 4 }).format(value);
const label = value => String(value || 'Unspecified').replaceAll('_', ' ').replaceAll('-', ' ');
const date = value => value ? new Date(value).toLocaleString('en-GB', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' }) : 'Not recorded';

export function groupContributions(records = [], module = 'all', model = 'all', status = 'all') {
  const grouped = new Map();
  for (const row of records) {
    if (module !== 'all' && row.application !== module) continue;
    if (model !== 'all' && `${row.provider}/${row.model_name}` !== model) continue;
    if (status === 'missing' && row.pricing_configured) continue;
    if (status === 'configured' && !row.pricing_configured) continue;
    const key = JSON.stringify([row.user_id, row.application]);
    if (!grouped.has(key)) grouped.set(key, { key, user: row.user, application: row.application,
      requests: 0, successful: 0, tokens: 0, cost: 0, missingPricing: false, models: [], evidence: [], last_activity: null });
    const item = grouped.get(key);
    item.requests += row.requests; item.successful += row.successful; item.tokens += row.tokens || 0;
    item.cost += row.recorded_cost_usd || 0; item.missingPricing ||= !row.pricing_configured;
    item.models.push({ name: `${row.provider}/${row.model_name}`, requests: row.requests });
    item.evidence.push(...(row.evidence || []).map(e => ({ ...e, model: row.model_name })));
    if (!item.last_activity || row.last_activity > item.last_activity) item.last_activity = row.last_activity;
  }
  return [...grouped.values()].sort((a, b) => Number(b.missingPricing) - Number(a.missingPricing) || b.requests - a.requests || (a.user?.name || '').localeCompare(b.user?.name || ''));
}

export default function AIContributionRegister({ rows, modules, module, setModule, model, resetModel, status, setStatus, onRowsChange, onMethodology, onMonthly, truncated = false }) {
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState('engagement');
  const [eligibility, setEligibility] = useState('all');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [selectedKey, setSelectedKey] = useState(null);
  const [closed, setClosed] = useState(false);
  const [detailTab, setDetailTab] = useState('summary');
  const filtered = useMemo(() => rows.filter(row => {
    const q = search.trim().toLowerCase();
    return (!q || [row.user?.name, row.user?.email, row.application, ...row.evidence.map(e => e.request_id)].some(v => String(v || '').toLowerCase().includes(q))) &&
      (mode !== 'successful' || row.successful > 0) && mode !== 'outcomes' && (eligibility === 'all' || eligibility === 'not_evaluated');
  }), [rows, search, mode, eligibility]);
  useEffect(() => { setPage(1); }, [search, mode, eligibility, size, module, model, status]);
  useEffect(() => { onRowsChange(filtered); }, [filtered, onRowsChange]);
  const selected = filtered.find(row => row.key === selectedKey) || filtered[0];
  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const currentPage = Math.min(page, pages);
  const reset = () => { setSearch(''); setModule('all'); resetModel(); setStatus('all'); setEligibility('all'); setMode('engagement'); };
  const select = row => { setSelectedKey(row.key); setClosed(false); setDetailTab('summary'); };
  return <div className={`ad-contribution-layout ${closed ? 'ad-evidence-closed' : ''}`}>
    <section className="ad-panel ad-register">
      <div className="ad-panel-heading"><h2>Contribution register</h2>{closed && <button onClick={() => setClosed(false)}>Show supporting evidence</button>}</div>
      <nav className="ad-register-tabs" aria-label="Contribution views">{[['engagement', 'Engagement'], ['successful', 'Successful use'], ['outcomes', 'Verified outcomes']].map(([key, text]) => <button key={key} aria-current={mode === key ? 'page' : undefined} onClick={() => setMode(key)}>{text}</button>)}</nav>
      <div className="ad-register-filters">
        <label className="ad-search"><Search /><input aria-label="Search contributors" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contributors, modules or sampled request IDs..." /></label>
        <select aria-label="Contribution module" value={module} onChange={e => setModule(e.target.value)}><option value="all">All modules</option>{modules.map(m => <option key={m} value={m}>{label(m)}</option>)}</select>
        <select aria-label="Recognition eligibility" value={eligibility} onChange={e => setEligibility(e.target.value)}><option value="all">All eligibility</option><option value="not_evaluated">Not evaluated</option><option value="eligible">Eligible</option></select>
        <select aria-label="Contribution reporting status" value={status} onChange={e => setStatus(e.target.value)}><option value="all">All reporting status</option><option value="missing">Pricing missing</option><option value="configured">Pricing configured</option></select>
        <button className="ad-link" onClick={reset}>Reset</button>
      </div>
      <div className="ad-table-scroll"><table className="ad-contribution-table"><thead><tr>{['Contributor', 'Module', 'AI requests', 'Successful requests', 'Verified outcomes', 'Cost (USD)', 'Eligibility', 'Last activity (UTC)'].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{filtered.slice((currentPage - 1) * size, currentPage * size).map(row => <tr key={row.key} className={!closed && row.key === selected?.key ? 'ad-selected-row' : ''} onClick={() => select(row)}>
        <td><button className="ad-row-link" aria-label={`Supporting evidence for ${row.user?.name || 'Unknown user'} in ${label(row.application)}`} onClick={() => select(row)}>{row.user?.name || 'Unknown user'}</button></td><td>{label(row.application)}</td><td>{fmt(row.requests)}</td><td>{fmt(row.successful)}</td><td><span className="ad-unavailable">Not recorded</span></td><td>{usd(row.cost)}{row.missingPricing && <small className="ad-pricing-warning">Pricing missing</small>}</td><td><span className="ad-eligibility"><i />Not evaluated</span></td><td>{date(row.last_activity)}</td>
      </tr>)}</tbody></table></div>
      {!filtered.length && <div className="ad-empty"><FileText /><h3>{mode === 'outcomes' ? 'Verified outcomes are not connected' : eligibility === 'eligible' ? 'Eligibility has not been evaluated' : 'No recorded contributions'}</h3><p>{mode === 'outcomes' ? 'Administrator-approved outcomes and accepted outputs are not yet recorded by the reporting service.' : 'Try another period or reset your filters. This register includes AI request records only; browsing activity is excluded.'}</p><button onClick={mode === 'outcomes' || eligibility === 'eligible' ? onMethodology : reset}>{mode === 'outcomes' || eligibility === 'eligible' ? 'View reporting methodology' : 'Reset filters'}</button></div>}
      <div className="ad-register-pagination"><span>Showing {filtered.length ? (currentPage - 1) * size + 1 : 0}–{Math.min(currentPage * size, filtered.length)} of {filtered.length} contributions</span><div><button aria-label="Previous contributions page" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft /></button><span className="ad-current-page">{currentPage}</span><button aria-label="Next contributions page" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}><ChevronRight /></button></div><label>Rows per page <select aria-label="Contributions rows per page" value={size} onChange={e => setSize(Number(e.target.value))}>{[5, 10, 20, 50].map(n => <option key={n}>{n}</option>)}</select></label></div>
      <p className="ad-register-note">AI request logs only · browsing excluded · request success does not establish accepted work.{truncated && ' Showing the latest 2,000 user/module/model groups; narrow the reporting period for additional detail.'}</p>
    </section>
    {!closed && <aside className="ad-panel ad-evidence" aria-label="Supporting evidence"><div className="ad-panel-heading"><h2>Supporting evidence</h2><button aria-label="Close supporting evidence" onClick={() => setClosed(true)}><X /></button></div>
      {selected ? <><div className="ad-evidence-person"><div><h3>{selected.user?.name || 'Unknown user'}</h3><p>{selected.user?.email}</p><p>{label(selected.application)}</p></div><span className="ad-eligibility"><i />Not evaluated</span></div>
        <nav className="ad-register-tabs ad-evidence-tabs" aria-label="Evidence views">{[['summary', 'Summary'], ['outcomes', 'Verified outcomes'], ['requests', `Request samples (${selected.evidence.length})`]].map(([key, text]) => <button key={key} aria-current={detailTab === key ? 'page' : undefined} onClick={() => setDetailTab(key)}>{text}</button>)}</nav>
        {detailTab === 'summary' ? <><div className="ad-evidence-columns"><div><h4>Reporting coverage</h4><strong>Not established</strong><p>Server provenance and deduplication are not attested.</p><h4>Model usage</h4>{selected.models.map(m => <p key={m.name}>{m.name} <strong>({Math.round(m.requests / selected.requests * 100)}%)</strong></p>)}<h4>Total tokens</h4><strong>{fmt(selected.tokens)}</strong><h4>Reported cost (USD)</h4><strong>{usd(selected.cost)}</strong>{selected.missingPricing && <p className="ad-pricing-warning">An active pricing configuration is missing.</p>}</div><div><h4>Verified outcomes</h4><strong>Not recorded</strong><p>Administrator approval is not connected.</p><h4>Successful requests</h4><strong>{fmt(selected.successful)} <span>of {fmt(selected.requests)}</span></strong><p>Technical success, not accepted outputs.</p><h4>Sample request IDs</h4>{selected.evidence.slice(0, 3).map((e, i) => <code key={i}>{e.request_id || 'Request ID not recorded'}</code>)}<button className="ad-link" onClick={() => setDetailTab('requests')}>View request samples <ExternalLink /></button><h4>Evidence links</h4><p>No reviewed evidence links recorded.</p></div></div><div className="ad-evidence-audit"><h4>Review and audit</h4><div><p>Last reviewed by<strong>Not reviewed</strong></p><p>Last reviewed<strong>Not recorded</strong></p><p>Review history<strong>Not connected</strong></p></div></div></> : detailTab === 'outcomes' ? <div className="ad-empty"><ShieldCheck /><h3>No verified outcomes recorded</h3><p>Recognition requires reviewed evidence. AI request success alone does not establish a verified outcome.</p></div> : <div className="ad-request-samples"><p>Up to three latest records per model in this reporting window. These are samples, not a complete request history.</p>{selected.evidence.map((e, i) => <article key={i}><code>{e.request_id || 'Request ID not recorded'}</code><span>{e.model}</span><span>{date(e.timestamp)} UTC</span><span className={`ad-chip ${e.success ? 'ad-green' : 'ad-amber'}`}>{e.success ? 'Request succeeded' : 'Request failed'}</span></article>)}</div>}
        <footer className="ad-evidence-actions"><div><Info />Monthly recognition is reviewed for a completed calendar month.</div><button className="ad-primary" onClick={onMonthly}>Review monthly award</button><button disabled title="Evidence requests are not connected.">Request evidence</button><button aria-label="Recognition methodology" onClick={onMethodology}><Info /></button></footer>
      </> : <div className="ad-empty"><FileText /><h3>Select a contribution</h3><p>Recorded model usage, cost and request samples will appear here. Select a period with AI request records to review evidence.</p><button onClick={onMethodology}>View reporting methodology</button></div>}
    </aside>}
  </div>;
}
AIContributionRegister.propTypes = { rows: PropTypes.array.isRequired, modules: PropTypes.array.isRequired, module: PropTypes.string.isRequired, setModule: PropTypes.func.isRequired, model: PropTypes.string.isRequired, resetModel: PropTypes.func.isRequired, status: PropTypes.string.isRequired, setStatus: PropTypes.func.isRequired, onRowsChange: PropTypes.func.isRequired, onMethodology: PropTypes.func.isRequired, onMonthly: PropTypes.func.isRequired, truncated: PropTypes.bool };
