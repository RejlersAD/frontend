/* eslint-disable react/prop-types */
import React, { useState } from 'react';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import { EmptyState, RouteLink, Status } from './ExecutivePrimitives';
import { formatDate, formatNumber } from './executivePresentation';
import { RiskMetric, RiskSectionHeader, RiskSourceNote, RiskUnavailable, unknownRiskMetric } from './riskPresentation';

const REPORTED = new Set(['available', 'partial']);
const numberPresent = value => value != null && value !== '' && Number.isFinite(Number(value));
const QHSE_MEASURES = [
  ['recordable_incidents', 'Recordable incidents', 'Verified recordable incident events and a defined reporting period are not connected. Project quality records are not incident events.'],
  ['lost_time_injuries', 'Lost-time injuries', 'Verified lost-time injury events and a defined reporting period are not connected. This is an event count, not a rate per hours worked.'],
  ['near_misses', 'Near misses', 'Verified near-miss events are not connected. Quality observations are not safety near misses.'],
  ['quality_nonconformances', 'Quality nonconformities', 'An approved item-level nonconformity register is not connected. Project corrective-action totals do not establish distinct nonconformities.'],
  ['environmental_events', 'Environmental events', 'Verified environmental event records and a defined reporting period are not connected.'],
  ['overdue_corrective_actions', 'Corrective actions overdue', 'Individual corrective-action due dates and closure states are not connected. Projects with recorded closure delay do not establish the count of overdue actions.'],
];
const PROJECT_MEASURES = [
  ['open_cars', 'Open CARs (project totals)'],
  ['delayed_car_projects', 'Projects with delayed CARs'],
  ['open_observations', 'Open observations (project totals)'],
  ['delayed_observation_projects', 'Projects with delayed observations'],
  ['delayed_audit_projects', 'Projects with recorded audit delay'],
];
const CONTROL_MEASURES = [
  ['controls_tested', 'Controls tested', 'A governed control-testing register and reporting period are not connected.', 'count'],
  ['control_effectiveness', 'Control effectiveness', 'Approved testing outcomes and the tested-control denominator are not connected.', 'percent'],
  ['control_deficiencies', 'Control deficiencies', 'A governed register of distinct control deficiencies and their closure states is not connected.', 'count'],
  ['open_audit_findings', 'Open audit findings', 'Item-level audit findings and closure states are not connected. Free-text findings and delayed audit records do not establish open finding counts.', 'count'],
];
const AUDIT_MEASURES = [
  ['scheduled_audits', 'Scheduled audits'], ['delayed_audits', 'Delayed audits'], ['completed_audits', 'Completed audits'],
];

function sectionFor(risk, key, description) {
  const section = risk?.[key];
  return { ...section, status: section?.status || (['restricted', 'error'].includes(risk?.status) ? risk.status : 'unavailable'),
    description: section?.description || description };
}

function measure(section, id, label, description, unit = 'count', field = 'metrics') {
  const metric = section[field]?.find(item => item.id === id) || unknownRiskMetric(id, label, description, unit);
  return ['restricted', 'error'].includes(section.status)
    ? { ...metric, label, status: section.status, value: null, route: null }
    : { ...metric, label };
}

function definition(section, id, label, metrics) {
  return { ...unknownRiskMetric(id, label, section.description), status: section.status,
    source: section.source || 'Authorized QHSE source registers', route: section.route, metrics };
}

function ExplainButton({ metric, onExplain }) {
  return <button type="button" className="cc-info-button" aria-label={`About ${metric.label}`}
    title={metric.description || metric.reason} onClick={() => onExplain?.(metric)}>
    <InformationCircleIcon aria-hidden="true" />
  </button>;
}

function RecordedMeasures({ metrics, onExplain, className, testPrefix }) {
  return <div className={className}>{metrics.map(metric => <button type="button" key={metric.id}
    className="rc-recorded-metric" data-testid={`${testPrefix}-${metric.id}`}
    aria-label={`About ${metric.label}`} title={metric.description || metric.reason} onClick={() => onExplain?.(metric)}>
    <span>{metric.label}</span><strong><RiskMetric metric={metric} /></strong>
  </button>)}</div>;
}

