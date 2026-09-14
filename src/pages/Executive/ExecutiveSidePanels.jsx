/* eslint-disable react/prop-types */
import React from 'react';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import { MetricValue, Status, RouteLink, EmptyState } from './ExecutivePrimitives';
import { DEPARTMENTS, formatDate, formatNumber, internalRoute } from './executivePresentation';

const REPORTED = new Set(['available', 'partial']);
const SEVERITY = { critical: 0, high: 1, medium: 2, low: 3 };
const KEY_METRICS = {
  engineering: ['process_reviews', 'electrical_rework'],
  finance: ['overdue_receivables', 'invoice_match_exceptions', 'receivables', 'payables'],
  hr: ['headcount', 'joiners_30d'],
  sales: ['active_opportunities', 'weighted_pipeline'],
  project_control: ['projects_at_risk', 'active_projects'],
  procurement: ['overdue_deliveries', 'pending_requisitions', 'po_commitments'],
  qhse: ['open_cars', 'overdue_car_projects', 'delayed_audit_projects'],
};

function unknownMetric(id, label, description, source = 'Source not connected', unit = 'count') {
  return { id, label, value: null, unit, status: 'unavailable', description,
    definition: description, reason: description, source, target: null, trend: null, period: 'current_snapshot' };
}

function findMetric(report, id, fallback) {
  return [...(report?.kpis || []), ...(report?.departments || []).flatMap(item => item.metrics || [])]
    .find(metric => metric.id === id) || fallback;
}

function ExplainButton({ metric, onExplain, label }) {
  return <button type="button" className="cc-info-button" onClick={() => onExplain?.(metric)}
    aria-label={label || `About ${metric.label}`} title={metric.description || metric.reason}>
    <InformationCircleIcon aria-hidden="true" />
  </button>;
}

function MiniStat({ metric, label, onExplain }) {
  const known = REPORTED.has(metric.status) && metric.value != null;
  const risk = ['project_risks', 'safety_incidents'].includes(metric.id);
  const tone = known && risk && Number(metric.value) > 0 ? 'danger'
    : known && metric.id === 'delayed_audit_projects' && Number(metric.value) > 0 ? 'warning'
      : known && metric.id === 'safety_incidents' && Number(metric.value) === 0 ? 'success' : 'neutral';
  return <button type="button" className={`cc-mini-stat cc-mini-stat--${tone}`} onClick={() => onExplain?.(metric)}
    title={metric.reason || metric.description} aria-label={`About ${label || metric.label}`}
    data-testid={`executive-side-metric-${metric.id}`}>
    <span className="cc-mini-stat-label">{label || metric.label}</span>
    <strong><MetricValue metric={metric} /></strong>
  </button>;
}

function sectionDescription(id, label, description, status = 'available') {
  return { id, label, description, definition: description, status,
    source: 'Authorized operational registers', period: 'current_snapshot', target: null, trend: null };
}

