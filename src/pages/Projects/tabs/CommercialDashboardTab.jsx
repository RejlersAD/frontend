/* eslint-disable react/prop-types */
import React, { useEffect, useId, useRef, useState } from 'react'
import {
  AlertTriangle, ArrowRight, BadgeCheck, Banknote, CalendarDays, CheckCircle2, ClipboardList,
  CreditCard, FileText, Info, Landmark, ListFilter, Receipt, ShoppingCart, Wallet, X,
} from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import CostDashboardTab from './CostDashboardTab'

const DAY = 86400000
const isNumber = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
const amount = value => isNumber(value) ? Number(value).toLocaleString('en-GB', { maximumFractionDigits: 0 }) : 'Unavailable'
const money = (value, currency) => isNumber(value) ? `${currency || '—'} ${amount(value)}` : 'Unavailable'
const time = value => value ? Date.parse(String(value).slice(0, 10) + 'T00:00:00Z') : NaN
const dateLabel = value => Number.isFinite(time(value)) ? new Date(time(value)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—'
const timestampLabel = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
const shortDate = value => new Date(Number(value)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const titleCase = value => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())
const toneClass = tone => ['danger', 'warning', 'success', 'blue', 'neutral'].includes(tone) ? tone : 'neutral'
const sourceGroup = value => /purchase|procurement|receipt/.test(value || '') ? 'procurement' : /invoice|payment|finance/.test(value || '') ? 'finance' : 'project_control'
const sourceLabel = value => titleCase(sourceGroup(value))

export function downloadCommercialCsv(model, project) {
  if (!model?.availability?.commercial) return
  const cell = value => {
    let text = String(value ?? '')
    if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`
    return `"${text.replaceAll('"', '""')}"`
  }
  const code = project?.code || project?.name || 'Project'
  const rows = [['Section', 'Project', 'Currency', 'Date', 'Reference', 'Description', 'Budget', 'Committed', 'Actual', 'Amount', 'Status'],
    ...[['Contract value', model.contractValue, model.contractCurrency], ['Control budget', model.controlBudget], ['PO commitments', model.committed], ['Verified actual', model.actual], ['Supplier paid', model.paid], ['Approved & unpaid', model.unpaid]].map(([label, value, currency]) => ['Current summary', code, currency || model.summaryCurrency, '', '', label, '', '', '', value, 'Current reported total']),
    ...(model.wbs || []).map(row => ['WBS position', code, row.currency || model.summaryCurrency, '', row.code, row.name, row.budget, row.committed, row.actual, '', 'Current posted position']),
    ...(model.ledger || []).map(row => ['Cost posting', code, row.currency, row.date, row.reference, titleCase(row.type), '', '', '', row.amount, row.status])]
  const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url; link.download = `${String(code).replace(/[^a-z0-9_-]/gi, '-')}-commercial.csv`
  document.body.appendChild(link); link.click(); link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function Panel({ title, icon: Icon, actions, className = '', children }) {
  const id = useId()
  return <section className={`cp-panel ${className}`} aria-labelledby={id}><header><h2 id={id}><Icon size={16} aria-hidden="true" />{title}</h2>{actions && <div className="cp-panel-actions">{actions}</div>}</header>{children}</section>
}
const TextAction = ({ children, onClick }) => <button type="button" className="cp-text-button" onClick={onClick}>{children}<ArrowRight size={14} aria-hidden="true" /></button>
const Empty = ({ children }) => <div className="cp-empty"><Info size={23} aria-hidden="true" /><p>{children}</p></div>
const Scroll = ({ label, children }) => <div className="cp-table-wrap" role="region" aria-label={label} tabIndex={0}>{children}</div>
const Status = ({ tone, children }) => <span className={`cp-status cp-${toneClass(tone)}`}>{tone === 'success' ? <CheckCircle2 size={13} aria-hidden="true" /> : ['danger', 'warning'].includes(tone) ? <AlertTriangle size={13} aria-hidden="true" /> : <Info size={13} aria-hidden="true" />}{children}</span>
const Facts = ({ rows }) => <dl className="cp-detail-grid">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? '—'}</dd></div>)}</dl>

