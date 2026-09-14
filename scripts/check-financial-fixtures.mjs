// Synthetic financial DTOs for isolated browser checks; never imported by the app.
const bucketLabels = [
  ['current', 'Current'], ['days_1_30', '1–30 days'], ['days_31_60', '31–60 days'],
  ['over60', 'Over 60 days'], ['unknown_due_date', 'Due date not recorded'],
];
const metric = (id, label, extra = {}) => ({
  id, label, value: null, unit: 'currency', status: 'unavailable',
  source: 'Approved financial reporting source not connected',
  description: `${label} requires a verified reporting source.`,
  definition: `${label} is not inferred from operational invoice or project registers.`,
  reason: 'An approved reporting source and reporting period are required.',
  target: null, trend: null, period: 'current_snapshot', ...extra,
});
const group = (currency, amounts, extra = {}) => ({
  currency, status: 'available', total: amounts.reduce((sum, amount) => sum + Number(amount), 0).toFixed(2),
  buckets: bucketLabels.map(([id, label], index) => ({ id, label, amount: Number(amounts[index]).toFixed(2) })),
  missing_balance_count: 0, unknown_due_date_count: currency === 'AED' ? 2 : 0, ...extra,
});

export function financialFixture(name = 'full') {
  if (name === 'financial-missing') return undefined;
  const aging = {
    status: 'available', invoice_count: 12, missing_balance_count: 0,
    source_updated_at: '2026-09-12T10:00:00Z',
    by_currency: [
      group('AED', [40000, 30000, 20000, 25000, 10000]),
      group('USD', [10000, 30000, 40000, 10000, 0]),
    ],
  };
  const report = {
    status: 'available', source_updated_at: aging.source_updated_at,
    source_timestamp_kind: 'latest_record_update',
    kpis: [
      metric('revenue_ytd', 'Revenue YTD'), metric('operating_profit', 'Operating profit'),
      metric('operating_margin', 'Operating margin', { unit: 'percent' }),
      metric('cash_position', 'Cash position'), metric('dso', 'DSO', { unit: 'days' }),
    ],
    working_capital: { metrics: [], aging },
    actions: Array.from({ length: 6 }, (_, index) => ({
      id: `financial-invoice-${index + 1}`, department: 'finance',
      title: `Fixture invoice FIN-${101 + index} requires review`,
      detail: `Confirm the recorded invoice balance and accountable owner for FIN-${101 + index}.`,
      severity: ['critical', 'high', 'medium'][index % 3], owner: `Fixture finance owner ${index + 1}`,
      action_label: 'Review invoice', route: `/finance/outgoing-invoices/financial-${index + 1}`,
      due_date: index < 3 ? '2026-09-10' : null,
    })),
    controls: {
      ledger_connected: false, source_status: 'available',
      source_updated_at: aging.source_updated_at, source_timestamp_kind: 'latest_record_update',
      description: 'Verified invoice balances support receivables aging. General ledger, approved budget, project margin and close controls are not connected.',
      unavailable_panels: ['historical_performance', 'business_units', 'project_margins', 'forecast_bridge', 'financial_close'],
    },
  };
  if (name === 'financial-usd-only' || name === 'financial-zero-buckets') {
    aging.by_currency = name === 'financial-usd-only' ? [aging.by_currency[1]] : [group('USD', [100, 0, 0, 0, 0])];
    aging.invoice_count = name === 'financial-zero-buckets' ? 1 : 4;
  }
  if (name === 'financial-unspecified') {
    aging.by_currency = [group('UNSPECIFIED', [500, 0, 0, 0, 0])];
    aging.invoice_count = 1;
  }
  if (name === 'financial-incomplete') {
    aging.status = 'incomplete';
    aging.missing_balance_count = 1;
    Object.assign(aging.by_currency[0], { status: 'incomplete', total: null, missing_balance_count: 1 });
    aging.by_currency[0].buckets.forEach(row => { row.amount = null; });
  }
  if (name === 'financial-settled' || name === 'zero') {
    aging.by_currency = [];
    aging.invoice_count = 0;
    report.actions = [];
  }
  if (['financial-restricted', 'financial-error', 'partial', 'empty'].includes(name)) {
    const status = name === 'empty' ? 'unavailable' : name === 'financial-error' ? 'error' : 'restricted';
    report.status = status;
    report.source_updated_at = null;
    report.source_timestamp_kind = null;
    report.controls.source_status = status;
    report.controls.source_updated_at = null;
    report.controls.source_timestamp_kind = null;
    report.actions = [];
    aging.status = status;
    aging.by_currency = [];
    aging.invoice_count = 0;
    aging.source_updated_at = null;
  }
  const completeGroups = aging.by_currency.filter(row => row.status === 'available');
  const incompleteCurrencies = aging.by_currency.filter(row => row.status !== 'available').map(row => row.currency);
  const observed = (id, label, amountOf) => metric(id, label, {
    status: incompleteCurrencies.length ? 'partial' : aging.status,
    source: 'Authorized unpaid invoice balances',
    description: 'Known balances grouped in their original currencies; incomplete currencies remain unavailable.',
    reason: aging.status === 'error' ? 'The customer invoice source could not be read.' : null,
    by_currency: completeGroups.map(row => ({ currency: row.currency, amount: amountOf(row) })),
    incomplete_currencies: incompleteCurrencies,
  });
  report.working_capital.metrics = [
    observed('receivables', 'Receivables', row => row.total),
    observed('receivables_over60', 'Receivables over 60 days', row => row.buckets.find(bucket => bucket.id === 'over60').amount),
    metric('unbilled_wip', 'Unbilled WIP'), metric('cash_position', 'Cash position'), metric('dso', 'DSO', { unit: 'days' }),
  ];
  return report;
}
