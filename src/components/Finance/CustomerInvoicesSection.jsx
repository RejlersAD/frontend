import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { ArrowDownIcon, ArrowUpIcon, ChevronLeftIcon, ChevronRightIcon, ChevronUpDownIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import financeService from '../../services/finance.service';
import { financeCount, financeNumber } from './financeCommandPresentation';
import { receivableCustomer, receivableNumber, receivableRawValue, receivableReadable } from './financeReceivablesPresentation';
import './CustomerInvoicesSection.css';

const PAGE_SIZE = 8;
const COLUMNS = [
  { key: 'invoice_number', label: 'Invoice #', width: 112 },
  { key: 'invoice_date', label: 'Invoice Date', type: 'date', width: 112 },
  { key: 'invoice_sent_date', label: 'Invoice Sent', type: 'date', width: 112 },
  { key: 'company', label: 'COMPANY', width: 160 },
  { key: 'project_name', label: 'Project Name', width: 210 },
  { key: 'amount', label: 'Invoice Amount', type: 'money', numeric: true, width: 135 },
  { key: 'amount_home', label: 'Inv Amt. (AED)', type: 'money', numeric: true, width: 135 },
  { key: 'due_date', label: 'Due Date', type: 'date', width: 112 },
  { key: 'payment_terms', label: 'Payment terms', width: 125 },
  { key: 'pm', label: 'PM', width: 140 },
  { key: 'payment_status', label: 'Payment Status', width: 130 },
  { key: 'days_overdue', label: 'Days overdue', numeric: true, width: 115 },
  { key: 'payment_date', label: 'Payment Date', type: 'date', width: 112 },
  { key: 'actual_payment_received', label: 'Actual Payment Received', type: 'money', numeric: true, width: 175 },
  { key: 'remarks', label: 'Remarks', width: 220 },
];
const formatAmount = receivableNumber;
const currencyLabel = value => !value || value === 'UNSPECIFIED' ? '—' : value;
const formatDate = value => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '—';
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).replace('Sept', 'Sep') : '—';
};

function RegisterTotal({ metric, descriptionId }) {
  const value = receivableRawValue(metric);
  const missing = financeCount(metric?.missing_count);
  return <td className="ar-customer-register-number" title={value === null ? 'Amount not recorded' : `${currencyLabel(metric?.currency)} ${formatAmount(value)}`}>
    {formatAmount(value)}{metric?.partial && <abbr title={`${missing === null ? 'Some' : missing} invoice amounts are missing; this is a recorded subtotal.`} aria-describedby={descriptionId}>*</abbr>}
  </td>;
}
RegisterTotal.propTypes = { metric: PropTypes.object, descriptionId: PropTypes.string.isRequired };