function Dialog({ title, children, onClose, onControls }) {
  const ref = useRef(null), id = useId()
  useEffect(() => {
    const node = ref.current, opener = document.activeElement
    node.showModal()
    return () => { node.close(); if (opener?.isConnected) opener.focus({ preventScroll: true }) }
  }, [])
  return <dialog ref={ref} className="cp-dialog" aria-labelledby={id} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose() }}><div className="cp-dialog-header"><h2 id={id}>{title}</h2><button type="button" className="pp-button pp-icon-button" aria-label="Close dialog" onClick={onClose}><X size={18} /></button></div><div className="cp-dialog-body">{children}</div><div className="cp-dialog-footer"><button type="button" className="pp-button" onClick={onClose}>Close</button><button type="button" className="pp-button pp-primary" onClick={onControls}>Open commercial controls</button></div></dialog>
}

function ExceptionsTable({ rows, onAction }) {
  return <Scroll label="Commercial exception records"><table className="cp-table cp-exceptions-table"><thead><tr><th>Priority</th><th>Exception</th><th>Owner</th><th>Action</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td><Status tone={row.priority === 'critical' ? 'danger' : row.priority === 'high' ? 'warning' : 'blue'}>{titleCase(row.priority)}</Status></td><td><strong>{row.title}</strong><small title={row.detail}>{row.detail}</small></td><td>{row.owner || 'Unassigned'}</td><td><button type="button" className="pp-button" onClick={() => onAction(row)}>{row.button || 'Review'}</button></td></tr>)}</tbody></table></Scroll>
}

function CostComparison({ rows, model, mode }) {
  const selected = rows.at(-1)
  const chartData = rows.map(row => ({ ...row, x: time(row.date) }))
  return <div className="cp-chart-body"><div className="cp-chart-main">
    {rows.length ? mode === 'table' ? <Scroll label="Sealed cost performance records"><table className="cp-table"><thead><tr><th>Data date</th><th>Budget at completion</th><th>Planned value</th><th>Earned value</th><th>Actual cost</th></tr></thead><tbody>{rows.map(row => <tr key={row.id || row.date}><td>{dateLabel(row.date)}</td><td>{money(row.bac, row.currency)}</td><td>{money(row.pv, row.currency)}</td><td>{money(row.ev, row.currency)}</td><td>{money(row.legacyCostBasis ? row.recordedActual : row.ac, row.currency)}{row.legacyCostBasis && <small>Legacy period amount</small>}</td></tr>)}</tbody></table></Scroll> : <>
      <div className="cp-chart-legend"><span className="cp-legend-planned">Planned value</span><span className="cp-legend-earned">Earned value</span><span className="cp-legend-actual">Actual cost</span><span className="cp-legend-budget">Budget</span></div>
      <div className="cp-chart-plot" role="img" aria-label={`Cost performance: ${rows.length} sealed reporting records in ${model.currency}.`}><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} margin={{ top: 8, right: 18, bottom: 4, left: -7 }} accessibilityLayer>
        <CartesianGrid stroke="#e4ebf5" /><XAxis dataKey="x" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={shortDate} minTickGap={28} tick={{ fontSize: 10, fill: '#456086' }} axisLine={{ stroke: '#c9d6e8' }} tickLine={false} />
        <YAxis tickFormatter={value => Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(value)} tick={{ fontSize: 10, fill: '#456086' }} axisLine={false} tickLine={false} />
        <Tooltip labelFormatter={value => dateLabel(new Date(Number(value)).toISOString())} formatter={(value, name) => [money(value, model.currency), name]} contentStyle={{ fontSize: 12, borderColor: '#dbe5f1', borderRadius: 5 }} />
        <Line dataKey="pv" name="Planned value" stroke="#075bff" strokeWidth={2} dot={{ r: 2 }} connectNulls={false} isAnimationActive={false} />
        <Line dataKey="ev" name="Earned value" stroke="#00856b" strokeWidth={2} dot={{ r: 2 }} connectNulls={false} isAnimationActive={false} />
        <Line dataKey="ac" name="Actual cost" stroke="#d30038" strokeWidth={2} dot={{ r: 2 }} connectNulls={false} isAnimationActive={false} />
        <Line dataKey="bac" name="Budget at completion" stroke="#7d8da8" strokeDasharray="5 4" strokeWidth={1.5} dot={false} connectNulls={false} isAnimationActive={false} />
      </LineChart></ResponsiveContainer></div>
    </> : <Empty>{model.availability?.snapshots === false ? 'Cost reporting history is unavailable.' : 'No sealed cost reporting records match this period.'}</Empty>}
    <p className="cp-note" title={model.chartNote || 'Monetary values from sealed reporting snapshots. These historical records may differ from current posted totals.'}>{rows.some(row => row.legacyCostBasis) ? 'Legacy period cost basis: cumulative actual cost, CPI and EAC are unavailable for flagged records.' : `${model.currency} · Sealed reporting records. Historical values may differ from current totals.`}</p>
  </div><dl className="cp-chart-summary"><div><dt>Snapshot date</dt><dd className="cp-summary-date">{dateLabel(selected?.date)}</dd></div><div><dt>CPI</dt><dd className={selected?.cpi < 1 ? 'cp-danger' : ''}>{isNumber(selected?.cpi) ? Number(selected.cpi).toFixed(2) : '—'}</dd></div><div><dt>Cost variance</dt><dd className={`cp-summary-money ${selected?.costVariance < 0 ? 'cp-danger' : ''}`}>{selected ? money(selected.costVariance, model.currency) : '—'}</dd></div><div><dt>Estimate at completion</dt><dd className="cp-summary-money">{selected ? money(selected.eac, model.currency) : '—'}</dd></div></dl></div>
}

