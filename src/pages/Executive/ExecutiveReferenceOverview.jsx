/* eslint-disable react/prop-types */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRightIcon, ChartBarIcon, ChevronDownIcon, ChevronUpIcon, ClockIcon, Cog6ToothIcon, CircleStackIcon, CreditCardIcon, DocumentChartBarIcon, DocumentTextIcon, ExclamationTriangleIcon, InformationCircleIcon, RectangleStackIcon, UserIcon, UsersIcon } from '@heroicons/react/24/outline';
import financeService from '../../services/finance.service';
import { formatDate, formatNumber } from './executivePresentation';
import { RouteLink } from './ExecutivePrimitives';
import { CompanyPerformanceChart, PortfolioDonut, RevenueForecastChart } from './OverviewCharts';
import { overviewModel, overviewMoney } from './overviewPresentation';
import { invoiceMonthLabel } from './invoicePerformancePresentation';
import PortfolioKpiGraphic from './PortfolioKpiGraphic';

const CARD_ICONS = [ChartBarIcon, DocumentTextIcon, CreditCardIcon, ClockIcon, RectangleStackIcon];
const CARD_GRAPHICS = {
  revenue: { id: 'contract_value', color: '#1674ff' },
  total_amount: { id: 'contract_value', color: '#7468ff' },
  amount_received: { id: 'revenue_remaining', color: '#00a977' },
  amount_pending: { id: 'forecast_margin', color: '#f7a400' },
  total_projects: { id: 'active_projects', color: '#1674ff' },
};
const WORKFORCE_ICONS = [UserIcon, ChartBarIcon, UsersIcon, ExclamationTriangleIcon];
const CONTROL_ICONS = [DocumentChartBarIcon, Cog6ToothIcon, ExclamationTriangleIcon, CircleStackIcon];
const numeric = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
const percent = value => numeric(value) ? `${formatNumber(value, { maximumFractionDigits: 1 })}%` : '—';
const compact = value => numeric(value) ? formatNumber(value, { notation: 'compact', maximumFractionDigits: 1 }) : '—';

export function reviewOverviewDecisions() {
  const target = document.getElementById('eov-decisions');
  target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  target?.focus({ preventScroll: true });
}

function Explain({ metric, onExplain, label }) {
  return <button type="button" className="eov-info" aria-label={label || `About ${metric.label}`} onClick={() => onExplain(metric)}><InformationCircleIcon aria-hidden="true" /></button>;
}

function Panel({ title, subtitle, children, className = '', controls, id }) {
  return <section className={`eov-panel ${className}`} aria-label={title} id={id} tabIndex={id ? -1 : undefined}>
    <header className="eov-panel-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{controls}</header>{children}
  </section>;
}

function PeriodButtons({ mode, onChange, label, small = false }) {
  return <div className={`eov-period${small ? ' eov-period--small' : ''}`} role="group" aria-label={label}>
    <button type="button" aria-pressed={mode === 'monthly'} onClick={() => onChange('monthly')}>Monthly</button>
    <button type="button" aria-pressed={mode === 'ytd'} onClick={() => onChange('ytd')}>YTD</button>
  </div>;
}

