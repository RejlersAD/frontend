import React, { useEffect, useState } from 'react';
import { Workflow, Users, Clock3, Activity, RefreshCw, Download } from 'lucide-react';
import analyticsService from '../../services/analyticsService';
import './AIWorkflowMeasurements.css';

const moduleName = code => ({ planning_package: 'Planning packages', pid_analysis: 'P&ID analysis', pfd_to_pid: 'PFD to P&ID', designiq: 'DesignIQ', crs_documents: 'CRS documents', pfd_quality: 'PFD Quality' }[code] || code);
const sourceName = type => ({ 'planning_intelligence.PlanningGeneration': 'Planning generation', 'planning_intelligence.DocumentIntelligenceRun': 'Document intelligence run', 'planning_intelligence.PlanningJob': 'Planning job', 'pid_analysis.PIDAnalysisReport': 'P&ID report' }[type] || type);

export default function AIWorkflowMeasurements({ onRecordOutcome }) {
  const [data, setData] = useState(null);
  const [days, setDays] = useState(30);
  const [module, setModule] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    setData(null); setError('');
    const timer = setTimeout(() => analyticsService.getAIMeasurements({ days, module, status, search, page }, { signal: controller.signal })
      .then(value => { if (active) setData(value); })
      .catch(() => { if (active) setError('Could not load workflow measurements. Retry the request.'); }), 200);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [days, module, status, search, page, revision]);
  const exportPage = () => {
    const cell = value => { const s = String(value ?? ''); return `"${(/^[=+@\-\t\r]/.test(s) ? `'${s}` : s).replaceAll('"', '""')}"`; };
    const records = [['Workflow', 'Employee', 'Module', 'Status', 'Started UTC', 'SDK calls', 'Source type', 'Source ID'], ...data.results.map(r => [r.id, r.user, r.module, r.status, r.started_at, r.sdk_calls, r.source_type, r.source_id])];
    const url = URL.createObjectURL(new Blob(['\ufeff', records.map(r => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv' }));
    const link = document.createElement('a'); link.href = url; link.download = `ai-workflows-page-${page}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const change = setter => e => { setter(e.target.value); setPage(1); };
  return <div className="aw-measurements">
    <div className="aw-toolbar"><div><h2>Workflow measurements</h2><p>Server-observed workflow activity; productivity pilots: Planning packages and P&amp;ID analysis</p></div><label>Period<select aria-label="Workflow reporting period" value={days} onChange={change(setDays)}>{[7, 30, 90, 365].map(n => <option key={n} value={n}>Last {n} days</option>)}</select></label><button onClick={() => setRevision(v => v + 1)}><RefreshCw /> Refresh measurements</button></div>
    {error && <p role="alert">{error}</p>}{!data && !error && <p role="status">Loading workflow measurements…</p>}
    {data && <><div className="ad-kpis">{[
      ['AI workflows', data.totals.ai_workflows, `${data.totals.completed_ai_workflows} completed outputs`, Workflow, 'blue'],
      ['Active employees', data.totals.active_users, 'Employees with observed SDK calls', Users, 'blue'],
      ['Derived AI sessions', data.totals.derived_sessions, '30-minute inactivity boundary', Clock3, 'indigo'],
      ['Provider SDK calls', data.totals.sdk_calls, `${data.totals.successful_sdk_calls} returned successfully`, Activity, 'blue'],
    ].map(([label, value, hint, Icon, tone]) => <div className="ad-kpi" data-tone={tone} key={label}><span className="ad-kpi-icon"><Icon /></span><span><span className="ad-kpi-label">{label}</span><strong>{value}</strong><small>{hint}</small></span></div>)}</div>
      <div className="ad-info"><div><strong>{data.snapshot_stale ? 'Workforce snapshot needs attention' : 'Workforce snapshot available'}</strong><p>Last capture: {data.latest_snapshot ? new Date(data.latest_snapshot).toLocaleString() : 'Not captured'}. Fresh snapshots: {data.snapshot_fresh_organizations ?? 0} of {data.snapshot_organizations ?? 0} organizations. Freshness limit: 36 hours. No historical workforce data is backfilled.</p></div></div>
      <section className="ad-panel"><div className="ad-panel-heading"><h2>Integration coverage</h2><span>Coverage is shown per adapter; no workforce coverage percentage is assumed.</span></div><div className="ad-table-scroll"><table><thead><tr><th>AI module</th><th>Adapter status</th><th>Observed calls</th><th>Uncosted calls</th><th>Last request</th><th>Output reconciliation</th></tr></thead><tbody>{data.coverage.map(r => <tr key={r.module}><td><details><summary>{r.name}</summary><p>{r.boundary}</p><ul>{r.paths.map(p => <li key={p}>{p}</li>)}</ul></details></td><td>{r.status}</td><td>{r.sdk_calls}</td><td>{r.pricing_missing}</td><td>{r.last_request ? new Date(r.last_request).toLocaleString() : 'No observations'}</td><td>{r.reconciliation?.status || 'Not checked'}{r.reconciliation?.unlinked_outputs > 0 && <small>{r.reconciliation.unlinked_outputs} persisted outputs have no workflow reference</small>}</td></tr>)}</tbody></table></div></section>
      <section className="ad-panel"><div className="aw-toolbar"><h2>Workflow register</h2><input aria-label="Search workflows" placeholder="Employee or source reference" value={search} onChange={change(setSearch)} /><select aria-label="Workflow module" value={module} onChange={change(setModule)}><option value="">All modules</option>{data.coverage.map(row => <option key={row.module} value={row.module}>{row.name}</option>)}</select><select aria-label="Workflow status" value={status} onChange={change(setStatus)}><option value="">All statuses</option>{['running', 'completed', 'returned', 'failed', 'no_result'].map(s => <option key={s}>{s}</option>)}</select><button onClick={exportPage}><Download /> Export this page</button></div>
        <div className="ad-table-scroll"><table><thead><tr><th>Employee / workflow</th><th>Module</th><th>Status</th><th>SDK calls</th><th>Result reference</th><th>Action</th></tr></thead><tbody>{data.results.map(r => <tr key={r.id}><td>{r.user}<small>{r.id}</small></td><td>{moduleName(r.module)}</td><td>{r.status === 'no_result' ? 'No output' : r.status === 'returned' ? 'Response returned' : r.status}</td><td>{r.sdk_calls}</td><td>{sourceName(r.source_type) || 'No persisted output'}<small>{r.source_id}</small></td><td>{r.can_record_outcome && <button onClick={() => onRecordOutcome(r)}>Record outcome</button>}{r.outcome_recorded && <span>Evidence recorded</span>}</td></tr>)}{!data.results.length && <tr><td colSpan="6">No server workflow measurements match this period and these filters. Historical requests are not converted into workflows.</td></tr>}</tbody></table></div>
        <div className="aw-toolbar"><span>{data.count} workflows · Page {page} of {Math.max(1, Math.ceil(data.count / 10))}</span><button disabled={page === 1} onClick={() => setPage(v => v - 1)}>Previous workflows</button><button disabled={page * 10 >= data.count} onClick={() => setPage(v => v + 1)}>Next workflows</button></div>
      </section>
      <section className="ad-panel aw-method"><h2>Measurement rules</h2>{data.totals.stalled_workflows > 0 && <p role="status">{data.totals.stalled_workflows} workflows have been running for more than six hours. Check the worker before treating these as completed or failed.</p>}<p>{data.totals.sessions_per_eligible_employee_per_week ?? 'Not available'} derived sessions per eligible employee per week ({data.totals.eligible_employees ?? 0} employees in the reporting cohort).</p><p>{data.totals.sessions_per_active_employee_per_week ?? 'Not available'} derived sessions per active employee per week. User prompts: not measured — generated model messages are not employee prompts.</p>{Object.entries(data.methodology).filter(([k]) => k !== 'version').map(([k, text]) => <details key={k}><summary>{k[0].toUpperCase() + k.slice(1)}</summary><p>{text}</p></details>)}</section>
    </>}
  </div>;
}
