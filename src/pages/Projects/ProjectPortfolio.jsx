import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import PropTypes from 'prop-types'
import { AlertCircle, AlertTriangle, ArrowDown, ArrowDownUp, ArrowUp, ArrowUpRight, BarChart3, Building2, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download, FileText, Filter, FolderOpen, MoreHorizontal, Plus, RefreshCw, Search, Settings, Table, Upload, User, X } from 'lucide-react'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-sans/700.css'
import { buildPortfolioRows, exportPortfolioCsv, getPortfolioSummary, portfolioNeedsReview } from './portfolioPresentation'
import './ProjectPortfolio.css'

const COLUMNS = [
  { key: 'name', label: 'Project Name', sortLabel: 'Name' }, { key: 'code', label: 'Project Code', sortLabel: 'Code' },
  { key: 'baselineStart', label: 'Baseline Timeline', sortLabel: 'Baseline timeline' },
  { key: 'creatorName', label: 'Author / Creator', sortLabel: 'Author' },
  { key: 'statusLabel', label: 'Project Status', sortLabel: 'Status' }, { key: 'health', label: 'Overall Health', sortLabel: 'Health' },
  { key: 'updatedAt', label: 'Last Updated', sortLabel: 'Updated' },
]
const SUMMARY = [
  { key: 'total', label: 'Total projects', hint: 'Across your project portfolio', icon: FileText, tone: 'blue' },
  { key: 'needsReview', label: 'Needs review', hint: 'Projects requiring attention', icon: AlertTriangle, tone: 'amber' },
  { key: 'baselineApproved', label: 'Baseline approved', hint: 'Approved schedule baselines', icon: CheckCircle2, tone: 'blue' },
  { key: 'missingOwner', label: 'Missing owner', hint: 'No project owner assigned', icon: User, tone: 'blue' },
]
const TONES = new Set(['blue', 'green', 'amber', 'red', 'purple', 'gray', 'slate', 'neutral', 'success', 'warning', 'danger', 'muted'])
const tone = value => TONES.has(value) ? value : 'neutral'
const count = value => Number(value || 0).toLocaleString('en')
const projectId = row => String(row.id)
const date = value => {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Not specified'
  return new Date(String(value).length === 10 ? `${value}T12:00:00` : value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}


function PortfolioMenu({ label, children, icon, text, active = false }) {
  const [open, setOpen] = useState(false), root = useRef(null), trigger = useRef(null), popup = useRef(null), id = useId()
  const [placement, setPlacement] = useState({ top: 0, left: 0 })
  useLayoutEffect(() => {
    if (!open || !trigger.current || !popup.current) return
    const anchor = trigger.current.getBoundingClientRect(), box = popup.current.getBoundingClientRect()
    setPlacement({ top: Math.max(8, anchor.bottom + box.height + 8 < window.innerHeight ? anchor.bottom + 6 : anchor.top - box.height - 6),
      left: Math.max(8, Math.min(window.innerWidth - box.width - 8, anchor.right - box.width)) })
  }, [open])
  useEffect(() => {
    if (!open) return undefined
    const outside = event => { if (!root.current?.contains(event.target) && !popup.current?.contains(event.target)) setOpen(false) }
    const scroll = event => { if (!popup.current?.contains(event.target)) setOpen(false) }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('scroll', scroll, true)
    window.addEventListener('resize', scroll)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('scroll', scroll, true); window.removeEventListener('resize', scroll) }
  }, [open])
  return <div className={`pf-menu ${active ? 'is-active' : ''}`} ref={root} onKeyDown={event => {
    if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus() }
  }}>
    <button type="button" className={`pf-button ${text ? '' : 'pf-icon-button'}`} ref={trigger} aria-label={label} aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>{icon}{text && <span>{text}</span>}</button>
    {open && createPortal(<div ref={popup} className="pf-popover" id={id} style={{ position: 'fixed', ...placement, right: 'auto', maxHeight: 'calc(100dvh - 24px)', overflowY: 'auto', zIndex: 10000 }} aria-label={label} onClick={event => { if (event.target.closest('[data-close-menu]')) { setOpen(false); trigger.current?.focus() } }}>{children}</div>, root.current.closest('.project-portfolio'))}
  </div>
}
PortfolioMenu.propTypes = { label: PropTypes.string.isRequired, children: PropTypes.node.isRequired, icon: PropTypes.node, text: PropTypes.string, active: PropTypes.bool }

