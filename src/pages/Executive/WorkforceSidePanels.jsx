/* eslint-disable react/prop-types */
import React, { useState } from 'react';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import { Status } from './ExecutivePrimitives';
import { formatNumber } from './executivePresentation';
import { WorkforceMetric, WorkforceSectionHeader, WorkforceSourceNote, WorkforceUnavailable } from './workforcePresentation';

const REPORTED = new Set(['available', 'partial']);
const RETENTION = [
  ['notice_period', 'Employees in notice period', 'Current employees with a recorded notice-period status. This count does not establish voluntary turnover or an individual retention-risk assessment.', 'count'],
  ['voluntary_turnover', 'Voluntary turnover', 'A verified voluntary-exit cohort and average workforce for a common reporting period are not connected.', 'percent'],
  ['internal_mobility', 'Internal mobility', 'Approved internal-move events and a consistent reporting period are not connected.', 'count'],
  ['retention_risk', 'Retention risk', 'A governed aggregate retention-risk assessment is not connected.', 'count'],
];
const DISTRIBUTIONS = [
  { id: 'office', label: 'Office' }, { id: 'business_unit', label: 'Business unit' }, { id: 'branch', label: 'Branch' },
];
const numberPresent = value => value != null && value !== '' && Number.isFinite(Number(value));

function unknownMetric(id, label, description, unit = 'count') {
  return { id, label, unit, value: null, status: 'unavailable', description, definition: description,
    reason: description, source: 'Verified workforce reporting source required', target: null, trend: null };
}

function scopedSection(workforce, section, description) {
  const status = ['restricted', 'error'].includes(workforce?.status) ? workforce.status : section?.status || 'unavailable';
  return { ...section, status, description: section?.description || description };
}

function sectionMetric(id, label, section) {
  return { ...unknownMetric(id, label, section.description), status: section.status, source: section.source || 'Authorized workforce source registers' };
}

function ExplainButton({ metric, onExplain }) {
  return <button type="button" className="cc-info-button" onClick={() => onExplain?.(metric)}
    aria-label={`About ${metric.label}`} title={metric.description || metric.reason}>
    <InformationCircleIcon aria-hidden="true" />
  </button>;
}

export function CriticalRoles({ workforce, onExplain }) {
  const section = scopedSection(workforce, workforce?.critical_roles,
    'Approved critical-role coverage and vacancy records are not connected. A missing succession incumbent does not establish an approved vacancy.');
  const metric = sectionMetric('workforce_critical_roles_coverage', 'Critical roles', section);
  return <section className="wf-panel wf-critical-panel" aria-label="Critical roles" data-testid="workforce-critical-roles">
    <WorkforceSectionHeader title="Critical roles" action={<ExplainButton metric={metric} onExplain={onExplain} />} />
    <div className="wf-side-table-wrap" role="region" aria-label="Critical role coverage" tabIndex={0}>
      <table className="wf-side-table wf-critical-table"><thead><tr>
        <th scope="col">Role</th><th scope="col">Vacancies</th><th scope="col">Projects affected</th><th scope="col">Hiring pipeline</th><th scope="col">Owner</th><th scope="col">Status</th><th scope="col">Action</th>
      </tr></thead><tbody><tr><td colSpan={7}><WorkforceUnavailable section={section} title="Critical-role coverage not connected" /></td></tr></tbody></table>
    </div>
  </section>;
}

export function ProjectCoverageRisk({ workforce, onExplain }) {
  const section = scopedSection(workforce, workforce?.project_coverage_risk,
    'Approved project staffing, discipline demand and accountable coverage plans are not connected. Department headcount does not establish project coverage.');
  const metric = sectionMetric('workforce_project_coverage_risk', 'Project coverage risk', section);
  return <section className="wf-panel wf-coverage-panel" aria-label="Project coverage risk" data-testid="workforce-project-coverage-risk">
    <WorkforceSectionHeader title="Project coverage risk" action={<ExplainButton metric={metric} onExplain={onExplain} />} />
    <div className="wf-coverage-summary">{[
      ['fully_covered', 'Fully covered'], ['require_reallocation', 'Require reallocation'],
      ['depend_on_recruitment', 'Depend on recruitment'], ['depend_on_subcontractor', 'Depend on subcontractor'],
    ].map(([id, label]) => <button type="button" className="wf-coverage-stat" key={id} data-testid={`workforce-coverage-${id}`}
      aria-label={`About ${label.toLowerCase()}`} title={section.description} onClick={() => onExplain?.(metric)}>
      <strong>—</strong><span>{label}</span>
    </button>)}</div>
    <div className="wf-side-table-wrap" role="region" aria-label="Project staffing coverage" tabIndex={0}>
      <table className="wf-side-table wf-coverage-table"><thead><tr>
        <th scope="col">Project</th><th scope="col">Discipline gap</th><th scope="col">Start date</th><th scope="col">Impact</th>
      </tr></thead><tbody><tr><td colSpan={4}><WorkforceUnavailable section={section} title="Project staffing coverage not connected" /></td></tr></tbody></table>
    </div>
  </section>;
}