export function EnterpriseRisk({ report, onExplain }) {
  const portfolio = report?.portfolio || {};
  const riskMetric = {
    ...unknownMetric('project_risks', 'Project risks', 'Accessible projects with high or critical governed exceptions.', 'Project portfolio exceptions'),
    status: portfolio.status || 'unavailable',
    value: REPORTED.has(portfolio.status) ? portfolio.counts?.at_risk ?? null : null,
  };
  const mitigation = findMetric(report, 'overdue_mitigations', unknownMetric(
    'overdue_mitigations', 'Overdue mitigations', 'Mitigation owners and committed closure dates are not connected.', 'Risk mitigation register required',
  ));
  const incidents = findMetric(report, 'safety_incidents', unknownMetric(
    'safety_incidents', 'QHSE incidents', 'Verified safety incidents are not supplied. Quality corrective actions are not safety incidents.', 'Safety incident register required',
  ));
  const auditProjects = findMetric(report, 'delayed_audit_projects', unknownMetric(
    'delayed_audit_projects', 'Delayed audits (projects)', 'Projects with recorded audit delays are not available.', 'QHSE project register',
  ));
  const sections = report?.departments || [];
  const allowed = new Set(sections.filter(item => REPORTED.has(item.status)).map(item => item.id));
  const items = new Map();
  for (const item of [...(report?.actions || []), ...sections.flatMap(section => section.actions || [])]) {
    if (['project_control', 'qhse'].includes(item.department) && allowed.has(item.department)) items.set(item.id, item);
  }
  const risks = [...items.values()].sort((a, b) => (SEVERITY[a.severity] ?? 9) - (SEVERITY[b.severity] ?? 9)).slice(0, 4);
  const sourceInfo = sectionDescription('enterprise_risk_coverage', 'Enterprise risk coverage',
    'This panel shows recorded project and quality exceptions. An enterprise mitigation register and next-review dates are not connected. Due dates are not substituted for review dates.');

  return <section className="cc-panel cc-risk-panel" aria-labelledby="cc-enterprise-risk-title" data-testid="executive-enterprise-risk">
    <div className="cc-panel-heading"><h2 id="cc-enterprise-risk-title">Enterprise risk</h2><ExplainButton metric={sourceInfo} onExplain={onExplain} /></div>
    <div className="cc-mini-stats">
      <MiniStat metric={riskMetric} label="Project risks" onExplain={onExplain} />
      <MiniStat metric={mitigation} label="Overdue mitigations" onExplain={onExplain} />
      <MiniStat metric={incidents} label="QHSE incidents" onExplain={onExplain} />
      <MiniStat metric={auditProjects} label="Delayed audits (projects)" onExplain={onExplain} />
    </div>
    <h3 className="cc-side-subtitle">Top risks</h3>
    <div className="cc-table-wrap">
      <table className="cc-compact-table cc-risk-table" aria-label="Recorded project and quality risks">
        <thead><tr><th scope="col">Risk</th><th scope="col">Owner</th><th scope="col">Next review</th></tr></thead>
        <tbody>{risks.map(item => <tr key={item.id}>
          <td className="cc-risk-name" title={item.title}>{internalRoute(item.route) ? <RouteLink route={item.route}>{item.title}</RouteLink> : item.title}</td>
          <td title={item.owner || 'Owner not recorded'}>{item.owner || '—'}</td>
          <td title={item.next_review_date ? undefined : 'Next review date not recorded'}>{item.next_review_date ? formatDate(item.next_review_date) : '—'}</td>
        </tr>)}</tbody>
      </table>
      {!risks.length && <EmptyState title="No risk items reported" detail="Available source records do not establish an enterprise risk assessment." />}
    </div>
    <div className="cc-panel-footer"><span className="cc-panel-note">Project and quality exceptions</span>
      {REPORTED.has(portfolio.status) && <RouteLink route="/projects?view=portfolio-exceptions">Open project risks</RouteLink>}
    </div>
  </section>;
}

