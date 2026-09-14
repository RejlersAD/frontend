/* eslint-disable react/prop-types */
import React from 'react';
import { formatNumber } from './executivePresentation';

export const FINANCIAL_KPIS = [
  { id: 'revenue_ytd', label: 'Revenue YTD', unit: 'currency', reason: 'Recognised year-to-date revenue and an approved budget are not connected.' },
  { id: 'operating_profit', label: 'Operating profit', unit: 'currency', reason: 'An approved operating profit statement is not connected. EBITA is a different measure.' },
  { id: 'operating_margin', label: 'Operating margin', unit: 'percent', reason: 'Operating profit and recognised revenue for a common period are required.' },
  { id: 'cash_position', label: 'Cash position', unit: 'currency', reason: 'Verified bank and cash balances are not connected. Invoice balances do not establish cash.' },
  { id: 'dso', label: 'DSO', unit: 'days', reason: 'Approved credit sales and receivables for a common reporting period are required.' },
];

export function unavailableFinancialMetric(id, label, reason, unit = 'count') {
  return { id, label, unit, status: 'unavailable', value: null, description: reason,
    reason, definition: reason, source: 'Approved financial reporting source required', target: null, trend: null };
}

export function financialReport(report) {
  if (report?.financial_performance) return report.financial_performance;
  const finance = report?.departments?.find(section => section.id === 'finance');
  return {
    status: finance?.status || 'unavailable',
    kpis: FINANCIAL_KPIS.map(item => unavailableFinancialMetric(item.id, item.label, item.reason, item.unit)),
    working_capital: { metrics: finance?.metrics || [], aging: { status: 'unavailable', by_currency: [] } },
    actions: finance?.actions || [], controls: { ledger_connected: false },
    source_updated_at: finance?.source_updated_at || null,
  };
}

export function financialCurrencies(financial) {
  const rows = [...(financial?.working_capital?.aging?.by_currency || []),
    ...[...(financial?.kpis || []), ...(financial?.working_capital?.metrics || [])]
      .flatMap(metric => metric.by_currency || (metric.currency ? [{ currency: metric.currency }] : []))];
  return [...new Set(rows.map(row => row.currency).filter(Boolean))].sort();
}

export function financialMetric(financial, id, currency) {
  const fallback = FINANCIAL_KPIS.find(item => item.id === id);
  const metric = [...(financial?.kpis || []), ...(financial?.working_capital?.metrics || [])].find(item => item.id === id)
    || unavailableFinancialMetric(id, fallback?.label || id, fallback?.reason || 'A verified reporting source is not connected.', fallback?.unit);
  if (metric.by_currency) {
    if (['restricted', 'error'].includes(metric.status)) return { ...metric, value: null };
    const selected = metric.by_currency.find(row => row.currency === currency);
    const base = { ...metric };
    delete base.by_currency;
    return selected
      ? { ...base, value: selected.amount, currency }
      : { ...base, value: null, currency, status: 'unavailable', reason: `No complete amount is reported for ${currency || 'the selected currency'}.` };
  }
  // An aggregate reported in a different currency cannot be relabelled by the display selector.
  if (metric.unit === 'currency' && metric.currency && currency && metric.currency !== currency) {
    return { ...metric, value: null, status: 'unavailable', reason: `This measure is reported in ${metric.currency}; no conversion is applied.` };
  }
  return metric;
}

export function FinancialMetricValue({ metric, compact = true }) {
  if (!metric || !['available', 'partial'].includes(metric.status)
    || metric.value == null || metric.value === '' || !Number.isFinite(Number(metric.value))) return '—';
  const value = formatNumber(metric.value, { maximumFractionDigits: 1,
    notation: compact && Math.abs(Number(metric.value)) >= 1000000 ? 'compact' : 'standard' });
  if (metric.unit === 'currency') return <>{metric.currency || 'UNSPECIFIED'} {value}</>;
  if (metric.unit === 'percent') return `${value}%`;
  if (metric.unit === 'days') return `${value} days`;
  return value;
}
