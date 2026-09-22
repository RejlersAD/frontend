/* eslint-disable react/prop-types */
import React from 'react';
import { ExclamationCircleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { formatNumber } from './executivePresentation';

export const numberPresent = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
export const PORTFOLIO_OUTCOMES = [
  { id: 'active_projects', label: 'Active projects', unit: 'count', reason: 'Accessible projects currently marked active.' },
  { id: 'contract_value', label: 'Contract value', unit: 'currency', reason: 'Recorded contract values for accessible open projects, kept in original currencies.' },
  { id: 'forecast_margin', label: 'Forecast margin', unit: 'percent', reason: 'Approved remaining revenue and forecast cost are not connected.' },
  { id: 'schedule_confidence', label: 'Schedule confidence', unit: 'percent', reason: 'A governed schedule confidence assessment is not connected.' },
  { id: 'revenue_remaining', label: 'Revenue remaining', unit: 'currency', reason: 'Recognised revenue and approved remaining revenue are not connected. Contract value is a separate measure.' },
];

export function unknownPortfolioMetric(id, label, description, unit = 'count') {
  return { id, label, description, definition: description, reason: description, unit,
    value: null, status: 'unavailable', source: 'Verified project reporting source required', target: null, trend: null };
}

export function portfolioMetric(portfolio, id) {
  const fallback = PORTFOLIO_OUTCOMES.find(item => item.id === id);
  return portfolio?.kpis?.find(metric => metric.id === id)
    || unknownPortfolioMetric(id, fallback?.label || id, fallback?.reason || 'The required reporting measure is not connected.', fallback?.unit);
}

// Amount cards select an original currency; counts and health retain open-project scope.
export function portfolioCurrencyMetric(portfolio, id, currency) {
  const metric = portfolioMetric(portfolio, id);
  if (['restricted', 'error'].includes(portfolio?.status)) return { ...metric, status: portfolio.status, value: null, by_currency: [] };
  if (metric.unit !== 'currency' || !currency) return metric;
  if (!['available', 'partial'].includes(metric.status)) return { ...metric, currency, value: null, by_currency: undefined };
  const group = metric.by_currency?.find(row => row.currency === currency);
  const missing = metric.incomplete_currencies?.includes(currency);
  const value = group ? group.amount : !metric.by_currency && metric.currency === currency ? metric.value : null;
  return { ...metric, currency, value: missing ? null : value, by_currency: undefined,
    status: !missing && numberPresent(value) ? 'available' : 'unavailable',
    description: `${metric.description || metric.reason || ''} Displayed in ${currency}; no currency conversion is applied.${missing ? ' This currency total is withheld because contract values are missing.' : ''}` };
}

export function portfolioReport(report) {
  if (report?.portfolio_performance) return report.portfolio_performance;
  const original = report?.portfolio || {};
  const section = report?.departments?.find(item => item.id === 'project_control');
  const projects = original.projects || [];
  return {
    status: original.status || 'unavailable', source_updated_at: section?.source_updated_at,
    scope: 'Accessible project preview; portfolio-level measures require the extended reporting source.',
    kpis: PORTFOLIO_OUTCOMES.map(item => item.id === 'active_projects' && original.status === 'available'
      ? { ...unknownPortfolioMetric(item.id, item.label, item.reason), value: original.counts?.active ?? null, status: 'available' }
      : unknownPortfolioMetric(item.id, item.label, item.reason, item.unit)),
    register: { status: original.status || 'unavailable', projects, total_rows: original.total_rows ?? original.counts?.total ?? null,
      returned_rows: projects.length, truncated: (original.total_rows ?? original.counts?.total ?? projects.length) > projects.length },
    actions: section?.actions || [], health: { status: 'unavailable', counts: null },
    milestones: { status: 'unavailable', rows: [], total_rows: null },
    delivery_capacity: { status: 'unavailable', rows: [] }, concentration: { status: 'unavailable', by_currency: [] },
    delivery_outlook: { status: 'unavailable' },
  };
}

export function PortfolioMetricValue({ metric, compact = true }) {
  if (!metric || !['available', 'partial'].includes(metric.status)) return '—';
  const value = amount => formatNumber(amount, { notation: compact && Math.abs(Number(amount)) >= 1000000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).replace(/[kmb]$/i, suffix => suffix.toUpperCase());
  if (metric.unit === 'currency' && metric.by_currency) {
    const rows = metric.by_currency.filter(row => numberPresent(row.amount));
    if (!rows.length) return '—';
    return <span className="pp-money-values">{rows.map(row => <span key={row.currency}>{row.currency || 'UNSPECIFIED'} {value(row.amount)}</span>)}</span>;
  }
  if (!numberPresent(metric.value)) return '—';
  if (metric.unit === 'currency') return `${metric.currency || 'UNSPECIFIED'} ${value(metric.value)}`;
  return `${value(metric.value)}${metric.unit === 'percent' ? '%' : metric.unit === 'days' ? ' days' : ''}`;
}

export const HEALTH_LABELS = { critical: 'Critical', high: 'High', medium: 'Attention', low: 'Low', clear: 'No exceptions', unavailable: 'Not assessed', unknown: 'Not assessed', restricted: 'Restricted', error: 'Source unavailable' };
export function PortfolioHealthBadge({ health = 'unavailable' }) {
  const known = Object.hasOwn(HEALTH_LABELS, health) ? health : 'unavailable';
  const Icon = ['critical', 'high', 'medium'].includes(known) ? ExclamationCircleIcon : InformationCircleIcon;
  return <span className={`pp-health-badge pp-health-badge--${known}`}><Icon aria-hidden="true" />{HEALTH_LABELS[known]}</span>;
}
