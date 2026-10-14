/* eslint-disable react/prop-types */
import React, { useMemo, useState } from 'react';
import { ArrowRightIcon, BriefcaseIcon, ChartBarIcon, ChevronLeftIcon, ChevronRightIcon, InformationCircleIcon, MagnifyingGlassIcon, UserGroupIcon, ArrowTrendingUpIcon, GlobeAltIcon } from '@heroicons/react/24/outline';
import { EmptyState, RouteLink, Status } from './ExecutivePrimitives';
import ExecutiveKpiCard from './ExecutiveKpiCard';
import { formatDate, formatNumber } from './executivePresentation';
import { WORKFORCE_OUTCOMES, WorkforceMetric, WorkforceSectionHeader, WorkforceSourceNote, WorkforceUnavailable, workforceMetric, workforceNumberPresent, workforceSourceAvailable, unknownWorkforceMetric } from './workforcePresentation';
import { CriticalRoles, ProjectCoverageRisk, RetentionMobility, WorkforceDistribution } from './WorkforceSidePanels';
import './WorkforcePerformance.css';

const OUTCOME_ICONS = [UserGroupIcon, ArrowTrendingUpIcon, BriefcaseIcon, GlobeAltIcon, ChartBarIcon];
const OUTCOME_TONES = ['blue', 'purple', 'green', 'rose', 'amber'];
const PRIORITY = { critical: 0, high: 1, medium: 2, low: 3 };

function WorkforceOutcomes({ workforce, onExplain }) {
  return <section className="wf-outcomes" aria-label="Five workforce outcomes" data-testid="workforce-outcomes">{WORKFORCE_OUTCOMES.map((item, index) => {
    const metric = workforceMetric(workforce, item.id);
    return <ExecutiveKpiCard key={item.id} className={`wf-outcome wf-outcome--${item.id}`} valueClassName="wf-outcome-value"
      testId={`workforce-kpi-${item.id}`} tone={OUTCOME_TONES[index]} icon={OUTCOME_ICONS[index]}
      label={item.label} metric={metric} value={<WorkforceMetric metric={metric} />} onExplain={onExplain}>
      <div className="wf-outcome-bottom"><Status status={metric.status} /><span>{item.basis}</span></div>
    </ExecutiveKpiCard>;
  })}</section>;
}

