/* eslint-disable react/prop-types */
import React from 'react';
import { ExclamationCircleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { formatNumber } from './executivePresentation';

export const numberPresent = value => value != null && value !== '' && Number.isFinite(Number(value));
export const COMMERCIAL_OUTCOMES = [
  { id: 'qualified_pipeline', label: 'Qualified pipeline', unit: 'currency', reason: 'Recorded qualified, proposal, negotiation and award-pending opportunity values in their original currencies.' },
  { id: 'weighted_pipeline', label: 'Weighted pipeline', unit: 'currency', reason: 'Stored probability-weighted values of open CRM opportunities. Weighted pipeline is not contracted revenue.' },
  { id: 'win_rate', label: 'Win rate', unit: 'percent', reason: 'Recorded won and lost opportunities with a verified close date in the reporting period are required.' },
  { id: 'proposals_due_30d', label: 'Proposals due in 30 days', unit: 'count', reason: 'Current proposal-stage opportunities with a recorded submission target from today through 30 days ahead.' },
  { id: 'framework_backlog', label: 'Framework backlog', unit: 'currency', reason: 'Approved remaining contracted framework revenue is not connected. Framework ceilings are not backlog.' },
];

export function unknownCommercialMetric(id, label, description, unit = 'count') {
  return { id, label, description, definition: description, reason: description, unit, value: null,
    status: 'unavailable', source: 'Verified commercial reporting source required', target: null, trend: null };
}

export function commercialReport(report) {
  if (report?.commercial_performance) return report.commercial_performance;
  const sales = report?.departments?.find(section => section.id === 'sales');
  const status = ['restricted', 'error'].includes(sales?.status) ? sales.status : 'unavailable';
  return {
    status, source_updated_at: sales?.source_updated_at, currencies: [],
    kpis: COMMERCIAL_OUTCOMES.map(item => ({ ...unknownCommercialMetric(item.id, item.label, item.reason, item.unit), status })),
    register: { status, opportunities: [], total_rows: null, returned_rows: 0, truncated: false },
    actions: sales?.actions || [], actions_status: sales?.status || status,
    bid_calendar: { status, rows: [] }, client_concentration: { status, by_currency: [] },
    resource_demand: { status: 'unavailable', rows: [] }, commercial_quality: { status, metrics: [] },
    pipeline_outlook: { status: 'unavailable' }, pipeline_movement: { status: 'unavailable' }, won_handoff: { status: 'unavailable' },
  };
}

export function commercialCurrencies(commercial) {
  const declared = (commercial?.currencies || []).map(row => typeof row === 'string' ? row : row.currency);
  const groups = [
    ...(commercial?.client_concentration?.by_currency || []),
    ...(commercial?.kpis || []).flatMap(metric => [...(metric.by_currency || []), ...(metric.incomplete_currencies || []).map(currency => ({ currency }))]),
    ...(commercial?.register?.opportunities || []), ...(commercial?.bid_calendar?.rows || []),
  ];
  return [...new Set([...declared, ...groups.map(row => row.currency || 'UNSPECIFIED')].filter(Boolean))].sort();
}

export function commercialMetric(commercial, id, currency) {
  const fallback = COMMERCIAL_OUTCOMES.find(item => item.id === id);
  const metric = [...(commercial?.kpis || []), ...(commercial?.commercial_quality?.metrics || [])].find(item => item.id === id)
    || unknownCommercialMetric(id, fallback?.label || id, fallback?.reason || 'The reporting measure is not connected.', fallback?.unit);
  if (['error', 'restricted'].includes(metric.status)) return { ...metric, value: null };
  if (Array.isArray(metric.by_currency)) {
    const base = { ...metric };
    delete base.by_currency;
    const selected = metric.by_currency.find(row => row.currency === currency);
    return selected ? { ...base, currency, value: selected.amount }
      : { ...base, currency, value: null, status: 'unavailable', reason: `No complete ${currency || 'selected-currency'} amount is reported. ${metric.reason || ''}`.trim() };
  }
  if (metric.unit === 'currency' && metric.currency && currency && metric.currency !== currency) return { ...metric, value: null, status: 'unavailable', reason: `Reported in ${metric.currency}; no currency conversion is applied.` };
  return metric;
}

export function CommercialMetricValue({ metric, compact = true }) {
  if (!metric || !['available', 'partial'].includes(metric.status) || !numberPresent(metric.value)) return '—';
  const value = formatNumber(metric.value, { maximumFractionDigits: 1, notation: compact && Math.abs(Number(metric.value)) >= 1000000 ? 'compact' : 'standard' });
  if (metric.unit === 'currency') return `${metric.currency || 'UNSPECIFIED'} ${value}`;
  return `${value}${metric.unit === 'percent' ? '%' : metric.unit === 'days' ? ' days' : ''}`;
}

export function CommercialHealth({ opportunity }) {
  const attention = opportunity.health === 'attention';
  const label = attention ? 'Attention' : opportunity.health === 'no_recorded_flags' ? 'No flags' : 'Not assessed';
  const Icon = attention ? ExclamationCircleIcon : InformationCircleIcon;
  return <span className={`cp-health ${attention ? 'cp-health--attention' : ''}`} title={opportunity.flags?.map(flag => flag.title).join('; ') || 'Absence of recorded flags does not establish bid readiness.'}><Icon aria-hidden="true" />{label}</span>;
}

export function probabilityMetric(opportunity) {
  const valid = numberPresent(opportunity.probability) && Number(opportunity.probability) >= 0 && Number(opportunity.probability) <= 100;
  return { id: `probability-${opportunity.id}`, label: `${opportunity.name}: probability`, unit: 'percent', value: valid ? opportunity.probability : null,
    status: valid ? 'available' : 'unavailable', source: 'CRM opportunity register',
    definition: opportunity.probability_basis || 'Stored CRM probability; normally assigned by stage.',
    description: valid ? 'This is the stored CRM probability. A validated evidence model and assessment history are not connected.' : 'A valid recorded probability between 0 and 100 is required.',
    reason: opportunity.probability_evidence ? 'See the recorded probability evidence in the source opportunity.' : 'Scored evidence, client-history weights and technical evaluation weights are not connected.',
    route: opportunity.route, target: null, trend: null };
}
