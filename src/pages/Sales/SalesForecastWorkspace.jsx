import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { AlertTriangle, ArrowRight, BarChart3, CalendarDays, CheckCircle2, Clock, Eye, FileText, Lock, Plus, RefreshCw, Save, Send, Target, Trophy, Upload, Users, X } from 'lucide-react';
import { forecastMonths, forecastNumber, forecastPeriodLabel, forecastReviewInputs, forecastScenarioValue, forecastSnapshotLabel, samePeriodSnapshots } from './salesForecastWorkspace';
import './SalesForecastWorkspace.css';

const tabs = ['Overview', 'Awards', 'Revenue', 'Workload', 'Performance'];
const humanize = value => String(value || '').replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
const statusName = value => humanize(value) || 'Unavailable';
const entries = value => value && typeof value === 'object' && !Array.isArray(value) ? Object.entries(value) : [];
const approvalDate = value => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Dubai' }).format(new Date(value)) : '—';

function SnapshotStatus({ status }) {
  return <span className={`sfc-status sfc-status-${status || 'unknown'}`}>{statusName(status)}</span>;
}
SnapshotStatus.propTypes = { status: PropTypes.string };

function CompareSnapshots({ current, snapshots, onClose }) {
  const dialog = useRef(null);
  const options = snapshots.filter(row => row.id !== current.id);
  const [otherId, setOtherId] = useState(options.find(row => row.status === 'approved')?.id || options[0]?.id || '');
  const other = options.find(row => row.id === otherId);
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.showModal();
    return () => previous?.focus();
  }, []);
  const metrics = [['predicted_revenue', 'Base forecast'], ['best_case', 'Best case'], ['worst_case', 'Worst case'], ['actual_revenue', 'Actual revenue']];
  return <dialog ref={dialog} className="sfc-compare" aria-labelledby="sfc-compare-title" onCancel={onClose}>
    <header><div><h2 id="sfc-compare-title">Compare forecast snapshots</h2><p>{forecastPeriodLabel(current.forecast_period)}</p></div><button type="button" className="sfc-icon-button" aria-label="Close comparison" onClick={onClose}><X size={21} /></button></header>
    <div className="sfc-compare-body"><label className="sfc-field">Compare with<select value={otherId} onChange={event => setOtherId(event.target.value)}>{options.map(row => <option key={row.id} value={row.id}>{forecastSnapshotLabel(row)} · {statusName(row.status)}</option>)}</select></label>
      <div className="sfc-table-scroll"><table data-table-typography="preserve"><thead><tr><th>Metric</th><th>Current snapshot<br /><span>{forecastSnapshotLabel(current)}</span></th><th>Comparison snapshot<br /><span>{other ? forecastSnapshotLabel(other) : '—'}</span></th></tr></thead><tbody>{metrics.map(([key, label]) => <tr key={key}><td>{label}</td><td>{forecastNumber(current[key], { decimals: 2 })}</td><td>{forecastNumber(other?.[key], { decimals: 2 })}</td></tr>)}<tr><td>Status</td><td>{statusName(current.status)}</td><td>{statusName(other?.status)}</td></tr></tbody></table></div>
      <p className="sfc-note">Currency is not recorded. Monetary variance is unavailable.</p>
    </div><footer><button type="button" className="sfc-button" onClick={onClose}>Close</button></footer>
  </dialog>;
}
CompareSnapshots.propTypes = { current: PropTypes.object.isRequired, snapshots: PropTypes.array.isRequired, onClose: PropTypes.func.isRequired };

