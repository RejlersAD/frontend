/* eslint-disable react/prop-types */
import React from 'react';
import { EmptyState } from './ExecutivePrimitives';
import { formatNumber } from './executivePresentation';

export const riskSourceAvailable = status => ['available', 'partial'].includes(status);
export const riskNumberPresent = value => value != null && value !== '' && Number.isFinite(Number(value));
export const RISK_OUTCOMES = [
  { id: 'high_enterprise_risks', label: 'High enterprise risks', basis: 'Approved residual risk ratings', description: 'A governed enterprise risk register with approved residual ratings and risk appetite is required.' },
  { id: 'overdue_mitigations', label: 'Overdue mitigations', basis: 'Approved treatment due dates', description: 'Risk treatments with recorded due dates, completion status and accountable owners are required.' },
  { id: 'recordable_qhse_incidents', label: 'Recordable QHSE incidents', basis: 'Verified incident classifications', description: 'A verified incident register and reporting period are required. Quality actions and observations are not safety incidents.' },
  { id: 'compliance_obligations_on_time', label: 'Compliance obligations', basis: 'Obligations met by their due date', unit: 'percent', description: 'A governed obligations register with due dates and verified fulfillment is required. Audit schedule dates do not establish compliance.' },
  { id: 'open_audit_findings', label: 'Open audit findings', basis: 'Item-level finding status', description: 'Individual findings and verified closure status are required. Audit records and free-text findings do not establish an open finding count.' },
];

export function unknownRiskMetric(id, label, description, unit = 'count', status = 'unavailable') {
  return { id, label, description, definition: description, unit, status, value: null, source: 'Verified risk and assurance reporting source required', target: null, trend: null };
}

export function riskComplianceReport(report) {
  if (report?.risk_compliance) return report.risk_compliance;
  const state = report?.departments?.find(section => section.id === 'qhse')?.status;
  const status = ['restricted', 'error'].includes(state) ? state : 'unavailable';
  const section = { status, rows: [], metrics: [], description: 'The assurance reporting source is not available.' };
  const gap = { status: 'unavailable', rows: [], description: 'A governed enterprise risk and assurance source is not connected.' };
  return { status, kpis: RISK_OUTCOMES.map(item => unknownRiskMetric(item.id, item.label, item.description, item.unit)),
    register: { ...gap, risks: [], total_rows: null }, source_followups: { ...section, total_rows: null }, actions: [], actions_status: status,
    qhse_performance: { ...section, project_metrics: [] }, compliance_calendar: section, audit_controls: section,
    heatmap: gap, risk_movement: gap, mitigation_effectiveness: gap, risk_concentration: gap, sources: [] };
}

export function riskMetric(risk, id) {
  const item = RISK_OUTCOMES.find(metric => metric.id === id);
  return risk?.kpis?.find(metric => metric.id === id) || unknownRiskMetric(id, item?.label || id, item?.description, item?.unit);
}

export function RiskMetric({ metric }) {
  if (!riskSourceAvailable(metric?.status) || !riskNumberPresent(metric?.value)) return '—';
  return `${formatNumber(metric.value, { maximumFractionDigits: metric.unit === 'percent' ? 1 : 0 })}${metric.unit === 'percent' ? '%' : ''}`;
}

export function RiskSectionHeader({ title, detail, action }) {
  return <div className="rc-panel-heading"><div><h2>{title}</h2>{detail && <p className="rc-heading-detail">{detail}</p>}</div>{action}</div>;
}

export function RiskUnavailable({ section, title = 'Not available' }) {
  return <EmptyState title={section?.status === 'restricted' ? 'Source access required' : section?.status === 'error' ? 'Assurance source unavailable' : title}
    detail={section?.description || 'A verified risk and assurance reporting source is required.'} />;
}

export function RiskSourceNote({ section }) {
  return section?.description ? <p className="rc-source-note">{section.description}</p> : null;
}