function Kpis({ cards, performance, currency, onExplain, loading, mode, onMode }) {
  return <section className="eov-kpis" aria-label="Executive key performance indicators" data-testid="executive-outcomes" aria-busy={loading}>
    {cards.map((card, index) => {
      const Icon = CARD_ICONS[index];
      const graphic = CARD_GRAPHICS[card.id];
      return <article className={`eov-kpi eov-kpi--${card.tone}`} key={card.id} data-testid={`executive-kpi-${card.id}`}>
        <span className="eov-kpi-icon" aria-hidden="true"><Icon /></span>
        <div className="eov-kpi-body"><h2>{card.label}</h2><strong className="eov-kpi-value">{card.value}</strong><p title={card.note}>{card.note}</p>
          {numeric(card.progress) && <div className="eov-kpi-progress" role="img" aria-label={`${formatNumber(card.progress, { maximumFractionDigits: 1 })}% ${card.label.toLowerCase()}`}><i style={{ width: `${Math.max(0, Math.min(100, card.progress))}%` }} /></div>}
        </div>
        <PortfolioKpiGraphic {...graphic} label={card.id === 'revenue' ? `${card.label} by invoice month (${currency}), ${mode === 'ytd' ? 'YTD' : 'monthly'}` : card.label} values={card.id === 'revenue' ? performance.rows.map(row => row.invoiced) : []} />
        <Explain metric={card.metric} onExplain={onExplain} />
        <button type="button" className="eov-calculation" aria-label={`How ${card.label} is calculated`} onClick={() => onExplain(card.metric)}><InformationCircleIcon aria-hidden="true" />How calculated</button>
        {card.id === 'revenue' && <PeriodButtons mode={mode} onChange={onMode} label="Invoiced revenue period" small />}
      </article>;
    })}
  </section>;
}

function DecisionBanner({ decisions, printing }) {
  const [collapsed, setCollapsed] = useState(false);
  const toggleRef = useRef(null);
  const restoreToggleFocus = useRef(false);
  useEffect(() => {
    if (restoreToggleFocus.current) {
      toggleRef.current?.focus({ preventScroll: true });
      restoreToggleFocus.current = false;
    }
  }, [collapsed]);
  const toggle = () => {
    restoreToggleFocus.current = true;
    setCollapsed(value => !value);
  };
  const review = () => {
    setCollapsed(true);
    reviewOverviewDecisions();
  };
  const urgent = decisions.rows.filter(row => ['critical', 'high'].includes(row.severity));
  const owners = [...new Set(urgent.map(row => row.owner).filter(owner => owner && owner !== '—'))];
  const unavailable = decisions.status === 'unavailable';
  return <section className={`eov-alert eov-floating-decisions${collapsed ? ' eov-floating-decisions--collapsed' : ''}${unavailable ? ' eov-alert--unavailable' : decisions.total ? '' : ' eov-alert--clear'}`} aria-label="Executive priorities" hidden={printing}>
    {collapsed ? <button type="button" className="eov-alert-launcher" aria-label="Expand decision banner" aria-expanded={false} onClick={toggle} ref={toggleRef}>
      <ExclamationTriangleIcon className="eov-alert-icon" aria-hidden="true" /><strong>{unavailable ? 'Decision sources unavailable' : `${decisions.total} ${decisions.total === 1 ? 'decision' : 'decisions'}`}</strong>{urgent.length > 0 && <span>{urgent.length} high priority</span>}<ChevronUpIcon className="eov-alert-chevron" aria-hidden="true" />
    </button> : <>
      <ExclamationTriangleIcon className="eov-alert-icon" aria-hidden="true" />
      <div className="eov-alert-copy" aria-live="polite"><h2>{unavailable ? 'Decision sources unavailable' : decisions.total ? `${decisions.total} executive ${decisions.total === 1 ? 'decision requires' : 'decisions require'} attention` : 'No executive decisions reported'}</h2><p>{unavailable ? 'An authorised source is required to assess executive priorities' : decisions.total ? `${urgent.length} high-priority ${urgent.length === 1 ? 'action' : 'actions'}${decisions.truncated ? ' in this preview' : ''} · Review recorded exceptions and accountable owners` : 'Current authorised source snapshot'}</p></div>
      <button type="button" className="eov-alert-minimize" aria-label="Minimize decision banner" aria-expanded={true} onClick={toggle} ref={toggleRef}><ChevronDownIcon aria-hidden="true" /></button>
      <div className="eov-alert-footer">{decisions.total > 0 && <span className="eov-alert-owner" title={owners.join(', ')}>Owners: {owners.length ? owners.slice(0, 2).join(' and ') : 'Assignment required'}</span>}<button type="button" className="cc-button cc-button--primary" onClick={review}>Review {decisions.total || ''} {decisions.total === 1 ? 'decision' : 'decisions'}</button></div>
    </>}
  </section>;
}

