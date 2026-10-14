/* eslint-disable react/prop-types */
import React, { useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRightIcon, ArrowsUpDownIcon, CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon, DocumentCheckIcon, FunnelIcon, InformationCircleIcon, MagnifyingGlassIcon, ScaleIcon, TrophyIcon } from '@heroicons/react/24/outline';
import { EmptyState, RouteLink, Status } from './ExecutivePrimitives';
import { formatDate, formatNumber } from './executivePresentation';
import { COMMERCIAL_OUTCOMES, CommercialHealth, CommercialMetricValue, commercialMetric, numberPresent, probabilityMetric, unknownCommercialMetric } from './commercialPresentation';
import { CommercialBidCalendar, CommercialClientConcentration, CommercialQuality, CommercialResourceDemand } from './CommercialSidePanels';
import ExecutiveKpiCard from './ExecutiveKpiCard';
import './CommercialPipeline.css';

const PRIORITY = { critical: 0, high: 1, medium: 2, low: 3 };
const shortDate = value => value ? formatDate(value).replace(/ \d{4}$/, '') : '—';
const originalCurrency = row => row.currency || 'UNSPECIFIED';
const validSource = status => ['available', 'partial'].includes(status);
const sourceTitle = (status, fallback) => status === 'restricted' ? 'Commercial access required' : status === 'error' ? 'CRM source unavailable' : fallback;

function CommercialOutcomes({ commercial, currency, onExplain }) {
  const icons = [FunnelIcon, ScaleIcon, TrophyIcon, CalendarDaysIcon, DocumentCheckIcon];
  const tones = ['blue', 'purple', 'green', 'rose', 'amber'];
  return <section className="cp-outcomes" aria-label="Five growth outcomes" data-testid="commercial-outcomes">{COMMERCIAL_OUTCOMES.map((item, index) => {
    const metric = commercialMetric(commercial, item.id, currency);
    return <ExecutiveKpiCard key={item.id} className="cp-outcome" valueClassName="cp-outcome-value"
      testId={`commercial-kpi-${item.id}`} tone={tones[index]} icon={icons[index]} label={item.label}
      metric={metric} value={<CommercialMetricValue metric={metric} />} onExplain={onExplain}>
      <p className="cp-outcome-basis">{item.id === 'win_rate' ? 'Trailing 365 days · all currencies' : item.id === 'proposals_due_30d' ? 'All currencies · recorded target dates' : item.id === 'framework_backlog' ? 'Approved remaining revenue required' : 'Original currency · current CRM snapshot'}</p>
      <div className="cp-outcome-bottom"><Status status={metric.status} /><span>{item.id === 'qualified_pipeline' ? 'Excludes lead-stage opportunities' : item.id === 'weighted_pipeline' ? 'Includes all open stages' : 'Targets and trends not connected'}</span></div>
    </ExecutiveKpiCard>;
  })}</section>;
}

