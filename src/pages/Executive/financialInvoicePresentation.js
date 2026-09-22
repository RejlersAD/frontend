import { financeCount, financeNumber } from '../../components/Finance/financeCommandPresentation.js';
import { receivableCustomerRows, receivableRawValue, receivableReadable } from '../../components/Finance/financeReceivablesPresentation.js';
import { invoicePerformanceModel } from './invoicePerformancePresentation.js';
import { workbookMetric } from './overviewPresentation.js';

/** The Financial board uses the same audited invoice periods as the Overview. */
export function financialInvoiceModel(data, currency = 'AED', mode = 'monthly', month = '') {
  const scoped = data?.currency === currency ? data : null;
  const invoicing = invoicePerformanceModel(scoped?.invoice_performance, currency, mode, month);
  const summary = scoped?.workbook_summary;
  const workbookReadable = summary?.schema_version === '1.0' && summary.status === 'available';
  const amount = workbookMetric(summary, currency, 'invoice_amount', 'total_amount', 'Total amount');
  const received = workbookMetric(summary, currency, 'actual_payment_received', 'amount_received', 'Total amount received');
  const receivablesReadable = receivableReadable(scoped?.sources?.receivables);
  const pending = receivablesReadable ? scoped.kpis?.unpaid : null;
  const amountCoverage = workbookReadable ? summary.currency_breakdown?.find(row => row.currency === currency && row.currency_status === 'recorded')?.coverage?.invoice_amount : null;
  const cells = amountCoverage ? ['numeric_count', 'blank_count', 'text_count', 'error_count'].reduce((sum, key) => sum + (financeCount(amountCoverage[key]) || 0), 0) : 0;
  const customers = receivablesReadable ? receivableCustomerRows(scoped).map((row, index) => ({
    id: row.company || `unassigned-${index}`, label: row.customer, value: row.amount, partial: !!row.partial,
  })) : [];
  const ageing = receivablesReadable ? (scoped.ageing || []).map(row => ({
    id: row.id, label: row.label, value: financeNumber(receivableRawValue(row.receivables)), partial: !!row.receivables?.partial,
  })) : [];
  const forecastValues = invoicing.forecast.rows.map(row => financeNumber(row.value));
  const covered = forecastValues.filter(value => value !== null);
  const forecastPartial = covered.length > 0 && covered.length !== 12;
  const forecastTotal = covered.length ? covered.reduce((sum, value) => sum + value, 0) : null;
  const definition = scoped?.definitions?.balance_basis || 'Current outstanding customer invoice balances in their original currency. Blank receipts count as zero for this collection register; missing invoice amounts remain unknown.';
  const pendingMetric = { id: 'amount_pending', label: 'Total amount pending', value: financeNumber(receivableRawValue(pending)),
    unit: 'currency', currency, status: receivablesReadable ? pending?.partial ? 'partial' : 'available' : scoped?.sources?.receivables?.status || 'unavailable',
    description: definition, definition, source: 'Current authorised customer invoice register', route: '/finance/outgoing-invoices' };
  return { ...invoicing, amount, received, pending: pendingMetric, pendingSource: pending, receivablesReadable,
    workbookReadable, projectCount: workbookReadable ? financeCount(summary.totals?.project_count) : null,
    amountCoverage: cells ? (financeCount(amountCoverage.numeric_count) || 0) / cells * 100 : null,
    customers, ageing, priorities: receivablesReadable ? scoped.priority_invoices || [] : [],
    forecast: { ...invoicing.forecast, total: forecastTotal, partial: forecastPartial, coveredMonths: covered.length },
    definitions: { balance: definition,
      customer: `${definition} Grouped by the recorded COMPANY field. These are client receivables, not business-unit revenue or profitability.`,
      ageing: `${definition} ${scoped?.definitions?.ageing || 'Balances grouped by days past due, with unknown due dates kept separate.'} This is a current balance distribution, not historical working capital.`,
      priorities: scoped?.definitions?.priority || 'Up to five open customer invoices ordered by days past due and balance. The owner is the recorded project manager, not an assigned collection owner.' },
  };
}
