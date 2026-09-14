/* eslint-disable react/prop-types */
import React, { useMemo, useRef, useState } from 'react';
import { ArrowRightIcon, ChevronLeftIcon, ChevronRightIcon, ClipboardDocumentCheckIcon, ClockIcon, DocumentMagnifyingGlassIcon, HeartIcon, InformationCircleIcon, MagnifyingGlassIcon, ShieldExclamationIcon } from '@heroicons/react/24/outline';
import { EmptyState, RouteLink, Status } from './ExecutivePrimitives';
import ExecutiveKpiCard from './ExecutiveKpiCard';
import { formatDate, formatNumber } from './executivePresentation';
import { RISK_OUTCOMES, RiskMetric, RiskSectionHeader, RiskSourceNote, RiskUnavailable, riskMetric, riskNumberPresent, riskSourceAvailable } from './riskPresentation';
import { QHSEPerformance, ComplianceCalendar, AuditControls, RiskConcentration } from './RiskSidePanels';
import './RiskCompliance.css';

const PRIORITY = { critical: 0, high: 1, medium: 2, low: 3 };
const OUTCOME_ICONS = [ShieldExclamationIcon, ClockIcon, HeartIcon, ClipboardDocumentCheckIcon, DocumentMagnifyingGlassIcon];
const OUTCOME_TONES = ['blue', 'purple', 'green', 'rose', 'amber'];
const CATEGORY_LABELS = { quality: 'Project quality', audit_schedule: 'Audit schedule' };
const STATUS_LABELS = { reported_delay: 'Recorded delay', past_target_date: 'Past target date' };
const shortDate = value => value ? formatDate(value).replace(/ \d{4}$/, '') : '—';

function RiskOutcomes({ risk, onExplain }) {
  return <section className="rc-outcomes" aria-label="Five assurance outcomes" data-testid="risk-outcomes">{RISK_OUTCOMES.map((item, index) => {
    const metric = riskMetric(risk, item.id);
    return <ExecutiveKpiCard className="rc-outcome" key={item.id} valueClassName="rc-outcome-value"
      testId={`risk-kpi-${item.id}`} tone={OUTCOME_TONES[index]} icon={OUTCOME_ICONS[index]}
      label={item.label} metric={metric} value={<RiskMetric metric={metric} />} onExplain={onExplain}>
      <Status status={metric.status} /><p className="rc-outcome-basis">{item.basis}</p>
    </ExecutiveKpiCard>;
  })}</section>;
}

function ExecutiveRiskActions({ risk, onExplain, printing }) {
  const [expanded, setExpanded] = useState(false);
  const status = risk.actions_status || risk.status;
  const actions = riskSourceAvailable(status) ? [...(risk.actions || [])].sort((a, b) => (PRIORITY[a.severity] ?? 9) - (PRIORITY[b.severity] ?? 9)) : [];
  const visible = printing || expanded ? actions : actions.slice(0, 3);
  const explain = action => onExplain({ id: action.id, label: action.title, description: action.detail, source: action.source || 'Recorded QHSE follow-up', status: 'available', route: action.route });
  return <section className="rc-panel rc-actions" data-testid="risk-actions"><RiskSectionHeader title="Executive actions required" action={actions.length > 3 && <button className="cc-text-button cc-screen-only" onClick={() => setExpanded(value => !value)}>{expanded ? 'Show top 3 actions' : `View all ${actions.length} actions`}<ArrowRightIcon /></button>} />
    <div className="cc-table-wrap"><table className="cc-table rc-actions-table"><caption className="cc-sr-only">Executive assurance actions from connected QHSE sources</caption><thead><tr>{['Priority', 'Action', 'Related project / area', 'Impact / context', 'Review owner', 'Deadline', 'Action'].map((label, index) => <th scope="col" key={`${label}-${index}`}>{label}</th>)}</tr></thead><tbody>{visible.map(action => <tr key={action.id}><td><Status status={action.severity} /></td><th scope="row"><button className="cc-cell-button rc-truncate" title={action.title} onClick={() => explain(action)}>{action.title}</button></th><td><span className="rc-truncate" title={action.project_code || action.project_name}>{action.project_code || action.project_name || 'QHSE'}</span></td><td><span className="rc-truncate" title={action.impact || action.detail}>{action.impact || action.detail || 'Not recorded'}</span></td><td><span className="rc-truncate" title={action.owner}>{action.owner || 'Unassigned'}</span></td><td>{shortDate(action.due_date)}</td><td><RouteLink route={action.route} className="cc-table-action">Review</RouteLink></td></tr>)}</tbody></table></div>
    {!visible.length && (riskSourceAvailable(status) ? <EmptyState title={status === 'partial' ? 'Follow-up coverage incomplete' : 'No assurance actions reported'} detail="Actions reflect connected quality and audit schedule records." /> : <RiskUnavailable section={{ status }} title="Assurance actions unavailable" />)}
    <p className="rc-source-note">Source follow-ups require review; risk acceptance, financial exposure and approved treatment deadlines are not inferred.{status === 'partial' ? ' Some source coverage is unavailable.' : ''}{risk.actions_truncated ? ` Showing ${risk.actions_returned} of ${risk.action_count} source actions.` : ''}</p>
  </section>;
}

