const numeric = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
const readable = status => ['available', 'partial'].includes(status);
const fields = ['invoiced', 'received', 'outstanding'];
const emptyAmount = () => ({ amount: null, known_amount: null, partial: false });

export function invoiceMonthLabel(month) {
  return /^\d{4}-\d{2}$/.test(month || '') ? new Date(`${month}-01T12:00:00Z`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }) : 'Reporting period unavailable';
}

function sumAmounts(rows, field) {
  if (!rows.length) return emptyAmount();
  const complete = rows.every(row => numeric(row[field]?.amount) !== null && !row[field]?.partial);
  const known = rows.map(row => numeric(row[field]?.amount) ?? numeric(row[field]?.known_amount));
  const subtotal = known.some(value => value !== null) ? known.reduce((total, value) => total + (value ?? 0), 0) : null;
  return { amount: complete ? subtotal : null, known_amount: subtotal, partial: !complete };
}

function collectionRate(amounts) {
  return amounts.invoiced.amount > 0 && amounts.received.amount !== null
    ? amounts.received.amount / amounts.invoiced.amount * 100 : null;
}

/** Invoice-date cohorts, with amounts kept in their original currency. */
export function invoicePerformanceModel(source, currency, mode = 'monthly', monthChoice = '') {
  const valid = source?.schema_version === '1.0' && source.currency === currency;
  const status = valid ? source.status : 'unavailable';
  const canRead = valid && readable(status);
  const asOf = valid ? source.as_of_date || '' : '';
  const year = asOf.slice(0, 4);
  const history = canRead && Array.isArray(source.monthly)
    ? source.monthly.filter(row => /^\d{4}-\d{2}$/.test(row.month) && row.month <= asOf.slice(0, 7)).sort((a, b) => a.month.localeCompare(b.month)) : [];
  // Only the current calendar year's January-to-date coverage is guaranteed by
  // the rolling twelve-month API. Do not offer an incomplete previous-year YTD.
  const months = history.filter(row => row.month.startsWith(`${year}-`)).map(row => row.month);
  const selectedMonth = months.includes(monthChoice) ? monthChoice : months.at(-1) || '';
  const through = history.filter(row => row.month <= selectedMonth);
  const currentYear = through.filter(row => row.month.startsWith(`${year}-`));
  const selected = mode === 'ytd' ? currentYear : through.filter(row => row.month === selectedMonth);
  const amounts = Object.fromEntries(fields.map(field => [field, sumAmounts(selected, field)]));
  const rate = collectionRate(amounts);
  const isCurrent = selectedMonth === asOf.slice(0, 7);
  const period = mode === 'ytd' ? `Jan–${invoiceMonthLabel(selectedMonth)} · YTD` : `${invoiceMonthLabel(selectedMonth)}${isCurrent ? ' · month to date' : ''}`;
  const definitions = valid ? source.definitions || {} : {};
  const partial = selected.some(row => fields.some(field => row[field]?.partial)) || (canRead && (source.coverage?.missing_invoice_date_count || 0) > 0);
  const definition = [definitions.invoiced || 'Recorded external invoice amounts grouped by invoice issue date. This is invoiced value, not recognised accounting revenue.', definitions.scope, definitions.period, 'Monthly shows the selected calendar month. YTD runs from 1 January through the selected month; the current month stops at the source cutoff.'].filter(Boolean).join(' ');
  const makeMetric = (id, label, value, unit, description, metricStatus = status) => ({ id, label, value, unit, currency,
    status: metricStatus, description, definition: description, source: source?.source?.label || 'Finance invoice workbook', route: source?.source?.route || '/finance/outgoing-invoices' });
  const revenue = makeMetric('revenue', 'Invoiced revenue', amounts.invoiced.amount ?? amounts.invoiced.known_amount, 'currency', definition,
    canRead ? amounts.invoiced.partial ? 'partial' : 'available' : status);
  const budget = canRead && source.budget?.status === 'approved' ? source.budget : { status: canRead ? source.budget?.status || 'unavailable' : status, rows: [], description: canRead ? source.budget?.description || 'Awaiting Finance’s approved invoicing budget.' : 'Approved Finance planning access and an authorised invoice source are required.' };
  const margin = canRead && source.operating_margin?.status === 'approved' ? source.operating_margin : { status: canRead ? source.operating_margin?.status || 'unavailable' : status, rows: [], description: canRead ? source.operating_margin?.description || 'Awaiting Finance’s matched recognised revenue and operating costs.' : 'Approved Finance accounting access and an authorised invoice source are required.' };
  const budgetByMonth = new Map((budget.rows || []).map(row => [row.month, numeric(row.value)]));
  const marginByMonth = new Map((margin.rows || []).map(row => [row.month, row]));
  const chartRows = (mode === 'ytd' ? currentYear : through).map((row, index) => {
    const cohort = mode === 'ytd' ? currentYear.slice(0, index + 1) : [row];
    const values = Object.fromEntries(fields.map(field => [field, sumAmounts(cohort, field)]));
    const budgetValues = cohort.map(item => budgetByMonth.get(item.month) ?? null);
    const actuals = cohort.map(item => marginByMonth.get(item.month));
    const completeActuals = actuals.every(item => numeric(item?.recognised_revenue) !== null && numeric(item?.operating_costs) !== null);
    // YTD requires complete prior months, with no omitted accounting periods.
    const fullPeriods = cohort.every(item => {
      const lastDay = new Date(Date.UTC(Number(item.month.slice(0, 4)), Number(item.month.slice(5, 7)), 0)).toISOString().slice(0, 10);
      return (marginByMonth.get(item.month)?.actual_through || '') === (lastDay < asOf ? lastDay : asOf);
    });
    const netRevenue = completeActuals ? actuals.reduce((total, item) => total + Number(item.recognised_revenue), 0) : null;
    const costs = completeActuals ? actuals.reduce((total, item) => total + Number(item.operating_costs), 0) : null;
    return { month: row.month, ...Object.fromEntries(fields.map(field => [field, values[field].amount])),
      collection_rate: collectionRate(values),
      budget: budgetValues.every(value => value !== null) ? budgetValues.reduce((total, value) => total + value, 0) : null,
      operating_margin: mode === 'monthly' ? numeric(marginByMonth.get(row.month)?.value)
        : margin.status !== 'approved' ? null : Object.hasOwn(row, 'ytd_operating_margin') ? numeric(row.ytd_operating_margin)
          : fullPeriods && netRevenue > 0 ? (netRevenue - costs) / netRevenue * 100 : null };
  });
  const forecastSource = canRead && ['estimated', 'approved'].includes(source.forecast?.status) ? source.forecast : null;
  const forecast = { basis: forecastSource?.status || 'unavailable', rows: (forecastSource?.rows || []).map(row => ({ month: row.month, value: numeric(row.value) })),
    title: forecastSource?.status === 'approved' ? 'Approved invoicing forecast' : forecastSource?.status === 'estimated' ? 'Estimated invoicing' : 'Invoicing forecast',
    description: forecastSource?.description || 'Awaiting an approved Finance forecast or sufficient completed invoice history.' };
  forecast.metric = makeMetric('invoicing_forecast', forecast.title, null, 'currency', forecast.description, forecast.basis);
  return { revenue, note: canRead ? `${period}${amounts.invoiced.partial ? ' · known subtotal*' : ''}` : status === 'restricted' ? 'Access restricted' : status === 'error' ? 'Source unavailable' : 'Invoice periods unavailable',
    forecast, performance: { rows: chartRows, months, selectedMonth, asOf, period, partial, status, amounts, collectionRate: rate,
      description: definitions.received || 'Current recorded collections against invoices issued in each month; this is not cash received during that month.',
      latestInvoice: canRead ? source.coverage?.last_invoice_date || '' : '',
      coverageNote: canRead && (source.coverage?.missing_invoice_date_count || 0) > 0 ? `${source.coverage.missing_invoice_date_count} undated invoices excluded.` : '',
      budget: { status: budget.status, metric: makeMetric('invoice_budget', 'Invoicing budget', null, 'currency', budget.description, budget.status) },
      margin: { status: margin.status, metric: makeMetric('operating_margin', 'Operating margin', null, 'percent', margin.description, margin.status) },
      metric: makeMetric('invoice_performance', 'Invoice performance', rate, 'percent', [definition, definitions.received, definitions.outstanding, definitions.collection_rate].filter(Boolean).join(' ')) } };
}