function WbsTable({ rows, currency, onOpen }) {
  return <Scroll label="WBS commercial records"><table className="cp-table cp-wbs-table"><thead><tr><th>WBS / cost area</th><th>Budget</th><th>Committed</th><th>Actual</th><th>Remaining budget</th><th>Status</th></tr></thead><tbody>{rows.map(row => <tr key={row.id || row.code}><td><button type="button" className="cp-row-link" onClick={() => onOpen(row)}>{row.code} · {row.name}</button></td><td>{money(row.budget, row.currency || currency)}</td><td>{money(row.committed, row.currency || currency)}</td><td>{money(row.actual, row.currency || currency)}</td><td className={row.remaining < 0 ? 'cp-danger' : ''}>{money(row.remaining, row.currency || currency)}</td><td><Status tone={row.tone || (row.remaining < 0 ? 'danger' : 'success')}>{!isNumber(row.budget) || !isNumber(row.actual) ? 'Unavailable' : row.remaining < 0 ? 'Over budget' : row.availableToCommit < 0 ? 'Commitments high' : row.budget > 0 ? 'Within budget' : 'No budget'}</Status></td></tr>)}</tbody></table></Scroll>
}

function LedgerTable({ rows, onOpen }) {
  return <Scroll label="Posted cost records"><table className="cp-table cp-ledger-table"><thead><tr><th>Date</th><th>Reference</th><th>Type</th><th>WBS</th><th>Source</th><th>Amount</th><th>Action</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td>{dateLabel(row.date)}</td><td>{row.reference || '—'}</td><td>{titleCase(row.type)}</td><td>{row.wbsCode || 'Unallocated'}</td><td>{sourceLabel(row.sourceType)}</td><td>{money(row.amount, row.currency)}</td><td><button type="button" className="pp-button" onClick={() => onOpen(row)}>Open</button></td></tr>)}</tbody></table></Scroll>
}

