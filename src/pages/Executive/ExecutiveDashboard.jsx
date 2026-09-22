import React, { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { ArrowDownTrayIcon, ArrowPathIcon, ChevronDownIcon, EllipsisHorizontalIcon, EllipsisVerticalIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import apiClient from '../../services/api.service';
import { formatDate, requestError, validateExecutiveReport } from './executivePresentation';
import { DefinitionsDialog, RouteLink } from './ExecutivePrimitives';
import ExecutiveReferenceOverview, { reviewOverviewDecisions } from './ExecutiveReferenceOverview';
import FinancialPerformance from './FinancialPerformance';
import ProjectPortfolio, { reviewPortfolioInterventions } from './ProjectPortfolio';
import { portfolioReport } from './portfolioPresentation';
import CommercialPipeline from './CommercialPipeline';
import { commercialCurrencies, commercialReport } from './commercialPresentation';
import WorkforcePerformance from './WorkforcePerformance';
import { workforceReport } from './workforcePresentation';
import RiskCompliance from './RiskCompliance';
import { riskComplianceReport } from './riskPresentation';
import './ExecutiveDashboard.css';
import './ExecutiveOverview.css';
import './ExecutiveKpiCard.css';
import './ExecutiveTabColors.css';
import './ExecutiveReferenceOverview.css';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'financial', label: 'Financial performance' },
  { id: 'portfolio', label: 'Project portfolio' },
  { id: 'commercial', label: 'Commercial pipeline' },
  { id: 'workforce', label: 'Workforce' },
  { id: 'risk', label: 'Risk & compliance' },
];

