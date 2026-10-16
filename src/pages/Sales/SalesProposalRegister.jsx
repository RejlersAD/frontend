import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, ChevronDown, ChevronLeft, ChevronRight, FileText, Filter, Plus, RefreshCw, Search, SlidersHorizontal, Upload, X } from 'lucide-react';
import salesService from '../../services/sales.service';
import SalesProposalWorkspace, { ProposalMenu, ProposalStatus, proposalTabKey } from './SalesProposalWorkspace';
import { filterProposals, isPreparationOpportunity, proposalRowKey, proposalOwnerId, proposalBucket, proposalClient, proposalCode, proposalDate, proposalDeadline, proposalOwner, proposalRevision, proposalTitle, sortProposals } from './salesProposalRegister';
import { loadPreparationOpportunities } from './salesProposalDraft';
import './SalesProposalRegister.css';

const views = [['all', 'All'], ['preparation', 'Preparation'], ['draft', 'Draft'], ['review', 'In review'], ['approved', 'Approved'], ['submitted', 'Submitted']];
const columnOptions = [['code', 'VF code'], ['title', 'Proposal / client'], ['revision', 'Rev'], ['deadline', 'Deadline'], ['status', 'Status'], ['owner', 'Owner']];
const defaultColumns = ['code', 'title', 'revision', 'deadline', 'status'];