function WorkforceDecisions({ workforce, onExplain, printing }) {
  const [expanded, setExpanded] = useState(false);
  const status = workforce.actions_status || workforce.status;
  const actions = workforceSourceAvailable(status) ? [...(workforce.actions || [])].sort((a, b) => (PRIORITY[a.severity] ?? 9) - (PRIORITY[b.severity] ?? 9)) : [];
  const visible = expanded || printing ? actions : actions.slice(0, 3);
  return <section className="wf-panel wf-decisions" data-testid="workforce-decisions"><WorkforceSectionHeader title="Workforce decisions required" action={actions.length > 3 && <button className="cc-text-button cc-screen-only" onClick={() => setExpanded(value => !value)}>{expanded ? 'Show top 3 decisions' : `View all ${actions.length} decisions`}<ArrowRightIcon /></button>} />
    <div className="cc-table-wrap"><table className="cc-table wf-decisions-table"><caption className="cc-sr-only">Aggregate workforce decisions and recorded accountability</caption><thead><tr>{['Priority', 'Decision', 'Impact / context', 'Owner', 'Deadline', 'Action'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{visible.map(action => <tr key={action.id}><td><Status status={action.severity} /></td><th scope="row"><button className="cc-cell-button" onClick={() => onExplain({ id: action.id, label: action.title, description: action.detail, status: 'available', source: 'Aggregate employee master checks', route: action.route })}>{action.title}</button></th><td><span className="wf-decision-context" title={action.impact || action.detail}>{action.impact || action.detail || 'Not recorded'}</span></td><td>{action.owner || 'Unassigned'}</td><td>{action.due_date ? formatDate(action.due_date) : '—'}</td><td><RouteLink route={action.route} className="cc-table-action">Review</RouteLink></td></tr>)}</tbody></table></div>
    {!visible.length && (workforceSourceAvailable(status) ? <EmptyState title="No workforce actions reported" detail="No exceptions were returned by the connected aggregate HR checks." /> : <WorkforceUnavailable section={{ status }} title="Workforce decisions unavailable" />)}
    <p className="wf-source-note">Actions reflect aggregate HR records. Capacity interventions and decision deadlines require an approved workforce plan.{workforce.actions_truncated ? ` Showing ${workforce.actions_returned} of ${workforce.action_count} source actions.` : ''}</p>
  </section>;
}

function CapacityPlan({ workforce, onExplain, printing }) {
  const section = workforce.capacity_plan || {};
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [sort, setSort] = useState({ field: 'department', descending: false });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const rows = workforceSourceAvailable(section.status) ? section.rows || [] : [];
  const departments = [...new Set(rows.map(row => row.department))].sort((a, b) => a.localeCompare(b));
  const selectedDepartment = departments.includes(department) ? department : '';
  const filtered = useMemo(() => rows.filter(row => (printing || ((!selectedDepartment || row.department === selectedDepartment) && row.department.toLowerCase().includes(search.trim().toLowerCase())))).sort((a, b) => {
    const order = sort.field === 'headcount' ? (a.headcount ?? -1) - (b.headcount ?? -1) : a.department.localeCompare(b.department);
    return (sort.descending ? -order : order) || a.department.localeCompare(b.department);
  }), [rows, printing, selectedDepartment, search, sort]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = printing ? filtered : filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const changeSort = field => { setSort(value => ({ field, descending: value.field === field ? !value.descending : false })); setPage(1); };
  return <section className="wf-panel wf-capacity-panel" data-testid="workforce-capacity-plan"><WorkforceSectionHeader title="Discipline capacity plan" action={<span className="wf-register-count">{workforceNumberPresent(section.total_rows) ? `${formatNumber(section.total_rows)} departments` : 'Coverage unavailable'}</span>} />
    <div className="wf-capacity-filters cc-screen-only"><label className="wf-search"><MagnifyingGlassIcon aria-hidden="true" /><input aria-label="Search workforce departments" placeholder="Search department…" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></label><label>Business unit<select aria-label="Capacity business unit" disabled title="Cross-filtered capacity by business unit is not connected"><option>Not connected</option></select></label><label>Location<select aria-label="Capacity location" disabled title="Location staffing commitments are not connected"><option>Not connected</option></select></label><label>Department<select aria-label="Workforce department" value={selectedDepartment} onChange={event => { setDepartment(event.target.value); setPage(1); }}><option value="">All departments</option>{departments.map(label => <option key={label}>{label}</option>)}</select></label><label>Demand source<select aria-label="Capacity demand source" disabled><option>Not connected</option></select></label></div>
    <p className="wf-table-basis">Current headcount by recorded department · people. Discipline FTE and demand are not connected.</p>
    <div className="cc-table-wrap"><table className="cc-table wf-capacity-table"><caption className="cc-sr-only">Department headcount and availability of approved capacity measures</caption><thead><tr><th scope="col" aria-sort={sort.field === 'department' ? sort.descending ? 'descending' : 'ascending' : 'none'}><button className="wf-sort" onClick={() => changeSort('department')}>Department ↕</button></th><th scope="col" aria-sort={sort.field === 'headcount' ? sort.descending ? 'descending' : 'ascending' : 'none'}><button className="wf-sort" onClick={() => changeSort('headcount')}>Headcount ↕</button></th>{['Available FTE', 'Committed FTE', 'Forecast demand', 'Coverage', 'Utilization', 'Critical skills', 'Capacity status', 'Action'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{visible.map(row => <tr key={row.id ?? row.department}><th scope="row">{row.department}</th><td><strong>{formatNumber(row.headcount)}</strong></td>{Array.from({ length: 6 }, (_, i) => <td key={i}><span title="Approved capacity data is not connected">—</span></td>)}<td><span className="wf-neutral-state">Not assessed</span></td><td><RouteLink route={row.route} className="cc-table-action">Open</RouteLink></td></tr>)}</tbody></table></div>
    {!visible.length && (workforceSourceAvailable(section.status) ? <EmptyState title={rows.length ? 'No departments match your filters' : 'No current employees reported'} detail={rows.length ? 'Change the search or department selection.' : 'The populated HR source reports no current employees.'} /> : <WorkforceUnavailable section={section} title="Capacity reporting unavailable" />)}
    {workforceSourceAvailable(section.status) && <div className="wf-pagination cc-screen-only"><span>{filtered.length ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filtered.length)} of ${filtered.length} returned departments` : '0 matching departments'}</span><nav aria-label="Workforce department pages"><button aria-label="Previous workforce page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeftIcon /></button><span>Page {currentPage} of {pageCount}</span><button aria-label="Next workforce page" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}><ChevronRightIcon /></button></nav><label>Rows per page<select aria-label="Workforce rows per page" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}>{[6, 10, 20].map(value => <option key={value}>{value}</option>)}</select></label></div>}
    <div className="wf-panel-footer"><p className="wf-source-note">{section.truncated ? `Source preview: ${section.returned_rows} of ${section.total_rows} departments. Filters use returned rows.` : 'Department labels do not establish engineering disciplines or available project capacity.'}</p><button className="cc-text-button" onClick={() => onExplain({ id: 'workforce-capacity-basis', label: 'Capacity reporting basis', status: section.status, source: 'Aggregate employee master', description: section.description, metrics: [{ id: 'department-headcount-basis', label: 'Department reporting basis', status: section.status, source: 'Aggregate employee master', description: section.description }, ...(workforce.data_quality?.metrics || [])] })}>Reporting basis<InformationCircleIcon /></button></div>
  </section>;
}

function SupplyDemand({ workforce, onExplain }) {
  const section = workforce.supply_demand_outlook || {};
  const insight = (id, label, description) => unknownWorkforceMetric(id, label, description, 'count', ['restricted', 'error'].includes(section.status) ? section.status : 'unavailable');
  return <section className="wf-panel" data-testid="workforce-supply-demand"><WorkforceSectionHeader title="Supply and demand outlook" /><div className="wf-outlook-grid"><div><div className="wf-chart-legend"><span><i />Available capacity</span><span><i className="wf-legend-committed" />Committed demand</span><span><i className="wf-legend-pipeline" />Weighted pipeline demand</span></div><div className="wf-empty-chart"><WorkforceUnavailable section={section} title="Capacity forecast unavailable" /></div></div><aside className="wf-key-insights" aria-label="Capacity forecast insights"><h3>Key insights</h3>{[
    insight('peak_gap', 'Peak gap', 'Approved capacity and dated project demand are required.'),
    insight('gap_timing', 'Capacity gap begins', 'A time-phased staffing plan is required.'),
    insight('released_capacity', 'Capacity released', 'Approved resource release dates are required.'),
    insight('forecast_confidence', 'Forecast confidence', 'A verified demand forecast and confidence model are required.'),
  ].map(metric => <button key={metric.id} onClick={() => onExplain(metric)}><span>{metric.label}</span><strong>—</strong></button>)}<p>Forward demand is not inferred from employee counts.</p></aside></div></section>;
}

function Movement({ workforce, onExplain }) {
  const section = workforce.workforce_movement || {};
  const series = workforceSourceAvailable(section.status) ? section.series || [] : [];
  const maximum = Math.max(1, ...series.flatMap(row => [Number(row.joiners) || 0, Number(row.exits) || 0]));
  const metrics = section.metrics || [];
  return <section className="wf-panel wf-movement" data-testid="workforce-movement"><WorkforceSectionHeader title="Workforce movement" detail="Recorded joiners and exits · last six calendar months" action={<span className="wf-register-count">People</span>} /><div className="wf-movement-layout"><div><div className="wf-chart-legend"><span><i className="wf-legend-joiners" />Joiners</span><span><i className="wf-legend-exits" />Recorded exits</span></div>{series.length ? <div className="wf-movement-chart" role="img" aria-label={`Recorded workforce movement: ${series.map(row => `${row.label}: ${row.joiners} joiners, ${row.exits} exits`).join('; ')}`}><div className="wf-movement-scale" aria-hidden="true"><span>{maximum}</span><span>0</span></div><div className="wf-movement-bars" aria-hidden="true">{series.map(row => <div className="wf-movement-month" key={row.month}><div className="wf-movement-pair"><div><strong>{formatNumber(row.joiners)}</strong><i style={{ height: `${Math.max(0, Number(row.joiners) / maximum * 64)}px` }} /></div><div><strong>{formatNumber(row.exits)}</strong><i className="wf-exit-bar" style={{ height: `${Math.max(0, Number(row.exits) / maximum * 64)}px` }} /></div></div><span>{row.label}</span></div>)}</div></div> : <WorkforceUnavailable section={section} title="Recorded movement unavailable" />}</div><aside className="wf-movement-summary" aria-label="Recorded movement in the last 30 days"><h3>Last 30 days</h3>{metrics.map(metric => <button key={metric.id} onClick={() => onExplain(metric)}><span>{metric.label}</span><strong><WorkforceMetric metric={metric} /></strong></button>)}<p>Exit reasons and opening headcount are not inferred.</p></aside></div><WorkforceSourceNote section={section} /></section>;
}

export default function WorkforcePerformance({ workforce, onExplain, printing = false }) {
  return <div className="workforce-performance" data-testid="workforce-performance"><WorkforceOutcomes workforce={workforce} onExplain={onExplain} /><div className="wf-layout"><div className="wf-main-column"><WorkforceDecisions workforce={workforce} onExplain={onExplain} printing={printing} /><CapacityPlan workforce={workforce} onExplain={onExplain} printing={printing} /><SupplyDemand workforce={workforce} onExplain={onExplain} /><Movement workforce={workforce} onExplain={onExplain} /></div><aside className="wf-right-column" aria-label="Workforce risks and distribution"><CriticalRoles workforce={workforce} onExplain={onExplain} printing={printing} /><ProjectCoverageRisk workforce={workforce} onExplain={onExplain} printing={printing} /><RetentionMobility workforce={workforce} onExplain={onExplain} printing={printing} /><WorkforceDistribution workforce={workforce} onExplain={onExplain} printing={printing} /></aside></div></div>;
}