export default function ExecutiveDashboard() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [revision, setRevision] = useState(0);
  const [selection, setSelection] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = TABS.some(tab => tab.id === searchParams.get('tab')) ? searchParams.get('tab') : 'overview';
  const setActiveTab = id => setSearchParams(previous => {
    const next = new URLSearchParams(previous);
    if (id === 'overview') next.delete('tab');
    else next.set('tab', id);
    return next;
  });
  const [financialSnapshot, setFinancialSnapshot] = useState(null);
  const [financialCurrency, setFinancialCurrency] = useState('AED');
  const [overviewCurrency, setOverviewCurrency] = useState('AED');
  const [overviewCurrencies, setOverviewCurrencies] = useState(['AED']);
  const [pipelineCurrencyChoice, setPipelineCurrencyChoice] = useState('AED');
  const [portfolioCurrency, setPortfolioCurrency] = useState('AED');
  const [printing, setPrinting] = useState(false);
  const tabList = useRef(null);
  const financialMenu = useRef(null);
  const overviewMenu = useRef(null);
  const portfolioMenu = useRef(null);

  useEffect(() => { if (activeTab !== 'financial') setFinancialSnapshot(null); }, [activeTab]);

  useEffect(() => {
    if (!['commercial', 'workforce', 'risk'].includes(activeTab)) return undefined;
    const revealSelectedTab = () => {
      const list = tabList.current;
      const selected = list?.querySelector('#executive-tab-' + activeTab);
      if (!list || !selected || list.scrollWidth <= list.clientWidth) return;
      const delta = selected.getBoundingClientRect().left - list.getBoundingClientRect().left;
      list.scrollLeft += delta - (list.clientWidth - selected.offsetWidth) / 2;
    };
    revealSelectedTab();
    window.addEventListener('resize', revealSelectedTab);
    return () => window.removeEventListener('resize', revealSelectedTab);
  }, [activeTab]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);
    apiClient.get('/dashboard/executive/', { signal: controller.signal }).then(({ data }) => {
      if (active) setReport(validateExecutiveReport(data));
    }).catch(problem => {
      if (active) { setReport(null); setSelection(null); setError(requestError(problem)); }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [revision]);

  useEffect(() => {
    document.documentElement.classList.add('executive-page-open');
    const beforePrint = () => flushSync(() => setPrinting(true));
    const afterPrint = () => setPrinting(false);
    window.addEventListener('beforeprint', beforePrint);
    window.addEventListener('afterprint', afterPrint);
    return () => {
      document.documentElement.classList.remove('executive-page-open');
      window.removeEventListener('beforeprint', beforePrint);
      window.removeEventListener('afterprint', afterPrint);
    };
  }, []);

  const portfolio = useMemo(() => portfolioReport(report), [report]);
  const portfolioCurrencies = [...new Set(['AED', portfolioCurrency, ...(portfolio.kpis || []).flatMap(metric => (metric.by_currency || []).map(row => row.currency)), ...(portfolio.register?.projects || []).map(row => row.currency)].filter(Boolean))].sort();
  const commercial = useMemo(() => commercialReport(report), [report]);
  const workforce = useMemo(() => workforceReport(report), [report]);
  const risk = useMemo(() => riskComplianceReport(report), [report]);
  const pipelineCurrencies = useMemo(() => commercialCurrencies(commercial), [commercial]);
  const pipelineCurrency = pipelineCurrencies.includes(pipelineCurrencyChoice) ? pipelineCurrencyChoice : pipelineCurrencies.includes('AED') ? 'AED' : pipelineCurrencies[0] || '';
  const metrics = useMemo(() => activeTab === 'financial' ? []
    : activeTab === 'portfolio' ? [...(portfolio.kpis || []), ...(portfolio.health?.metrics || []), ...(portfolio.milestones?.metrics || [])]
      : activeTab === 'commercial' ? [...(commercial.kpis || []), ...(commercial.commercial_quality?.metrics || [])]
        : activeTab === 'workforce' ? [...(workforce.kpis || []), ...(workforce.retention_mobility?.metrics || []), ...(workforce.workforce_movement?.metrics || []), ...(workforce.data_quality?.metrics || [])]
          : activeTab === 'risk' ? [...new Map([...(risk.kpis || []), ...(risk.qhse_performance?.metrics || []), ...(risk.qhse_performance?.project_metrics || []), ...(risk.audit_controls?.metrics || [])].map(metric => [metric.id, metric])).values()]
            : [...(report?.kpis || []), ...(report?.departments || []).flatMap(section => section.metrics || [])], [report, portfolio, commercial, workforce, risk, activeTab]);
  const department = id => report?.departments.find(section => section.id === id);
  const explainScope = type => {
    const disclosures = {
      scope: { label: 'Reporting scope', description: 'This report covers source records authorised for your account in the current RADAI workspace. Legal-entity and Rejlers Group consolidation are not connected.', status: 'available' },
      period: { label: 'Reporting period', description: ['overview', 'financial'].includes(activeTab) ? 'Invoiced revenue and invoice-date charts use their selected calendar month or January-to-date period. Current-month invoicing stops at the source cutoff. Receipts are current recorded collections against those invoices, not historical cash flows. Workbook totals cover all source periods; receivables show current open balances. No fiscal-year or currency conversion is assumed.' : 'This is a current operational snapshot. Historical reporting periods are not connected. Each source may have a different last record update.', status: 'available' },
      comparison: { label: 'Performance comparison', description: 'Approved budget, targets and comparable historical periods are not connected. A variance is shown only when its reporting basis is verified.', status: 'unavailable' },
      portfolio: { label: 'Portfolio scope', description: 'Accessible open projects in planning, active or on-hold status. Closed and cancelled projects are excluded. Business-unit and legal-entity portfolio consolidation are not connected. Register filters apply to the returned rows; counts and health retain this overall scope. The currency selector changes monetary cards and delivery bubbles only. Project rows retain their recorded original currencies; no FX conversion is applied.', status: portfolio.status },
      risk: { label: 'Risk and assurance reporting basis', description: 'Authorised QHSE project quality counters and audit schedule records. Follow-ups are source flags, not enterprise risks. Approved residual ratings, appetite, treatment evidence, verified incidents and legal compliance obligations are not connected. Each source retains its own access and reporting coverage.', status: risk.status },
      workforce: { label: 'Workforce reporting basis', description: 'Aggregate current employees from the authorised employee master. Department headcounts are people, not FTE. Recorded joining and exit dates describe past movement; approved skills, vacancies, project capacity, billable hours and forward demand are not connected. No individual personnel or salary records are included.', status: workforce.status },
      commercial: { label: 'Commercial reporting basis', description: 'Recorded open CRM opportunities, kept in original currencies. The currency selector filters monetary outcomes, opportunities, bid targets and client concentration. Win rate, proposal target counts, decisions and CRM quality cover all authorised currencies. Probability is stored in CRM; approved forecast scenarios and revenue requirements are not connected.', status: commercial.status },
    };
    setSelection({ id: type, source: 'Executive reporting scope', ...disclosures[type] });
  };
  const printBoard = () => {
    flushSync(() => setPrinting(true));
    window.print();
    setPrinting(false);
  };
  const exportSnapshot = () => {
    const snapshot = activeTab === 'financial' ? {
      schema_version: '1.0', report_type: 'executive_financial_performance',
      generated_at: financialSnapshot.receivables.generated_at,
      receivables: financialSnapshot.receivables,
      revenue: financialSnapshot.revenue,
      reporting_period: financialSnapshot.reporting_period,
      source_description: financialSnapshot.source_description,
    } : report;
    const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = activeTab === 'financial' ? `radai-executive-financial-${snapshot.generated_at.slice(0, 10)}.json` : `radai-executive-${report.generated_at.slice(0, 10)}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const navigateTabs = event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const current = TABS.findIndex(tab => tab.id === activeTab);
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length - 1
      : (current + (event.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
    setActiveTab(TABS[index].id);
    tabList.current.querySelectorAll('[role="tab"]')[index].focus();
  };
  const visibleTab = activeTab;
  const isOverview = visibleTab === 'overview';
  const isFinancial = visibleTab === 'financial';
  const financialBusy = isFinancial && (!financialSnapshot || financialSnapshot.loading);
  const financialUnavailable = isFinancial && !financialSnapshot?.receivables;
  const financialCurrencies = [...new Set([financialCurrency, ...(financialSnapshot?.receivables?.filters?.currencies || []), ...(financialSnapshot?.receivables?.workbook_summary?.currency_breakdown || []).map(row => row.currency).filter(Boolean)])].sort();
  const closeFinancialMenu = () => { if (financialMenu.current) financialMenu.current.open = false; };
  const isPortfolio = visibleTab === 'portfolio';
  const isCommercial = visibleTab === 'commercial';
  const isWorkforce = visibleTab === 'workforce';
  const isRisk = visibleTab === 'risk';
  const sourceLabels = { finance: 'Finance', project_control: 'Projects', hr: 'HR', sales: 'CRM', qhse: 'QHSE' };

  return <div className={`executive-dashboard cc-command-center cc-radai-page ${isFinancial ? 'cc-financial-page' : isPortfolio ? 'cc-portfolio-page' : isCommercial ? 'cc-commercial-page' : isWorkforce ? 'cc-workforce-page' : isRisk ? 'cc-risk-page' : 'cc-overview-page'}`}>
    <header className="cc-page-header">
      <div className="cc-title-row"><div className="cc-title-block"><div className="cc-breadcrumb"><span>Executive</span> / {TABS.find(tab => tab.id === activeTab)?.label}</div><h1>{isFinancial ? 'Financial Performance' : isPortfolio ? 'Project Portfolio' : isCommercial ? 'Commercial Pipeline' : isWorkforce ? 'Workforce' : isRisk ? 'Risk & Compliance' : 'Executive Command Center'}</h1><p>{isFinancial ? 'Invoicing, collections, receivables and Finance outlook' : isPortfolio ? 'Portfolio value, delivery confidence and executive interventions' : isCommercial ? 'Pipeline value, win confidence, client exposure and delivery demand.' : isWorkforce ? 'Capacity, utilization, critical skills and workforce risk.' : isRisk ? 'Enterprise risk, QHSE performance, obligations and assurance.' : 'Company performance, portfolio risk and decisions requiring attention.'}</p></div>
        <div className="cc-header-right"><div className="cc-toolbar cc-screen-only">
          {isOverview ? <>
            <button className="cc-button cc-scope-button" onClick={() => explainScope('scope')} aria-label="Reporting scope" aria-haspopup="dialog">RADAI workspace<ChevronDownIcon /></button>
            <button className="cc-button cc-scope-button" onClick={() => explainScope('period')} aria-label="Reporting period" aria-haspopup="dialog">Current snapshot<ChevronDownIcon /></button>
            <select className="cc-button" aria-label="Overview reporting currency" value={overviewCurrency} onChange={event => setOverviewCurrency(event.target.value)}>{[...new Set([overviewCurrency, ...overviewCurrencies])].sort().map(currency => <option key={currency} value={currency}>{currency === 'UNSPECIFIED' ? 'Unspecified' : currency}</option>)}</select>
            <button className="cc-button cc-scope-button" onClick={() => explainScope('period')} aria-label="Overview date scope" aria-haspopup="dialog">All periods<ChevronDownIcon /></button>
            <button className="cc-button cc-button--primary" onClick={reviewOverviewDecisions} disabled={!report}>Review decisions</button>
            <button className="cc-button" onClick={printBoard} disabled={loading || !report}><ArrowDownTrayIcon />Export</button>
            <details ref={overviewMenu} className="eov-header-menu" onKeyDown={event => { if (event.key === 'Escape') { overviewMenu.current.open = false; overviewMenu.current.querySelector('summary')?.focus(); } }}><summary aria-label="More overview options"><EllipsisHorizontalIcon /></summary><div><button onClick={() => { overviewMenu.current.open = false; setRevision(value => value + 1); }} disabled={loading}><ArrowPathIcon />Refresh overview</button><button onClick={() => { overviewMenu.current.open = false; exportSnapshot(); }} disabled={loading || !report}><ArrowDownTrayIcon />Export snapshot</button><button onClick={() => { overviewMenu.current.open = false; setSelection({ all: true }); }} disabled={!report}><InformationCircleIcon />Metric definitions</button></div></details>
          </> : isFinancial ? <>
            <button className="cc-button cc-scope-button" onClick={() => explainScope('scope')} aria-label="Reporting scope" aria-haspopup="dialog">RADAI workspace<ChevronDownIcon /></button>
            <button className="cc-button cc-scope-button" onClick={() => explainScope('period')} aria-label="Reporting period" aria-haspopup="dialog">Current<ChevronDownIcon /></button>
            <select className="cc-button ef-currency-select" aria-label="Financial reporting currency" title="Original currency for invoicing, workbook amount cards and current receivables. No conversion is applied." value={financialCurrency} disabled={financialBusy} onChange={event => setFinancialCurrency(event.target.value)}>{financialCurrencies.map(value => <option key={value} value={value}>{value === 'UNSPECIFIED' ? 'Unspecified' : value}</option>)}</select>
            <button className="cc-button cc-scope-button" onClick={() => explainScope('period')} aria-label="Financial date scope" aria-haspopup="dialog">Invoice periods<ChevronDownIcon /></button>
            <button className="cc-button cc-button--primary" onClick={() => { const target = document.getElementById('ef-management-actions'); target?.scrollIntoView({ behavior: 'smooth', block: 'center' }); target?.focus({ preventScroll: true }); }}>Review financial actions</button>
            <button className="cc-button ef-export" onClick={printBoard} disabled={loading || !report || financialBusy || financialUnavailable}><ArrowDownTrayIcon />Export</button>
            <details ref={financialMenu} className="ef-header-menu" onKeyDown={event => { if (event.key === 'Escape') { closeFinancialMenu(); financialMenu.current?.querySelector('summary')?.focus(); } }}><summary aria-label="More financial options"><EllipsisVerticalIcon /></summary><div><button onClick={() => { closeFinancialMenu(); setRevision(value => value + 1); }} disabled={loading || financialBusy}><ArrowPathIcon />Refresh financial performance</button><button onClick={() => { closeFinancialMenu(); exportSnapshot(); }} disabled={loading || !report || financialBusy || financialUnavailable}><ArrowDownTrayIcon />Export snapshot</button></div></details>
          </> : <>
          <button className="cc-button cc-scope-button" onClick={() => explainScope('scope')} aria-label="Reporting scope" aria-haspopup="dialog">RADAI workspace<ChevronDownIcon /></button>
          <button className="cc-button cc-scope-button" onClick={() => explainScope('period')} aria-label="Reporting period" aria-haspopup="dialog">Current snapshot<ChevronDownIcon /></button>
          {isCommercial && <select className="cp-currency-select" aria-label="Commercial reporting currency" title="Original CRM currency; no conversion is applied." value={pipelineCurrency} disabled={!pipelineCurrencies.length || loading} onChange={event => setPipelineCurrencyChoice(event.target.value)}>{pipelineCurrencies.length ? pipelineCurrencies.map(value => <option key={value}>{value}</option>) : <option value="">No currency data</option>}</select>}
          {isFinancial ? null : isPortfolio ? <button className="cc-button cc-scope-button" onClick={() => explainScope('portfolio')} aria-label="Portfolio scope" aria-haspopup="dialog">Open projects<ChevronDownIcon /></button> : isCommercial ? <button className="cc-button cc-scope-button" onClick={() => explainScope('commercial')} aria-label="Commercial reporting basis" aria-haspopup="dialog">CRM estimates<ChevronDownIcon /></button> : isWorkforce ? <button className="cc-button cc-scope-button" onClick={() => explainScope('workforce')} aria-label="Workforce reporting basis" aria-haspopup="dialog">Current workforce<ChevronDownIcon /></button> : isRisk ? <button className="cc-button cc-scope-button" onClick={() => explainScope('risk')} aria-label="Risk reporting basis" aria-haspopup="dialog">Connected assurance<ChevronDownIcon /></button> : <button className="cc-button cc-scope-button" onClick={() => explainScope('comparison')} aria-label="Comparison basis" aria-haspopup="dialog">Targets unavailable<ChevronDownIcon /></button>}
          {isPortfolio ? <><select className="cc-button pp-currency-select" aria-label="Portfolio reporting currency" title="Original currency for monetary cards and delivery outlook; project rows and health retain overall open-project scope." value={portfolioCurrency} onChange={event => setPortfolioCurrency(event.target.value)}>{portfolioCurrencies.map(value => <option key={value}>{value}</option>)}</select><button type="button" className="cc-button cc-button--primary" onClick={reviewPortfolioInterventions} disabled={!report}>Review interventions</button><button type="button" className="cc-button" onClick={printBoard} aria-label="Export board report" disabled={loading || !report}><ArrowDownTrayIcon />Export</button><details className="pp-header-menu" ref={portfolioMenu} onKeyDown={event => { if (event.key === 'Escape') { portfolioMenu.current.open = false; portfolioMenu.current.querySelector('summary')?.focus(); } }}><summary aria-label="More portfolio options"><EllipsisHorizontalIcon /></summary><div><button type="button" disabled={loading} onClick={() => { portfolioMenu.current.open = false; setRevision(value => value + 1); }}><ArrowPathIcon />Refresh portfolio</button><button type="button" disabled={loading || !report} onClick={() => { portfolioMenu.current.open = false; exportSnapshot(); }}><ArrowDownTrayIcon />Export snapshot</button></div></details></> : <><button className="cc-button cc-refresh" disabled={loading || financialBusy} onClick={() => setRevision(value => value + 1)} aria-label={isFinancial ? "Refresh financial performance" : "Refresh overview"}><ArrowPathIcon className={loading || financialBusy ? 'cc-spinning' : ''} />Refresh</button><button className="cc-button cc-button--primary" onClick={printBoard} disabled={loading || !report || financialBusy || financialUnavailable}><ArrowDownTrayIcon />Export board report</button></>}
          </>}
        </div><div className="cc-retrieved" role="status"><i className={loading || !report || financialBusy || financialUnavailable || (isWorkforce && !['available', 'partial'].includes(workforce.status)) || (isRisk && !['available', 'partial'].includes(risk.status)) ? 'cc-dot-muted' : ''} />{loading ? 'Updating overview…' : report ? isFinancial ? financialBusy ? 'Updating invoice balances...' : `Provisional · Latest Finance record: ${financialSnapshot?.receivables?.source_updated_at ? formatDate(financialSnapshot.receivables.source_updated_at, true) : 'not recorded'}` : isPortfolio ? `Provisional · Latest project record: ${portfolio.source_updated_at ? formatDate(portfolio.source_updated_at, true) : 'not recorded'}` : isCommercial ? `Latest CRM record: ${commercial.source_updated_at ? formatDate(commercial.source_updated_at, true) : 'not recorded'}` : isWorkforce ? `Latest HR record: ${workforce.source_updated_at ? formatDate(workforce.source_updated_at, true) : 'not recorded'}` : isRisk ? `Latest QHSE record: ${risk.source_updated_at ? formatDate(risk.source_updated_at, true) : 'not recorded'}` : `Provisional \u00b7 Updated ${formatDate(report.generated_at, true)}` : 'Report not loaded'}</div></div>
      </div>
      <div ref={tabList} className="cc-tabs cc-screen-only" role="tablist" aria-label="Executive dashboard sections" onKeyDown={navigateTabs}>{TABS.map(tab => <button key={tab.id} id={`executive-tab-${tab.id}`} role="tab" aria-selected={activeTab === tab.id} aria-controls={`executive-tabpanel-${tab.id}`} tabIndex={activeTab === tab.id ? 0 : -1} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}</div>
    </header>

    <div className="cc-content" aria-busy={loading}>
      {error && <section className="cc-error" role="alert"><InformationCircleIcon /><div><h2>{error.title}</h2><p>{error.detail}</p><button className="cc-button" onClick={() => setRevision(value => value + 1)}>Try again</button><RouteLink route="/dashboard">Return to dashboard</RouteLink></div></section>}
      {loading && !report && <div className="cc-loading" role="status"><h2>Preparing your executive overview</h2><p>Loading authorised source reports and management priorities.</p><div className="cc-loading-grid" aria-hidden="true">{Array.from({ length: 4 }, (_, index) => <div key={index} />)}</div></div>}
      {report && <div role="tabpanel" id={`executive-tabpanel-${visibleTab}`} aria-labelledby={`executive-tab-${visibleTab}`} tabIndex={0} className="cc-tabpanel">
        {isOverview && <ExecutiveReferenceOverview report={report} currency={overviewCurrency} refreshKey={revision} printing={printing} onExplain={setSelection} onNavigate={setActiveTab} onCurrencies={setOverviewCurrencies} />}
        {visibleTab === 'financial' && <FinancialPerformance report={report} currency={financialCurrency} refreshKey={revision} printing={printing} onSnapshotChange={setFinancialSnapshot} onExplain={setSelection} />}
        {visibleTab === 'portfolio' && <ProjectPortfolio report={report} portfolio={portfolio} currency={portfolioCurrency} onExplain={setSelection} onNavigate={setActiveTab} printing={printing} />}
        {visibleTab === 'commercial' && <CommercialPipeline report={report} commercial={commercial} currency={pipelineCurrency} onExplain={setSelection} printing={printing} />}
        {visibleTab === 'workforce' && <WorkforcePerformance workforce={workforce} onExplain={setSelection} printing={printing} />}
        {visibleTab === 'risk' && <RiskCompliance risk={risk} onExplain={setSelection} printing={printing} />}
      </div>}
      {report && !isFinancial && !isOverview && <details className="cc-report-notes" open={printing || undefined}><summary><InformationCircleIcon />Reporting scope & data coverage</summary><div><p>Current authorised RADAI workspace. Group consolidation is not available. Monetary values remain in their original currencies. A missing measure is shown as a dash; a reported zero remains zero.</p><ul>{report.limitations?.map((item, index) => <li key={index}>{item}</li>)}</ul><p>Source timestamps describe the latest record update, not source completeness or refresh success. Budget, revenue forecasts and historical comparisons require verified reporting sources.</p></div></details>}
    </div>

    {!isOverview && <footer className="cc-data-footer">{isFinancial ? <div className="cc-source-strip"><span>Invoice register snapshot · Original currencies · Customer names from COMPANY</span></div> : <div className="cc-source-strip"><button className="cc-coverage-button" onClick={() => setSelection({ all: true })} disabled={!report}><InformationCircleIcon />Data coverage {report ? `${report.coverage?.available_departments ?? 0}/${report.coverage?.total_departments ?? 7} sources` : 'not loaded'}</button><span className="cc-source-caption">Latest record:</span>{Object.entries(sourceLabels).map(([id, label]) => <span key={id} title={department(id)?.source_timestamp_label || 'Source record timestamp unavailable'}>{label} <b>{department(id)?.source_updated_at ? formatDate(department(id).source_updated_at, true) : '—'}</b></span>)}</div>}<div className="cc-footer-actions cc-screen-only">{!isFinancial && <button className="cc-text-button" onClick={() => setSelection({ all: true })} disabled={!report}>Metric definitions</button>}<button className="cc-text-button" onClick={exportSnapshot} disabled={!report || loading || financialBusy || financialUnavailable}>Export snapshot</button></div></footer>}
    <DefinitionsDialog selection={selection} onClose={() => setSelection(null)} metrics={metrics} />
  </div>;
}