function AuditTable({ rows, onOpen }) {
  return <Scroll label="Commercial audit records"><table className="cp-table cp-audit-table"><thead><tr><th>Event / reference</th><th>Source</th><th>Recorded</th><th>Status</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td><button type="button" className="cp-row-link" onClick={() => onOpen(row)} title={timestampLabel(row.date)}>{row.eventTypeLabel || titleCase(row.eventType) || 'Commercial event'}</button><small>{row.reference || '—'}</small></td><td>{sourceLabel(row.sourceType)}</td><td>{dateLabel(row.date)}</td><td><Status tone={row.processingError ? 'danger' : 'success'}>{row.processingError ? 'Review' : row.ledgerRebuilt ? 'Posted' : 'Recorded'}</Status></td></tr>)}</tbody></table></Scroll>
}

export default function CommercialDashboardTab({ project, commercialPerformance, commercialMode = 'management', onCommercialMode }) {
  const { model, loading, issues = [], reload } = commercialPerformance
  const [periodId, setPeriodId] = useState('all')
  const [timeRange, setTimeRange] = useState('all')
  const [chartMode, setChartMode] = useState('chart')
  const [showFilters, setShowFilters] = useState(false)
  const [search, setSearch] = useState('')
  const [source, setSource] = useState('all')
  const [dialog, setDialog] = useState(null)
  useEffect(() => { setPeriodId('all'); setTimeRange('all'); setSearch(''); setSource('all'); setDialog(null) }, [project.id])
  const controls = () => { setDialog(null); onCommercialMode('controls') }
  const action = row => row.view === 'quality' ? setDialog({ type: 'quality' }) : row.view === 'audit' ? setDialog({ type: 'audit' }) : controls()
  const period = model?.periods?.find(row => String(row.id) === periodId)
  const now = new Date()
  const endDate = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const startDate = timeRange === 'all' ? -Infinity : endDate - (timeRange === 'three' ? 90 : 180) * DAY
  const matchesDate = row => {
    const date = time(row.date)
    if (timeRange !== 'all' && (!Number.isFinite(date) || date < startDate || date > endDate)) return false
    if (!period) return true
    if (row.periodId !== undefined && row.periodId !== null) return String(row.periodId) === String(period.id)
    return Number.isFinite(date) && date >= time(period.startDate) && date <= time(period.endDate)
  }
  const matchesSearch = row => !search || [row.reference, row.name, row.code, row.wbsCode, row.wbsName, row.eventType, row.eventTypeLabel, row.actor].some(value => String(value || '').toLowerCase().includes(search.toLowerCase()))
  const matchesSource = row => source === 'all' || sourceGroup(row.sourceType) === source
  const chartRows = (model?.chartPoints || []).filter(matchesDate)
  const ledger = (model?.ledger || []).filter(row => matchesDate(row) && matchesSearch(row) && matchesSource(row))
  const audit = (model?.auditEvents || []).filter(row => matchesDate(row) && matchesSearch(row) && matchesSource(row))
  const wbs = (model?.wbs || []).filter(matchesSearch)
  const exceptions = model?.exceptions || []
  const hasFilters = search || source !== 'all' || periodId !== 'all' || timeRange !== 'all'
  const clear = () => { setSearch(''); setSource('all'); setPeriodId('all'); setTimeRange('all') }
  const cards = model ? [
    ['Contract value', model.contractValue, FileText, 'blue', 'Recorded contract', model.contractCurrency],
    ['Control budget', model.controlBudget, Wallet, 'blue', 'Posted budget'],
    ['PO commitments', model.committed, ShoppingCart, 'blue', 'Posted commitments'],
    ['Verified actual', model.actual, Receipt, isNumber(model.actual) && isNumber(model.controlBudget) && !model.summariesUnsafe && model.actual > model.controlBudget ? 'danger' : 'blue', 'Posted actual cost'],
    ['Supplier paid', model.paid, Banknote, 'success', 'Reported supplier payments'],
    ['Approved & unpaid', model.unpaid, CreditCard, model.unpaid > 0 ? 'warning' : 'success', 'Verified actual less paid'],
  ] : []
  const dialogTitle = { exceptions: 'Commercial exceptions', quality: 'Commercial data quality', wbs: 'WBS commercial detail', ledger: 'Cost posting details', audit: 'Commercial audit trail', budgets: 'Budget allocations', postings: 'Recent cost postings', 'wbs-all': 'WBS commercial position', payment: 'Payment position' }
  return <div className="cp-workspace">
    <div className="cp-toolbar"><div className="cp-mode-switch" role="group" aria-label="Commercial workspace mode">{['management', 'controls'].map(mode => <button type="button" key={mode} aria-pressed={commercialMode === mode} onClick={() => onCommercialMode(mode)}>{titleCase(mode)}</button>)}</div>
      {commercialMode === 'management' && <><label className="cp-toolbar-field">Reporting period<select value={periodId} onChange={event => setPeriodId(event.target.value)} disabled={loading || !model?.periods?.length}><option value="all">All periods</option>{model?.periods?.map(row => <option key={row.id} value={row.id}>{row.name} · {titleCase(row.status)}</option>)}</select></label><label className="cp-toolbar-field">Time range<select value={timeRange} onChange={event => setTimeRange(event.target.value)}><option value="all">Full history</option><option value="three">Last 3 months</option><option value="six">Last 6 months</option></select></label><span className="cp-toolbar-currency">Currency <strong>{model?.currency || project.currency || '—'}</strong></span><button type="button" className="pp-button" aria-expanded={showFilters} aria-controls="commercial-record-filters" onClick={() => setShowFilters(value => !value)}><ListFilter size={14} />Filters</button><span className="cp-toolbar-date"><CalendarDays size={15} aria-hidden="true" />Data date: {dateLabel(model?.dataDate)}</span></>}
    </div>
    {commercialMode === 'controls' ? <div className="cp-controls-container"><CostDashboardTab key={project.id} project={project} /></div> : <>
      {showFilters && <div id="commercial-record-filters" className="cp-filters"><label>Search commercial records<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Reference, WBS, event or person" /></label><label>Source<select value={source} onChange={event => setSource(event.target.value)}><option value="all">All sources</option><option value="procurement">Procurement</option><option value="finance">Finance</option><option value="project_control">Project Control</option></select></label><button type="button" className="pp-button" onClick={clear}>Clear filters</button></div>}
      {hasFilters && <p className="cp-filter-note">Period and source filters apply to history and postings. Summary, payment and WBS amounts remain the current posted position; search also filters WBS rows.</p>}
      {loading ? <div className="cp-empty" role="status">Loading commercial performance…</div> : !model ? <Empty>Commercial performance is unavailable.</Empty> : <>
        {issues.length > 0 && <div className="cp-warning-note" role="alert"><AlertTriangle size={17} aria-hidden="true" /><span>Some commercial data is unavailable. {issues.map(item => typeof item === 'string' ? item : item.message).join(' ')}</span><button type="button" className="pp-button" onClick={reload}>Retry commercial data</button></div>}
        {model.summariesUnsafe && <div className="cp-warning-note"><AlertTriangle size={16} /><span>{model.summaryNote}</span><button type="button" className="cp-text-button" onClick={() => setDialog({ type: 'quality' })}>Review currencies</button></div>}
        <section className="cp-kpis" aria-label="Commercial indicators">{cards.map(([label, value, Icon, tone, detail, currency]) => <article key={label} className={`cp-kpi cp-${isNumber(value) ? tone : 'neutral'}`}><Icon size={27} aria-hidden="true" /><div className="cp-kpi-copy"><span>{label}</span><strong title={money(value, currency || model.summaryCurrency)}>{isNumber(value) && <small className="cp-amount-currency">{currency || model.summaryCurrency} </small>}{amount(value)}</strong><small>{detail}</small></div></article>)}</section>
        <div className="cp-grid">
          <Panel title="Cost performance" icon={Landmark} className="cp-chart-panel" actions={<><TextAction onClick={() => setDialog({ type: 'budgets' })}>Review budgets</TextAction><div className="cp-segmented" role="group" aria-label="Cost comparison view">{['chart', 'table'].map(mode => <button type="button" key={mode} aria-pressed={chartMode === mode} onClick={() => setChartMode(mode)}>{titleCase(mode)}</button>)}</div></>}><CostComparison rows={chartRows} model={model} mode={chartMode} /></Panel>
          <Panel title="Commercial exceptions" icon={ClipboardList} className="cp-exceptions-panel" actions={<><span className="cp-count">{exceptions.length}</span><TextAction onClick={() => setDialog({ type: 'exceptions' })}>View all</TextAction></>}>{exceptions.length ? <ExceptionsTable rows={exceptions.slice(0, 4)} onAction={action} /> : <Empty>No commercial exceptions identified from the available records.</Empty>}</Panel>
          <Panel title="WBS commercial position" icon={Wallet} className="cp-wbs-panel" actions={<TextAction onClick={() => setDialog({ type: 'wbs-all' })}>View all {model.wbs?.length || 0}</TextAction>}>{wbs.length ? <WbsTable rows={wbs.slice(0, 5)} currency={model.currency} onOpen={row => setDialog({ type: 'wbs', row })} /> : <Empty>{model.wbs === null ? 'WBS commercial data is unavailable.' : search ? 'No WBS cost areas match your search.' : 'No posted WBS commercial entries.'}</Empty>}<p className="cp-note">Remaining budget = budget − actual cost. Commitments are shown separately.</p></Panel>
          <Panel title="Payment position" icon={CreditCard} className="cp-payment-panel" actions={<TextAction onClick={() => setDialog({ type: 'payment' })}>View details</TextAction>}><dl className="cp-payment-summary">{[['Supplier paid', model.paid], ['Approved & unpaid', model.unpaid], ['Outstanding commitments', model.outstandingCommitment], ['Invoice scheduled amount', model.invoiceScheduledAmount]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{money(value, model.summaryCurrency)}</dd></div>)}</dl><div className="cp-payment-flow">{[['Approved POs', model.counts?.approvedPurchaseOrders], ['Accepted receipts', model.counts?.acceptedReceipts], ['Verified invoices', model.counts?.verifiedInvoices], ['Payment events', model.counts?.payments]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{isNumber(value) ? value : '—'}</strong></div>)}</div><p className="cp-note">Scheduled amounts are invoice-level records; payment due dates are not available here.</p></Panel>
          <Panel title="Recent cost postings" icon={Receipt} className="cp-ledger-panel" actions={<TextAction onClick={() => setDialog({ type: 'postings' })}>View all {ledger.length}</TextAction>}>{ledger.length ? <LedgerTable rows={ledger.slice(0, 4)} onOpen={row => setDialog({ type: 'ledger', row })} /> : <Empty>{model.ledger === null ? 'Posted cost records are unavailable.' : 'No posted cost records match these filters.'}</Empty>}</Panel>
          <Panel title="Commercial audit trail" icon={BadgeCheck} className="cp-audit-panel" actions={<TextAction onClick={() => setDialog({ type: 'audit' })}>View audit trail</TextAction>}>{audit.length ? <AuditTable rows={audit.slice(0, 3)} onOpen={row => setDialog({ type: 'audit', row })} /> : <Empty>{model.auditEvents === null ? 'Commercial audit data is unavailable.' : 'No commercial events match these filters.'}</Empty>}</Panel>
        </div>
        <section className="cp-quality" aria-label="Commercial data quality"><h2>Commercial data quality</h2>{model.quality?.map(row => <button type="button" key={row.id} title={row.detail} onClick={() => setDialog({ type: 'quality' })}><span className={`cp-${toneClass(row.tone)}`}>{row.ready ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}</span><span><span>{row.label}</span><strong className={`cp-${toneClass(row.tone)}`}>{row.status}</strong></span></button>)}<button type="button" className="pp-button" onClick={() => setDialog({ type: 'quality' })}>Review commercial data</button></section>
      </>}
    </>}
    {dialog && <Dialog title={dialogTitle[dialog.type]} onClose={() => setDialog(null)} onControls={controls}>
      {dialog.type === 'quality' ? <><dl className="cp-detail-grid">{model.quality?.map(row => <div key={row.id}><dt>{row.label}</dt><dd><Status tone={row.tone}>{row.status}</Status><p>{row.detail}</p></dd></div>)}</dl><p className="cp-note">{model.chartNote}</p></> : dialog.type === 'exceptions' ? exceptions.length ? <ExceptionsTable rows={exceptions} onAction={action} /> : <Empty>No commercial exceptions recorded.</Empty> : dialog.type === 'budgets' ? model.budgets?.length ? <Scroll label="Budget allocation records"><table className="cp-table"><thead><tr><th>Budget</th><th>WBS</th><th>Amount</th><th>Status</th><th>Approved by</th><th>Approved</th></tr></thead><tbody>{model.budgets.map(row => <tr key={row.id}><td>{row.code} · {row.name}</td><td>{row.wbsCode} · {row.wbsName}</td><td>{money(row.amount, row.currency)}</td><td>{titleCase(row.status)}</td><td>{row.approvedBy || '—'}</td><td>{dateLabel(row.approvedAt)}</td></tr>)}</tbody></table></Scroll> : <Empty>{model.budgets === null ? 'Budget allocations are unavailable.' : 'No budget allocations recorded.'}</Empty> : dialog.type === 'wbs-all' ? wbs.length ? <WbsTable rows={wbs} currency={model.currency} onOpen={row => setDialog({ type: 'wbs', row })} /> : <Empty>No WBS rows match the current search.</Empty> : dialog.type === 'postings' ? ledger.length ? <LedgerTable rows={ledger} onOpen={row => setDialog({ type: 'ledger', row })} /> : <Empty>No cost postings match the current filters.</Empty> : dialog.type === 'wbs' ? <><h3>{dialog.row.code} · {dialog.row.name}</h3><Facts rows={[[ 'Budget', money(dialog.row.budget, model.currency)], ['Committed', money(dialog.row.committed, model.currency)], ['Actual', money(dialog.row.actual, model.currency)], ['Remaining budget', money(dialog.row.remaining, model.currency)]]} /><p className="cp-note">Actual costs and commitments are separate measures. They are not added together as spending.</p></> : dialog.type === 'ledger' ? <Facts rows={[[ 'Reference', dialog.row.reference], ['Entry type', titleCase(dialog.row.type)], ['Amount', money(dialog.row.amount, dialog.row.currency)], ['Date', dateLabel(dialog.row.date)], ['WBS', [dialog.row.wbsCode, dialog.row.wbsName].filter(Boolean).join(' · ') || 'Unallocated'], ['Source', sourceLabel(dialog.row.sourceType)], ['Status', titleCase(dialog.row.status)], ['Reporting period', model.periods?.find(row => String(row.id) === String(dialog.row.periodId))?.name || 'Unassigned']]} /> : dialog.type === 'audit' ? dialog.row ? <Facts rows={[[ 'Event', dialog.row.eventTypeLabel || titleCase(dialog.row.eventType)], ['Reference', dialog.row.reference], ['Recorded', timestampLabel(dialog.row.date)], ['Actor', dialog.row.actor], ['Amount', money(dialog.row.amount, dialog.row.currency)], ['Source', sourceLabel(dialog.row.sourceType)], ['Ledger updated', dialog.row.ledgerRebuilt ? 'Yes' : 'No'], ['Processing issue', dialog.row.processingError || 'None recorded']]} /> : audit.length ? <><AuditTable rows={audit} onOpen={row => setDialog({ type: 'audit', row })} /><p className="cp-note">The commercial feed contains the most recent 30 audit events.</p></> : <Empty>No commercial events match the current filters.</Empty> : <><Facts rows={[[ 'Supplier paid', money(model.paid, model.summaryCurrency)], ['Approved & unpaid', money(model.unpaid, model.summaryCurrency)], ['Outstanding commitments', money(model.outstandingCommitment, model.summaryCurrency)], ['Invoice scheduled amount', money(model.invoiceScheduledAmount, model.summaryCurrency)]]} /><p className="cp-note">Supplier paid is derived from invoice allocations. Scheduled amounts are recorded at invoice level and do not provide a project payment calendar or payment due dates.</p></>}
    </Dialog>}
  </div>
}