function PortfolioHealth({ portfolio, onNavigate }) {
  return <Panel title="Portfolio health" subtitle="Project status by validated data" className="eov-health">
    <div className="eov-health-body"><PortfolioDonut buckets={portfolio.buckets} total={portfolio.total} /><div className="eov-health-legend">{portfolio.buckets.map(bucket => <div key={bucket.id}><span className="eov-status-dot" style={{ background: bucket.color }} /><span>{bucket.label}</span><strong>{numeric(bucket.count) ? formatNumber(bucket.count) : '—'}</strong><span>{percent(bucket.percent)}</span></div>)}</div></div>
    <div className="eov-health-notice"><InformationCircleIcon aria-hidden="true" /><strong>{numeric(portfolio.attentionCount) ? `${formatNumber(portfolio.attentionCount)} projects require management attention` : 'Project health not assessed'}</strong><button type="button" className="eov-text-button" onClick={() => onNavigate('portfolio')}>Open portfolio<ArrowRightIcon /></button></div>
  </Panel>;
}

function Commercial({ commercial, forecast, currency, onExplain }) {
  const max = Math.max(0, ...commercial.stages.map(row => Number(row.value) || 0));
  return <Panel title="Commercial outlook" subtitle={`Pipeline by stage (${currency})`} className="eov-commercial">
    <div className="eov-commercial-body"><dl className="eov-commercial-totals"><div><dt>Total pipeline value</dt><dd>{commercial.total}</dd></div><div><dt>Weighted value</dt><dd>{commercial.weighted}</dd></div><div><dt>{commercial.conversionLabel}</dt><dd>{commercial.conversion}</dd></div></dl>
      <div className="eov-stage-list" aria-label={`Commercial pipeline by stage in ${currency}`}>{commercial.stages.length ? commercial.stages.map((row, index) => <div className="eov-stage" key={row.id}><span title={row.label}>{row.label}</span><span className="eov-stage-track"><i style={{ width: `${max && numeric(row.value) ? Math.max(0, Number(row.value)) / max * 100 : 0}%`, opacity: 1 - Math.min(index, 3) * .18 }} /></span><strong>{compact(row.value)}</strong></div>) : <div className="eov-unavailable"><InformationCircleIcon /><span>Pipeline data not available</span></div>}</div>
      <div className="eov-forecast"><h3>Next 12 months · {forecast.title.toLowerCase()} ({currency} millions)</h3><RevenueForecastChart rows={forecast.rows} currency={currency} basis={forecast.basis} /><button type="button" className="eov-text-button eov-forecast-basis" aria-label={forecast.basis === 'estimated' ? 'About invoicing estimate' : 'About invoicing forecast'} onClick={() => onExplain(forecast.metric)}><InformationCircleIcon />{forecast.basis === 'estimated' ? 'Estimate · recent 3-month average' : forecast.basis === 'approved' ? 'Finance-approved plan' : 'Finance forecast pending'}</button></div>
    </div>
  </Panel>;
}