export default function SalesProposalRegister({ rows: quotes, loading, error, record, recordLoading, recordError, selectedId, onRefresh, onSelect, onRetryRecord, onOpenFullRecord, onEdit, onCreate, onAction, onPrepared, actions, locked }) {
  const [candidates, setCandidates] = useState([]), [candidateLoading, setCandidateLoading] = useState(true), [candidateError, setCandidateError] = useState(''), [candidateRefresh, setCandidateRefresh] = useState(0), [pendingId, setPendingId] = useState('');
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    setCandidateLoading(true); setCandidateError('');
    loadPreparationOpportunities(params => salesService.getPreparationOpportunities({ ...params, pending_only: true }, { signal: controller.signal })).then(items => { if (active) setCandidates(items); }).catch(failure => { if (active) { setCandidates([]); setCandidateError(failure?.response?.data?.detail || failure.message || 'Preparation opportunities are unavailable.'); } }).finally(() => { if (active) setCandidateLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [quotes, candidateRefresh]);
  const rows = useMemo(() => {
    const covered = new Set(quotes.map(row => String(row.deal || row.deal_details?.id)));
    return [...candidates.filter(row => !row.has_proposal && !covered.has(String(row.id))).map(row => ({ ...row, row_kind: 'preparation' })), ...quotes];
  }, [quotes, candidates]);
  const pending = rows.find(row => isPreparationOpportunity(row) && String(row.id) === pendingId);
  const select = row => { if (isPreparationOpportunity(row)) setPendingId(String(row.id)); else { setPendingId(''); onSelect(row); } };
  const open = row => { if (isPreparationOpportunity(row)) setPendingId(String(row.id)); else { setPendingId(''); onOpenFullRecord(row); } };
  useEffect(() => {
    if (!pendingId) return;
    const replacement = quotes.find(row => String(row.deal || row.deal_details?.id) === pendingId);
    if (replacement) { setPendingId(''); onSelect(replacement); }
  }, [quotes, pendingId, onSelect]);
  const [view, setView] = useState('all');
  const [query, setQuery] = useState('');
  const [owner, setOwner] = useState('');
  const [client, setClient] = useState('');
  const [deadline, setDeadline] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [columns, setColumns] = useState(defaultColumns);
  const [sort, setSort] = useState({ key: '', direction: 'asc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const filtered = useMemo(() => filterProposals(rows, { query, view, owner, client, deadline }), [rows, query, view, owner, client, deadline]);
  const sorted = useMemo(() => sort.key ? sortProposals(filtered, sort.key, sort.direction) : filtered, [filtered, sort]);
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, pages);
  const pageRows = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const visibleColumns = columnOptions.filter(([key]) => columns.includes(key));
  const owners = [...new Map(rows.filter(row => proposalOwnerId(row)).map(row => [String(proposalOwnerId(row)), proposalOwner(row)])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const clients = [...new Map(rows.filter(row => row.client).map(row => [String(row.client), proposalClient(row)])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const counts = Object.fromEntries(views.map(([key]) => [key, key === 'all' ? rows.length : rows.filter(row => proposalBucket(row) === key).length]));
  const change = setter => value => { setter(value); setPage(1); };
  const clearFilters = () => { setView('all'); setQuery(''); setOwner(''); setClient(''); setDeadline(''); setPage(1); };
  const activeFilters = query || owner || client || deadline || view !== 'all';

  useEffect(() => {
    if (!loading && !error && !record && !selectedId && !pendingId && rows.length) { if (isPreparationOpportunity(rows[0])) setPendingId(String(rows[0].id)); else onSelect(rows[0]); }
  }, [loading, error, record, selectedId, rows, onSelect, pendingId]);

  const exportView = async () => {
    if (loading || exporting || !filtered.length) return;
    const saved = sorted.filter(row => !isPreparationOpportunity(row));
    if (!saved.length) return;
    if (saved.length > 10000) { setExportError('Export supports up to 10,000 proposals. Narrow the filters and try again.'); return; }
    setExporting(true); setExportError('');
    try {
      const blob = await salesService.exportQuotes(saved.map(row => row.id));
      const url = URL.createObjectURL(blob), anchor = document.createElement('a');
      anchor.href = url; anchor.download = 'proposal-register.csv'; document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (failure) {
      let response = failure?.response?.data;
      if (response instanceof Blob) { try { response = JSON.parse(await response.text()); } catch { response = null; } }
      const detail = typeof response?.detail === 'string' && response.detail.length <= 1000 && !/<[^>]+>/.test(response.detail) ? response.detail : '';
      setExportError(detail || (failure?.response?.status === 403 ? 'You do not have permission to export these proposals.' : 'The proposal export could not be completed. Please retry.'));
    } finally { setExporting(false); }
  };

  const cell = (row, key) => {
    if (key === 'code') return <span title={proposalCode(row)}>{proposalCode(row)}</span>;
    if (key === 'title') return <><button type="button" className="spg-row-title" title={isPreparationOpportunity(row) ? proposalTitle(row) : `${proposalTitle(row)} · ${row.quote_number}`} aria-label={isPreparationOpportunity(row) ? `Prepare proposal for ${row.deal_code}` : `Select proposal ${row.quote_number} revision ${row.version}`} onClick={() => select(row)}>{proposalTitle(row)}</button><span className="spg-row-client" title={proposalClient(row)}>{proposalClient(row)}</span></>;
    if (key === 'revision') return <span title={isPreparationOpportunity(row) ? 'No proposal revision created' : `Proposal ${proposalRevision(row)}`}>{Number.isInteger(row.version) ? String(row.version).padStart(2, '0') : '—'}</span>;
    if (key === 'deadline') return <span title={proposalDate(proposalDeadline(row))}>{proposalDate(proposalDeadline(row))}</span>;
    if (key === 'status') return <ProposalStatus record={row} />;
    return <span title={proposalOwner(row)}>{proposalOwner(row)}</span>;
  };

  return <div className="spg-page">
    <header className="spg-page-header"><h1>Proposals</h1><div><button type="button" className="spg-button" disabled={loading || exporting || !filtered.some(row => !isPreparationOpportunity(row))} onClick={exportView} title="Export saved proposals in this view; preparation opportunities have no proposal yet"><Upload size={19} />{exporting ? 'Exporting…' : 'Export'}</button><button type="button" className="spg-button spg-primary" onClick={() => onCreate()}><Plus size={20} />New proposal</button></div></header>
    {(error || exportError) && <div className="spg-page-error" role="alert">{error || exportError}{error && <button type="button" onClick={onRefresh}>Retry loading</button>}</div>}
    {candidateLoading && <p className="spg-readiness-message" role="status">Loading preparation opportunities... Saved proposals remain available.</p>}
    {candidateError && <div className="spg-page-error" role="alert">Preparation opportunities could not be loaded: {candidateError}<button type="button" onClick={() => setCandidateRefresh(value => value + 1)}>Retry preparation opportunities</button></div>}
    {filtered.some(isPreparationOpportunity) && <p className="spg-readiness-message">Preparation rows are opportunities awaiting their first proposal. Export includes saved proposals only.</p>}
    <div className="spg-panels">
      <section className="spg-register" aria-label="Proposal register">
        <div className="spg-register-tabs" role="tablist" aria-label="Proposal status">{views.map(([key, name]) => <button key={key} id={`spg-status-${key}`} type="button" role="tab" aria-label={name} aria-controls="spg-register-results" aria-selected={view === key} tabIndex={view === key ? 0 : -1} onClick={() => change(setView)(key)} onKeyDown={event => proposalTabKey(event, views.map(([value]) => value), view, change(setView))}>{name}<span aria-hidden="true">{loading ? '…' : counts[key]}</span></button>)}</div>
        <div className="spg-register-toolbar"><label className="spg-search"><Search size={19} /><input aria-label="Search proposals" value={query} onChange={event => change(setQuery)(event.target.value)} placeholder="Search VF code, proposal or client" /></label><select aria-label="Owner" value={owner} onChange={event => change(setOwner)(event.target.value)}><option value="">Owner</option><option value="unassigned">Unassigned</option>{owners.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select><button type="button" className={`spg-button spg-filter-button ${filtersOpen ? 'spg-active' : ''}`} aria-label="Proposal filters" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(value => !value)}><Filter size={19} /></button></div>
        {filtersOpen && <div className="spg-filter-panel"><label>Client<select aria-label="Client" value={client} onChange={event => change(setClient)(event.target.value)}><option value="">All clients</option>{clients.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label><label>Deadline<select aria-label="Deadline filter" value={deadline} onChange={event => change(setDeadline)(event.target.value)}><option value="">All deadlines</option><option value="week">Due in 7 days</option><option value="overdue">Overdue</option><option value="missing">No deadline</option></select></label></div>}
        {activeFilters && <div className="spg-filter-summary"><span>{filtered.length} matching {filtered.length === 1 ? 'proposal' : 'proposals'}</span><button type="button" onClick={clearFilters}>Clear filters<X size={13} /></button></div>}
        <div className="spg-register-table-scroll" id="spg-register-results" role="tabpanel" aria-labelledby={`spg-status-${view}`} tabIndex={0} aria-busy={loading}><table data-table-typography="preserve"><thead><tr>{visibleColumns.map(([key, name]) => <th key={key} className={`spg-col-${key}`} aria-sort={sort.key === key ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'}><button type="button" aria-label={`Sort by ${name}`} onClick={() => setSort(previous => ({ key, direction: previous.key === key && previous.direction === 'asc' ? 'desc' : 'asc' }))}>{name}{sort.key === key ? sort.direction === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} /> : <ChevronDown size={12} className="spg-sort-idle" />}</button></th>)}</tr></thead><tbody>
          {!loading && pageRows.map(row => <tr key={proposalRowKey(row)} className={(isPreparationOpportunity(row) ? pendingId === String(row.id) : !pendingId && record?.id === row.id) ? 'spg-selected-row' : ''} aria-selected={isPreparationOpportunity(row) ? pendingId === String(row.id) : !pendingId && record?.id === row.id} onClick={event => { if (!event.target.closest('button,a,input')) select(row); }} onDoubleClick={() => open(row)}>{visibleColumns.map(([key]) => <td key={key} className={`spg-col-${key}`}>{cell(row, key)}</td>)}</tr>)}
          {(loading || !pageRows.length) && <tr><td colSpan={visibleColumns.length}><div className="spg-panel-state">{loading ? <RefreshCw size={28} className="spg-spin" /> : <FileText size={28} />}<h2>{loading ? 'Loading proposals…' : error ? 'Proposals unavailable' : rows.length ? 'No proposals match this view' : 'No proposals yet'}</h2><p>{loading ? 'Loading the complete register.' : error ? 'Retry to load the proposal register.' : rows.length ? 'Change the search or clear the filters.' : 'Create a proposal from an eligible opportunity.'}</p>{activeFilters && !loading && <button type="button" className="spg-button" onClick={clearFilters}>Clear filters</button>}</div></td></tr>}
        </tbody></table></div>
        <footer className="spg-register-footer"><span>{sorted.length ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, sorted.length)} of ${sorted.length}` : '0 proposals'}</span><div className="spg-page-buttons"><button type="button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={17} /></button><span aria-label={`Page ${currentPage} of ${pages}`}>{currentPage}</span><button type="button" aria-label="Next page" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}><ChevronRight size={17} /></button></div><ProposalMenu label="Columns" icon={SlidersHorizontal} className="spg-columns-menu">{columnOptions.map(([key, name]) => <label key={key}><input type="checkbox" checked={columns.includes(key)} disabled={key === 'title'} onChange={event => setColumns(previous => event.target.checked ? [...previous, key] : previous.filter(value => value !== key))} />{name}</label>)}<label>Rows per page<select aria-label="Rows per page" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}>{[5, 10, 25, 50].map(value => <option key={value} value={value}>{value}</option>)}</select></label><button type="button" onClick={onRefresh} disabled={loading}><RefreshCw size={16} />Refresh proposals</button></ProposalMenu></footer>
      </section>
      {pendingId ? <section className="spg-workspace" aria-label="Proposal preparation opportunity">
        {pending ? <><header className="spg-workspace-header"><div className="spg-identity"><div><Link to={`/sales/opportunities?record=${encodeURIComponent(pending.id)}`}>{pending.deal_code}</Link></div><h2>{pending.deal_name}</h2><p>{pending.client_name || 'Client unavailable'}</p><ProposalStatus record={pending} /></div></header>
          <div className="spg-workspace-content"><p>A Go decision is recorded. Prepare the first proposal using this opportunity&apos;s saved client and source facts.</p><dl className="spg-facts"><div><dt>Opportunity owner</dt><dd>{proposalOwner(pending)}</dd></div><div><dt>Submission deadline</dt><dd>{proposalDate(pending.submission_due_date)}</dd></div><div><dt>Proposal revision</dt><dd>Not created</dd></div></dl>
            {!pending.can_create_proposal && <p className="spg-inline-error">{pending.blocked_reason || 'Proposal creation is unavailable.'}</p>}
            {pending.client && <Link to={`/sales/clients?record=${encodeURIComponent(pending.client)}`}>View client</Link>}
          </div><footer className="spg-workspace-footer"><button type="button" className="spg-button spg-primary" disabled={candidateLoading || Boolean(candidateError) || !pending.can_create_proposal} onClick={() => onCreate(pending)}><Plus size={16} />Prepare proposal</button><button type="button" className="spg-button" disabled={candidateLoading} onClick={() => setCandidateRefresh(value => value + 1)}>Refresh eligibility</button></footer></> : <div className="spg-panel-state"><h2>Preparation opportunity unavailable</h2><p>{candidateLoading ? 'Checking current eligibility...' : 'Refresh or select another row. No proposal was created.'}</p><button type="button" className="spg-button" onClick={() => { setPendingId(''); setCandidateRefresh(value => value + 1); }}>Refresh preparation opportunities</button></div>}
      </section> : <SalesProposalWorkspace record={record} loading={recordLoading} error={recordError} onRetry={onRetryRecord} onRefresh={onRefresh} onPrepared={onPrepared} onEdit={onEdit} onOpenFullRecord={() => onOpenFullRecord(record)} onAction={onAction} actions={actions} locked={locked} />}
    </div>
  </div>;
}

SalesProposalRegister.propTypes = { rows: PropTypes.array.isRequired, loading: PropTypes.bool.isRequired, error: PropTypes.string, record: PropTypes.object, recordLoading: PropTypes.bool.isRequired, recordError: PropTypes.string, selectedId: PropTypes.string, onRefresh: PropTypes.func.isRequired, onSelect: PropTypes.func.isRequired, onRetryRecord: PropTypes.func.isRequired, onOpenFullRecord: PropTypes.func.isRequired, onEdit: PropTypes.func.isRequired, onCreate: PropTypes.func.isRequired, onAction: PropTypes.func.isRequired, onPrepared: PropTypes.func.isRequired, actions: PropTypes.array.isRequired, locked: PropTypes.bool.isRequired };