export default function CustomerInvoicesSection({ currency = '', company = '', asOf = '', refreshKey = 0, enabled = true, dataScope = 'finance', onSnapshotChange }) {
  const headingId = useId();
  const noteId = useId();
  const scope = JSON.stringify([currency, company, refreshKey, dataScope, asOf]);
  const [position, setPosition] = useState({ scope, page: 1 });
  const page = position.scope === scope ? position.page : 1;
  const [ordering, setOrdering] = useState('-invoice_date');
  const [retry, setRetry] = useState(0);
  const requestKey = JSON.stringify([scope, page, ordering, retry, enabled]);
  const sequence = useRef(0);
  const [response, setResponse] = useState({ key: '', loading: true, data: null, error: '' });

  useEffect(() => {
    setPosition(current => current.scope === scope ? current : { scope, page: 1 });
  }, [scope]);

  useEffect(() => {
    const request = ++sequence.current;
    if (!enabled) {
      setResponse({ key: requestKey, loading: false, data: null, error: '' });
      return () => { sequence.current += 1; };
    }
    setResponse({ key: requestKey, loading: true, data: null, error: '' });
    const fetchRegister = dataScope === 'executive' ? financeService.getExecutiveCustomerInvoiceRegister : financeService.getCustomerInvoiceRegister;
    fetchRegister({ currency, company, as_of: asOf, page, page_size: PAGE_SIZE, ordering }).then(data => {
      if (request !== sequence.current) return;
      if (data?.schema_version !== '1.0' || !Array.isArray(data.rows) || !data.source || !data.pagination || !data.totals) {
        throw new Error('The customer invoice register response is incomplete. Please try again.');
      }
      setResponse({ key: requestKey, loading: false, data, error: '' });
    }).catch(error => {
      if (request !== sequence.current) return;
      const detail = error?.response?.data;
      const message = error?.response?.status === 403 ? 'You do not have access to customer invoices.'
        : typeof detail?.detail === 'string' ? detail.detail
          : typeof detail?.error === 'string' ? detail.error
            : error?.message || 'Customer invoices could not be loaded.';
      setResponse({ key: requestKey, loading: false, data: null, error: message });
    });
    return () => { sequence.current += 1; };
  }, [enabled, currency, company, asOf, page, ordering, requestKey, dataScope]);

  const current = enabled && response.key === requestKey;
  const data = current ? response.data : null;
  const loading = enabled && (!current || response.loading);
  const error = current ? response.error : '';
  useLayoutEffect(() => { onSnapshotChange?.({ data, loading, error, scope }); }, [data, loading, error, scope, onSnapshotChange]);
  const readable = enabled && receivableReadable(data?.source);
  const rows = readable ? data.rows : [];
  const count = readable ? financeCount(data.pagination.count) : null;
  const currentPage = readable ? financeCount(data.pagination.page) || page : page;
  const first = count > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const last = count > 0 ? Math.min(first + rows.length - 1, count) : 0;
  const homeCurrency = data?.home_currency || 'AED';
  const selectedCurrency = data?.currency || currency;
  const partial = readable && ['amount', 'amount_home', 'actual_payment_received'].some(key => data.totals[key]?.partial);
  const sourceUnavailable = data && !readable;
  const retryable = !!error || (sourceUnavailable && data.source.status !== 'restricted');
  const stateMessage = !enabled ? 'Customer invoices are unavailable for this view.'
    : loading ? 'Loading customer invoices…'
      : error || (sourceUnavailable ? data.source.reason || 'Customer invoice data is unavailable.' : 'No customer invoices match these filters.');
  const sort = key => {
    setPosition({ scope, page: 1 });
    setOrdering(value => value === key ? `-${key}` : key);
  };

  return <section className="ar-customer-register" data-testid="customer-invoices-section" aria-labelledby={headingId} aria-busy={loading}>
    <header className="ar-customer-register-heading"><h2 id={headingId}>Customer invoices</h2><span title="Invoice amounts and payments use the selected original currency. The AED column shows recorded AED invoice values.">Invoice currency: {currencyLabel(selectedCurrency)} · Home currency: {homeCurrency}<InformationCircleIcon aria-hidden="true" /></span></header>
    <div className="ar-customer-register-panel">
      <div className="ar-customer-register-scroll" tabIndex={0} role="region" aria-label="Customer invoice register table">
        <table className="ar-customer-register-table" data-table-typography="preserve" aria-label="Customer invoices" aria-describedby={partial ? noteId : undefined}>
          <caption className="sr-only">Customer invoices in {currencyLabel(selectedCurrency)}. Home amounts are recorded in {homeCurrency}. Grand total includes all {count === null ? 'matching' : count} filtered invoices, across every page.</caption>
          <colgroup>{COLUMNS.map(column => <col key={column.key} style={{ width: `${column.width / COLUMNS.reduce((total, item) => total + item.width, 0) * 100}%` }} />)}</colgroup>
          <thead><tr>{COLUMNS.map(column => {
            const active = ordering.replace(/^-/, '') === column.key;
            const Icon = active ? ordering.startsWith('-') ? ArrowDownIcon : ArrowUpIcon : ChevronUpDownIcon;
            return <th key={column.key} scope="col" data-field={column.key} className={column.numeric ? 'ar-customer-register-number' : undefined} aria-sort={active ? ordering.startsWith('-') ? 'descending' : 'ascending' : 'none'}><button type="button" disabled={loading || !readable} aria-label={`Sort customer invoices by ${column.label}`} onClick={() => sort(column.key)} data-active={active || undefined}><span>{column.label}</span><Icon aria-hidden="true" /></button></th>;
          })}</tr></thead>
          <tbody>{rows.length > 0 ? rows.map(row => {
            const route = row.id === undefined || row.id === null ? null : `/finance/outgoing-invoices/${encodeURIComponent(row.id)}`;
            const customer = receivableCustomer(row);
            const invoice = row.invoice_number || '—';
            return <tr key={row.id || row.invoice_number}>{COLUMNS.map(column => {
              if (column.key === 'company') return <th key={column.key} data-field={column.key} scope="row" title={customer}>{route ? <Link to={route} aria-label={`Open customer invoice ${invoice} for ${customer}`}>{customer}</Link> : customer}</th>;
              if (column.key === 'invoice_number') return <td key={column.key} data-field={column.key} title={invoice}>{route ? <Link to={route}>{invoice}</Link> : invoice}</td>;
              const raw = column.key === 'payment_status' ? row.payment_status_label : row[column.key];
              const value = column.type === 'date' ? formatDate(raw) : column.type === 'money' ? formatAmount(raw) : raw === null || raw === undefined || raw === '' ? '—' : String(raw);
              const overdue = column.key === 'days_overdue' && financeNumber(raw) > 0;
              const title = column.key === 'actual_payment_received' && financeNumber(raw) === null ? 'Payment not recorded; treated as zero when calculating the remaining balance.' : value;
              return <td key={column.key} data-field={column.key} className={`${column.numeric ? 'ar-customer-register-number' : ''}${overdue ? ' ar-customer-register-due' : ''}`} title={title}>{value}</td>;
            })}</tr>;
          }) : <tr><td className="ar-customer-register-state" colSpan={COLUMNS.length}><div role={error ? 'alert' : loading ? 'status' : undefined}>{loading && <span className="ar-customer-register-spinner" aria-hidden="true" />}<p>{stateMessage}</p>{retryable && <button type="button" onClick={() => setRetry(value => value + 1)}>Try again</button>}</div></td></tr>}</tbody>
          {readable && <tfoot><tr><th scope="row" colSpan={5} className="ar-customer-register-grand-total" title={`Grand total in ${currencyLabel(selectedCurrency)}; AED amounts in ${homeCurrency}`}>Grand total</th><RegisterTotal metric={data.totals.amount} descriptionId={noteId} /><RegisterTotal metric={data.totals.amount_home} descriptionId={noteId} /><td colSpan={6} /><RegisterTotal metric={data.totals.actual_payment_received} descriptionId={noteId} /><td /></tr></tfoot>}
        </table>
      </div>
      <footer className="ar-customer-register-footer"><p id={noteId}>{partial && '* Recorded subtotal; missing invoice amounts are excluded. '}Grand total includes all filtered invoices. Balance = Invoice Amount − Actual Payment Received; blank payments count as zero.</p>
        <nav aria-label="Customer invoice pages"><span aria-live="polite">{count === null ? '—' : `${first}–${last} of ${count.toLocaleString('en-GB')}`}</span><button type="button" aria-label="Previous customer invoice page" disabled={loading || !readable || !data.pagination.has_previous} onClick={() => setPosition({ scope, page: Math.max(1, currentPage - 1) })}><ChevronLeftIcon aria-hidden="true" /></button><button type="button" aria-label="Next customer invoice page" disabled={loading || !readable || !data.pagination.has_next} onClick={() => setPosition({ scope, page: currentPage + 1 })}><ChevronRightIcon aria-hidden="true" /></button></nav>
      </footer>
    </div>
  </section>;
}
CustomerInvoicesSection.propTypes = { currency: PropTypes.string, company: PropTypes.string, asOf: PropTypes.string, refreshKey: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), enabled: PropTypes.bool, dataScope: PropTypes.oneOf(['finance', 'executive']), onSnapshotChange: PropTypes.func };