export function CapacityWorkforce({ report, onExplain }) {
  const workforce = report?.workforce || {};
  const hr = report?.departments?.find(item => item.id === 'hr');
  const headcount = findMetric(report, 'headcount', unknownMetric(
    'headcount', 'Headcount', 'Current employee headcount is not available.', 'Employee master',
  ));
  const criticalRoles = findMetric(report, 'critical_roles', unknownMetric(
    'critical_roles', 'Critical roles', 'A current critical-role coverage assessment is not connected.', 'Workforce planning required',
  ));
  const utilisation = findMetric(report, 'utilisation', unknownMetric(
    'utilisation', 'Billable utilisation', 'Approved billable hours and available capacity are required.', 'Approved time and capacity sources required', 'percent',
  ));
  const gap = findMetric(report, 'capacity_gap', unknownMetric(
    'capacity_gap', 'Capacity gap', 'Demand and available capacity need a common planning period.', 'Workforce planning required',
  ));
  const allocation = REPORTED.has(workforce.status) && workforce.unit === 'people' && Array.isArray(workforce.allocation)
    ? workforce.allocation.filter(row => typeof row.label === 'string' && row.count != null && row.count !== ''
      && Number.isFinite(Number(row.count)) && Number(row.count) >= 0)
      .map(row => ({ label: row.label || 'Unassigned', count: Number(row.count) }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    : [];
  const total = allocation.reduce((sum, row) => sum + row.count, 0);
  const visibleAllocation = allocation.length > 4
    ? [...allocation.slice(0, 3), { label: 'Other departments', count: allocation.slice(3).reduce((sum, row) => sum + row.count, 0) }]
    : allocation;
  const sourceInfo = { ...sectionDescription('workforce_coverage', 'Workforce allocation',
    workforce.description || 'Current employees by recorded department. These are people counts, not FTE, project staffing or a capacity plan.', workforce.status || 'unavailable'),
    source: workforce.source || 'Employee master',
  };

  return <section className="cc-panel cc-workforce-panel" aria-labelledby="cc-workforce-title" data-testid="executive-capacity-workforce">
    <div className="cc-panel-heading"><h2 id="cc-workforce-title">Capacity &amp; workforce</h2><ExplainButton metric={sourceInfo} onExplain={onExplain} /></div>
    <div className="cc-mini-stats">
      <MiniStat metric={headcount} label="Headcount" onExplain={onExplain} />
      <MiniStat metric={criticalRoles} label="Critical roles" onExplain={onExplain} />
      <MiniStat metric={utilisation} label="Billable utilisation" onExplain={onExplain} />
      <MiniStat metric={gap} label="Capacity gap" onExplain={onExplain} />
    </div>
    <div className="cc-allocation-heading"><span>Workforce by department</span><span>People</span></div>
    {visibleAllocation.length ? <div className="cc-allocation-list">{visibleAllocation.map(row => <div className="cc-allocation-row" key={row.label}
      aria-label={`${row.label}: ${formatNumber(row.count)} people`}>
      <span className="cc-allocation-label" title={row.label}>{row.label}</span>
      <span className="cc-allocation-track" aria-hidden="true"><span style={{ width: `${total > 0 ? row.count / total * 100 : 0}%` }} /></span>
      <span className="cc-allocation-value">{formatNumber(row.count)}</span>
    </div>)}</div> : <EmptyState title={workforce.status === 'restricted' ? 'Workforce access required' : 'Allocation not available'}
      detail="Department counts require the authorized employee master." />}
    <div className="cc-panel-footer"><span className="cc-panel-note">Recorded headcount · not FTE</span>
      {hr && REPORTED.has(hr.status) && <RouteLink route="/hr">Open workforce</RouteLink>}
    </div>
  </section>;
}

function departmentMetric(section) {
  if (section.status === 'restricted') return { ...unknownMetric(`${section.id}_coverage`, 'Restricted', 'Department read access is required.'), status: 'restricted' };
  const metrics = section.metrics || [];
  const preferred = (KEY_METRICS[section.id] || []).map(id => metrics.find(metric => metric.id === id)).filter(Boolean);
  return preferred.find(metric => REPORTED.has(metric.status)) || metrics.find(metric => REPORTED.has(metric.status))
    || preferred[0] || metrics[0] || unknownMetric(`${section.id}_coverage`, 'Not available',
    section.limitations?.join(' ') || 'No verified key metric is available for this department.');
}

function departmentStatus(section, report) {
  if (!REPORTED.has(section.status)) return { code: section.status || 'unavailable' };
  const actions = [...(section.actions || []), ...(report?.actions || []).filter(item => item.department === section.id)];
  const highest = actions.map(item => item.severity).filter(item => Object.hasOwn(SEVERITY, item))
    .sort((a, b) => SEVERITY[a] - SEVERITY[b])[0];
  if (highest) return { code: highest, label: highest === 'critical' ? 'Critical' : highest === 'high' ? 'Attention' : 'Review' };
  return { code: section.status, label: section.status === 'partial' ? 'Partial' : 'Reported' };
}

export function DepartmentPulse({ report, onExplain, onDepartment }) {
  const sourceInfo = sectionDescription('department_pulse_coverage', 'Department pulse',
    'Status reflects the highest severity in reported department alerts or source availability. Reported data and an empty alert preview do not establish that a department is on track.');
  return <section className="cc-panel cc-pulse-panel" aria-labelledby="cc-department-pulse-title" data-testid="executive-department-pulse">
    <div className="cc-panel-heading"><h2 id="cc-department-pulse-title">Department pulse</h2><ExplainButton metric={sourceInfo} onExplain={onExplain} /></div>
    <div className="cc-table-wrap"><table className="cc-compact-table cc-pulse-table" aria-label="Department reporting and exceptions">
      <thead><tr><th scope="col">Department</th><th scope="col">Key metric</th><th scope="col">Status</th><th scope="col"><span className="cc-sr-only">View department</span></th></tr></thead>
      <tbody>{DEPARTMENTS.map(metadata => {
        const section = report?.departments?.find(item => item.id === metadata.id)
          || { ...metadata, status: 'unavailable', metrics: [], actions: [] };
        const metric = departmentMetric(section);
        const status = departmentStatus(section, report);
        return <tr key={section.id} data-testid={`executive-department-${section.id}`}>
          <th scope="row" className="cc-pulse-name">{section.label || metadata.label}</th>
          <td><button type="button" className="cc-pulse-metric" title={metric.reason || metric.description} onClick={() => onExplain?.(metric)}
            aria-label={`About ${metadata.label}: ${metric.label}`}><strong><MetricValue metric={metric} /></strong><span>{metric.label}</span></button></td>
          <td><Status status={status.code}>{status.label}</Status></td>
          <td>{section.status !== 'restricted' && (onDepartment
            ? <button type="button" className="cc-text-link" onClick={() => onDepartment(section.id)} aria-label={`View ${metadata.label}`}>View</button>
            : <RouteLink route={section.route} aria-label={`Open ${metadata.label}`}>View</RouteLink>)}</td>
        </tr>;
      })}</tbody>
    </table></div>
  </section>;
}