function CompanyPerformance({ performance, currency, mode, onMode, onMonth, onExplain }) {
  const amountLabel = metric => `${overviewMoney(metric?.amount ?? metric?.known_amount, currency)}${metric?.partial && numeric(metric?.known_amount) ? '*' : ''}`;
  return <Panel title="Company performance" subtitle={`Invoicing and collections (${currency} millions)`} className="eov-performance" controls={<div className="eov-performance-controls">
    <select aria-label="Invoicing month" value={performance.selectedMonth} onChange={event => onMonth(event.target.value)} disabled={!performance.months.length}>
      {!performance.months.length && <option value="">No invoice periods</option>}
      {performance.months.map(month => <option key={month} value={month}>{invoiceMonthLabel(month)}</option>)}
    </select><PeriodButtons mode={mode} onChange={onMode} label="Revenue reporting period" />
  </div>}>
    <div className="eov-performance-summary" aria-label="Selected invoice period totals">
      <span>Collected against invoices <strong>{amountLabel(performance.amounts.received)}</strong></span>
      <span>Outstanding <strong>{amountLabel(performance.amounts.outstanding)}</strong></span>
      <span>Collection rate <strong>{percent(performance.collectionRate)}</strong></span>
      <Explain metric={performance.metric} onExplain={onExplain} />
    </div>
    <CompanyPerformanceChart rows={performance.rows} currency={currency} mode={mode} />
    <div className="eov-finance-inputs">
      <button type="button" onClick={() => onExplain(performance.budget.metric)}><InformationCircleIcon />{performance.budget.status === 'approved' ? 'Budget: Finance approved' : performance.budget.status === 'restricted' ? 'Budget: access restricted' : performance.budget.status === 'error' ? 'Budget: source unavailable' : 'Budget: awaiting Finance plan'}</button>
      <button type="button" onClick={() => onExplain(performance.margin.metric)}><InformationCircleIcon />{performance.margin.status === 'approved' ? 'Margin: matched Finance actuals' : performance.margin.status === 'restricted' ? 'Operating margin: access restricted' : performance.margin.status === 'error' ? 'Operating margin: source unavailable' : 'Operating margin: awaiting matching costs'}</button>
    </div>
    <p className="eov-performance-note">{performance.period} · Current collections grouped by invoice month.{performance.latestInvoice && ` Latest invoice: ${formatDate(performance.latestInvoice)}.`}{performance.partial && ' *Incomplete amounts; known subtotals shown. Rates require complete amounts.'} {performance.coverageNote}</p>
  </Panel>;
}

function Workforce({ workforce, onExplain, onNavigate, printing }) {
  const visible = printing ? workforce.rows : workforce.rows.slice(0, 5);
  const max = Math.max(0, ...workforce.rows.map(row => Number(row.value) || 0));
  return <Panel title="Workforce capacity" className="eov-workforce">
    <div className="eov-workforce-kpis">{workforce.metrics.map((metric, index) => {
      const Icon = WORKFORCE_ICONS[index] || UsersIcon;
      return <button type="button" key={metric.id} onClick={() => onExplain(metric.metric)} aria-label={`About ${metric.label}`} className={`eov-workforce-kpi eov-workforce-kpi--${metric.id}`} data-testid={`executive-side-metric-${metric.id}`}><Icon aria-hidden="true" /><span><span>{metric.label}</span><strong>{metric.value}</strong></span></button>;
    })}</div>
    <div className="eov-workforce-caption"><h3>{workforce.chartLabel}</h3><span>People</span></div>
    <div className="eov-workforce-bars">{workforce.rows.length ? visible.map(row => <div className="eov-workforce-row" key={row.id} aria-label={`${row.label}: ${row.value} people`}><span title={row.label}>{row.label}</span><span className="eov-workforce-track"><i style={{ width: `${max ? Number(row.value) / max * 88 : 0}%` }} /><strong>{formatNumber(row.value)}</strong></span></div>) : <div className="eov-unavailable"><InformationCircleIcon /><span>Workforce allocation not available</span></div>}</div>
    <p className="eov-workforce-note">{workforce.rows.length > visible.length && <button type="button" className="eov-text-button" onClick={() => onNavigate('workforce')}>View all {workforce.rows.length} units<ArrowRightIcon /></button>}Recorded headcount · Billable hours and capacity targets are not connected</p>
  </Panel>;
}

