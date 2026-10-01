import test from 'node:test';
import assert from 'node:assert/strict';
import { financeSource, overviewExport } from '../src/pages/Executive/financeSourcePresentation.js';
import { portfolioSourceRoute } from '../src/pages/Executive/portfolioInvoicePresentation.js';
import { financialInvoiceModel } from '../src/pages/Executive/financialInvoicePresentation.js';
import { overviewModel } from '../src/pages/Executive/overviewPresentation.js';

const finance = {
  currency: 'AED', source_updated_at: '2026-10-01T08:00:00Z',
  sources: { receivables: { mode: 'workbook', kind: 'finance_source_snapshot', status: 'available', snapshot_id: 7,
    imported_at: '2026-10-01T07:00:00Z' } },
  kpis: { unpaid: { amount: '120.00', count: 1 } },
};

test('published Finance provenance uses publication time and read-only source, not request time or operational details', () => {
  assert.deepEqual(financeSource(finance), {
    workbook: true, label: 'Published Finance workbook', timestampLabel: 'Finance snapshot published',
    timestamp: '2026-10-01T07:00:00Z', route: '/finance',
  });
  const metric = financialInvoiceModel(finance).pending;
  assert.equal(metric.value, 120);
  assert.equal(metric.route, '/finance');
  assert.equal(metric.source, 'Published Finance workbook');
});

test('legacy operational Finance remains explicitly identified with its original route', () => {
  const source = financeSource({ sources: { receivables: { status: 'available' } }, source_updated_at: '2026-09-20T10:00:00Z' });
  assert.equal(source.workbook, false);
  assert.equal(source.route, '/finance/outgoing-invoices');
  assert.equal(source.timestampLabel, 'Latest Finance record');
});

test('Overview exports the displayed Finance version and selected period, withholding stale currency/loading/error responses', () => {
  const report = { schema_version: '1.0', generated_at: '2026-10-01T08:30:00Z' };
  const snapshot = { receivables: finance, reporting_period: { mode: 'ytd', month: '2026-09' }, source_description: 'Published Finance workbook' };
  const result = overviewExport(report, snapshot, 'AED');
  assert.equal(result.finance.receivables.sources.receivables.snapshot_id, 7);
  assert.deepEqual(result.finance.reporting_period, snapshot.reporting_period);
  assert.equal(result.generated_at, report.generated_at);
  for (const unavailable of [{ ...snapshot, loading: true }, { ...snapshot, error: 'denied' }, { ...snapshot, receivables: { ...finance, currency: 'EUR' } }]) {
    assert.equal(overviewExport(report, unavailable, 'AED').finance, null);
  }
});

test('portfolio links accept read-only Finance while rejecting external and unrelated routes', () => {
  assert.equal(portfolioSourceRoute('/finance'), '/finance');
  assert.equal(portfolioSourceRoute('/finance?currency=AED'), '/finance?currency=AED');
  assert.equal(portfolioSourceRoute('/finance/outgoing-invoices/42'), '/finance/outgoing-invoices/42');
  for (const route of ['https://example.test/finance', '//example.test/finance', '/admin', '/finance/settings', 'javascript:alert(1)']) {
    assert.equal(portfolioSourceRoute(route), null);
  }
});

test('Overview and Financial project cards share workbook counts independently of portfolio health and invoice periods', () => {
  const report = { portfolio_performance: { register: { status: 'available', total_rows: 50, projects: [] },
    health: { status: 'available', counts: { clear: 47, high: 2, medium: 0, low: 0, critical: 1, unknown: 0 } } } };
  for (const currency of ['AED', 'EUR']) {
    for (const count of [497, 31, 0, null, -1, 1.5, true, 'invalid']) {
      const response = { ...finance, currency,
        workbook_summary: { schema_version: '1.0', status: 'available', totals: { project_count: count } } };
      for (const mode of ['monthly', 'ytd']) {
        const model = overviewModel(report, currency, response, mode, '2026-09');
        const card = model.cards.find(item => item.id === 'total_projects');
        assert.equal(card.metric.value, financialInvoiceModel(response, currency, mode).projectCount);
        assert.equal(model.portfolio.total, 50);
        assert.equal(model.portfolio.buckets[0].count, 47);
        assert.equal(card.metric.route, '/finance');
        if (count === 0) assert.equal(card.value, '0');
      }
    }
  }
  for (const summary of [null, { schema_version: '1.0', status: 'restricted', totals: { project_count: 497 } },
    { schema_version: '1.0', status: 'error', totals: { project_count: 497 } },
    { schema_version: 'unsupported', status: 'available', totals: { project_count: 497 } }]) {
    const card = overviewModel(report, 'AED', { ...finance, workbook_summary: summary }).cards.find(item => item.id === 'total_projects');
    assert.equal(card.value, '\u2014');
    assert.equal(card.metric.value, null);
    if (summary?.status === 'restricted') assert.equal(card.metric.route, null);
  }
  const mismatched = { ...finance, currency: 'EUR', workbook_summary: { schema_version: '1.0', status: 'available', totals: { project_count: 497 } } };
  assert.equal(overviewModel(report, 'AED', mismatched).cards.find(item => item.id === 'total_projects').metric.value, null);
  assert.equal(overviewModel(report, 'AED', null).cards.find(item => item.id === 'total_projects').metric.value, null);
});