export function QHSEPerformance({ risk, onExplain }) {
  const section = sectionFor(risk, 'qhse_performance',
    'Verified safety and environmental event registers are not connected. Current quality project aggregates are reported separately.');
  const metrics = QHSE_MEASURES.map(([id, label, description]) => measure(section, id, label, description));
  const projectMetrics = PROJECT_MEASURES.map(([id, label]) => measure(section, id, label,
    'Current active QHSE project register totals. Delay measures count projects and do not count distinct overdue quality items.', 'count', 'project_metrics'));
  const info = definition(section, 'risk_qhse_performance', 'QHSE performance', [...metrics, ...projectMetrics]);

  return <section className="rc-panel rc-qhse-panel" aria-label="QHSE performance" data-testid="risk-qhse-performance">
    <RiskSectionHeader title="QHSE performance" action={<ExplainButton metric={info} onExplain={onExplain} />} />
    <div className="rc-side-table-wrap" role="region" aria-label="QHSE event measures and definitions" tabIndex={0}>
      <table className="rc-side-table rc-qhse-table"><thead><tr>
        <th scope="col">Measure</th><th scope="col">Current</th><th scope="col">Unit</th><th scope="col">Trend</th>
      </tr></thead><tbody>{metrics.map(metric => <tr key={metric.id} data-testid={`risk-qhse-${metric.id}`}>
        <th scope="row"><button type="button" className="rc-measure-name" aria-label={`About ${metric.label}`}
          title={metric.description || metric.reason} onClick={() => onExplain?.(metric)}>{metric.label}</button></th>
        <td><strong><RiskMetric metric={metric} /></strong></td><td>Count</td>
        <td title="A verified comparable historical series is not connected">—</td>
      </tr>)}</tbody></table>
    </div>
    <p className="rc-panel-note">Event counts and historical comparisons require verified records. Rates per hours worked are not available.</p>
    <div className="rc-recorded-heading"><h3>Recorded project quality</h3><Status status={section.status} /></div>
    <RecordedMeasures metrics={projectMetrics} onExplain={onExplain} className="rc-qhse-project-summary" testPrefix="risk-qhse-project" />
    <RiskSourceNote section={section} />
    {REPORTED.has(section.status) && <div className="rc-panel-footer"><RouteLink route={section.route} arrow>Open QHSE register</RouteLink></div>}
  </section>;
}

export function ComplianceCalendar({ risk, onExplain, printing = false }) {
  const [expanded, setExpanded] = useState(false);
  const section = sectionFor(risk, 'compliance_calendar',
    'A permitted QHSE audit schedule is required. Statutory obligations, certification renewals and legal compliance deadlines are not connected.');
  const scheduleAvailable = REPORTED.has(section.status) && section.basis === 'qhse_audit_schedule';
  const rows = scheduleAvailable ? section.rows || [] : [];
  const visible = expanded || printing ? rows : rows.slice(0, 3);
  const total = scheduleAvailable && numberPresent(section.total_rows) ? Number(section.total_rows) : null;
  const info = definition(section, 'risk_compliance_calendar', 'Compliance calendar');

  return <section className="rc-panel rc-compliance-panel" aria-label="Compliance calendar" data-testid="risk-compliance-calendar">
    <RiskSectionHeader title="Compliance calendar" detail="QHSE audit schedule" action={<ExplainButton metric={info} onExplain={onExplain} />} />
    <div className="rc-side-table-wrap" role="region" aria-label="Recorded QHSE audit schedule" tabIndex={0}>
      <table className="rc-side-table rc-compliance-table"><thead><tr>
        <th scope="col">Audit</th><th scope="col">Project</th><th scope="col">Target date</th><th scope="col">Recorded auditor</th><th scope="col">Status</th><th scope="col">Action</th>
      </tr></thead><tbody>{visible.map(row => <tr key={row.id} data-testid={`risk-calendar-${row.id}`}>
        <th scope="row" title={row.title}>{row.title}</th><td title={row.project_name}>{row.project_code || row.project_name || '—'}</td>
        <td><span>{row.date ? formatDate(row.date) : '—'}</span><small className="rc-calendar-timing">
          {row.date_status === 'past_target_date' ? 'Target date passed' : row.date_status === 'due_today' ? 'Due today' : row.date_status === 'upcoming' ? 'Upcoming' : 'Date not assessed'}
        </small></td><td>{row.recorded_auditor || <span title="An auditor is not recorded">Unassigned</span>}</td>
        <td><Status status={row.status === 'DELAYED' ? 'medium' : row.status === 'SCHEDULED' ? 'available' : 'unavailable'}>
          {row.status === 'DELAYED' ? 'Delayed' : row.status === 'SCHEDULED' ? 'Scheduled' : 'Not recorded'}
        </Status></td><td><RouteLink route={row.route} className="cc-table-action" aria-label={`Open QHSE audit ${row.title}`}>Open</RouteLink></td>
      </tr>)}</tbody></table>
    </div>
    {!visible.length && (total === 0 ? <EmptyState title="No pending audit dates in this window"
      detail="No scheduled or delayed QHSE audits are recorded through the next 30 days for active QHSE projects." />
      : <RiskUnavailable section={section} title="QHSE audit schedule not available" />)}
    <p className="rc-panel-note">Audit target dates include past dates and the next 30 days. Recorded auditor is not a verified compliance owner. Legal obligations are not connected.</p>
    <div className="rc-panel-footer"><span className="rc-panel-note">{total == null ? 'Schedule coverage unavailable' : `Showing ${visible.length} of ${formatNumber(total)} audit dates`}
      {section.truncated && total != null ? ' · API preview limited' : ''}</span>
      {rows.length > 3 && <button type="button" className="cc-text-button cc-screen-only" onClick={() => setExpanded(value => !value)}>
        {expanded ? 'Show top 3' : 'View returned audits'}
      </button>}
    </div>
    <RiskSourceNote section={section} />
  </section>;
}