function CommercialDecisions({ commercial, onExplain, printing }) {
  const [expanded, setExpanded] = useState(false);
  const status = commercial.actions_status || commercial.status;
  const actions = [...(commercial.actions || [])].sort((a, b) => (PRIORITY[a.severity] ?? 9) - (PRIORITY[b.severity] ?? 9));
  const visible = expanded || printing ? actions : actions.slice(0, 3);
  return <section className="cp-panel cp-decisions" aria-labelledby="cp-decisions-title" data-testid="commercial-decisions"><div className="cp-panel-heading"><h2 id="cp-decisions-title">Commercial decisions required</h2>{actions.length > 3 && <button className="cc-text-button cc-screen-only" onClick={() => setExpanded(value => !value)}>{expanded ? 'Show top 3 decisions' : `Show ${actions.length} decisions`}<ArrowRightIcon /></button>}</div>
    {visible.length ? <div className="cc-table-wrap"><table className="cc-table cp-decisions-table"><caption className="cc-sr-only">Commercial decisions and recorded opportunity context</caption><thead><tr>{['Priority', 'Decision', 'Opportunity / program', 'Value / impact', 'Owner', 'Target date', 'Action'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{visible.map(action => <tr key={action.id} data-testid={`commercial-action-${action.id}`}>
      <td><span className={`cp-priority cp-priority--${action.severity}`}><span aria-hidden="true">●</span>{action.severity}</span></td><th scope="row"><button className="cc-cell-button cp-truncate" title={action.title} onClick={() => onExplain({ id: action.id, label: action.title, description: action.detail, source: 'Authorised CRM opportunity record', status: 'available', route: action.route })}>{action.title}</button></th><td><span className="cp-truncate" title={action.opportunity_name}>{action.opportunity_name || '—'}</span></td><td><span className="cp-truncate" title={action.impact || action.detail}>{action.impact || action.detail || 'Not connected'}</span></td><td><span className="cp-truncate" title={action.owner || 'Owner not recorded'}>{action.owner || 'Unassigned'}</span></td><td>{shortDate(action.due_date)}</td><td><RouteLink route={action.route} className="cc-table-action">Review</RouteLink></td>
    </tr>)}</tbody></table></div> : <EmptyState title={sourceTitle(status, status === 'partial' ? 'Commercial coverage incomplete' : 'No decisions reported')} detail="Decisions reflect recorded CRM flags and lifecycle gates." />}
    <p className="cp-panel-note">Decisions cover all authorised currencies. Dates are recorded opportunity targets; submission and intervention completion are not inferred.</p>
    {commercial.actions_truncated && <p className="cp-panel-note">This report includes {actions.length}{numberPresent(commercial.action_count) ? ` of ${formatNumber(commercial.action_count)}` : ''} decisions. <RouteLink route="/sales/opportunities">Open opportunity register</RouteLink></p>}
  </section>;
}

function ProbabilityButton({ opportunity, onExplain }) {
  const id = useId();
  const [anchor, setAnchor] = useState(null);
  const metric = probabilityMetric(opportunity);
  const show = event => {
    const rect = event.currentTarget.getBoundingClientRect();
    setAnchor({ left: Math.max(8, Math.min(rect.left - 12, window.innerWidth - 248)), top: Math.min(rect.bottom + 8, window.innerHeight - 152) });
  };
  useEffect(() => {
    if (!anchor) return undefined;
    const hide = () => setAnchor(null);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => { window.removeEventListener('scroll', hide, true); window.removeEventListener('resize', hide); };
  }, [anchor]);
  return <><button className="cp-probability" aria-label={`Probability evidence for ${opportunity.name}`} aria-describedby={anchor ? id : undefined} onFocus={show} onMouseEnter={show} onBlur={() => setAnchor(null)} onMouseLeave={() => setAnchor(null)} onKeyDown={event => { if (event.key === 'Escape') setAnchor(null); }} onClick={() => { setAnchor(null); onExplain(metric); }}><CommercialMetricValue metric={metric} /><InformationCircleIcon aria-hidden="true" /></button>
    {anchor && createPortal(<div id={id} role="tooltip" className="cp-probability-tooltip" style={anchor}><strong><CommercialMetricValue metric={metric} /> <InformationCircleIcon aria-hidden="true" /></strong><p>{metric.definition}</p><p>{metric.reason}</p><span>Click to view source details</span></div>, document.body)}</>;
}

const COLUMNS = [['name', 'Opportunity'], ['client_name', 'Client'], ['stage_label', 'Stage'], ['estimated_value', 'Unweighted value'], ['probability', 'Probability'], ['weighted_value', 'Weighted value'], ['submission_due_date', 'Submission target'], ['expected_close_date', 'Expected close'], ['owner', 'Opportunity owner']];
function compareRows(a, b, key, direction) {
  const numeric = ['estimated_value', 'probability', 'weighted_value'].includes(key);
  const left = a[key], right = b[key];
  const leftMissing = left == null || left === '' || numeric && !numberPresent(left);
  const rightMissing = right == null || right === '' || numeric && !numberPresent(right);
  if (leftMissing !== rightMissing) return leftMissing ? 1 : -1;
  if (leftMissing) return String(a.name).localeCompare(String(b.name));
  const comparison = numeric ? Number(left) - Number(right) : String(left).localeCompare(String(right));
  return (comparison || String(a.name).localeCompare(String(b.name))) * (direction === 'asc' ? 1 : -1);
}

function OpportunityRegister({ commercial, currency, onExplain, printing }) {
  const register = commercial.register || {};
  const rows = useMemo(() => (register.opportunities || []).map(row => row.flags?.some(flag => flag.code === 'invalid_weighting')
    ? { ...row, weighted_value: null } : row), [register.opportunities]);
  const [filters, setFilters] = useState({ search: '', stage: 'all', business_unit: 'all', client: 'all', owner: 'all' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [sort, setSort] = useState({ key: 'estimated_value', direction: 'desc' });
  useEffect(() => {
    setPage(1);
    setFilters({ search: '', stage: 'all', business_unit: 'all', client: 'all', owner: 'all' });
  }, [currency]);
  const selected = useMemo(() => rows.filter(row => originalCurrency(row) === currency), [rows, currency]);
  const total = register.total_rows_by_currency?.[currency] ?? (!register.truncated && validSource(register.status) ? selected.length : null);
  const filtered = useMemo(() => selected.filter(row => printing || (
    [row.name, row.code, row.client_name].some(value => String(value || '').toLowerCase().includes(filters.search.trim().toLowerCase()))
    && (filters.stage === 'all' || row.stage === filters.stage)
    && (filters.business_unit === 'all' || row.business_unit === filters.business_unit)
    && (filters.client === 'all' || String(row.client_id || row.client_name || 'UNASSIGNED') === filters.client)
    && (filters.owner === 'all' || (row.owner || 'Unassigned') === filters.owner)
  )).sort((a, b) => compareRows(a, b, sort.key, sort.direction)), [selected, filters, sort, printing]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize)), currentPage = Math.min(page, pages);
  const start = printing ? 0 : (currentPage - 1) * pageSize;
  const visible = printing ? filtered : filtered.slice(start, start + pageSize);
  const stages = [...new Map(selected.map(row => [row.stage, row.stage_label || row.stage])).entries()];
  const units = [...new Set(selected.map(row => row.business_unit).filter(Boolean))].sort();
  const clients = [...new Map(selected.map(row => [String(row.client_id || row.client_name || 'UNASSIGNED'), row.client_name || 'Unassigned'])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const owners = [...new Set(selected.map(row => row.owner || 'Unassigned'))].sort();
  const update = (key, value) => { setFilters(current => ({ ...current, [key]: value })); setPage(1); };
  const sortColumn = key => { setSort(current => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' })); setPage(1); };
  const pageNumbers = Array.from({ length: pages }, (_, index) => index + 1).filter(number => number === 1 || number === pages || Math.abs(number - currentPage) <= 1);
  return <section className="cp-panel cp-register" aria-labelledby="cp-register-title" data-testid="commercial-register"><div className="cp-panel-heading"><h2 id="cp-register-title">Opportunity register</h2><span className="cp-register-count">{validSource(register.status) && numberPresent(total) ? `${formatNumber(total)} open opportunities${currency ? ` · ${currency}` : ''}` : <Status status={register.status || commercial.status} />}</span></div>
    {validSource(register.status) ? <><div className="cp-register-filters cc-screen-only"><label className="cp-search"><span className="cc-sr-only">Search opportunities</span><MagnifyingGlassIcon /><input type="search" aria-label="Search opportunities" placeholder="Search opportunity, client or reference…" value={filters.search} onChange={event => update('search', event.target.value)} /></label><label>Stage<select aria-label="Commercial stage" value={filters.stage} onChange={event => update('stage', event.target.value)}><option value="all">All</option>{stages.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>Business unit<select aria-label="Commercial business unit" value={filters.business_unit} disabled={!units.length} title={!units.length ? 'Business units are not recorded in this source.' : undefined} onChange={event => update('business_unit', event.target.value)}><option value="all">All</option>{units.map(value => <option key={value}>{value}</option>)}</select></label><label>Client<select aria-label="Commercial client" value={filters.client} onChange={event => update('client', event.target.value)}><option value="all">All</option>{clients.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>Opportunity owner<select aria-label="Commercial opportunity owner" value={filters.owner} onChange={event => update('owner', event.target.value)}><option value="all">All</option>{owners.map(value => <option key={value}>{value}</option>)}</select></label></div>
    {visible.length ? <div className="cc-table-wrap"><table className="cc-table cp-register-table"><caption className="cc-sr-only">Open opportunities in {currency}, using stored CRM values and probability</caption><thead><tr>{COLUMNS.map(([key, label]) => <th key={key} scope="col" aria-sort={sort.key === key ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'}><button className="cp-sort" onClick={() => sortColumn(key)}>{label}<ArrowsUpDownIcon /></button></th>)}<th scope="col">Health</th><th scope="col">Action</th></tr></thead><tbody>{visible.map(row => <tr key={row.id} className={row.health === 'attention' ? 'cp-attention-row' : ''} data-testid={`commercial-opportunity-${row.id}`}>
      <th scope="row"><span className="cp-truncate" title={`${row.code} · ${row.name}`}>{row.name}</span></th><td><span className="cp-truncate" title={row.client_name}>{row.client_name || 'Unassigned'}</span></td><td><span className="cp-truncate" title={row.stage_label}>{row.stage_label || row.stage}</span></td><td className="cp-money-cell">{numberPresent(row.estimated_value) ? `${originalCurrency(row)} ${formatNumber(row.estimated_value, { notation: Math.abs(Number(row.estimated_value)) >= 1000000 ? 'compact' : 'standard' })}` : '—'}</td><td><ProbabilityButton opportunity={row} onExplain={onExplain} /></td><td className="cp-money-cell">{numberPresent(row.weighted_value) ? `${originalCurrency(row)} ${formatNumber(row.weighted_value, { notation: Math.abs(Number(row.weighted_value)) >= 1000000 ? 'compact' : 'standard' })}` : '—'}</td><td>{shortDate(row.submission_due_date)}</td><td>{shortDate(row.expected_close_date)}</td><td><span className="cp-truncate" title={row.owner || 'Opportunity owner not recorded'}>{row.owner || 'Unassigned'}</span></td><td><CommercialHealth opportunity={row} /></td><td><RouteLink route={row.route} className="cc-table-action">{row.health === 'attention' ? 'Review' : 'Open'}</RouteLink></td>
    </tr>)}</tbody></table></div> : <EmptyState title={selected.length ? 'No opportunities match these filters' : currency ? `No loaded opportunities in ${currency}` : 'No open opportunities reported'} detail={register.truncated ? 'The source preview is limited. Open the complete opportunity register for other records.' : undefined} />}
    <div className="cp-pagination"><span>{filtered.length ? `Showing ${start + 1}–${start + visible.length} of ${filtered.length}` : 'Showing 0'} loaded opportunities</span><nav className="cc-screen-only" aria-label="Opportunity pages"><button aria-label="Previous opportunity page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeftIcon /></button>{pageNumbers.map((number, index) => <React.Fragment key={number}>{index > 0 && number > pageNumbers[index - 1] + 1 && <span>…</span>}<button aria-label={`Opportunity page ${number}`} aria-current={currentPage === number ? 'page' : undefined} onClick={() => setPage(number)}>{number}</button></React.Fragment>)}<button aria-label="Next opportunity page" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}><ChevronRightIcon /></button></nav><label className="cc-screen-only">Rows per page<select aria-label="Opportunities per page" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}>{[5, 10, 20].map(value => <option key={value}>{value}</option>)}</select></label></div>
    {register.truncated && <p className="cp-panel-note">This report includes {rows.length} of {formatNumber(register.total_rows)} open opportunities across all currencies. Filters apply to loaded rows. <RouteLink route="/sales/opportunities">Open full register</RouteLink></p>}
    </> : <EmptyState title={sourceTitle(register.status, 'Opportunity register not connected')} detail="An accessible CRM opportunity source is required." />}
    <p className="cp-panel-note">Expected close is the CRM target, not a confirmed award date. Probability is a stored estimate; absence of flags does not establish bid readiness.</p>
  </section>;
}

function PipelineOutlook({ commercial, currency, onExplain }) {
  const metric = unknownCommercialMetric('pipeline_outlook', 'Pipeline outlook', commercial.pipeline_outlook?.description || 'An approved period-based award forecast and revenue requirement are not connected. Expected opportunity close dates do not establish a revenue forecast.');
  return <section className="cp-panel cp-outlook" aria-labelledby="cp-outlook-title" data-testid="commercial-pipeline-outlook"><div className="cp-panel-heading"><h2 id="cp-outlook-title">Pipeline outlook</h2><button className="cc-info-button" aria-label="About pipeline outlook" onClick={() => onExplain(metric)}><InformationCircleIcon /></button></div><p className="cp-chart-subtitle">12-month expected award value vs revenue requirement{currency ? ` · ${currency}` : ''}</p>
    <div className="cp-outlook-grid"><div><div className="cp-chart-legend"><span><i className="cp-legend-committed" />Committed</span><span><i />High confidence</span><span><i className="cp-legend-medium" />Medium confidence</span><span><i className="cp-legend-target" />Revenue requirement</span></div><div className="cp-outlook-chart cp-empty-chart"><EmptyState title="Award forecast not connected" detail="Approved time series and revenue requirement required." /></div></div><aside className="cp-fy-summary" aria-label="Commercial full year summary"><h3>FY summary</h3>{[['fy_target', 'FY target'], ['secured_revenue', 'Secured'], ['weighted_gap', 'Weighted gap'], ['forecast_confidence', 'Forecast confidence']].map(([id, label]) => <button key={id} onClick={() => onExplain(unknownCommercialMetric(id, label, 'A common approved revenue plan, secured revenue and forecast basis are not connected.'))}><span>{label}</span><strong>—</strong></button>)}</aside></div></section>;
}

function PipelineMovement({ commercial, onExplain }) {
  const metric = unknownCommercialMetric('pipeline_movement', 'Pipeline movement', commercial.pipeline_movement?.description || 'Comparable opening and closing pipeline snapshots and classified movements are not connected. Current opportunity values cannot reconstruct historical movements.');
  return <section className="cp-panel cp-movement" aria-labelledby="cp-movement-title" data-testid="commercial-pipeline-movement"><div className="cp-panel-heading"><h2 id="cp-movement-title">Pipeline movement</h2><button className="cc-info-button" aria-label="About pipeline movement" onClick={() => onExplain(metric)}><InformationCircleIcon /></button></div><div className="cp-movement-chart cp-empty-chart"><EmptyState title="Pipeline movement not connected" detail="Opening and closing snapshots with classified changes required." /></div><p className="cp-panel-note">New work, probability changes, wins, losses and slipped targets</p></section>;
}

function WonHandoff({ commercial, onExplain }) {
  const handoff = commercial.won_handoff || {};
  const metric = { ...unknownCommercialMetric('won_handoff', 'Won opportunity handover', handoff.description || 'Approved opportunities follow the governed Project Handover process. Handover source access is required.'), status: handoff.status || 'unavailable', route: handoff.route };
  return <div className="cp-handoff" data-testid="commercial-won-handoff"><InformationCircleIcon aria-hidden="true" /><p><strong>Won work enters controlled handover.</strong> Approved awards proceed through Project Handover for acceptance and project conversion.{validSource(handoff.status) && numberPresent(handoff.count) && <> <b>{formatNumber(handoff.count)}</b> approved awards await conversion across all currencies.</>}</p>{validSource(handoff.status) && handoff.route ? <RouteLink route={handoff.route}>Open project handovers<ArrowRightIcon /></RouteLink> : <button className="cc-text-button" onClick={() => onExplain(metric)}>Source details</button>}</div>;
}

export default function CommercialPipeline({ report, commercial, currency, onExplain, printing = false }) {
  return <div className="commercial-performance" data-testid="commercial-pipeline"><CommercialOutcomes commercial={commercial} currency={currency} onExplain={onExplain} /><div className="cp-layout"><div className="cp-main-column" data-testid="commercial-main-column"><CommercialDecisions commercial={commercial} onExplain={onExplain} printing={printing} /><OpportunityRegister commercial={commercial} currency={currency} onExplain={onExplain} printing={printing} /><div className="cp-bottom-grid"><PipelineOutlook commercial={commercial} currency={currency} onExplain={onExplain} /><PipelineMovement commercial={commercial} onExplain={onExplain} /></div></div><aside className="cp-right-column" aria-label="Bid calendar, client exposure and commercial quality" data-testid="commercial-right-column"><CommercialBidCalendar report={report} commercial={commercial} currency={currency} onExplain={onExplain} printing={printing} /><CommercialClientConcentration report={report} commercial={commercial} currency={currency} onExplain={onExplain} printing={printing} /><CommercialResourceDemand report={report} commercial={commercial} currency={currency} onExplain={onExplain} /><CommercialQuality report={report} commercial={commercial} currency={currency} onExplain={onExplain} /></aside></div><WonHandoff commercial={commercial} onExplain={onExplain} /></div>;
}
