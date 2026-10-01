import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { ArrowDown, ArrowUp, Building2, ChevronDown, ChevronLeft, ChevronRight, Filter, Plus, RefreshCw, Search, SlidersHorizontal, Upload, X } from 'lucide-react';
import SalesClientWorkspace from './SalesClientWorkspace';
import { clientIndustry, clientLabel, clientOwner, filterClients, sortClients } from './salesClientRegister';
import './SalesClientRegister.css';

const views = [['all', 'All'], ['active', 'Active'], ['prospect', 'Prospects'], ['inactive', 'Inactive']];
const columnOptions = [['client', 'Client'], ['industry', 'Industry'], ['country', 'Country'], ['owner', 'Owner'], ['status', 'Status'], ['verification_status', 'Verification'], ['active_deals_count', 'Active opportunities']];
const defaults = ['client', 'industry', 'country', 'owner', 'status'];

export default function SalesClientRegister({ rows, loading, error, record, recordLoading, recordError, selectedId, onRefresh, onSelect, onRetryRecord, onOpenFullRecord, onEdit, onCreate }) {
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [country, setCountry] = useState('');
  const [owner, setOwner] = useState('');
  const [industry, setIndustry] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [columns, setColumns] = useState(defaults);
  const [sort, setSort] = useState({ key: 'client', direction: 'asc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const filtered = useMemo(() => filterClients(rows, { query, status, country, owner, industry }), [rows, query, status, country, owner, industry]);
  const sorted = useMemo(() => sortClients(filtered, sort.key, sort.direction), [filtered, sort]);
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, pages);
  const pageRows = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const visibleColumns = columnOptions.filter(([key]) => columns.includes(key));
  const countries = [...new Set(rows.map(row => row.country).filter(Boolean))].sort();
  const owners = [...new Map(rows.filter(row => row.account_manager).map(row => [String(row.account_manager), clientOwner(row)])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const industries = [...new Set(rows.map(row => row.industry_type).filter(Boolean))].sort();
  const activeFilters = query || country || owner || industry || status !== 'all';
  const change = setter => value => { setter(value); setPage(1); };
  const clearFilters = () => { setQuery(''); setCountry(''); setOwner(''); setIndustry(''); setStatus('all'); setPage(1); };

  useEffect(() => {
    if (!loading && !error && !record && !selectedId && sorted.length) onSelect(sorted[0]);
  }, [loading, error, record, selectedId, sorted, onSelect]);

  const statusKeys = rows.some(row => row.status === 'former') ? [...views, ['former', 'Former']] : views;
  const tabKey = event => {
    const index = statusKeys.findIndex(([key]) => key === status);
    const next = event.key === 'ArrowRight' ? (index + 1) % statusKeys.length : event.key === 'ArrowLeft' ? (index + statusKeys.length - 1) % statusKeys.length : event.key === 'Home' ? 0 : event.key === 'End' ? statusKeys.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault(); change(setStatus)(statusKeys[next][0]);
    event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next]?.focus();
  };
  const cell = (row, key) => {
    if (key === 'client') return <><button type="button" className="scl-client-name" title={row.company_name} aria-label={`Select client ${row.company_name}`} onClick={() => onSelect(row)}>{row.company_name}</button><span className="scl-client-code">{row.client_code}</span></>;
    if (key === 'industry') return clientIndustry(row.industry_type);
    if (key === 'owner') return clientOwner(row);
    if (key === 'status') return <span className={`scl-status scl-status-${row.status}`}>{clientLabel(row.status) || '—'}</span>;
    if (key === 'verification_status') return clientLabel(row.verification_status) || '—';
    return row[key] ?? '—';
  };

  return <div className="scl-page">
    <header className="scl-page-header"><h1>Clients</h1><div><span title="Client export is not available"><button type="button" className="scl-button" disabled aria-label="Export clients unavailable"><Upload size={19} />Export</button></span><button type="button" className="scl-button scl-primary" onClick={onCreate}><Plus size={20} />New client</button></div></header>
    {error && <div className="scl-page-error" role="alert">{error}<button type="button" onClick={onRefresh}>Retry loading</button></div>}
    <div className="scl-panels">
      <section className="scl-register" aria-label="Client register">
        <div className="scl-register-tabs" role="tablist" aria-label="Client status">{statusKeys.map(([key, name]) => <button type="button" key={key} id={`scl-status-${key}`} role="tab" aria-label={name} aria-controls="scl-register-results" aria-selected={status === key} tabIndex={status === key ? 0 : -1} onKeyDown={tabKey} onClick={() => change(setStatus)(key)}>{name}<span aria-hidden="true">{loading ? '…' : key === 'all' ? rows.length : rows.filter(row => row.status === key).length}</span></button>)}</div>
        <div className="scl-register-toolbar"><label className="scl-search"><Search size={20} /><input aria-label="Search clients" placeholder="Search client name, ID or domain" value={query} onChange={event => change(setQuery)(event.target.value)} /></label><select aria-label="Country" value={country} onChange={event => change(setCountry)(event.target.value)}><option value="">Country</option>{countries.map(value => <option key={value}>{value}</option>)}</select><button type="button" className={`scl-button scl-filter-button ${filtersOpen ? 'scl-active' : ''}`} aria-label="Client filters" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(value => !value)}><Filter size={20} /></button></div>
        {filtersOpen && <div className="scl-filter-panel"><label>Owner<select value={owner} onChange={event => change(setOwner)(event.target.value)}><option value="">All owners</option><option value="unassigned">Unassigned</option>{owners.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label><label>Industry<select value={industry} onChange={event => change(setIndustry)(event.target.value)}><option value="">All industries</option>{industries.map(value => <option key={value} value={value}>{clientIndustry(value)}</option>)}</select></label></div>}
        {activeFilters && <div className="scl-filter-summary"><span>{filtered.length} matching {filtered.length === 1 ? 'client' : 'clients'}</span><button type="button" onClick={clearFilters}>Clear filters<X size={13} /></button></div>}
        <div className="scl-register-scroll" id="scl-register-results" role="tabpanel" aria-labelledby={`scl-status-${status}`} tabIndex={0} aria-busy={loading}><table data-table-typography="preserve"><thead><tr>{visibleColumns.map(([key, name]) => <th key={key} className={`scl-col-${key}`} aria-sort={sort.key === key ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'}><button type="button" aria-label={`Sort by ${name}`} onClick={() => setSort(previous => ({ key, direction: previous.key === key && previous.direction === 'asc' ? 'desc' : 'asc' }))}>{name}{sort.key === key ? sort.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} /> : <ChevronDown size={12} />}</button></th>)}</tr></thead><tbody>
          {!loading && pageRows.map(row => <tr key={row.id} aria-selected={record?.id === row.id} className={record?.id === row.id ? 'scl-selected-row' : ''} onClick={event => { if (!event.target.closest('button,a')) onSelect(row); }} onDoubleClick={() => onOpenFullRecord(row)}>{visibleColumns.map(([key]) => <td key={key} className={`scl-col-${key}`}>{cell(row, key)}</td>)}</tr>)}
          {(loading || !pageRows.length) && <tr><td colSpan={visibleColumns.length}><div className="scl-panel-state">{loading ? <RefreshCw size={28} className="scl-spin" /> : <Building2 size={28} />}<h2>{loading ? 'Loading clients…' : error ? 'Clients unavailable' : rows.length ? 'No clients match this view' : 'No clients yet'}</h2><p>{loading ? 'Loading client records.' : error ? 'Retry to load the client register.' : rows.length ? 'Change your search or clear the filters.' : 'Add a client to get started.'}</p>{activeFilters && !loading && <button type="button" className="scl-button" onClick={clearFilters}>Clear filters</button>}</div></td></tr>}
        </tbody></table></div>
        <footer className="scl-register-footer"><span>{sorted.length ? `${(currentPage - 1) * pageSize + 1} – ${Math.min(currentPage * pageSize, sorted.length)} of ${sorted.length}` : '0 clients'}</span><div className="scl-page-buttons"><button type="button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={17} /></button><span aria-label={`Page ${currentPage} of ${pages}`}>{currentPage}</span><button type="button" aria-label="Next page" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}><ChevronRight size={17} /></button></div><details className="scl-columns-menu" onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); } }}><summary className="scl-button"><SlidersHorizontal size={19} />Columns<ChevronDown size={15} /></summary><div className="scl-menu-popup">{columnOptions.map(([key, name]) => <label key={key}><input type="checkbox" checked={columns.includes(key)} disabled={key === 'client'} onChange={event => setColumns(previous => event.target.checked ? [...previous, key] : previous.filter(value => value !== key))} />{name}</label>)}<label>Rows per page<select aria-label="Rows per page" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}>{[5, 10, 25, 50].map(value => <option key={value}>{value}</option>)}</select></label><button type="button" onClick={onRefresh} disabled={loading}><RefreshCw size={16} />Refresh clients</button></div></details></footer>
      </section>
      <SalesClientWorkspace record={record} loading={recordLoading} error={recordError} onRetry={onRetryRecord} onEdit={onEdit} onOpenFullRecord={() => onOpenFullRecord(record)} onRefresh={onRefresh} />
    </div>
  </div>;
}
SalesClientRegister.propTypes = {
  rows: PropTypes.array.isRequired, loading: PropTypes.bool.isRequired, error: PropTypes.string,
  record: PropTypes.object, recordLoading: PropTypes.bool.isRequired, recordError: PropTypes.string, selectedId: PropTypes.string,
  onRefresh: PropTypes.func.isRequired, onSelect: PropTypes.func.isRequired, onRetryRecord: PropTypes.func.isRequired,
  onOpenFullRecord: PropTypes.func.isRequired, onEdit: PropTypes.func.isRequired, onCreate: PropTypes.func.isRequired,
};
