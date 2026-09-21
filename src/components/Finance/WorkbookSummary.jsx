import PropTypes from 'prop-types';
import { BanknotesIcon, BriefcaseIcon, DocumentCurrencyDollarIcon, DocumentTextIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { financeCount, financeDate } from './financeCommandPresentation';
import { outgoingReviewMoney } from './outgoingReviewPresentation';
import { workbookCurrencyLabel } from './financeReceivablesPresentation';
import './WorkbookSummary.css';

const METRICS = [
  { id: 'invoice_amount', label: 'Total amount', currencies: true, icon: DocumentTextIcon, tone: 'blue' },
  { id: 'invoice_amount_aed', label: 'Total amount in AED', note: 'Recorded AED amounts', icon: DocumentCurrencyDollarIcon, tone: 'cyan' },
  { id: 'actual_payment_received', label: 'Total amount received', currencies: true, icon: BanknotesIcon, tone: 'green' },
  { id: 'project_count', label: 'Total projects', note: 'Unique RAD Project #', icon: BriefcaseIcon, tone: 'violet' },
];
const STATUSES = [['paid', 'Paid'], ['cancelled', 'Cancelled'], ['pending', 'Pending'], ['new', 'New'], ['other', 'Other statuses']];
const available = summary => summary?.status === 'available' && summary?.schema_version === '1.0';
const countLabel = value => financeCount(value)?.toLocaleString('en-GB') ?? '—';
const stateMessage = (summary, loading) => loading ? 'Loading workbook summary…' : summary?.status === 'restricted' ? 'Workbook summary access is restricted.' : 'Workbook summary is unavailable.';

function WorkbookSource({ summary }) {
  const source = summary.source || {};
  const coverage = METRICS.filter(metric => metric.id !== 'project_count').flatMap(metric => {
    const field = summary.coverage?.[metric.id];
    return [['error_count', 'error'], ['text_count', 'text']].filter(([key]) => financeCount(field?.[key]) > 0)
      .map(([key, type]) => `${metric.label}: ${countLabel(field[key])} ${type} ${field[key] === 1 ? 'cell' : 'cells'} excluded.`);
  });
  return <details className="ar-workbook-source"><summary><InformationCircleIcon aria-hidden="true" />Workbook source</summary><div>
    <p><strong>{source.file_name || 'Invoice tracking workbook'}</strong>{source.sheet ? ` · ${source.sheet.trim()}` : ''}{source.first_row && source.last_row ? ` · Rows ${source.first_row}–${source.last_row}` : ''}</p>
    <p>This workbook snapshot includes all invoice statuses. Dashboard customer, currency, period and as-of filters do not change these totals or the payment status counts.</p>
    <p>Columns L and AA combine original workbook currencies; they are not converted to AED. Column M contains the recorded AED amounts. Totals include numeric cells only.</p>
    <p>Each currency list uses that amount cell’s currency label and the invoice currency field. Conflicting labels appear as Currency needs review; missing labels appear as Currency not recorded. Payments retain their own currency labels. No exchange rates are assumed.</p>
    {coverage.length > 0 && <p>{coverage.join(' ')}</p>}
    {financeCount(summary.project_excluded_rows) > 0 && <p>Project count excludes {countLabel(summary.project_excluded_rows)} rows with a blank or N/A RAD Project #.</p>}
  </div></details>;
}
WorkbookSource.propTypes = { summary: PropTypes.object.isRequired };

function CurrencyBreakdown({ summary, field, loading }) {
  const rows = !loading && available(summary) && Array.isArray(summary.currency_breakdown) ? summary.currency_breakdown : [];
  if (!rows.length) return <span className="ar-workbook-currency-state">{loading ? 'Loading currencies…' : 'Currency breakdown unavailable'}</span>;
  const adjustment = summary.currency_rounding_adjustment?.[field];
  const hasAdjustment = Number.isFinite(Number(adjustment)) && Number(adjustment) !== 0;
  return <dl className="ar-workbook-currencies" aria-label={field === 'invoice_amount' ? 'Invoice amounts by currency' : 'Amounts received by currency'}>{rows.map((row, index) => {
    const label = workbookCurrencyLabel(row);
    const amount = outgoingReviewMoney(row[field], 'AED').replace(/^AED /, '');
    return <div key={`${row.currency || row.currency_status || 'unknown'}-${index}`} data-currency={row.currency || row.currency_status || 'unknown'}><dt>{label}</dt><dd>[{amount}]</dd></div>;
  })}{hasAdjustment && <div data-currency="rounding"><dt>Rounding</dt><dd>[{outgoingReviewMoney(adjustment, 'AED').replace(/^AED /, '')}]</dd></div>}</dl>;
}
CurrencyBreakdown.propTypes = { summary: PropTypes.object, field: PropTypes.string.isRequired, loading: PropTypes.bool };

export function WorkbookSummaryCards({ summary, loading = false }) {
  const readable = !loading && available(summary);
  return <section className="ar-workbook-summary" aria-label="Workbook invoice totals" aria-busy={loading}>
    <header className="ar-workbook-heading"><div><h2>Workbook totals</h2><p>{readable ? <>Full workbook · {countLabel(summary.invoice_count)} invoice rows · Snapshot {financeDate(summary.source?.snapshot_at)}</> : stateMessage(summary, loading)}</p></div><span className="ar-workbook-scope">Unaffected by dashboard filters</span>{readable && <WorkbookSource summary={summary} />}</header>
    <div className="ar-workbook-cards">{METRICS.map(({ id, label, note, currencies, icon: Icon, tone }) => {
      const value = readable ? summary.totals?.[id] : null;
      const formatted = id === 'project_count' ? countLabel(value) : outgoingReviewMoney(value, 'AED');
      return <article className={`ar-workbook-card ar-workbook-${tone}`} key={id} data-testid={`workbook-total-${id}`}><div className="ar-workbook-card-label"><Icon aria-hidden="true" /><h3>{label}</h3></div><strong>{id === 'invoice_amount_aed' ? formatted : formatted.replace(/^AED /, '')}</strong>{currencies ? <CurrencyBreakdown summary={summary} field={id} loading={loading} /> : <span>{note}</span>}</article>;
    })}</div>
  </section>;
}
WorkbookSummaryCards.propTypes = { summary: PropTypes.object, loading: PropTypes.bool };

export function PaymentStatusSummary({ summary, loading = false }) {
  if (loading || !available(summary)) return <div className="ar-workbook-state" role="status">{stateMessage(summary, loading)}</div>;
  const other = (summary.other_statuses || []).map(row => `${row.label}: ${countLabel(row.count)}`).join('; ');
  const amountCell = (value, coverage) => {
    const excluded = ['blank_count', 'text_count', 'error_count'].reduce((sum, key) => sum + (financeCount(coverage?.[key]) || 0), 0);
    return <td data-field="amount_aed">{outgoingReviewMoney(value, 'AED').replace(/^AED /, '')}{excluded > 0 && <abbr title={`Recorded AED subtotal; ${countLabel(excluded)} missing or invalid amount cells excluded`} aria-label={`${countLabel(excluded)} missing or invalid amount cells excluded`}>*</abbr>}</td>;
  };
  const adjustment = summary.payment_status_rounding_adjustment;
  const hasAdjustment = Number.isFinite(Number(adjustment)) && Number(adjustment) !== 0;
  return <div className="ar-payment-status-content"><table className="ar-table ar-payment-status-table" data-table-typography="preserve"><caption className="sr-only">Recorded AED amounts and invoice rows by payment status across the full workbook. Dashboard filters do not change these values. Missing and invalid amount cells are excluded from subtotals.</caption><thead><tr><th scope="col">Payment status</th><th scope="col">Amount (AED)</th><th scope="col">Invoice rows</th></tr></thead><tbody>{STATUSES.map(([id, label]) => {
    const row = (summary.payment_status || []).find(status => status.id === id);
    return <tr key={id} data-status={id}><th scope="row"><span className={`ar-workbook-status-dot ar-workbook-status-${id}`} aria-hidden="true" />{id === 'other' && other ? <abbr title={other} tabIndex={0}>{label}</abbr> : label}</th>{amountCell(row?.amount_aed, row?.amount_coverage)}<td data-field="invoice_count">{countLabel(row?.count)}</td></tr>;
  })}</tbody><tfoot><tr><th scope="row">Total</th>{amountCell(summary.totals?.invoice_amount_aed, summary.coverage?.invoice_amount_aed)}<td data-field="invoice_count">{countLabel(summary.invoice_count)}</td></tr></tfoot></table><p>Recorded AED amounts; missing or invalid cells excluded.{hasAdjustment && <> Rounding: {outgoingReviewMoney(adjustment, 'AED')}.</>}</p></div>;
}
PaymentStatusSummary.propTypes = { summary: PropTypes.object, loading: PropTypes.bool };