function MonthlyOutlook({ record, onWorkload }) {
  const months = forecastMonths(record?.forecast_period);
  const totalLabel = /^\d{4}-Q[1-4]$/.test(record?.forecast_period || '') ? `${record.forecast_period.slice(-2)} total` : 'Period total';
  const columns = [['Expected awards', "('000)"], ['Secured revenue', "('000)"], ['Pipeline revenue', "('000)"], ['Total revenue', "('000)"], ['Demand', 'h'], ['Capacity', 'h'], ['Gap', 'h']];
  return <section className="sfc-card sfc-monthly" aria-labelledby="sfc-monthly-title"><header className="sfc-section-heading"><h2 id="sfc-monthly-title">Monthly outlook</h2><span>Currency not recorded · Workload: hours</span></header>
    <div className="sfc-table-scroll"><table className="sfc-monthly-table" data-table-typography="preserve"><thead><tr><th scope="col">Month</th>{columns.map(([name, unit]) => <th scope="col" key={name}>{name}<span>{unit}</span></th>)}</tr></thead><tbody>{months.length ? months.map(month => <tr key={month.key}><th scope="row">{month.label}</th>{columns.map(([name]) => <td key={name} aria-label={`${name}: not recorded`}>—</td>)}</tr>) : <tr><td colSpan={8} className="sfc-table-empty">No monthly period recorded.</td></tr>}</tbody><tfoot><tr><th scope="row">{totalLabel}</th>{columns.map(([name]) => <td key={name}>—</td>)}</tr></tfoot></table></div>
    <div className="sfc-attention"><AlertTriangle size={20} /><span>Monthly phasing and capacity are not recorded.</span><button type="button" onClick={onWorkload}>Review workload<ArrowRight size={17} /></button></div>
    <p className="sfc-note">Award values are not delivery-phased revenue.</p>
  </section>;
}
MonthlyOutlook.propTypes = { record: PropTypes.object, onWorkload: PropTypes.func.isRequired };

function Performance({ record, scenario, expanded = false }) {
  return <section className="sfc-card sfc-performance" aria-labelledby="sfc-performance-title"><header className="sfc-section-heading"><h2 id="sfc-performance-title">Commercial performance</h2><span>Forecast versus {forecastPeriodLabel(record.forecast_period)} target</span></header><div className="sfc-table-scroll"><table data-table-typography="preserve"><thead><tr><th>Metric</th><th>Forecast</th><th>Target</th><th>Variance</th></tr></thead><tbody><tr><td>Revenue</td><td>{forecastNumber(forecastScenarioValue(record, scenario))}</td><td>—</td><td>—</td></tr><tr><td>Gross margin</td><td>—</td><td>—</td><td>—</td></tr>{expanded && <tr><td>Actual revenue</td><td>{forecastNumber(record.actual_revenue)}</td><td>—</td><td>—</td></tr>}</tbody></table></div>{expanded && <p className="sfc-note">Currency and commercial targets are not recorded. Variance is unavailable.</p>}</section>;
}
Performance.propTypes = { record: PropTypes.object.isRequired, scenario: PropTypes.string.isRequired, expanded: PropTypes.bool };

function RecordedBreakdown({ title, values, firstColumn, secondColumn, empty, note }) {
  return <section className="sfc-card"><header className="sfc-section-heading"><h2>{title}</h2></header><div className="sfc-table-scroll"><table data-table-typography="preserve"><thead><tr><th>{firstColumn}</th><th>{secondColumn}</th></tr></thead><tbody>{values.length ? values.map(([key, value]) => <tr key={key}><td>{humanize(key)}</td><td>{forecastNumber(value)}</td></tr>) : <tr><td colSpan={2} className="sfc-table-empty">{empty}</td></tr>}</tbody></table></div>{note && <p className="sfc-note">{note}</p>}</section>;
}
RecordedBreakdown.propTypes = { title: PropTypes.string.isRequired, values: PropTypes.array.isRequired, firstColumn: PropTypes.string.isRequired, secondColumn: PropTypes.string.isRequired, empty: PropTypes.string.isRequired, note: PropTypes.string };

