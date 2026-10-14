import React, { useMemo, useState } from 'react';

export default function EngagementList({ report }) {
  const [search, setSearch] = useState('');
  const [band, setBand] = useState('All');
  const [page, setPage] = useState(1);
  const rows = useMemo(() => (report?.people || []).filter(p =>
    `${p.name} ${p.department} ${p.organization}`.toLowerCase().includes(search.toLowerCase()) &&
    (band === 'All' || p.band === band)), [report, search, band]);
  if (!report) return null;
  const pages = Math.max(1, Math.ceil(rows.length / 10));
  const current = Math.min(page, pages);
  return <section className="ad-panel">
    <div className="ad-panel-heading"><h2>Observed engagement</h2><span>{rows.length} employees</span></div>
    <p>{report.methodology}</p><details><summary>Maturity evidence rules</summary><p>Levels 1?3 describe observed occasional, weekly and near-daily usage. Level 4 requires approved workflow-integration evidence; level 5 requires approved automation-creator evidence. No observations remain Unknown while coverage is incomplete. Recognition is reviewed separately.</p></details>
    <p>{report.start.slice(0, 10)} to {report.end.slice(0, 10)} (exclusive) · {report.version}</p>
    <div className="ad-panel-heading">
      <input aria-label="Search engagement" placeholder="Search employee or department" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
      <select aria-label="Engagement band" value={band} onChange={e => { setBand(e.target.value); setPage(1); }}>{['All', 'Unknown', 'Low', 'Moderate', 'High', 'Power user'].map(b => <option key={b}>{b}</option>)}</select>
    </div>
    <div className="ad-table-scroll"><table><thead><tr><th>Employee</th><th>Active days</th><th>AI modules</th><th>Active weeks</th><th>Score / 100</th><th>Engagement</th><th>Maturity</th></tr></thead>
      <tbody>{rows.slice((current - 1) * 10, current * 10).map(p => <tr key={p.user_id}><td>{p.name}<small style={{ display: 'block' }}>{p.department} · {p.organization}</small></td><td>{p.active_days}</td><td>{p.modules_used} / {p.entitled_modules}</td><td>{p.active_weeks} / 4</td><td>{p.score ?? 'Unknown'}</td><td>{p.band}</td><td title={p.maturity_basis}>{p.maturity_level == null ? 'Unknown' : `Level ${p.maturity_level}`}</td></tr>)}{!rows.length && <tr><td colSpan="7">No employees match these filters.</td></tr>}</tbody></table></div>
    <div className="ad-panel-heading"><button disabled={current === 1} onClick={() => setPage(current - 1)}>Previous</button><span>Page {current} of {pages}</span><button disabled={current === pages} onClick={() => setPage(current + 1)}>Next</button></div>
  </section>;
}
