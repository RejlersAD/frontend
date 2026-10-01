import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { ArrowDown, ArrowUp, Briefcase, ChevronDown, ChevronLeft, ChevronRight, Filter, Plus, RefreshCw, Search, SlidersHorizontal, Upload, X } from 'lucide-react';
import SalesFrameworkWorkspace from './SalesFrameworkWorkspace';
import { filterFrameworks, frameworkDate, frameworkLabel, frameworkMoney, frameworkOwner, frameworkRemaining, sortFrameworks } from './salesFrameworkRegister';
import './SalesFrameworkRegister.css';

const views = [['all', 'All'], ['active', 'Active'], ['draft', 'Draft'], ['suspended', 'Suspended'], ['expired', 'Expired']];
const options = [['agreement', 'Agreement / client'], ['expiry_date', 'Valid until'], ['remaining_value', 'Remaining'], ['status', 'Status'], ['owner', 'Owner'], ['ceiling_value', 'Ceiling'], ['committed_value', 'Committed'], ['invoiced_value', 'Invoiced']];
const defaultColumns = ['agreement', 'expiry_date', 'remaining_value', 'status'];

export default function SalesFrameworkRegister({ rows, loading, error, record, recordLoading, recordError, selectedId, onRefresh, onSelect, onRetryRecord, onOpenFullRecord, onEdit, onCreate, onAction, actions, locked }) {
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [client, setClient] = useState('');
  const [owner, setOwner] = useState('');
  const [currency, setCurrency] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [columns, setColumns] = useState(defaultColumns);
  const [sort, setSort] = useState({ key: 'agreement', direction: 'desc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const filtered = useMemo(() => filterFrameworks(rows, { query, status, client, owner, currency }), [rows, query, status, client, owner, currency]);
  const sorted = useMemo(() => sortFrameworks(filtered, sort.key, sort.direction), [filtered, sort]);
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, pages);
  const pageRows = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const visibleColumns = options.filter(([key]) => columns.includes(key));
  const clients = [...new Map(rows.filter(row => row.client).map(row => [String(row.client), row.client_name || 'Client name unavailable'])).entries()];
  const owners = [...new Map(rows.filter(row => row.owner).map(row => [String(row.owner), frameworkOwner(row)])).entries()];
  const currencies = [...new Set(rows.map(row => row.currency).filter(Boolean))].sort();
  const statusKeys = [...views, ...[...new Set(rows.map(row => row.status).filter(value => value && !views.some(([key]) => key === value)))].map(value => [value, frameworkLabel(value)])];
  const activeFilters = query || client || owner || currency || status !== 'all';
  const change = setter => value => { setter(value); setPage(1); };
  const clearFilters = () => { setQuery(''); setClient(''); setOwner(''); setCurrency(''); setStatus('all'); setPage(1); };

  useEffect(() => {
    if (!loading && !error && !record && !selectedId && sorted.length) onSelect(sorted[0]);
  }, [loading, error, record, selectedId, sorted, onSelect]);

  const tabKey = event => {
    const index = statusKeys.findIndex(([key]) => key === status);
    const next = event.key === 'ArrowRight' ? (index + 1) % statusKeys.length : event.key === 'ArrowLeft' ? (index + statusKeys.length - 1) % statusKeys.length : event.key === 'Home' ? 0 : event.key === 'End' ? statusKeys.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault(); change(setStatus)(statusKeys[next][0]);
    event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next]?.focus();
  };
  const cell = (row, key) => {
    if (key === 'agreement') return <><button type="button" className="sfw-agreement-number" aria-label={`Select framework ${row.framework_number}`} onClick={() => onSelect(row)}>{row.framework_number}</button><span className="sfw-agreement-name" title={row.title}>{row.title}</span><span className="sfw-client-name">{row.client_name || 'Client name unavailable'}</span></>;
    if (key === 'expiry_date') return frameworkDate(row.expiry_date);
    if (key === 'status') return <span className={`sfw-status sfw-status-${row.status}`}>{frameworkLabel(row.status)}</span>;
    if (key === 'owner') return frameworkOwner(row);
    return frameworkMoney(key === 'remaining_value' ? frameworkRemaining(row) : row[key], row.currency, { compact: true });
  };

  return <div className="sfw-page">
    <header className="sfw-page-header"><h1>Framework agreements</h1><div><span title="Framework export is not available"><button type="button" className="sfw-button" disabled aria-label="Export frameworks unavailable"><Upload size={19} />Export</button></span><button type="button" className="sfw-button sfw-primary" onClick={onCreate}><Plus size={20} />New framework</button></div></header>
    {error && <div className="sfw-page-error" role="alert">{error}<button type="button" onClick={onRefresh}>Retry loading</button></div>}
    <div className="sfw-panels">
      <section className="sfw-register" aria-label="Framework register">
        <div className="sfw-register-tabs" role="tablist" aria-label="Framework status">{statusKeys.map(([key, name]) => <button type="button" key={key} id={`sfw-status-${key}`} role="tab" aria-label={name} aria-controls="sfw-register-results" aria-selected={status === key} tabIndex={status === key ? 0 : -1} onKeyDown={tabKey} onClick={() => change(setStatus)(key)}>{name}<span aria-hidden="true">{loading ? '…' : key === 'all' ? rows.length : rows.filter(row => row.status === key).length}</span></button>)}</div>
        <div className="sfw-register-toolbar"><label className="sfw-search"><Search size={20} /><input aria-label="Search frameworks" placeholder="Search framework, client or reference" value={query} onChange={event => change(setQuery)(event.target.value)} /></label><button type="button" className={`sfw-button sfw-filter-button ${filtersOpen ? 'sfw-active' : ''}`} aria-label="Framework filters" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(value => !value)}><Filter size={20} /></button></div>
        {filtersOpen && <div className="sfw-filter-panel"><label>Client<select value={client} onChange={event => change(setClient)(event.target.value)}><option value="">All clients</option>{clients.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label><label>Owner<select value={owner} onChange={event => change(setOwner)(event.target.value)}><option value="">All owners</option><option value="unassigned">Unassigned</option>{owners.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label><label>Currency<select value={currency} onChange={event => change(setCurrency)(event.target.value)}><option value="">All currencies</option>{currencies.map(value => <option key={value}>{value}</option>)}</select></label></div>}
        {activeFilters && <div className="sfw-filter-summary"><span>{filtered.length} matching {filtered.length === 1 ? 'agreement' : 'agreements'}</span><button type="button" onClick={clearFilters}>Clear filters<X size={13} /></button></div>}
        <div className="sfw-register-scroll" id="sfw-register-results" role="tabpanel" aria-labelledby={`sfw-status-${status}`} tabIndex={0} aria-busy={loading}><table data-table-typography="preserve"><thead><tr>{visibleColumns.map(([key, name]) => <th key={key} className={`sfw-col-${key}`} aria-sort={sort.key === key ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'}><button type="button" aria-label={`Sort by ${name}`} onClick={() => setSort(previous => ({ key, direction: previous.key === key && previous.direction === 'asc' ? 'desc' : 'asc' }))}>{name}{sort.key === key ? sort.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} /> : <ChevronDown size={12} />}</button></th>)}</tr></thead><tbody>
          {!loading && pageRows.map(row => <tr key={row.id} aria-selected={record?.id === row.id} className={record?.id === row.id ? 'sfw-selected-row' : ''} onClick={event => { if (!event.target.closest('button,a')) onSelect(row); }} onDoubleClick={() => onOpenFullRecord(row)}>{visibleColumns.map(([key]) => <td key={key} className={`sfw-col-${key}`}>{cell(row, key)}</td>)}</tr>)}
          {(loading || !pageRows.length) && <tr><td colSpan={visibleColumns.length}><div className="sfw-panel-state">{loading ? <RefreshCw size={28} className="sfw-spin" /> : <Briefcase size={28} />}<h2>{loading ? 'Loading frameworks…' : error ? 'Frameworks unavailable' : rows.length ? 'No frameworks match this view' : 'No frameworks yet'}</h2><p>{loading ? 'Loading agreement records.' : error ? 'Retry to load the framework register.' : rows.length ? 'Change your search or clear the filters.' : 'Register a framework to get started.'}</p>{activeFilters && !loading && <button type="button" className="sfw-button" onClick={clearFilters}>Clear filters</button>}</div></td></tr>}
        </tbody></table></div>
        <footer className="sfw-register-footer"><span>{sorted.length ? `${(currentPage - 1) * pageSize + 1} – ${Math.min(currentPage * pageSize, sorted.length)} of ${sorted.length}` : '0 agreements'}</span><div className="sfw-page-buttons"><button type="button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={17} /></button><span aria-label={`Page ${currentPage} of ${pages}`}>{currentPage}</span><button type="button" aria-label="Next page" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}><ChevronRight size={17} /></button></div><details className="sfw-columns-menu" onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); } }}><summary className="sfw-button"><SlidersHorizontal size={19} />Columns<ChevronDown size={15} /></summary><div className="sfw-menu-popup">{options.map(([key, name]) => <label key={key}><input type="checkbox" checked={columns.includes(key)} disabled={key === 'agreement'} onChange={event => setColumns(previous => event.target.checked ? [...previous, key] : previous.filter(value => value !== key))} />{name}</label>)}<label>Rows per page<select aria-label="Rows per page" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}>{[5, 10, 25, 50].map(value => <option key={value}>{value}</option>)}</select></label><button type="button" onClick={onRefresh} disabled={loading}><RefreshCw size={16} />Refresh frameworks</button></div></details></footer>
      </section>
      <SalesFrameworkWorkspace key={record?.id || 'empty'} record={record} loading={recordLoading} error={recordError} onRetry={onRetryRecord} onEdit={onEdit} onOpenFullRecord={() => onOpenFullRecord(record)} onRefresh={onRefresh} onAction={onAction} actions={actions} locked={locked} />
    </div>
  </div>;
}
SalesFrameworkRegister.propTypes = {
  rows: PropTypes.array.isRequired, loading: PropTypes.bool.isRequired, error: PropTypes.string,
  record: PropTypes.object, recordLoading: PropTypes.bool.isRequired, recordError: PropTypes.string, selectedId: PropTypes.string,
  onRefresh: PropTypes.func.isRequired, onSelect: PropTypes.func.isRequired, onRetryRecord: PropTypes.func.isRequired,
  onOpenFullRecord: PropTypes.func.isRequired, onEdit: PropTypes.func.isRequired, onCreate: PropTypes.func.isRequired,
  onAction: PropTypes.func.isRequired, actions: PropTypes.array.isRequired, locked: PropTypes.bool.isRequired,
};