export function AuditControls({ risk, onExplain }) {
  const section = sectionFor(risk, 'audit_controls',
    'Recorded audit workflow counts do not establish control-testing outcomes, control deficiencies or the number of open audit findings.');
  const controls = CONTROL_MEASURES.map(([id, label, description, unit]) => measure(section, id, label, description, unit));
  const auditMetrics = AUDIT_MEASURES.map(([id, label]) => measure(section, id, label,
    'Count of audit records by their recorded workflow status on active QHSE projects. Audit status is not control effectiveness.'));
  const info = definition(section, 'risk_audit_controls', 'Audit & controls', [...controls, ...auditMetrics]);

  return <section className="rc-panel rc-audit-panel" aria-label="Audit and controls" data-testid="risk-audit-controls">
    <RiskSectionHeader title="Audit & controls" action={<ExplainButton metric={info} onExplain={onExplain} />} />
    <div className="rc-audit-summary">{controls.map(metric => <button type="button" className="rc-audit-stat" key={metric.id}
      data-testid={`risk-control-${metric.id}`} aria-label={`About ${metric.label}`} title={metric.description || metric.reason} onClick={() => onExplain?.(metric)}>
      <strong><RiskMetric metric={metric} /></strong><span>{metric.label}</span>
    </button>)}</div>
    <div className="rc-recorded-heading"><h3>Recorded QHSE audits</h3><Status status={section.status} /></div>
    <RecordedMeasures metrics={auditMetrics} onExplain={onExplain} className="rc-audit-recorded-summary" testPrefix="risk-audit" />
    <RiskSourceNote section={section} />
    {REPORTED.has(section.status) && <div className="rc-panel-footer"><RouteLink route={section.route} arrow>Open audit register</RouteLink></div>}
  </section>;
}

export function RiskConcentration({ risk, onExplain }) {
  const section = sectionFor(risk, 'risk_concentration',
    'A governed residual exposure measure, consistent valuation basis and complete category mapping are not connected. Project exception counts do not establish residual risk exposure.');
  const info = { ...definition(section, 'risk_concentration', 'Risk concentration'),
    source: section.source || 'Governed residual risk exposure source required' };

  return <section className="rc-panel rc-concentration-panel" aria-label="Risk concentration" data-testid="risk-concentration">
    <RiskSectionHeader title="Risk concentration" detail="Share of verified residual exposure" action={<ExplainButton metric={info} onExplain={onExplain} />} />
    <div className="rc-concentration-empty"><RiskUnavailable section={section} title="Residual exposure not available" /></div>
    <p className="rc-panel-note">Risk counts, project contract values and quality observations are not substituted for residual exposure.</p>
  </section>;
}