function Projects({ projects, printing, onNavigate }) {
  const rows = printing ? projects.rows : projects.rows.slice(0, 4);
  return <Panel title="Projects requiring attention" className="eov-projects" controls={projects.rows.length > 4 && <button className="eov-text-button" onClick={() => onNavigate('portfolio')}>View all<ArrowRightIcon /></button>}>
    <div className="eov-table-scroll" role="region" aria-label="Projects requiring attention register" tabIndex={0}><table className="eov-table eov-project-table" data-table-typography="preserve"><thead><tr>{['Project', 'Client', 'Progress', 'Schedule', 'Margin forecast', 'Risk', 'Executive owner', 'Action'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{rows.map(project => <tr key={project.id} data-testid={`executive-project-${project.id}`}>
      <th scope="row" title={project.name}>{project.name}</th><td title={project.client}>{project.client || '—'}</td>
      <td><span className="eov-project-progress"><span>{percent(project.progress)}</span>{numeric(project.progress) && <i><span style={{ width: `${Math.min(100, Math.max(0, Number(project.progress)))}%` }} /></i>}</span></td>
      <td>{numeric(project.schedule) ? Number(project.schedule) === 0 ? 'On plan' : `${formatNumber(Math.abs(project.schedule))} days ${Number(project.schedule) > 0 ? 'late' : 'ahead'}` : '—'}</td><td>{numeric(project.margin) ? percent(project.margin) : project.margin || '—'}</td><td><span className={`eov-risk eov-risk--${project.health}`}><ExclamationTriangleIcon aria-hidden="true" />{({ critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low', clear: 'No exceptions' })[project.health] || 'Not assessed'}</span></td><td title={project.owner}>{project.owner || '—'}</td><td><RouteLink route={project.route} className="eov-open">Open</RouteLink></td>
    </tr>)}</tbody></table>{!rows.length && <div className="eov-empty-row">{['available', 'partial'].includes(projects.status) ? 'No project exceptions reported.' : 'Project access or a connected register is required.'}</div>}</div>
    {projects.truncated && <p className="eov-table-note">Source returns a limited project preview. Open portfolio for the complete register.</p>}
  </Panel>;
}

function Decisions({ decisions, printing, onExplain }) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const filtered = decisions.rows.filter(row => `${row.title} ${row.owner} ${row.department}`.toLowerCase().includes(query.toLowerCase()));
  const rows = printing ? decisions.rows : expanded ? filtered : filtered.slice(0, 3);
  return <Panel title="Executive decisions" className="eov-decisions" id="eov-decisions" controls={decisions.rows.length > 3 && <button type="button" className="eov-text-button cc-screen-only" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? 'Show top 3' : `View all ${decisions.rows.length}`}<ArrowRightIcon /></button>}>
    {expanded && <input type="search" className="eov-decision-search cc-screen-only" aria-label="Search management actions" placeholder="Search decisions or owners…" value={query} onChange={event => setQuery(event.target.value)} />}
    <div className="eov-table-scroll" role="region" aria-label="Management decisions" tabIndex={0}><table className="eov-table eov-decision-table" data-table-typography="preserve"><thead><tr>{['#', 'Decision', 'Impact', 'Owner', 'Due date', 'Action'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={row.id} data-testid={`executive-action-${row.id}`}><td>{index + 1}</td><th scope="row"><button type="button" className="eov-cell-button" onClick={() => onExplain({ ...row, label: row.title, status: row.severity, description: row.detail || row.title, source: 'Authorised management exceptions', route: row.route })}>{row.title}</button></th><td><strong>{row.impact || '—'}</strong></td><td title={row.owner}>{row.owner || 'Unassigned'}</td><td className={['critical', 'high'].includes(row.severity) ? 'eov-due-urgent' : ''}>{row.dueDate ? formatDate(row.dueDate) : '—'}</td><td><RouteLink route={row.route} className="eov-open">Open</RouteLink></td></tr>)}</tbody></table>{!rows.length && <div className="eov-empty-row">{query ? 'No decisions match your search.' : 'No executive decisions reported.'}</div>}</div>
    {decisions.truncated && <p className="cc-cap-note">Showing {decisions.rows.length} of {decisions.total} selected source alerts. Full records remain in each department.</p>}
  </Panel>;
}

export default function ExecutiveReferenceOverview({ report, currency, refreshKey, printing, onExplain, onNavigate, onCurrencies }) {
  const [finance, setFinance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [financeError, setFinanceError] = useState('');
  const [mode, setMode] = useState('monthly');
  const [month, setMonth] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true); setFinance(null); setFinanceError('');
    financeService.getExecutiveReceivablesDashboard({ currency, months: '12' }).then(data => {
      if (data?.schema_version !== '1.0' || !data.sources || !data.kpis) throw new Error('Incomplete invoice summary');
      if (active) { setFinance(data); onCurrencies?.([...new Set([...(data.filters?.currencies || []), ...(data.workbook_summary?.currency_breakdown || []).map(row => row.currency).filter(Boolean)])]); }
    }).catch(error => {
      if (active) setFinanceError(error?.response?.status === 403 ? 'Invoice summary access restricted.' : 'Invoice summary could not be loaded. Use Refresh overview to try again.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [currency, refreshKey, onCurrencies]);
  const model = useMemo(() => overviewModel(report, currency, finance?.currency === currency ? finance : null, mode, month), [report, currency, finance, mode, month]);
  return <div className="eov-board" aria-busy={loading}>
    <Kpis cards={model.cards} performance={model.performance} currency={currency} onExplain={onExplain} loading={loading} mode={mode} onMode={setMode} />
    {financeError && <p className="eov-finance-error" role="status"><InformationCircleIcon />{financeError}</p>}
    <div className="eov-primary-row"><CompanyPerformance performance={model.performance} currency={currency} mode={mode} onMode={setMode} onMonth={setMonth} onExplain={onExplain} /><PortfolioHealth portfolio={model.portfolio} onNavigate={onNavigate} /></div>
    <div className="eov-secondary-row"><Commercial commercial={model.commercial} forecast={model.forecast} currency={currency} onExplain={onExplain} /><Workforce workforce={model.workforce} onExplain={onExplain} onNavigate={onNavigate} printing={printing} /></div>
    <div className="eov-tables-row"><Projects projects={model.projects} printing={printing} onNavigate={onNavigate} /><Decisions decisions={model.decisions} printing={printing} onExplain={onExplain} /></div>
    <section className="eov-controls" aria-label="Enterprise controls"><h2>Enterprise controls</h2>{model.controls.map((control, index) => {
      const Icon = CONTROL_ICONS[index] || Cog6ToothIcon;
      return <button type="button" key={control.id} onClick={() => onExplain(control.metric)}><Icon aria-hidden="true" /><span>{control.label}: <strong>{control.value}</strong></span></button>;
    })}<button type="button" className="eov-text-button" onClick={() => onNavigate('risk')}>View governance status<ArrowRightIcon /></button></section>
    <footer className="eov-footer"><details className="eov-notes" open={printing || undefined}><summary>All figures are provisional until executive reporting closes. Original currencies · Current authorised workspace.<InformationCircleIcon /></summary><div><p>Invoiced revenue is recorded invoice value, not recognised accounting revenue. Collections reflect current recorded receipts against each invoice cohort. Missing measures are shown as a dash; known incomplete subtotals carry an asterisk.</p><p>{model.forecast.description}</p><p>Operating margin requires Finance-approved recognised revenue and matching operating costs. Budget requires an approved Finance plan.</p>{report.limitations?.map((item, index) => <p key={index}>{item}</p>)}<p>{model.portfolio.description}</p><p>{model.workforce.description}</p></div></details><span className="eov-brand">∠ REJLERS <span>Engineering for a sustainable tomorrow</span></span></footer>
    <DecisionBanner decisions={model.decisions} printing={printing} />
  </div>;
}
