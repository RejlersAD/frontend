/* eslint-disable react/prop-types */
import React from 'react';
import { EmptyState } from './ExecutivePrimitives';
import { formatNumber } from './executivePresentation';

export const workforceSourceAvailable = status => ['available', 'partial'].includes(status);
export const workforceNumberPresent = value => value != null && value !== '' && Number.isFinite(Number(value));
export const WORKFORCE_OUTCOMES = [
  { id: 'headcount', label: 'Headcount', unit: 'count', basis: 'Current employees · people', description: 'Current non-test employee master records, including probation, notice and suspension, with valid current employment dates.' },
  { id: 'billable_utilisation', label: 'Billable utilization', unit: 'percent', basis: 'Billable hours / available hours', description: 'Approved billable hours and available working hours are required.' },
  { id: 'critical_vacancies', label: 'Critical vacancies', unit: 'count', basis: 'Roles with significant project impact', description: 'Approved vacancies linked to critical skills and project commitments are required.' },
  { id: 'voluntary_turnover', label: 'Voluntary turnover', unit: 'percent', basis: '12-month rolling rate', description: 'Verified voluntary exit reasons and average headcount for the reporting period are required.' },
  { id: 'capacity_coverage', label: 'Capacity coverage', unit: 'percent', basis: 'Available capacity / forecast demand', description: 'Approved FTE availability and project demand are required.' },
];

export function unknownWorkforceMetric(id, label, description, unit = 'count', status = 'unavailable') {
  return { id, label, description, unit, status, value: null, source: 'Workforce reporting source required', target: null, trend: null };
}

export function workforceReport(report) {
  if (report?.workforce_performance) return report.workforce_performance;
  const hr = report?.departments?.find(section => section.id === 'hr');
  const status = ['restricted', 'error'].includes(hr?.status) ? hr.status : 'unavailable';
  const section = { status, rows: [], description: 'The workforce reporting source is not available.' };
  return { status, kpis: WORKFORCE_OUTCOMES.map(item => unknownWorkforceMetric(item.id, item.label, item.description, item.unit, status)),
    actions: [], actions_status: status, capacity_plan: { ...section, total_rows: null }, supply_demand_outlook: section,
    workforce_movement: { ...section, metrics: [], series: [] }, critical_roles: section, project_coverage_risk: section,
    retention_mobility: { ...section, metrics: [] }, distribution: { office: section, branch: section, business_unit: section, employment_type: section },
    data_quality: { ...section, metrics: [] } };
}

export function workforceMetric(workforce, id) {
  const item = WORKFORCE_OUTCOMES.find(metric => metric.id === id);
  return workforce?.kpis?.find(metric => metric.id === id) || unknownWorkforceMetric(id, item?.label || id, item?.description, item?.unit,
    ['restricted', 'error'].includes(workforce?.status) ? workforce.status : 'unavailable');
}

export function WorkforceMetric({ metric, compact = false }) {
  if (!workforceSourceAvailable(metric?.status) || !workforceNumberPresent(metric?.value)) return '—';
  return `${formatNumber(metric.value, { maximumFractionDigits: metric.unit === 'percent' ? 1 : 0, notation: compact && Number(metric.value) >= 10000 ? 'compact' : 'standard' })}${metric.unit === 'percent' ? '%' : ''}`;
}

export function WorkforceSectionHeader({ title, detail, action }) {
  return <div className="wf-panel-heading"><div><h2>{title}</h2>{detail && <p className="wf-heading-detail">{detail}</p>}</div>{action}</div>;
}

export function WorkforceUnavailable({ section, title = 'Not available' }) {
  return <EmptyState title={section?.status === 'restricted' ? 'HR access required' : section?.status === 'error' ? 'HR source unavailable' : title}
    detail={section?.description || 'A verified workforce reporting source is required.'} />;
}

export function WorkforceSourceNote({ section }) {
  return section?.description ? <p className="wf-source-note">{section.description}</p> : null;
}