export default function SalesForecastWorkspace({ rows, loading, error, record, recordLoading, recordError, selectedId, onRefresh, onSelect, onRetryRecord, onOpenFullRecord, onEdit, onCreate, onAction, actions, locked }) {
  const [tab, setTab] = useState('Overview');
  const [scenario, setScenario] = useState('base');
  const [service, setService] = useState('');
  const [comparing, setComparing] = useState(false);
  const [showAllInputs, setShowAllInputs] = useState(false);
  const [reviewing, setReviewing] = useState('');
  const reviewPanel = useRef(null);
  const approvedNote = useRef(null);
  const current = !recordLoading && !recordError ? record : null;
  const selectedRow = rows.find(row => row.id === record?.id);
  const period = record?.forecast_period || selectedRow?.forecast_period || '';
  const periods = [...new Set(rows.map(row => row.forecast_period).filter(Boolean))].sort((a, b) => (forecastMonths(b).at(-1)?.key || '').localeCompare(forecastMonths(a).at(-1)?.key || '') || b.localeCompare(a));
  const snapshots = useMemo(() => samePeriodSnapshots(rows, period), [rows, period]);
  const baseline = snapshots.find(row => row.status === 'approved');
  const services = entries(current?.forecast_by_service);
  const reviewInputs = forecastReviewInputs(current);
  const scenarioName = { base: 'Base', best: 'Best case', worst: 'Worst case' }[scenario];
  const approvalAvailable = actions.some(action => action.id === 'approve_forecast');

  useEffect(() => {
    if (!loading && !error && !record && !selectedId && rows.length) {
      const sorted = [...rows].sort((a, b) => String(b.forecast_date || '').localeCompare(String(a.forecast_date || '')) || String(b.id).localeCompare(String(a.id)));
      onSelect(sorted[0]);
    }
  }, [loading, error, record, selectedId, rows, onSelect]);
  useEffect(() => { setService(''); setComparing(false); setShowAllInputs(false); setReviewing(''); }, [record?.id]);
  useEffect(() => {
    if (showAllInputs && tab === 'Overview') reviewPanel.current?.scrollIntoView({ block: 'nearest' });
  }, [showAllInputs, tab]);
  const tabKey = event => {
    const index = tabs.indexOf(tab);
    const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault(); setTab(tabs[next]); event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next]?.focus();
  };
  const reviewAll = () => { setTab('Overview'); setShowAllInputs(true); setReviewing(''); };
  const topDeals = Array.isArray(current?.top_deals_considered) ? current.top_deals_considered : [];
  const displayedInputs = showAllInputs ? reviewInputs : reviewInputs.slice(0, 2);
  const recoveryPicker = snapshots.length > 0 && <label className="sfc-field sfc-recovery-picker">Snapshot<select aria-label="Snapshot" value={record?.id || ''} onChange={event => { const chosen = snapshots.find(row => row.id === event.target.value); if (chosen) onSelect(chosen); }}>{snapshots.map(row => <option key={row.id} value={row.id}>{forecastSnapshotLabel(row)} · {statusName(row.status)}</option>)}</select></label>;

  return <section className="sfc-page" aria-label="Forecast planning workspace">
    <header className="sfc-page-header"><div className="sfc-page-identity"><h1>Forecast</h1>{current && <><span className="sfc-version" title="Saved snapshot date">{forecastSnapshotLabel(current)}</span><SnapshotStatus status={current.status} /></>}</div><div className="sfc-header-actions"><button type="button" className="sfc-button" disabled={!current || snapshots.length < 2} onClick={() => setComparing(true)}><FileText size={19} />Compare versions</button><span title="Forecast export is not available"><button type="button" className="sfc-button" disabled><Upload size={19} />Export</button></span><button type="button" className="sfc-button sfc-primary" disabled={!current || locked} onClick={onEdit}><Save size={20} />{current && current.status !== 'draft' ? 'Edit snapshot' : 'Save draft'}</button></div></header>
    {error && <div className="sfc-error" role="alert">{error}<button type="button" onClick={onRefresh}>Retry loading</button></div>}
    <div className="sfc-filters"><label className="sfc-field sfc-period">Period<div><CalendarDays size={19} /><select aria-label="Period" value={period} disabled={loading || !rows.length} onChange={event => { const matching = samePeriodSnapshots(rows, event.target.value); if (matching.length) onSelect(matching[0]); }}>{!period && <option value="">Select period</option>}{period && !periods.includes(period) && <option value={period}>{forecastPeriodLabel(period)}</option>}{periods.map(value => <option key={value} value={value}>{forecastPeriodLabel(value)}</option>)}</select></div></label>
      <label className="sfc-field">Scenario<select aria-label="Scenario" value={scenario} disabled={!current} onChange={event => setScenario(event.target.value)}><option value="base">Base</option><option value="best">Best case</option><option value="worst">Worst case</option></select></label>
      <label className="sfc-field">Service line<select aria-label="Service line" value={service} disabled={!services.length} onChange={event => { setService(event.target.value); setTab('Awards'); }}><option value="">All service lines</option>{services.map(([key]) => <option key={key} value={key}>{humanize(key)}</option>)}</select></label>
      <label className="sfc-field" title="Client breakdown is not recorded">Client<select aria-label="Client" disabled value=""><option value="">All clients</option></select></label>
      <label className="sfc-field" title="Snapshot currency is not recorded">Currency<select aria-label="Currency" disabled value=""><option value="">Not recorded</option></select></label>
      <div className="sfc-as-of">As of {current ? forecastSnapshotLabel(current) : '—'}</div>
    </div>
    <div className="sfc-tabs" role="tablist" aria-label="Forecast views">{tabs.map(name => <button type="button" key={name} role="tab" id={`sfc-tab-${name.toLowerCase()}`} aria-controls="sfc-content" aria-selected={tab === name} tabIndex={tab === name ? 0 : -1} onClick={() => setTab(name)} onKeyDown={tabKey}>{name}</button>)}</div>
    {(loading || recordLoading) ? <div className="sfc-page-state" role="status"><RefreshCw size={30} className="sfc-spin" /><h2>Loading forecast…</h2>{recoveryPicker}</div> : recordError ? <div className="sfc-page-state" role="alert"><AlertTriangle size={30} /><h2>Forecast unavailable</h2><p>{recordError}</p><button type="button" className="sfc-button" onClick={onRetryRecord}>Retry</button>{recoveryPicker}</div> : !current ? <div className="sfc-page-state"><BarChart3 size={32} /><h2>{error ? 'Forecasts unavailable' : 'No forecast snapshots yet'}</h2><p>{error ? 'Retry to load saved forecasts.' : 'Generate a snapshot to start planning.'}</p><button type="button" className="sfc-button sfc-primary" onClick={onCreate}><Plus size={18} />Generate forecast</button></div> : <>
      <div className="sfc-metrics" aria-label="Forecast summary">{[
        [Trophy, 'Expected awards', '—', 'Award basis not recorded'],
        [BarChart3, 'Forecast revenue', forecastNumber(forecastScenarioValue(current, scenario), { compact: true, decimals: 2 }), 'Currency not recorded'],
        [Users, 'Demand hours', '—', 'Monthly phasing not recorded'],
        [Target, 'Forecast margin', '—', 'Target not recorded'],
      ].map(([Icon, name, value, note]) => <div className="sfc-metric" key={name}><Icon size={30} /><div><span>{name}</span><strong>{value}</strong><p>{note}</p></div></div>)}</div>
      <div className="sfc-workspace" id="sfc-content" role="tabpanel" aria-labelledby={`sfc-tab-${tab.toLowerCase()}`} tabIndex={0}>
        <div className="sfc-primary-column">
          {tab === 'Overview' && <><MonthlyOutlook record={current} onWorkload={() => setTab('Workload')} /><Performance record={current} scenario={scenario} /><section className="sfc-card sfc-review-inputs" ref={reviewPanel} aria-labelledby="sfc-inputs-title"><header className="sfc-section-heading"><h2 id="sfc-inputs-title">Inputs requiring review<span className="sfc-count">{reviewInputs.length}</span></h2><button type="button" className="sfc-link" onClick={() => setShowAllInputs(value => !value)}>{showAllInputs ? 'Show less' : 'View all'}<ArrowRight size={16} /></button></header><div className="sfc-table-scroll"><table data-table-typography="preserve"><thead><tr><th>Source</th><th>Missing input</th><th>Impact</th><th>Action</th></tr></thead><tbody>{displayedInputs.map(input => <tr key={input.key}><td><button type="button" className="sfc-link" onClick={onOpenFullRecord}>{input.source}</button></td><td>{input.input}</td><td>{input.impact}</td><td><button type="button" className="sfc-link" aria-label={`Review ${input.input.toLowerCase()}`} onClick={() => setReviewing(previous => previous === input.key ? '' : input.key)}>Review</button></td></tr>)}</tbody></table></div>{reviewing && <p className="sfc-review-detail" role="status">{reviewInputs.find(input => input.key === reviewing)?.detail}</p>}<p className="sfc-note">Missing inputs are excluded from affected measures.</p></section></>}
          {tab === 'Awards' && <><RecordedBreakdown title="Pipeline by service line" values={service ? services.filter(([key]) => key === service) : services} firstColumn="Service line" secondColumn="Recorded weighted value" empty="No service breakdown recorded." note="Service lines may overlap. Currency and delivery phasing are not recorded." /><RecordedBreakdown title="Pipeline by stage" values={entries(current.forecast_by_stage)} firstColumn="Stage" secondColumn="Recorded weighted value" empty="No stage breakdown recorded." note="Recorded pipeline values are not approved awards or recognized revenue." /><section className="sfc-card"><header className="sfc-section-heading"><h2>Opportunities considered</h2></header><div className="sfc-table-scroll"><table data-table-typography="preserve"><thead><tr><th>VF code</th><th>Opportunity</th><th>Weighted value</th><th>Probability</th></tr></thead><tbody>{topDeals.length ? topDeals.map((deal, index) => <tr key={`${typeof deal === 'string' ? deal : deal?.deal_code}-${index}`}><td>{typeof deal === 'string' ? deal : deal?.deal_code || '—'}</td><td>{typeof deal === 'object' ? deal?.deal_name || '—' : '—'}</td><td>{forecastNumber(deal?.weighted_value)}</td><td>{forecastNumber(deal?.probability) === '—' ? '—' : `${forecastNumber(deal.probability)}%`}</td></tr>) : <tr><td colSpan={4} className="sfc-table-empty">No contributing opportunities recorded.</td></tr>}</tbody></table></div><p className="sfc-note">Saved contributing opportunities; this is not the complete pipeline.</p></section></>}
          {tab === 'Revenue' && <><MonthlyOutlook record={current} onWorkload={() => setTab('Workload')} /><section className="sfc-card"><header className="sfc-section-heading"><h2>Saved revenue scenarios</h2><span>Currency not recorded</span></header><div className="sfc-table-scroll"><table data-table-typography="preserve"><thead><tr><th>Scenario</th><th>Saved forecast</th></tr></thead><tbody>{[['base', 'Base'], ['best', 'Best case'], ['worst', 'Worst case']].map(([key, name]) => <tr key={key} className={scenario === key ? 'sfc-selected-row' : ''}><td>{name}</td><td>{forecastNumber(forecastScenarioValue(current, key), { decimals: 2 })}</td></tr>)}</tbody></table></div><p className="sfc-note">Saved estimates are not a monthly delivery schedule.</p></section></>}
          {tab === 'Workload' && <><RecordedBreakdown title="Recorded discipline demand" values={entries(current.demand_by_discipline)} firstColumn="Discipline" secondColumn="Recorded hours" empty="No discipline demand recorded." note="Monthly demand, available capacity and capacity gaps are not recorded." /><MonthlyOutlook record={current} onWorkload={() => approvedNote.current?.focus()} /></>}
          {tab === 'Performance' && <Performance record={current} scenario={scenario} expanded />}
        </div>
        <aside className="sfc-controls" aria-label="Forecast controls">
          <section><h2>Forecast controls</h2><dl><dt>Working version</dt><dd>{forecastSnapshotLabel(current)}<span aria-hidden="true"> · </span><SnapshotStatus status={current.status} /></dd><dt>Approved baseline</dt><dd>{baseline ? forecastSnapshotLabel(baseline) : 'Not recorded'}</dd><dt>Scenario</dt><dd>{scenarioName}</dd><dt>Snapshot date</dt><dd>{forecastSnapshotLabel(current)}</dd><dt>Owner</dt><dd>{current.generated_by_name || (current.generated_by ? 'Name unavailable' : 'Unassigned')}</dd></dl><button type="button" className="sfc-link" disabled={snapshots.length < 2} onClick={() => setComparing(true)}>View changes{baseline && baseline.id !== current.id ? ` since ${forecastSnapshotLabel(baseline)}` : ''}<ArrowRight size={16} /></button></section>
          <section><h2>Forecast basis</h2><dl><dt>Awards</dt><dd>Not recorded</dd><dt>Revenue</dt><dd>Saved forecast estimate</dd><dt>Workload</dt><dd>Recorded discipline hours</dd><dt>Secured work</dt><dd>Not recorded</dd></dl></section>
          <section className="sfc-approval"><h2>Review &amp; approval</h2><dl><dt>Snapshot status</dt><dd><Clock size={18} />{statusName(current.status)}</dd><dt>Approval</dt><dd>{current.approved_at ? <CheckCircle2 size={18} /> : <Clock size={18} />}{current.approved_at ? 'Recorded' : 'Not recorded'}</dd><dt>Approved on</dt><dd><Clock size={18} />{current.approved_at ? approvalDate(current.approved_at) : '—'}</dd></dl><p className="sfc-note" tabIndex={-1} ref={approvedNote}>Approved versions are locked.</p><button type="button" className="sfc-button sfc-primary sfc-full" onClick={reviewAll}><FileText size={20} />Review {reviewInputs.length} missing inputs</button><button type="button" className="sfc-button sfc-submit sfc-full" disabled title="A separate submission workflow is not configured"><Send size={20} />Submit for approval</button><p className="sfc-note">{locked ? 'This snapshot is locked.' : 'Use the existing snapshot approval action below.'}</p></section>
          <div className="sfc-snapshot-tools"><label className="sfc-field">Snapshot<select aria-label="Snapshot" value={current.id} onChange={event => { const chosen = snapshots.find(row => row.id === event.target.value); if (chosen) onSelect(chosen); }}>{!snapshots.some(row => row.id === current.id) && <option value={current.id}>{forecastSnapshotLabel(current)}</option>}{snapshots.map(row => <option key={row.id} value={row.id}>{forecastSnapshotLabel(row)} · {statusName(row.status)}</option>)}</select></label><div><button type="button" onClick={onCreate}><Plus size={15} />Generate forecast</button><button type="button" onClick={onRefresh}><RefreshCw size={15} />Refresh forecast</button><button type="button" onClick={onOpenFullRecord}><Eye size={15} />Open full forecast record</button>{approvalAvailable && !locked && <button type="button" onClick={() => onAction('approve_forecast')}><CheckCircle2 size={15} />Approve snapshot</button>}{locked && <span><Lock size={15} />Locked snapshot</span>}</div></div>
        </aside>
      </div>
      {comparing && <CompareSnapshots current={current} snapshots={snapshots} onClose={() => setComparing(false)} />}
    </>}
  </section>;
}
SalesForecastWorkspace.propTypes = {
  rows: PropTypes.array.isRequired, loading: PropTypes.bool.isRequired, error: PropTypes.string,
  record: PropTypes.object, recordLoading: PropTypes.bool.isRequired, recordError: PropTypes.string, selectedId: PropTypes.string,
  onRefresh: PropTypes.func.isRequired, onSelect: PropTypes.func.isRequired, onRetryRecord: PropTypes.func.isRequired,
  onOpenFullRecord: PropTypes.func.isRequired, onEdit: PropTypes.func.isRequired, onCreate: PropTypes.func.isRequired,
  onAction: PropTypes.func.isRequired, actions: PropTypes.array.isRequired, locked: PropTypes.bool.isRequired,
};
