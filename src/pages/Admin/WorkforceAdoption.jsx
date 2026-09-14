import React, { useEffect, useMemo, useState } from 'react';
import { Users, UserCheck, CalendarDays, Repeat2, Info, Download, RefreshCw, Search } from 'lucide-react';
import analyticsService from '../../services/analyticsService';
import './WorkforceAdoption.css';
import EngagementList from './EngagementList';

const pct = v => v == null ? 'Not available' : `${v}%`;
const date = v => new Date(v).toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
const initialMonday = () => {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
  return d;
};

export default function WorkforceAdoption() {
  const [weeks] = useState(() => Array.from({ length: 104 }, (_, i) => { const d = initialMonday(); d.setUTCDate(d.getUTCDate() - i * 7); return d.toISOString().slice(0, 10); }));
  const [week, setWeek] = useState(weeks[1]);
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [group, setGroup] = useState('departments');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    setBusy(true); setError(''); setReport(null); setNotice('');
    analyticsService.getWorkforceAdoption(week, { signal: controller.signal }).then(data => { if (active) setReport(data); })
      .catch(err => { if (active) setError(err?.response?.status === 403 ? 'You do not have access to workforce adoption.' : 'Could not load workforce adoption. Please retry.'); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; controller.abort(); };
  }, [week, revision]);
  useEffect(() => { setPage(1); }, [week, group, search, filter]);
  const rows = useMemo(() => (report?.[group] || []).filter(row => `${row.name} ${row.organization}`.toLowerCase().includes(search.toLowerCase()) &&
    (filter === 'all' || (filter === 'observed' && row.wau > 0) || (filter === 'monthly' && row.mau > 0) || (filter === 'returning' && row.returning > 0) || (filter === 'unobserved' && row.wau < row.eligible))), [report, group, search, filter]);
  const pages = Math.max(1, Math.ceil(rows.length / 10));
  const exportRows = () => {
    const cell = value => { const s = value == null ? 'Not available' : String(value); return `"${(/^[=+@\-\t\r]/.test(s) ? `'${s}` : s).replaceAll('"', '""')}"`; };
    const csv = [['Scope', report.scope], ['Week start UTC', report.window.start], ['Week end exclusive UTC', report.window.end], ['Cohort', report.quality.history_basis], ['Group', 'Organization', 'Eligible employees', 'WAU', 'MAU to report end', 'Observed adoption %', 'Previous WAU', 'Returning users', 'Repeat %'], ...rows.map(r => [r.name, r.organization, r.eligible, r.wau, r.mau, r.adoption_rate, r.previous_wau, r.returning, r.repeat_rate])].map(r => r.map(cell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = `radai-workforce-${group}-${week}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setNotice(`Exported ${rows.length} ${group}.`);
  };
  const t = report?.totals;
  return <section className="wa-workspace">
    <header className="wa-heading"><div><h2>Workforce AI adoption</h2><p>Observed reach, repeat usage and team adoption across eligible employees.</p></div><div><label><CalendarDays /><select aria-label="Adoption reporting week" value={week} onChange={e => setWeek(e.target.value)}>{weeks.map(w => <option key={w} value={w}>Week of {date(w)}{w === weeks[0] ? ' (in progress)' : ''}</option>)}</select></label><button aria-label="Refresh workforce adoption" disabled={busy} onClick={() => setRevision(v => v + 1)}><RefreshCw /></button><button disabled={!report || busy} onClick={exportRows}><Download />Export adoption</button></div></header>
    {notice && <p role="status" className="ad-info">{notice}</p>}
    {error ? <section className="ad-error" role="alert"><h3>Workforce report unavailable</h3><p>{error}</p><button onClick={() => setRevision(v => v + 1)}>Retry workforce report</button></section> : busy ? <section className="ad-panel ad-empty" role="status">Loading eligible workforce and recorded AI usage...</section> : report && <>
      <div className="ad-info"><Info /><div><strong>Observed adoption · coverage not established</strong><p>{report.quality.missing_data} {report.quality.history_basis}</p></div></div>
      <div className="wa-period"><span>{report.scope} · {date(report.window.start)} to {date(new Date(report.window.end).getTime() - 1)} · UTC{report.window.partial ? ' · Partial week; retention compares equal elapsed periods' : ''}</span><span>Last successful update: {new Date(report.generated_at).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC</span></div>
      <div className="ad-kpis wa-kpis">{[
        ['Eligible employees', t.eligible, 'Current active employee cohort', Users, 'all'],
        ['Weekly adoption', pct(t.weekly_adoption_rate), `${t.wau} weekly active / ${t.eligible} eligible`, UserCheck, 'observed'],
        ['Monthly active users', t.mau, `${date(report.window.month_start)} to report end`, CalendarDays, 'monthly'],
        ['Repeat weekly usage', pct(t.repeat_rate), `${t.returning} returned / ${t.previous_wau} previously active`, Repeat2, 'returning'],
      ].map(([label, value, hint, Icon, key]) => <button className="ad-kpi" data-tone={key === 'returning' ? 'indigo' : 'blue'} aria-pressed={filter === key} key={key} onClick={() => setFilter(key)}><span className="ad-kpi-icon"><Icon /></span><span><span className="ad-kpi-label">{label}</span><strong>{value}</strong><small>{hint}</small></span></button>)}</div>
      <div className="wa-layout"><div className="wa-main"><section className="ad-panel"><div className="ad-panel-heading"><h2>Adoption by department and team</h2><span className="ad-count">{rows.length}</span></div><nav className="ad-register-tabs" aria-label="Workforce grouping">{[['departments', 'Departments'], ['teams', 'Manager teams']].map(([key, name]) => <button key={key} aria-current={group === key ? 'page' : undefined} onClick={() => setGroup(key)}>{name}</button>)}</nav><div className="ad-register-filters"><label className="ad-search"><Search /><input aria-label="Search adoption groups" placeholder="Search department, manager or organization..." value={search} onChange={e => setSearch(e.target.value)} /></label><select aria-label="Adoption observation filter" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All groups</option><option value="observed">With weekly RADAI use</option><option value="monthly">With monthly RADAI use</option><option value="returning">With returning users</option><option value="unobserved">With unobserved employees</option></select><button className="ad-link" onClick={() => { setSearch(''); setFilter('all'); }}>Reset adoption filters</button></div><div className="ad-table-scroll"><table><thead><tr>{[group === 'teams' ? 'Manager / team' : 'Department', 'Organization', 'Eligible', 'WAU', 'MAU', 'Observed adoption', 'Repeat usage'].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.slice((page - 1) * 10, page * 10).map(r => <tr key={r.id}><td>{r.name}</td><td>{r.organization}</td><td>{r.eligible}</td><td>{r.wau}</td><td>{r.mau}</td><td><div className="wa-rate"><progress max="100" value={r.adoption_rate || 0} aria-label={`${r.name} observed adoption`} /><span>{pct(r.adoption_rate)}</span></div></td><td>{pct(r.repeat_rate)}<small>{r.returning} / {r.previous_wau} users</small></td></tr>)}</tbody></table></div>{!rows.length && <div className="ad-empty"><Users /><h3>{t.eligible ? 'No matching groups' : 'No eligible employees identified'}</h3><p>{t.eligible ? 'Reset filters to see all groups.' : 'Review employee identity links and access to configured RADAI modules. An empty denominator is not reported as 0% adoption.'}</p></div>}<div className="ad-pagination"><span>{rows.length} groups</span><div><button disabled={page === 1} onClick={() => setPage(v => v - 1)}>Previous groups</button><span>{page} / {pages}</span><button disabled={page >= pages} onClick={() => setPage(v => v + 1)}>Next groups</button></div></div></section>
      <section className="ad-panel"><div className="ad-panel-heading"><div><h2>Eight-week observed adoption</h2><p>All eligible employees in scope · current cohort applied to each week</p></div></div><div className="ad-table-scroll"><table><thead><tr><th>Week starting (UTC)</th><th>Active employees</th><th>Eligible cohort</th><th>Observed adoption</th><th>Cohort basis</th></tr></thead><tbody>{report.trend.map(r => <tr key={r.week_start}><td>{date(r.week_start)}</td><td>{r.wau}</td><td>{r.eligible}</td><td><div className="wa-rate"><progress max="100" value={r.adoption_rate || 0} aria-label={`Adoption week ${r.week_start}`} /><span>{pct(r.adoption_rate)}</span></div></td><td>{r.basis === 'snapshot' ? 'Dated snapshot' : r.basis === 'mixed' ? 'Mixed' : 'Current fallback'}</td></tr>)}</tbody></table></div></section><EngagementList key={week} report={report.engagement} /></div>
      <aside className="wa-context"><section className="ad-panel"><div className="ad-panel-heading"><h2>Eligibility and data quality</h2></div><p>{report.quality.eligibility_basis}</p><dl className="ad-boundaries"><dt>Unlinked active accounts</dt><dd>{report.quality.unlinked_accounts}</dd><dt>Inactive employee records</dt><dd>{report.quality.inactive_employees}</dd><dt>Explicitly excluded</dt><dd>{report.quality.excluded_accounts}</dd><dt>No configured RADAI access</dt><dd>{report.quality.employees_without_module_access}</dd><dt>No observed weekly use</dt><dd>{t.no_observed_use}</dd><dt>Avg. active RADAI days</dt><dd>{t.average_active_days ?? 'Not available'} <small>per weekly active employee</small></dd></dl><p>{report.quality.usage_basis}</p><details><summary>Included RADAI modules ({report.quality.modules.length})</summary><ul>{report.quality.modules.map(m => <li key={m.code}>{m.name}</li>)}</ul><p>Module entitlement defines the cohort; it does not grant any additional permissions.</p></details></section><section className="ad-panel"><div className="ad-panel-heading"><h2>Productivity and value</h2></div><dl className="ad-boundaries"><dt>Verified hours saved</dt><dd>{report.effectiveness.verified_hours_saved ?? 'Not measured'}</dd><dt>Approved observations</dt><dd>{report.effectiveness.verified_outcomes ?? 'Not measured'}</dd><dt>Business value</dt><dd>Not measured</dd></dl><p>{report.effectiveness.reason}</p><p>Sessions, prompts and completed workflows are not inferred from model request counts.</p></section></aside></div>
    </>}
  </section>;
}