function SourceFollowups({ risk, onExplain, printing }) {
  const section = risk.source_followups || {};
  const available = riskSourceAvailable(section.status);
  const rows = available ? section.rows || [] : [];
  const [filters, setFilters] = useState({ search: '', category: '', recorded_owner: '', status: '' });
  const [sort, setSort] = useState({ field: 'title', descending: false });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const values = key => [...new Set(rows.map(row => row[key]).filter(Boolean))].sort();
  const filtered = useMemo(() => rows.filter(row => printing || (
    [row.title, row.project_name, row.project_code, row.recorded_owner].some(value => String(value || '').toLowerCase().includes(filters.search.trim().toLowerCase()))
    && ['category', 'recorded_owner', 'status'].every(key => !filters[key] || row[key] === filters[key])
  )).sort((a, b) => {
    const left = a[sort.field], right = b[sort.field];
    if (!left !== !right) return left ? -1 : 1;
    return String(left || '').localeCompare(String(right || '')) * (sort.descending ? -1 : 1) || String(a.id).localeCompare(String(b.id));
  }), [rows, filters, printing, sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const start = printing ? 0 : (currentPage - 1) * pageSize;
  const visible = printing ? filtered : filtered.slice(start, start + pageSize);
  const updateFilter = (key, value) => { setFilters(previous => ({ ...previous, [key]: value })); setPage(1); };
  const changeSort = field => { setSort(previous => ({ field, descending: previous.field === field ? !previous.descending : false })); setPage(1); };
  const sortHeader = (field, label) => <th scope="col" aria-sort={sort.field === field ? sort.descending ? 'descending' : 'ascending' : 'none'}><button className="rc-sort" onClick={() => changeSort(field)}>{label} ↕</button></th>;
  const explain = row => onExplain({ id: row.id, label: row.title, description: row.detail, source: row.source, status: 'available', route: row.route });
  return <div className="rc-source-followups" data-testid="risk-source-followups"><div className="rc-followups-heading"><h3>Recorded assurance follow-ups</h3><span className="rc-register-count">{available && riskNumberPresent(section.total_rows) ? `${formatNumber(section.total_rows)} source follow-ups` : <Status status={section.status} />}</span></div>
    {available && <div className="rc-register-filters cc-screen-only"><label className="rc-search"><MagnifyingGlassIcon aria-hidden="true" /><input type="search" aria-label="Search assurance follow-ups" placeholder="Search project, follow-up or owner…" value={filters.search} onChange={event => updateFilter('search', event.target.value)} /></label>{[['category', 'Category'], ['recorded_owner', 'Recorded owner'], ['status', 'Follow-up status']].map(([key, label]) => <label key={key}><span className="cc-sr-only">{label}</span><select aria-label={`Assurance ${label.toLowerCase()}`} value={filters[key]} onChange={event => updateFilter(key, event.target.value)}><option value="">{label}: All</option>{values(key).map(value => <option key={value} value={value}>{key === 'category' ? CATEGORY_LABELS[value] || value : key === 'status' ? STATUS_LABELS[value] || value : value}</option>)}</select></label>)}</div>}
    <div className="cc-table-wrap"><table className="cc-table rc-followups-table"><caption className="cc-sr-only">Connected assurance follow-ups, separate from enterprise risk ratings</caption><thead><tr>{sortHeader('title', 'Follow-up')}{sortHeader('category', 'Category')}{sortHeader('project_code', 'Project')}<th scope="col">Recorded context</th>{sortHeader('recorded_owner', 'Recorded owner')}{sortHeader('due_date', 'Audit target')}<th scope="col">Source status</th><th scope="col">Action</th></tr></thead><tbody>{visible.map(row => <tr key={row.id}><th scope="row"><button className="cc-cell-button rc-truncate" title={row.title} onClick={() => explain(row)}>{row.title}</button></th><td>{CATEGORY_LABELS[row.category] || row.category}</td><td><span className="rc-truncate" title={row.project_name}>{row.project_code || '—'}</span></td><td><span className="rc-truncate" title={row.detail}>{row.detail}</span></td><td><span className="rc-truncate" title={row.recorded_owner}>{row.recorded_owner || 'Not recorded'}</span><small>{row.owner_label || 'Source owner'}</small></td><td>{shortDate(row.due_date)}</td><td><span className="rc-followup-status">{STATUS_LABELS[row.status] || 'Source flag'}</span></td><td><RouteLink route={row.route} className="cc-table-action">Review</RouteLink></td></tr>)}</tbody></table></div>
    {!visible.length && (available ? <EmptyState title={rows.length ? 'No follow-ups match these filters' : section.status === 'partial' ? 'Follow-up coverage incomplete' : 'No recorded assurance follow-ups'} detail={rows.length ? 'Change the search or filter selection.' : 'No qualifying follow-ups were returned by the connected sources.'} /> : <RiskUnavailable section={section} title="Assurance follow-ups unavailable" />)}
    {available && <div className="rc-pagination cc-screen-only"><span>{filtered.length ? `${start + 1}–${start + visible.length} of ${filtered.length} returned follow-ups` : '0 matching follow-ups'}</span><nav aria-label="Assurance follow-up pages"><button aria-label="Previous assurance page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeftIcon /></button><span>Page {currentPage} of {pages}</span><button aria-label="Next assurance page" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}><ChevronRightIcon /></button></nav><label>Rows per page<select aria-label="Assurance rows per page" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}>{[6, 10, 20].map(value => <option key={value}>{value}</option>)}</select></label></div>}
    {section.truncated && <p className="rc-source-note">Source preview: {section.returned_rows} of {section.total_rows} follow-ups. Filters apply to returned rows.</p>}
    <RiskSourceNote section={section} />
  </div>;
}

function EnterpriseRegister({ risk, onExplain, printing, registerRef }) {
  const section = risk.register || {};
  return <section ref={registerRef} tabIndex={-1} className="rc-panel rc-register" data-testid="risk-register"><RiskSectionHeader title="Enterprise risk register" action={<button className="cc-text-button" onClick={() => onExplain({ id: 'enterprise-risk-register', label: 'Enterprise risk register', status: section.status, source: 'Governed enterprise risk register required', description: section.description })}>Reporting basis<InformationCircleIcon /></button>} />
    <div className="rc-enterprise-gap"><RiskUnavailable section={section} title="Enterprise risk register not connected" /></div>
    <SourceFollowups risk={risk} onExplain={onExplain} printing={printing} />
  </section>;
}

function RiskExposure({ risk, onExplain, registerRef }) {
  const heatmap = risk.heatmap || {}, movement = risk.risk_movement || {};
  const openRegister = () => { registerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); registerRef.current?.focus({ preventScroll: true }); };
  return <section className="rc-panel rc-exposure" data-testid="risk-exposure"><RiskSectionHeader title="Risk exposure and movement" action={<button className="cc-info-button" aria-label="About risk exposure and movement" onClick={() => onExplain({ label: 'Risk exposure and movement', metrics: [{ id: 'risk-heatmap', label: 'Residual risk exposure', status: heatmap.status, source: 'Approved risk assessments required', description: heatmap.description }, { id: 'risk-movement', label: 'High risk movement', status: movement.status, source: 'Comparable historical risk snapshots required', description: movement.description }] })}><InformationCircleIcon /></button>} />
    <div className="rc-exposure-grid"><div className="rc-heatmap"><span className="rc-axis-y">Likelihood</span><div className="rc-heatmap-body"><div className="rc-matrix-grid" aria-hidden="true">{Array.from({ length: 25 }, (_, index) => <span key={index}>—</span>)}</div><div className="rc-matrix-message"><RiskUnavailable section={heatmap} title="Risk matrix unavailable" /></div></div><span className="rc-axis-x">Impact · approved scales required</span></div><div className="rc-movement"><h3>High risk movement (count)</h3><div className="rc-empty-chart"><RiskUnavailable section={movement} title="Risk history not connected" /></div></div></div>
    <div className="rc-panel-footer"><span className="rc-source-note">No residual rating or risk change is inferred.</span><button className="cc-text-button cc-screen-only" onClick={openRegister}>View source follow-ups<ArrowRightIcon /></button></div>
  </section>;
}

function MitigationEffectiveness({ risk, onExplain }) {
  const section = risk.mitigation_effectiveness || {};
  return <section className="rc-panel rc-mitigations" data-testid="risk-mitigations"><RiskSectionHeader title="Mitigation effectiveness" action={<button className="cc-info-button" aria-label="About mitigation effectiveness" onClick={() => onExplain({ id: 'mitigation-effectiveness', label: 'Mitigation effectiveness', status: section.status, source: 'Governed treatment and evidence register required', description: section.description })}><InformationCircleIcon /></button>} /><div className="rc-side-table-wrap" role="region" aria-label="Mitigation evidence and effectiveness" tabIndex={0}><table className="rc-side-table rc-mitigation-table"><thead><tr>{['Treatment', 'Linked risk', 'Due date', 'Evidence owner', 'Effectiveness', 'Status'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody><tr><td colSpan={6}><RiskUnavailable section={section} title="Treatment evidence not connected" /></td></tr></tbody></table></div><p className="rc-source-note">Closing a quality action does not by itself demonstrate risk reduction or control effectiveness.</p></section>;
}

export default function RiskCompliance({ risk, onExplain, printing = false }) {
  const registerRef = useRef(null);
  return <div className="risk-compliance" data-testid="risk-compliance"><div className="rc-layout"><div className="rc-main-column" data-testid="risk-main-column"><RiskOutcomes risk={risk} onExplain={onExplain} /><ExecutiveRiskActions risk={risk} onExplain={onExplain} printing={printing} /><EnterpriseRegister risk={risk} onExplain={onExplain} printing={printing} registerRef={registerRef} /><div className="rc-bottom-grid"><RiskExposure risk={risk} onExplain={onExplain} registerRef={registerRef} /><MitigationEffectiveness risk={risk} onExplain={onExplain} /></div></div><aside className="rc-right-column" aria-label="QHSE, compliance and assurance" data-testid="risk-right-column"><QHSEPerformance risk={risk} onExplain={onExplain} printing={printing} /><ComplianceCalendar risk={risk} onExplain={onExplain} printing={printing} /><AuditControls risk={risk} onExplain={onExplain} printing={printing} /><RiskConcentration risk={risk} onExplain={onExplain} printing={printing} /></aside></div></div>;
}