export function RetentionMobility({ workforce, onExplain }) {
  const section = scopedSection(workforce, workforce?.retention_mobility,
    'Recorded notice-period status is an aggregate workforce fact. Verified exit events, internal moves and a governed retention-risk assessment are not connected.');
  const metrics = RETENTION.map(([id, label, description, unit]) => {
    const metric = section.metrics?.find(item => item.id === id) || unknownMetric(id, label, description, unit);
    return ['restricted', 'error'].includes(section.status) ? { ...metric, status: section.status, value: null } : metric;
  });
  const info = { ...sectionMetric('workforce_retention_mobility', 'Retention & mobility', section), metrics };
  return <section className="wf-panel wf-retention-panel" aria-label="Retention and mobility" data-testid="workforce-retention-mobility">
    <WorkforceSectionHeader title="Retention & mobility" action={<ExplainButton metric={info} onExplain={onExplain} />} />
    <table className="wf-side-table wf-retention-table" aria-label="Aggregate retention and mobility reporting"><thead><tr>
      <th scope="col">Measure</th><th scope="col">Current</th><th scope="col">Status</th>
    </tr></thead><tbody>{metrics.map(metric => <tr key={metric.id} data-testid={`workforce-retention-${metric.id}`}>
      <th scope="row"><button type="button" className="wf-retention-name" onClick={() => onExplain?.(metric)}
        aria-label={`About ${metric.label}`} title={metric.description || metric.reason}>{metric.label}</button></th>
      <td><strong><WorkforceMetric metric={metric} compact /></strong></td><td><Status status={metric.status} /></td>
    </tr>)}</tbody></table>
    <WorkforceSourceNote section={section} />
  </section>;
}

export function WorkforceDistribution({ workforce, onExplain, printing = false }) {
  const [dimension, setDimension] = useState('office');
  const selected = DISTRIBUTIONS.find(item => item.id === dimension) || DISTRIBUTIONS[0];
  const section = scopedSection(workforce, workforce?.distribution?.[selected.id],
    'Current employee headcount by recorded organizational fields. Counts are people, not FTE or a resource-capacity assessment.');
  const employment = scopedSection(workforce, workforce?.distribution?.employment_type,
    'Employment type is not recorded in the canonical employee master. Account-profile values are not substituted.');
  const sourceRows = Array.isArray(section.rows) ? section.rows : [];
  const valid = REPORTED.has(section.status) && section.unit === 'people' && numberPresent(section.total)
    && Number(section.total) >= 0 && sourceRows.every(row => typeof row.label === 'string'
      && numberPresent(row.count) && Number(row.count) >= 0)
    && sourceRows.reduce((sum, row) => sum + Number(row.count), 0) === Number(section.total);
  const total = valid ? Number(section.total) : null;
  const rows = valid ? sourceRows.map(row => ({ label: row.label || 'Unassigned', count: Number(row.count) }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)) : [];
  const visible = !printing && rows.length > 4
    ? [...rows.slice(0, 3), { label: 'Other groups', count: rows.slice(3).reduce((sum, row) => sum + row.count, 0) }]
    : rows;
  const info = { ...sectionMetric('workforce_distribution', 'Workforce distribution', section), metrics: [
    sectionMetric(`workforce_distribution_${selected.id}`, `Headcount by ${selected.label.toLowerCase()}`, section),
    sectionMetric('workforce_distribution_employment_type', 'Employment type', employment),
  ] };

  return <section className="wf-panel wf-distribution-panel" aria-label="Workforce distribution" data-testid="workforce-distribution">
    <WorkforceSectionHeader title="Workforce distribution" action={<ExplainButton metric={info} onExplain={onExplain} />} />
    <div className="wf-distribution-grid"><div className="wf-distribution-people">
      <div className="wf-distribution-heading"><label><span className="cc-sr-only">Workforce distribution by</span>
        <select aria-label="Workforce distribution by" value={selected.id} onChange={event => setDimension(event.target.value)}>
          {DISTRIBUTIONS.map(item => <option value={item.id} key={item.id}>{item.label}</option>)}
        </select></label><span className="wf-distribution-total" data-testid="workforce-distribution-total">{total == null ? '—' : formatNumber(total)} people</span>
      </div>
      {valid ? <div className="wf-distribution-list" data-testid={`workforce-distribution-${selected.id}`}>
        {visible.map((row, index) => <div className="wf-distribution-row" key={`${row.label}-${index}`} data-testid="workforce-distribution-row">
          <div className="wf-distribution-row-heading"><span title={row.label}>{row.label}</span><strong>{formatNumber(row.count)}</strong></div>
          <div className="wf-distribution-track" role="img" aria-label={`${row.label}: ${formatNumber(row.count)} people`}>
            <span style={{ width: `${total > 0 ? row.count / total * 100 : 0}%` }} />
          </div>
        </div>)}
        {total === 0 && <p className="wf-distribution-empty" data-testid="workforce-distribution-zero">No current employees in the recorded population.</p>}
        {!printing && rows.length > 4 && <p className="wf-panel-note">Other groups combines {rows.length - 3} recorded groups.</p>}
      </div> : <WorkforceUnavailable section={section} title={`${selected.label} distribution not available`} />}
      <p className="wf-panel-note">{selected.id === 'office' ? 'Recorded organizational office' : `Recorded ${selected.label.toLowerCase()}`} · headcount</p>
    </div><div className="wf-distribution-employment" data-testid="workforce-distribution-employment-type">
      <h3>Employment type</h3><WorkforceUnavailable section={employment} title="Employment type not connected" />
    </div></div>
    <WorkforceSourceNote section={section} />
  </section>;
}
