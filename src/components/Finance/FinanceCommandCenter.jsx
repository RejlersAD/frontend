import { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import {
  ArrowPathIcon, BanknotesIcon, ChartBarIcon, ChevronRightIcon, ClipboardDocumentListIcon,
  Cog6ToothIcon, DocumentArrowDownIcon, DocumentTextIcon, ExclamationTriangleIcon,
  InformationCircleIcon, ShieldCheckIcon, CircleStackIcon, XMarkIcon, WalletIcon,
} from '@heroicons/react/24/outline';
import financeService from '../../services/finance.service';
import { CashWorkingCapitalTrend, ReceivablesAgeing } from './FinanceCommandCharts';
import { exportFinanceCommandPdf } from './financeCommandPdf';
import {
  currencyPositions, financeControls, financeCount, financeCoverage, financeDate,
  financeKpis, financeMoney, financeProcesses, financeRoute, financeTrend, sourceMessage,
} from './financeCommandPresentation';
import './FinanceCommandCenter.css';

const KPI_ICONS = [WalletIcon, DocumentTextIcon, BanknotesIcon, ChartBarIcon, ExclamationTriangleIcon];
const IconHeading = ({ icon: Icon, children, extra }) => <header className="finance-command-panel-heading"><h2><Icon aria-hidden="true" />{children}</h2>{extra}</header>;
IconHeading.propTypes = { icon: PropTypes.elementType.isRequired, children: PropTypes.node.isRequired, extra: PropTypes.node };

const Progress = ({ percentage, tone = 'blue', label }) => <div className={`finance-command-progress finance-command-${tone}`} title={label}><span role={percentage === null ? undefined : 'meter'} aria-label={label} aria-valuenow={percentage ?? undefined} aria-valuemin={percentage === null ? undefined : 0} aria-valuemax={percentage === null ? undefined : 100}><i style={{ width: percentage === null ? '0%' : `${Math.max(0, Math.min(100, percentage))}%` }} /></span><small>{percentage === null ? '—' : `${Math.round(percentage)}%`}</small></div>;
Progress.propTypes = { percentage: PropTypes.number, tone: PropTypes.string, label: PropTypes.string.isRequired };

const PositionTable = ({ rows }) => <div className="finance-command-table-scroll" role="region" tabIndex={0} aria-label="Currency position table"><table className="finance-command-table finance-command-position-table"><caption className="sr-only">Balances in original currencies; net exposure is receivables less payables.</caption><thead><tr><th scope="col">Currency</th><th scope="col">A/R outstanding</th><th scope="col">A/P outstanding</th><th scope="col">Net exposure</th><th scope="col">Oldest due</th></tr></thead><tbody>{rows.map(row => <tr key={row.currency}><th scope="row">{row.currency === 'UNSPECIFIED' ? 'Unspecified' : row.currency}</th><td>{financeMoney(row.receivables, row.currency)}</td><td>{financeMoney(row.payables, row.currency)}</td><td className={row.net === null ? '' : row.net < 0 ? 'finance-command-negative' : 'finance-command-positive'}>{financeMoney(row.net, row.currency)}</td><td>{row.oldest_due_date ? financeDate(row.oldest_due_date) : '—'}</td></tr>)}</tbody></table>{!rows.length && <p className="finance-command-empty-note">No currency balances are available from the connected registers.</p>}</div>;
PositionTable.propTypes = { rows: PropTypes.array.isRequired };

export default function FinanceCommandCenter() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currency, setCurrency] = useState('');
  const [dialog, setDialog] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [exportStatus, setExportStatus] = useState('');
  const requestId = useRef(0);
  const dialogRef = useRef(null);

  const load = useCallback(async () => {
    const current = ++requestId.current;
    setLoading(true); setError('');
    try {
      const response = await financeService.getFinanceCommandCenter();
      if (!response?.sources || !Array.isArray(response.currencies) || !response.process || response.schema_version !== '1.0') throw new Error('The finance dashboard returned an incomplete response. Please refresh.');
      if (current !== requestId.current) return;
      setData(response);
      setCurrency(previous => response.currencies.includes(previous) ? previous : response.currencies.includes('AED') ? 'AED' : response.currencies[0] || '');
    } catch (requestError) {
      if (current !== requestId.current) return;
      setData(null);
      setError(requestError?.response?.status === 403 ? 'You do not have access to the Finance dashboard.' : requestError?.response?.data?.detail || requestError?.message || 'The finance dashboard could not be loaded.');
    } finally { if (current === requestId.current) setLoading(false); }
  }, []);
  useEffect(() => { load(); return () => { requestId.current += 1; }; }, [load]);
  useEffect(() => {
    if (!dialog) return undefined;
    const previousFocus = document.activeElement;
    const element = dialogRef.current;
    element?.showModal();
    return () => { element?.close(); if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus(); };
  }, [dialog]);

  const cards = financeKpis(data, currency);
  const positions = currencyPositions(data);
  const processes = financeProcesses(data);
  const controls = financeControls(data);
  const actions = data?.actions || [];
  const coverage = financeCoverage(data);
  const currencies = data?.currencies || [];
  const asOf = data?.as_of_date ? new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${data.as_of_date}T12:00:00Z`)) : 'Current position';
  const updated = Object.values(data?.sources || {}).map(source => source.source_updated_at).filter(value => value && Number.isFinite(Date.parse(value))).sort().at(-1);
  const notices = Object.entries(data?.sources || {}).filter(([, source]) => source.status !== 'available');
  const exportPdf = async () => {
    if (!data || exporting) return;
    setExporting(true); setExportError(''); setExportStatus('');
    try { await exportFinanceCommandPdf(data, currency); setExportStatus('Financial report exported.'); }
    catch { setExportError('The PDF could not be exported. Please try again.'); }
    finally { setExporting(false); }
  };
  const actionTable = items => <div className="finance-command-table-scroll"><table className="finance-command-table finance-command-actions-table"><caption className="sr-only">Recorded financial action queues across currencies; owners and decision deadlines are not assigned in this feed.</caption><thead><tr><th scope="col" title="Display priority: overdue, matching exceptions and on-hold queues are High; other recorded queues are Medium.">Priority</th><th scope="col">Decision/action</th><th scope="col">Exposure</th><th scope="col">Owner</th><th scope="col">Due</th><th scope="col">Action</th></tr></thead><tbody>{items.map(action => {
    const high = ['receivables_overdue', 'payables_exception', 'payables_on_hold'].includes(action.id);
    const route = financeRoute(action.route);
    return <tr key={action.id} className={high ? 'finance-command-action-high' : ''}><td><span className={`finance-command-priority ${high ? 'is-high' : 'is-medium'}`}>{high ? 'High' : 'Medium'}</span></td><td><span data-table-text="primary" title={action.reason}>{action.label}</span></td><td>{financeCount(action.count) === null ? '—' : `${action.count} invoices`}</td><td>{action.owner || 'Not recorded'}</td><td>{action.due_date ? financeDate(action.due_date) : 'Not recorded'}</td><td>{route ? <Link className="finance-command-row-action" to={route}>{action.id === 'receivables_overdue' ? 'Review' : 'Open queue'}</Link> : <span className="finance-command-muted">Unavailable</span>}</td></tr>;
  })}</tbody></table>{!items.length && <p className="finance-command-empty-note">{loading ? 'Loading financial actions…' : !data || data.status !== 'available' ? 'Actions from unavailable sources cannot be assessed.' : 'No action queues require attention in the connected registers.'}</p>}</div>;

  return <div className="finance-command-center" aria-busy={loading}>
    <header className="finance-command-page-header"><div className="finance-command-title"><nav aria-label="Breadcrumb"><span>Finance</span><b>/</b>Overview</nav><h1>Finance Command Center</h1><p>Cash, working capital, receivables, payables and financial actions.</p></div>
      <label className="finance-command-period"><span>{asOf} <b>·</b></span><select aria-label="Reporting currency" value={currency} disabled={!currencies.length} onChange={event => setCurrency(event.target.value)}>{!currencies.length && <option value="">No currency recorded</option>}{currencies.map(code => <option key={code} value={code}>{code === 'UNSPECIFIED' ? 'Unspecified' : code}</option>)}</select></label>
      <div className="finance-command-header-right"><div className="finance-command-toolbar"><button type="button" className="finance-command-button" onClick={exportPdf} disabled={loading || !data || exporting}><DocumentArrowDownIcon />{exporting ? 'Exporting…' : 'Export PDF'}</button><button type="button" className="finance-command-button" onClick={load} disabled={loading}><ArrowPathIcon className={loading ? 'finance-command-spin' : ''} />Refresh</button><button type="button" className="finance-command-button finance-command-primary" onClick={() => setDialog('report')} disabled={!data}><ChartBarIcon />Open financial report</button></div><p className="finance-command-freshness" title="Latest recorded invoice update; refresh does not change the underlying source timestamp.">{loading ? 'Refreshing financial position…' : updated ? `Updated ${financeDate(updated, true)}` : 'Source update not recorded'} <span>· {coverage === null ? 'Original currencies' : `Balance coverage ${coverage}%`}</span></p></div>
    </header>

    {error && <div className="finance-command-notice finance-command-notice-error" role="alert"><ExclamationTriangleIcon /><span>{error}</span><button type="button" onClick={load}>Try again</button></div>}
    {notices.length > 0 && <div className="finance-command-notice" role="status"><InformationCircleIcon /><span>{notices.map(([kind, source]) => `${kind === 'receivables' ? 'Receivables' : 'Payables'}: ${sourceMessage(source)}`).join(' · ')}</span><button type="button" onClick={() => setDialog('controls')}>View source coverage</button></div>}
    {exportError && <p className="finance-command-export-error" role="alert">{exportError}</p>}{exportStatus && <p className="finance-command-export-status" role="status">{exportStatus}</p>}

    <section className="finance-command-kpis" aria-label="Financial outcomes">{cards.map((card, index) => { const Icon = KPI_ICONS[index]; return <article key={card.id} className={`finance-command-kpi finance-command-${card.tone}`} data-testid={`finance-kpi-${card.id}`}><span className="finance-command-kpi-icon"><Icon aria-hidden="true" /></span><div><h2>{card.label}</h2><strong>{loading && !data ? '—' : card.text}</strong><p title={card.reason}>{loading && !data ? 'Loading source…' : card.note}</p></div></article>; })}</section>

    <section className="finance-command-panel finance-command-actions"><IconHeading icon={ClipboardDocumentListIcon} extra={<div className="finance-command-heading-extra"><span>Across currencies</span>{actions.length > 3 && <button type="button" onClick={() => setDialog('report')}>View all {actions.length} actions <ChevronRightIcon /></button>}</div>}>Financial actions required</IconHeading>{actionTable(actions.slice(0, 3))}</section>

    <div className="finance-command-analytics"><CashWorkingCapitalTrend trend={loading && !data ? { status: 'loading', series: [] } : error ? { status: 'error', series: [] } : financeTrend(data, currency)} currency={currency} /><ReceivablesAgeing source={loading && !data ? { status: 'loading' } : error ? { status: 'error' } : data?.sources?.receivables} currency={currency} /></div>

    <div className="finance-command-operations"><section className="finance-command-panel finance-command-positions"><IconHeading icon={CircleStackIcon}>Entity and currency position</IconHeading><PositionTable rows={positions} /><footer>Amounts shown in original currency. Net exposure is A/R less A/P; entity coding is not recorded.</footer></section>
      <section className="finance-command-panel finance-command-health"><IconHeading icon={Cog6ToothIcon}>Process health</IconHeading><div className="finance-command-table-scroll"><table className="finance-command-table"><thead><tr><th scope="col">Process</th><th scope="col">Status</th><th scope="col">Share of register</th><th scope="col">Action</th></tr></thead><tbody>{processes.map(row => <tr key={row.id}><th scope="row">{row.label}</th><td><span className={`finance-command-health-status finance-command-${row.tone}`}><i />{row.count === null ? 'Not available' : `${row.count} ${row.suffix}`}</span></td><td><Progress percentage={row.percentage} tone={row.tone} label={row.definition} /></td><td>{row.route ? <Link className="finance-command-row-action" to={row.route}>{row.action}</Link> : <span className="finance-command-muted">Unavailable</span>}</td></tr>)}</tbody></table></div></section></div>

    <section className="finance-command-panel finance-command-controls" aria-label="Forecast and controls"><h2><ShieldCheckIcon />Forecast and controls</h2>{controls.map(control => <div className={`finance-command-control finance-command-${control.tone}`} key={control.id} title={control.definition}><h3>{control.label}</h3><div><strong>{control.value}</strong>{control.percentage !== null && <Progress percentage={control.percentage} tone={control.tone} label={control.definition} />}</div><p>{control.note}</p></div>)}<button type="button" className="finance-command-button" onClick={() => setDialog('controls')}><ShieldCheckIcon />View controls<ChevronRightIcon /></button></section>

    {dialog && <dialog ref={dialogRef} className="finance-command-dialog" aria-labelledby="finance-command-dialog-title" onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const items = [...dialogRef.current.querySelectorAll('button:not(:disabled), a[href], select:not(:disabled), summary, [tabindex="0"]')].filter(element => element.getClientRects().length);
      const first = items[0]; const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }} onCancel={() => setDialog(null)}><header><div><span>RADAI · Finance</span><h2 id="finance-command-dialog-title">{dialog === 'report' ? 'Financial report' : 'Forecast, controls and source coverage'}</h2></div><button type="button" aria-label="Close financial dialog" onClick={() => setDialog(null)}><XMarkIcon /></button></header><div className="finance-command-dialog-body">
      {dialog === 'report' ? <><p>Current position as at {data?.as_of_date ? financeDate(data.as_of_date) : 'the latest recorded date'}. Amounts retain their original currencies.</p><h3>Financial actions required</h3>{actionTable(actions)}<h3>Entity and currency position</h3><PositionTable rows={positions} /><h3>Reporting definitions</h3><p>Display priority marks overdue, matching exception and on-hold queues as High; other recorded queues are Medium. These priorities do not represent assigned approval deadlines.</p>{cards.filter(card => card.value === null).map(card => <p key={card.id}><strong>{card.label}: </strong>{card.reason}</p>)}</> : <><div className="finance-command-definition-grid">{controls.map(control => <article key={control.id}><h3>{control.label}<strong>{control.value}</strong></h3><p>{control.definition}</p></article>)}</div><h3>Source coverage</h3><p>Balance coverage measures recorded balances among unsettled invoices. It does not measure ledger completeness or cash accuracy.</p>{Object.entries(data?.sources || {}).map(([key, source]) => <article className="finance-command-source" key={key}><h4>{source.source || key}</h4><p>{source.status === 'available' ? 'Connected' : sourceMessage(source)} · Last record update: {financeDate(source.source_updated_at, true)}</p><p>{source.balance_coverage?.definition || source.reason}</p>{financeRoute(source.route) && <Link className="finance-command-row-action" to={source.route}>Open register</Link>}</article>)}{!data && <p>Source coverage is not available until the dashboard loads.</p>}</>}
    </div><footer><button type="button" className="finance-command-button" onClick={() => setDialog(null)}>Close</button>{dialog === 'report' && <button type="button" className="finance-command-button finance-command-primary" onClick={exportPdf} disabled={exporting || !data}><DocumentArrowDownIcon />{exporting ? 'Exporting…' : 'Export PDF'}</button>}</footer></dialog>}
  </div>;
}