function SelectionCheckbox({ checked, mixed = false, label, onChange }) {
  const input = useRef(null)
  useEffect(() => { if (input.current) input.current.indeterminate = mixed }, [mixed])
  return <input ref={input} type="checkbox" aria-label={label} checked={checked} aria-checked={mixed ? 'mixed' : checked} onChange={onChange} />
}
SelectionCheckbox.propTypes = { checked: PropTypes.bool.isRequired, mixed: PropTypes.bool, label: PropTypes.string.isRequired, onChange: PropTypes.func.isRequired }

function Timeline({ row }) {
  if (!row.baselineKnown) return <span className="pf-baseline-unavailable"><CalendarDays size={16} />Baseline unavailable</span>
  if (!row.baselineApproved) return <span className="pf-baseline-warning"><AlertTriangle size={16} />Baseline not approved</span>
  return <div className="pf-baseline"><CalendarDays size={16} /><span>{row.baselineStart && row.baselineFinish ? `${date(row.baselineStart)} – ${date(row.baselineFinish)}` : 'Baseline dates not specified'}</span></div>
}
Timeline.propTypes = { row: PropTypes.object.isRequired }

function StatusBadge({ label, color, health = false, reason }) {
  const Icon = ['amber', 'warning', 'red', 'danger'].includes(color) ? AlertTriangle : ['green', 'success'].includes(color) ? CheckCircle2 : AlertCircle
  return <span className={`pf-badge pf-tone-${tone(color)} ${health ? 'pf-health-badge' : ''}`} title={reason}>{health && <Icon size={13} />}{label || 'Not specified'}</span>
}
StatusBadge.propTypes = { label: PropTypes.string, color: PropTypes.string, health: PropTypes.bool, reason: PropTypes.string }

export default function ProjectPortfolio({ projects = [], loading = false, error, onCreate, onOpen, onRefresh, onImport }) {
  const rows = useMemo(() => buildPortfolioRows(projects), [projects])
  const summary = useMemo(() => getPortfolioSummary(rows), [rows])
  const unavailable = Boolean((loading || error) && !rows.length)
  const [query, setQuery] = useState(''), [status, setStatus] = useState('all'), [entity, setEntity] = useState('all')
  const [quickFilter, setQuickFilter] = useState('total'), [healthFilter, setHealthFilter] = useState('all')
  const [view, setView] = useState('table'), [visibleColumns, setVisibleColumns] = useState(() => COLUMNS.map(column => column.key))
  const [sort, setSort] = useState({ key: 'updatedAt', direction: 'desc' }), [page, setPage] = useState(1), [pageSize, setPageSize] = useState(10)
  const [selection, setSelection] = useState(() => new Set()), [notice, setNotice] = useState('')
  const statuses = useMemo(() => [...new Set(rows.map(row => row.statusLabel).filter(Boolean))].sort(), [rows])
  const entities = useMemo(() => [...new Set(rows.map(row => row.entity).filter(Boolean))].sort(), [rows])
  const healthOptions = useMemo(() => [...new Map(rows.filter(row => row.health?.key).map(row => [row.health.key, row.health])).values()], [rows])
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    return rows.filter(row => (!term || [row.name, row.code, row.client, row.ownerName, row.creatorName].some(value => String(value || '').toLowerCase().includes(term)))
      && (status === 'all' || row.statusLabel === status) && (entity === 'all' || row.entity === entity)
      && (healthFilter === 'all' || row.health?.key === healthFilter)
      && (quickFilter === 'total' || quickFilter === 'needsReview' && portfolioNeedsReview(row)
        || quickFilter === 'baselineApproved' && row.baselineApproved || quickFilter === 'missingOwner' && row.missingOwner))
  }, [rows, query, status, entity, healthFilter, quickFilter])
  const sorted = useMemo(() => [...filtered].sort((left, right) => {
    const value = row => sort.key === 'health' ? row.health?.label : row[sort.key]
    const a = value(left), b = value(right)
    if (!a && !b) return 0
    if (!a) return 1
    if (!b) return -1
    return String(a).localeCompare(String(b), 'en', { numeric: true, sensitivity: 'base' }) * (sort.direction === 'asc' ? 1 : -1)
  }), [filtered, sort])
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize)), currentPage = Math.min(page, pages)
  const pageRows = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const selectedRows = rows.filter(row => selection.has(projectId(row)))
  const selectedOnPage = pageRows.filter(row => selection.has(projectId(row))).length
  const filtersActive = Boolean(query.trim() || status !== 'all' || entity !== 'all' || healthFilter !== 'all' || quickFilter !== 'total')
  const columns = COLUMNS.filter(column => visibleColumns.includes(column.key))
  const healthGroups = healthOptions.map(health => ({ ...health, rows: filtered.filter(row => row.health?.key === health.key) }))
  const change = callback => { callback(); setPage(1) }
  const clearFilters = () => change(() => { setQuery(''); setStatus('all'); setEntity('all'); setHealthFilter('all'); setQuickFilter('total') })
  const toggleSelection = row => setSelection(current => { const next = new Set(current), id = projectId(row); if (next.has(id)) next.delete(id); else next.add(id); return next })
  const exportRows = records => { exportPortfolioCsv(records); setNotice(`${count(records.length)} ${records.length === 1 ? 'project' : 'projects'} exported.`) }
  const sortBy = key => { setSort(current => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' })); setPage(1) }
  const selectPage = () => setSelection(current => {
    const next = new Set(current)
    pageRows.forEach(row => { if (selectedOnPage === pageRows.length) next.delete(projectId(row)); else next.add(projectId(row)) })
    return next
  })
  const cell = (row, key) => {
    if (key === 'name') return <div className="pf-project-name"><button type="button" title={row.name || 'Untitled project'} onClick={() => onOpen(row)}>{row.name || 'Untitled project'}</button><small title={row.client || 'Client not specified'}>{row.client || 'Client not specified'}</small></div>
    if (key === 'code') return <span className="pf-project-code">{row.code || 'Not specified'}</span>
    if (key === 'baselineStart') return <Timeline row={row} />
    if (key === 'creatorName') return <div className="pf-author"><span className={`pf-avatar ${row.creatorName === 'Not recorded' ? 'is-empty' : ''}`} aria-hidden="true">{row.initials || '—'}</span><span>{row.creatorName || 'Not recorded'}</span></div>
    if (key === 'statusLabel') return <StatusBadge label={row.statusLabel} color={row.statusTone} />
    if (key === 'health') return <StatusBadge label={row.health?.label} color={row.health?.tone} reason={row.health?.reason} health />
    return <span className="pf-updated" title={row.updatedAt || undefined}>{date(row.updatedAt)}</span>
  }
  return <section className="project-portfolio" aria-label="Project portfolio">
    <nav className="pf-breadcrumb" aria-label="Breadcrumb"><span>Project Control</span><span aria-hidden="true">/</span><span aria-current="page">Portfolio</span></nav>
    <header className="pf-page-heading"><div><h1>Project Portfolio</h1><p>Monitor project health, baselines and ownership</p></div>
      <div className="pf-page-actions"><button type="button" className="pf-button pf-primary" onClick={onCreate} disabled={!onCreate}><Plus size={16} />Create project</button><button type="button" className="pf-button" aria-label="Export projects" disabled={loading || !filtered.length} onClick={() => exportRows(sorted)}><Download size={15} />Export</button>
        <PortfolioMenu label="More portfolio actions" icon={<MoreHorizontal size={17} />}><button type="button" data-close-menu disabled={loading || !onRefresh} onClick={onRefresh}><RefreshCw size={15} />Refresh projects</button><button type="button" data-close-menu disabled={!onImport} onClick={onImport}><Upload size={15} />Import projects</button></PortfolioMenu>
      </div>
    </header>
    <div className="pf-summary-grid" aria-label="Portfolio summary">{SUMMARY.map(({ key, label, icon: Icon, tone: color }) => <button type="button" key={key} className={`pf-summary-card pf-summary-${color} ${quickFilter === key && key !== 'total' ? 'is-selected' : ''}`} aria-label={label} aria-pressed={quickFilter === key} disabled={unavailable} onClick={() => change(() => { setQuickFilter(current => current === key ? 'total' : key); setHealthFilter('all') })}>
      <span className="pf-summary-icon"><Icon size={36} strokeWidth={1.6} /></span><span className="pf-summary-values"><span className="pf-summary-title">{key === 'missingOwner' ? 'Missing project owner' : label}</span><strong>{unavailable ? '—' : count(summary[key])}</strong></span><ChevronRight size={19} className="pf-summary-chevron" />
    </button>)}</div>
    {error && <div className="pf-error" role="alert"><AlertCircle size={17} /><span>{typeof error === 'string' ? error : 'Projects could not be loaded.'}</span>{onRefresh && <button type="button" className="pf-button" onClick={onRefresh}>Retry</button>}</div>}
    <section className="pf-projects-card" aria-labelledby="pf-projects-heading">
      <header className="pf-card-heading"><div><h2 id="pf-projects-heading">Projects <span>{unavailable ? 'Unavailable' : `${count(rows.length)} projects`}</span></h2><p>Select a project to open its performance workspace.</p></div><button type="button" className="pf-button pf-primary" onClick={onCreate} disabled={!onCreate}><Plus size={16} />Create project</button></header>
      <div className="pf-toolbar"><label className="pf-search"><Search size={16} /><input aria-label="Search projects" type="search" placeholder="Search project name, code, client or owner" value={query} onChange={event => change(() => setQuery(event.target.value))} /></label>
        <label className="pf-select-control"><span className="pf-sr-only">Project status</span><select aria-label="Project status" value={status} onChange={event => change(() => setStatus(event.target.value))}><option value="all">All projects</option>{statuses.map(value => <option key={value} value={value}>{value}</option>)}</select><ChevronDown size={13} aria-hidden="true" /></label>
        <PortfolioMenu label="Filters" text="Filters" active={quickFilter !== 'total' || healthFilter !== 'all'} icon={<Filter size={14} />}><div className="pf-filter-options"><strong>Project health</strong><label>Health<select aria-label="Project health" value={healthFilter} onChange={event => change(() => setHealthFilter(event.target.value))}><option value="all">All health states</option>{healthOptions.map(health => <option key={health.key} value={health.key}>{health.label}</option>)}</select></label><strong>Show projects</strong>{SUMMARY.map(item => <label className="pf-choice" key={item.key}><input type="radio" name="portfolio-quick-filter" checked={quickFilter === item.key} onChange={() => change(() => setQuickFilter(item.key))} />{item.key === 'total' ? 'All projects' : item.label}</label>)}<button type="button" data-close-menu onClick={clearFilters}>Clear all filters</button></div></PortfolioMenu>
        <label className="pf-select-control pf-entity"><Building2 size={14} aria-hidden="true" /><select aria-label="Project entity" value={entity} onChange={event => change(() => setEntity(event.target.value))}><option value="all">Entity</option>{entities.map(value => <option key={value} value={value}>{value}</option>)}</select><ChevronDown size={13} aria-hidden="true" /></label>
        <div className="pf-toolbar-end"><div className="pf-view-tabs" role="tablist" aria-label="Portfolio view"><button type="button" role="tab" aria-selected={view === 'table'} onClick={() => setView('table')}><Table size={15} />Table</button><button type="button" role="tab" aria-selected={view === 'health'} onClick={() => setView('health')}><BarChart3 size={16} />Portfolio health</button></div>{filtersActive && <button type="button" className="pf-clear-filters" onClick={clearFilters}><X size={13} />Clear filters</button>}<PortfolioMenu label="Columns" text="Columns" icon={<Settings size={15} />}><div className="pf-column-options"><strong>Visible columns</strong>{COLUMNS.map(column => <label className="pf-choice" key={column.key}><input type="checkbox" checked={visibleColumns.includes(column.key)} disabled={column.key === 'name'} onChange={event => setVisibleColumns(current => event.target.checked ? [...current, column.key] : current.filter(key => key !== column.key))} />{column.label}</label>)}<button type="button" data-close-menu onClick={() => setVisibleColumns(COLUMNS.map(column => column.key))}>Restore columns</button></div></PortfolioMenu></div>
      </div>
      {filtersActive && <div className="pf-filter-summary"><span>{count(filtered.length)} matching {filtered.length === 1 ? 'project' : 'projects'}</span>{quickFilter !== 'total' && <span className="pf-active-filter">{SUMMARY.find(item => item.key === quickFilter)?.label}<button type="button" aria-label="Remove summary filter" onClick={() => change(() => setQuickFilter('total'))}><X size={12} /></button></span>}</div>}
      {loading && <div className="pf-loading" role="status"><RefreshCw size={16} className="pf-spinner" />Loading projects...</div>}
      {view === 'table' ? <div className="pf-table-scroll" tabIndex={0} role="region" aria-label="Scrollable projects table"><table className="pf-project-table" data-table-typography="preserve" aria-label="Projects"><thead><tr><th className="pf-checkbox-cell" scope="col"><SelectionCheckbox checked={Boolean(pageRows.length && selectedOnPage === pageRows.length)} mixed={selectedOnPage > 0 && selectedOnPage < pageRows.length} label="Select all projects on this page" onChange={selectPage} /></th>{columns.map(column => <th scope="col" key={column.key} className={`pf-column-${column.key}`} aria-sort={sort.key === column.key ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'}><button type="button" aria-label={`Sort by ${column.sortLabel}`} onClick={() => sortBy(column.key)}>{column.label}{sort.key === column.key ? sort.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} /> : <ArrowDownUp size={12} />}</button></th>)}<th scope="col" className="pf-actions-heading">Action</th></tr></thead><tbody>
        {pageRows.map(row => <tr key={projectId(row)} className={selection.has(projectId(row)) ? 'is-selected' : undefined}><td className="pf-checkbox-cell"><SelectionCheckbox checked={selection.has(projectId(row))} label={`Select ${row.name}`} onChange={() => toggleSelection(row)} /></td>{columns.map(column => <td key={column.key} className={`pf-column-${column.key}`}>{cell(row, column.key)}</td>)}<td className="pf-row-actions"><button type="button" className="pf-open-project" aria-label={`Open ${row.name}`} onClick={() => onOpen(row)}>Open</button><PortfolioMenu label={`More actions for ${row.name}`} icon={<MoreHorizontal size={17} />}><button type="button" data-close-menu onClick={() => onOpen(row)}><ArrowUpRight size={15} />Open project</button><button type="button" data-close-menu onClick={() => exportRows([row])}><Download size={15} />Export project</button></PortfolioMenu></td></tr>)}
        {!pageRows.length && !loading && <tr><td colSpan={columns.length + 2}><div className="pf-empty"><FolderOpen size={32} /><strong>{error ? 'Projects unavailable' : filtersActive ? 'No matching projects' : 'No projects yet'}</strong><p>{error ? 'Retry to load the current project portfolio.' : filtersActive ? 'Try another search or clear your filters.' : 'Create a project to start planning and tracking delivery.'}</p><button type="button" className="pf-button" onClick={error ? onRefresh : filtersActive ? clearFilters : onCreate} disabled={error ? !onRefresh : !filtersActive && !onCreate}>{error ? 'Reload projects' : filtersActive ? 'Clear filters' : 'Create project'}</button></div></td></tr>}
      </tbody></table></div> : <div className="pf-health-view" role="tabpanel" aria-label="Portfolio health"><div className="pf-health-overview"><h3>Portfolio health</h3><p>Based on the current project records and active filters.</p></div>{healthGroups.length ? <div className="pf-health-groups">{healthGroups.map(health => <section key={health.key} className={`pf-health-group pf-tone-${tone(health.tone)}`}><header><StatusBadge label={health.label} color={health.tone} health /><strong>{count(health.rows.length)}</strong></header><div className="pf-health-meter" aria-label={`${health.label}: ${health.rows.length} of ${filtered.length} projects`}><i style={{ width: `${filtered.length ? health.rows.length / filtered.length * 100 : 0}%` }} /></div><p>{health.reason || 'Review the project for details.'}</p><ul>{health.rows.slice(0, 5).map(row => <li key={projectId(row)}><button type="button" onClick={() => onOpen(row)}><span>{row.name}</span><ArrowUpRight size={13} /></button></li>)}</ul>{health.rows.length > 5 && <button type="button" className="pf-health-show" onClick={() => { change(() => setHealthFilter(health.key)); setView('table') }}>View all {count(health.rows.length)} projects<ChevronRight size={13} /></button>}</section>)}</div> : <div className="pf-empty"><CheckCircle2 size={28} /><strong>No projects to display</strong><button type="button" className="pf-button" onClick={clearFilters}>Clear filters</button></div>}</div>}
      <footer className="pf-table-footer"><div className="pf-selection-status">{selectedRows.length ? <><span><Check size={13} />{count(selectedRows.length)} selected</span><button type="button" onClick={() => exportRows(selectedRows)}>Export selected</button><button type="button" onClick={() => setSelection(new Set())}>Clear selection</button></> : <span>Select projects to perform bulk actions</span>}</div>{view === 'table' && <div className="pf-pagination"><span>{sorted.length ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, sorted.length)}` : '0'} of {count(sorted.length)} projects</span><label><span>Rows per page</span><select aria-label="Projects per page" value={pageSize} onChange={event => change(() => setPageSize(Number(event.target.value)))}>{[10, 25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}</select></label><div className="pf-page-buttons"><button type="button" aria-label="First page" disabled={currentPage === 1} onClick={() => setPage(1)}><ChevronsLeft size={15} /></button><button type="button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage(current => Math.max(1, current - 1))}><ChevronLeft size={15} /></button>{Array.from({ length: Math.min(5, pages) }, (_, index) => Math.max(1, Math.min(currentPage - 2, pages - 4)) + index).map(number => <button key={number} type="button" aria-label={`Page ${number}`} aria-current={number === currentPage ? 'page' : undefined} onClick={() => setPage(number)}>{number}</button>)}<button type="button" aria-label="Next page" disabled={currentPage >= pages} onClick={() => setPage(current => Math.min(pages, current + 1))}><ChevronRight size={15} /></button><button type="button" aria-label="Last page" disabled={currentPage >= pages} onClick={() => setPage(pages)}><ChevronsRight size={15} /></button></div></div>}</footer>
    </section>
    <p className="pf-live-notice" role="status" aria-live="polite">{notice}</p>
  </section>
}

ProjectPortfolio.propTypes = {
  projects: PropTypes.array, loading: PropTypes.bool, error: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  onCreate: PropTypes.func, onOpen: PropTypes.func.isRequired, onRefresh: PropTypes.func, onImport: PropTypes.func,
}
