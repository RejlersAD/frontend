import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, Database, ExternalLink, FileClock, Info, Link2, Loader2, RefreshCw, Search, ShieldCheck, X } from 'lucide-react';
import { toast } from 'react-toastify';
import apiClient from '../../services/api.service';
import * as projectControl from '../../services/projectControl.service';
import { TYPE_LABELS, ISSUE_LABELS, recordKey, referenceText, formatMoney, filterReconciliationRecords, reconciliationSummary, projectCandidates } from './projectReconciliationModel';
import './ProjectReconciliation.css';

const PAGE_SIZE = 12;
const REASONS = { source: 'Verified against source document', code: 'Verified project code in source', owner: 'Confirmed with project owner', exception: 'Project reference needs clarification', other: 'Other reason' };
const asList = value => Array.isArray(value) ? value : value?.results || [];
const dateLabel = value => value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date unavailable';
const errorMessage = (error, fallback) => {
  const detail = error?.response?.data;
  if (typeof detail === 'string') return detail;
  const messages = detail && typeof detail === 'object' ? Object.values(detail).flat() : [];
  return messages.filter(value => typeof value === 'string').join(' ') || fallback;
};

function Metric({ icon: Icon, label, value, note, tone, title }) {
  return <article className={`pcr-metric pcr-${tone}`} title={title}><span className='pcr-metric-icon'><Icon size={22} /></span><div><h2>{label}</h2><strong>{value}</strong><p>{note}</p></div></article>;
}
Metric.propTypes = { icon: PropTypes.elementType.isRequired, label: PropTypes.string.isRequired, value: PropTypes.node, note: PropTypes.string, tone: PropTypes.string, title: PropTypes.string };

function AuditLog({ open, onClose, entries }) {
  const dialogRef = useRef(null);
  useEffect(() => { if (open) dialogRef.current?.showModal(); else dialogRef.current?.close(); }, [open]);
  return <dialog ref={dialogRef} className='pcr-audit' aria-labelledby='pcr-audit-title' onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <header><div><h2 id='pcr-audit-title'>Recent audit log</h2><p>The latest {entries.length} recorded relationship reviews.</p></div><button className='pcr-button pcr-icon-button' type='button' aria-label='Close audit log' onClick={onClose}><X size={18} /></button></header>
    <div className='pcr-audit-entries'>{entries.length ? entries.map(entry => <article key={entry.id}>
      <span className={`pcr-tag ${entry.resolution === 'exception' ? 'pcr-tag-amber' : ''}`}>{entry.resolution === 'exception' ? 'Saved exception' : entry.resolution === 'propagated' ? 'Related record updated' : 'Project linked'}</span>
      <h3>{entry.record_identifier || TYPE_LABELS[entry.record_type] || 'Procurement record'}</h3>
      {entry.resolution !== 'exception' && <p>{entry.previous_enterprise_project_code || 'Unallocated'} <ArrowRight size={13} /> {entry.enterprise_project_code || 'Unallocated'}</p>}
      <p>{entry.reason || 'No review note recorded.'}</p><small>{entry.resolved_by || 'System'} · {dateLabel(entry.created_at)}</small>
    </article>) : <div className='pcr-empty'><FileClock size={30} /><h3>No reviews recorded yet</h3><p>Confirmed links and saved exceptions will appear here.</p></div>}</div>
  </dialog>;
}
AuditLog.propTypes = { open: PropTypes.bool.isRequired, onClose: PropTypes.func.isRequired, entries: PropTypes.arrayOf(PropTypes.object).isRequired };

export default function ProjectReconciliation() {
  const user = useSelector(state => state.rbac?.currentUser || state.auth?.user);
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [loadError, setLoadError] = useState('');
  const [filters, setFilters] = useState({ search: '', type: '', issue: '', currency: '', status: 'unresolved', sort: 'value' });
  const [page, setPage] = useState(1), [selectedKey, setSelectedKey] = useState(null);
  const [projectId, setProjectId] = useState(''), [projectSearch, setProjectSearch] = useState('');
  const [browseProjects, setBrowseProjects] = useState(false), [projectLimit, setProjectLimit] = useState(6);
  const [reasonChoice, setReasonChoice] = useState(''), [reasonNote, setReasonNote] = useState(''), [reviewed, setReviewed] = useState(false);
  const [mode, setMode] = useState('entire'), [wbsNodes, setWbsNodes] = useState([]), [budgets, setBudgets] = useState([]);
  const [wbsId, setWbsId] = useState(''), [budgetId, setBudgetId] = useState(''), [amount, setAmount] = useState(''), [purchaseOrderId, setPurchaseOrderId] = useState('');
  const [choicesLoading, setChoicesLoading] = useState(false), [choicesError, setChoicesError] = useState(''), [choicesRetry, setChoicesRetry] = useState(0);
  const [budgetError, setBudgetError] = useState('');
  const [saving, setSaving] = useState(false), [saveError, setSaveError] = useState(''), [notice, setNotice] = useState('');
  const [sessionLinked, setSessionLinked] = useState(0), [moveNext, setMoveNext] = useState(true), [auditOpen, setAuditOpen] = useState(false);
  const requestSequence = useRef(0), reportRequest = useRef(null), mutationInFlight = useRef(false), resolverRef = useRef(null);

  const loadReport = useCallback(async () => {
    const sequence = ++requestSequence.current;
    reportRequest.current?.abort();
    const controller = new AbortController();
    reportRequest.current = controller;
    setLoading(true); setLoadError('');
    try {
      const response = await apiClient.get('/procurement/projects/relationship-report/', { signal: controller.signal, suppressErrorToast: true });
      if (sequence === requestSequence.current) setData(response.data);
      return response.data;
    } catch (error) {
      if (!controller.signal.aborted && sequence === requestSequence.current) setLoadError(errorMessage(error, 'Could not load the reconciliation report. Please try again.'));
      return null;
    } finally { if (sequence === requestSequence.current) setLoading(false); }
  }, []);
  useEffect(() => { loadReport(); return () => { requestSequence.current += 1; reportRequest.current?.abort(); }; }, [loadReport]);

  const rows = data?.unresolved || [];
  const filtered = useMemo(() => filterReconciliationRecords(data?.unresolved || [], filters), [data, filters]);
  const selected = filtered.find(row => recordKey(row) === selectedKey) || null;
  const selectedIndex = filtered.findIndex(row => recordKey(row) === selectedKey);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visibleRows = filtered.slice((Math.min(page, pages) - 1) * PAGE_SIZE, Math.min(page, pages) * PAGE_SIZE);
  const summary = reconciliationSummary(data, sessionLinked);
  const projects = data?.canonical_projects || [];
  const targetProject = projects.find(project => String(project.id) === projectId) || selected?.suggested_projects?.find(project => String(project.id) === projectId);
  const candidates = projectCandidates(selected, projects, projectSearch, { includeAll: browseProjects });
  const visibleProjects = candidates.slice(0, projectLimit);
  const invoice = selected?.record_type === 'invoice', split = !invoice && mode === 'split';
  const targetOrder = data?.purchase_order_choices?.find(order => String(order.id) === purchaseOrderId);
  const remaining = invoice ? selected?.invoice_match?.remaining_amount ?? selected?.amount : selected?.allocation?.remaining_amount ?? selected?.amount;
  const invoiceFullyAllocated = invoice && Number(remaining) <= 0 && Boolean(selected?.invoice_match?.existing_pos?.length);
  const sourceUrl = selected ? ({
    purchase_requisition: `/procurement/requisitions/${encodeURIComponent(selected.id)}`,
    purchase_order: `/procurement/orders/${encodeURIComponent(selected.id)}`,
    invoice: `/finance/incoming-invoices/${encodeURIComponent(selected.id)}`,
    procurement_project: '/procurement/projects',
  })[selected.record_type] : null;
  const sourceRevision = JSON.stringify([selectedKey, selected?.current_project, selected?.amount, selected?.currency, selected?.reference, selected?.allocation, selected?.invoice_match]);
  const reason = reasonChoice === 'other' ? reasonNote.trim() : reasonChoice ? `${REASONS[reasonChoice]}${reasonNote.trim() ? ` — ${reasonNote.trim()}` : ''}` : '';
  const canEdit = !user?.module_actions || user.module_actions.procurement?.includes('update');
  const canAllocate = !user?.module_actions || user.module_actions.project_control?.includes('create');

  useEffect(() => {
    if (!loading && !saving && selectedKey !== '' && !filtered.some(row => recordKey(row) === selectedKey)) setSelectedKey(filtered.length ? recordKey(filtered[0]) : '');
  }, [filtered, loading, saving, selectedKey]);
  useEffect(() => {
    setProjectId(''); setProjectSearch(''); setReasonChoice(''); setReasonNote(''); setReviewed(false);
    setBrowseProjects(false); setProjectLimit(6);
    setMode('entire'); setWbsId(''); setBudgetId(''); setPurchaseOrderId(''); setAmount(''); setSaveError('');
  }, [selectedKey]);
  // A refreshed source must be reviewed again before using its new identity
  // as the optimistic concurrency guard for a manual link.
  useEffect(() => { setReviewed(false); }, [sourceRevision]);
  useEffect(() => { setProjectLimit(6); }, [projectSearch, browseProjects]);
  useEffect(() => {
    setWbsId(''); setBudgetId(''); setWbsNodes([]); setBudgets([]); setChoicesError(''); setBudgetError('');
    if (!split || !projectId) { setChoicesLoading(false); return undefined; }
    const controller = new AbortController();
    setChoicesLoading(true);
    const options = { signal: controller.signal, suppressErrorToast: true };
    Promise.allSettled([projectControl.listWbsNodes(projectId, options), projectControl.listBudgetAllocations(projectId, options)])
      .then(([nodes, lines]) => {
        if (controller.signal.aborted) return;
        if (nodes.status === 'fulfilled') setWbsNodes(asList(nodes.value));
        else setChoicesError(errorMessage(nodes.reason, 'Could not load WBS choices.'));
        if (lines.status === 'fulfilled') setBudgets(asList(lines.value).filter(line => line.status === 'approved'));
        else setBudgetError('Optional budget lines could not be loaded. You can still save a WBS allocation without a budget line.');
      })
      .finally(() => { if (!controller.signal.aborted) setChoicesLoading(false); });
    return () => controller.abort();
  }, [split, projectId, choicesRetry]);

  const updateFilter = (field, value) => { setFilters(previous => ({ ...previous, [field]: value })); setPage(1); setSelectedKey(null); };
  const selectRecord = (row, reveal = false) => {
    setSelectedKey(recordKey(row)); setNotice('');
    const index = filtered.findIndex(item => recordKey(item) === recordKey(row));
    setPage(Math.floor(Math.max(index, 0) / PAGE_SIZE) + 1);
    if (reveal && window.innerWidth < 1100) requestAnimationFrame(() => {
      const panel = resolverRef.current, container = panel?.closest('main');
      if (container) container.scrollTo({
        top: container.scrollTop + panel.getBoundingClientRect().top - container.getBoundingClientRect().top - 12,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
    });
  };
  const nextRecord = (offset = 1) => { if (filtered[selectedIndex + offset]) selectRecord(filtered[selectedIndex + offset], true); };
  const selectProject = id => { setProjectId(String(id)); setReviewed(false); setSaveError(''); };
  const chooseMode = value => { setMode(value); setReviewed(false); setSaveError(''); setAmount(String(remaining ?? '')); };
  const validReason = Boolean(reason.trim()) && reason.length <= 500;
  const validAmount = Number.isFinite(Number(amount)) && Number(amount) > 0 && Number(amount) <= Number(remaining ?? 0);
  const currencyMismatch = split && targetProject?.currency && selected?.currency && targetProject.currency !== selected.currency;
  const validTarget = invoice ? Boolean(purchaseOrderId) && validAmount : Boolean(projectId) && (!split || (Boolean(wbsId) && validAmount && !choicesLoading && !choicesError && canAllocate && !currencyMismatch));
  const canConfirm = selected && validTarget && validReason && reviewed && (split ? canAllocate : canEdit) && !saving && !loading;

  const submitReview = async action => {
    if (mutationInFlight.current || !selected || !validReason || (action === 'exception' ? !canEdit : !canConfirm)) return;
    mutationInFlight.current = true; setSaving(true); setSaveError(''); setNotice('');
    const source = selected, follow = filtered[selectedIndex + 1] || filtered[selectedIndex - 1];
    try {
      let message, resolved = false;
      if (action === 'exception') {
        await apiClient.post('/procurement/projects/relationship-exception/', { record_type: source.record_type, record_id: source.id, reason });
        message = 'Saved as an exception. The source record and financial values are unchanged.';
        setData(previous => ({ ...previous, unresolved: previous.unresolved.map(row => recordKey(row) === recordKey(source) ? { ...row, exception: { reason, created_at: new Date().toISOString() } } : row) }));
      } else if (split) {
        await projectControl.createCostAllocation({ project: projectId, wbs_node: wbsId, budget_allocation: budgetId || null, source_type: source.record_type, source_id: source.id, amount, notes: reason });
        message = 'Allocation saved for independent approval. The project link remains open for review.';
        setAmount(''); setReviewed(false);
      } else if (invoice) {
        const response = await apiClient.post('/procurement/projects/resolve-invoice-po/', { invoice_id: source.id, purchase_order_id: purchaseOrderId, allocated_amount: amount, reason });
        resolved = response.data.match_status === 'verified';
        message = resolved ? 'Invoice matched and verified against the PO and receipt.' : `PO match saved for review. ${(response.data.exception_codes || []).join(', ').replaceAll('_', ' ') || 'Verification is still pending.'}`;
        setAmount(''); setReviewed(false);
      } else {
        const response = await apiClient.post('/procurement/projects/resolve-relationship/', { record_type: source.record_type, record_id: source.id, enterprise_project_id: projectId, expected_project_id: source.current_project?.id ?? null, reason });
        resolved = response.data.changed !== false;
        message = `Project link confirmed${response.data.propagated ? `; ${response.data.propagated} related record(s) linked` : ''}. Source references and values are unchanged.`;
      }
      if (resolved) {
        setSessionLinked(value => value + 1);
        setData(previous => ({ ...previous, unresolved: previous.unresolved.filter(row => recordKey(row) !== recordKey(source)) }));
      }
      setNotice(message); toast.success(message);
      if (resolved || action === 'exception') setSelectedKey(moveNext && follow ? recordKey(follow) : '');
      await loadReport();
    } catch (error) { setSaveError(errorMessage(error, 'The review could not be saved. Your selections are retained; please try again.')); }
    finally { mutationInFlight.current = false; setSaving(false); }
  };

  const values = summary.values.map(value => formatMoney(value.amount, value.currency, true)).join(' + ') || '—';
  const distinctCurrencies = [...new Set(rows.map(row => row.currency).filter(Boolean))].sort();
  const distinctIssues = [...new Set(rows.map(row => row.reason).filter(Boolean))].sort();
  return <div className='project-reconciliation-workspace'>
    <header className='pcr-header'><div><nav aria-label='Breadcrumb' className='pcr-breadcrumb'><Link to='/procurement'>Procurement</Link><span>/</span><Link to='/procurement/projects/reconciliation'>Project Links</Link><span>/</span><span>Project reconciliation</span></nav><h1>Project Reconciliation</h1><p>Review unmatched procurement records and link them to the correct project.</p></div>
      <div className='pcr-header-actions'><div><button className='pcr-button' type='button' onClick={() => setAuditOpen(true)}><FileClock size={16} />View audit log</button><button className='pcr-button' type='button' onClick={loadReport} disabled={loading || saving}><RefreshCw size={16} className={loading ? 'pcr-spin' : ''} />Refresh</button></div><p>{data?.generated_at ? `Updated ${dateLabel(data.generated_at)}, ${new Date(data.generated_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : loading ? 'Loading current records…' : 'Current reconciliation report'}</p></div>
    </header>
    <section className='pcr-metrics' aria-label='Reconciliation overview'>
      <Metric icon={AlertTriangle} label='Unresolved records' value={data ? summary.unresolved : '—'} note='Requires review' tone='amber' />
      <Metric icon={Link2} label='Suggested matches' value={data ? summary.suggested : '—'} note={summary.complete ? 'Awaiting confirmation' : 'In the loaded records'} tone='blue' />
      <Metric icon={CheckCircle2} label='Safely linked' value={sessionLinked} note='This session' tone='green' />
      <Metric icon={Database} label='Financial value affected' value={values} note={summary.complete ? 'Unresolved value by currency' : 'Loaded records only · by currency'} tone='blue' title={summary.values.map(value => formatMoney(value.amount, value.currency)).join(' + ')} />
    </section>
    <details className='pcr-guide'>
      <summary><Info size={18} /><span><strong>How reconciliation works</strong><span> Connect reporting records to the right project.</span></span><ChevronRight size={17} /></summary>
      <div className='pcr-guide-steps'>
        <div><span>1</span><h3>Review the source</h3><p>Open the PR, PO or invoice and check its project reference and value.</p></div>
        <div><span>2</span><h3>Choose the correct link</h3><p>Compare suggested projects or search the full register. Exact codes are stronger evidence; suggestions still need your confirmation.</p></div>
        <div><span>3</span><h3>Confirm and record</h3><p>Add your reason and confirm the link. The audit log records the review; source documents and amounts stay unchanged.</p></div>
      </div>
      <p className='pcr-guide-note'>Invoices must be matched to a PO and checked against receipts. WBS cost allocations are saved as drafts for independent approval. Opening or refreshing this page does not save links.</p>
    </details>
    {!summary.complete && data && <div className='pcr-message pcr-amber-message'>Showing {summary.sampleCount} of {summary.unresolved} unresolved records. Suggestions and financial totals cover the loaded records.</div>}
    {loadError && <div className='pcr-message pcr-error' role='alert'><AlertTriangle size={17} /><span>{loadError}{data ? ' Displaying the last loaded report.' : ''}</span><button className='pcr-button' type='button' onClick={loadReport} disabled={loading || saving}>Try again</button></div>}
    {notice && <div className='pcr-message pcr-success' role='status'><CheckCircle2 size={17} />{notice}</div>}
    <div className='pcr-workbench'>
      <section className='pcr-card pcr-queue' aria-label='Records requiring review' aria-busy={loading}>
        <div className='pcr-section-heading'><div><span className='pcr-eyebrow'>Work through your records</span><h2>Review queue <span className='pcr-count'>{filtered.length}</span></h2></div></div>
        <fieldset disabled={saving || loading} className='pcr-filters'><legend className='pcr-sr-only'>Filter review queue</legend>
          <select aria-label='Review status' value={filters.status} onChange={event => updateFilter('status', event.target.value)}><option value='unresolved'>Needs review</option><option value='exceptions'>Saved exceptions</option><option value='all'>All review records</option></select>
          <label className='pcr-search pcr-record-search'><Search size={15} /><input aria-label='Search records' value={filters.search} onChange={event => updateFilter('search', event.target.value)} placeholder='Search identifier, legacy code or title' /></label>
          <select aria-label='Record type' value={filters.type} onChange={event => updateFilter('type', event.target.value)}><option value=''>Record type</option>{Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <select aria-label='Issue' value={filters.issue} onChange={event => updateFilter('issue', event.target.value)}><option value=''>Issue</option>{distinctIssues.map(issue => <option key={issue} value={issue}>{ISSUE_LABELS[issue] || issue}</option>)}</select>
          <select aria-label='Currency' value={filters.currency} onChange={event => updateFilter('currency', event.target.value)}><option value=''>Currency</option>{distinctCurrencies.map(currency => <option key={currency}>{currency}</option>)}</select>
          <select aria-label='Sort records' value={filters.sort} onChange={event => updateFilter('sort', event.target.value)}><option value='value'>Value by currency</option><option value='oldest'>Oldest first</option><option value='newest'>Newest first</option><option value='identifier'>Identifier</option></select>
        </fieldset>
        {loading && !data ? <div className='pcr-empty' role='status'><Loader2 className='pcr-spin' size={28} /><h3>Loading reconciliation report…</h3></div>
          : !filtered.length ? <div className='pcr-empty'><CheckCircle2 size={34} /><h3>{loadError ? 'Report unavailable' : rows.length ? 'No records match these filters' : 'All project links are up to date'}</h3><p>{loadError ? 'Retry loading the current report.' : rows.length ? 'Change the filters to continue reviewing.' : 'There are no unresolved records to review.'}</p>{rows.length > 0 && <button className='pcr-button' type='button' onClick={() => { setFilters({ search: '', type: '', issue: '', currency: '', status: 'all', sort: 'value' }); setSelectedKey(null); setPage(1); }}>Clear filters</button>}</div>
          : <div className='pcr-records'>{visibleRows.map(row => <button key={recordKey(row)} type='button' className={`pcr-record ${recordKey(row) === selectedKey ? 'is-selected' : ''}`} aria-label={`Review ${row.identifier}`} aria-pressed={recordKey(row) === selectedKey} onClick={() => selectRecord(row, true)} disabled={saving || loading}>
            <div className='pcr-record-top'><span className='pcr-tag'>{TYPE_LABELS[row.record_type] || row.record_type}</span><span className='pcr-record-money'>{formatMoney(row.amount, row.currency)}</span></div>
            <div className='pcr-record-identity'><strong>{row.identifier || 'Unnumbered record'}</strong><span className='pcr-record-title'>{row.title || 'No description recorded'}</span></div>
            <div className='pcr-record-reference'><span>Source ref: <strong>{referenceText(row.reference) || 'Not recorded'}</strong></span><span>{dateLabel(row.created_at)}</span></div>
            <div className={`pcr-record-issue ${row.reason === 'exact_match_available' ? 'pcr-exact' : ''}`}>{row.reason === 'exact_match_available' ? <Link2 size={14} /> : <AlertTriangle size={14} />}<span>{row.exception ? 'Saved exception' : ISSUE_LABELS[row.reason] || row.reason}{row.allocation?.draft_amount > 0 && <small>Allocation awaiting approval</small>}</span><ChevronRight size={17} className='pcr-row-arrow' /></div>
          </button>)}</div>}
        <footer className='pcr-queue-footer'><span>{filtered.length ? `${(Math.min(page, pages) - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)} of ${filtered.length} records` : '0 records'}<small>Amounts are sorted within each currency.</small></span><div><button type='button' className='pcr-button pcr-icon-button' aria-label='Previous page' disabled={page <= 1 || saving} onClick={() => setPage(value => Math.max(1, value - 1))}><ChevronLeft size={16} /></button><button type='button' className='pcr-button pcr-icon-button' aria-label='Next page' disabled={page >= pages || saving} onClick={() => setPage(value => Math.min(pages, value + 1))}><ChevronRight size={16} /></button></div></footer>
      </section>
      <section ref={resolverRef} className='pcr-card pcr-resolver' aria-label='Resolve project link' aria-busy={saving}>
        <div className='pcr-section-heading'><h2>{invoice ? 'Resolve invoice match' : 'Resolve project link'}</h2><div className='pcr-record-navigation'><span>{selected ? `Record ${selectedIndex + 1} of ${filtered.length}` : 'Select a record'}</span><button className='pcr-button' type='button' aria-label='Previous record' disabled={saving || selectedIndex <= 0} onClick={() => nextRecord(-1)}><ChevronLeft size={15} /><span>Previous</span></button><button className='pcr-button' type='button' aria-label='Next record' disabled={saving || selectedIndex < 0 || selectedIndex >= filtered.length - 1} onClick={() => nextRecord(1)}><span>Next</span><ChevronRight size={15} /></button></div></div>
        {!selected ? <div className='pcr-empty pcr-resolver-empty'><Link2 size={34} /><h3>{rows.length ? 'Choose a record to review' : 'You’re all caught up'}</h3><p>Review its source reference, compare projects and confirm the correct link.</p></div>
          : <><div className='pcr-resolution-body'>
            <div className='pcr-step-heading'><span>1</span><h3>Review source record</h3>{sourceUrl && <Link className='pcr-source-link' to={sourceUrl} target='_blank' rel='noopener noreferrer'>Open source record <ExternalLink size={14} /></Link>}</div>
            <div className='pcr-source'>
              <div className='pcr-source-title'><span className='pcr-tag'>{TYPE_LABELS[selected.record_type]}</span><strong>{selected.identifier}</strong><p>{selected.title || 'No description recorded'}</p></div>
              <dl><div><dt>Source reference</dt><dd>{referenceText(selected.reference) || 'Not recorded'}</dd></div><div><dt>Recorded value</dt><dd>{formatMoney(selected.amount, selected.currency)}</dd></div><div><dt>{invoice ? 'PO verification' : 'Current project'}</dt><dd className={selected.current_project ? '' : 'pcr-amber-text'}>{selected.current_project?.code || (invoice ? 'Needs verification' : 'Unallocated')}</dd></div></dl>
            </div>
            {selected.exception && <div className='pcr-message pcr-amber-message'><AlertTriangle size={17} /><div><strong>Saved exception</strong><p>{selected.exception.reason}</p></div></div>}
            {selected.allocation && (selected.allocation.draft_amount > 0 || selected.allocation.approved_amount > 0) && <div className='pcr-allocation-status'><span>Approved allocation: <strong>{formatMoney(selected.allocation.approved_amount, selected.currency)}</strong></span><span>Awaiting approval: <strong>{formatMoney(selected.allocation.draft_amount, selected.currency)}</strong></span><span>Available: <strong>{formatMoney(remaining, selected.currency)}</strong></span></div>}
            <fieldset disabled={saving || loading || (!canEdit && (invoice || !canAllocate))} className='pcr-resolution-fields'><legend className='pcr-sr-only'>Review project assignment</legend>
              {!invoice ? <>
                <div className='pcr-step-heading'><span>2</span><h3>Choose target project</h3></div>
                <div className='pcr-project-heading'><label className='pcr-search'><Search size={17} /><input aria-label='Search projects' placeholder='Search all projects by code, name or client' value={projectSearch} onChange={event => setProjectSearch(event.target.value)} /></label></div>
                <div className='pcr-project-tabs' role='group' aria-label='Project choices'>
                  <button type='button' className={!browseProjects && !projectSearch && selected.suggested_projects?.length ? 'is-active' : ''} aria-pressed={Boolean(!browseProjects && !projectSearch && selected.suggested_projects?.length)} disabled={!selected.suggested_projects?.length} onClick={() => { setBrowseProjects(false); setProjectSearch(''); }}>Suggested <span>{selected.suggested_projects?.length || 0}</span></button>
                  <button type='button' className={browseProjects || !selected.suggested_projects?.length ? 'is-active' : ''} aria-pressed={Boolean(browseProjects || !selected.suggested_projects?.length)} onClick={() => { setBrowseProjects(true); setProjectSearch(''); }}>All projects <span>{projects.length}</span></button>
                  <small>{projectSearch ? `${candidates.length} search results` : !browseProjects && selected.suggested_projects?.length ? 'Based on source evidence' : 'Project register'}</small>
                </div>
                {!selected.suggested_projects?.length && !projectSearch && <p className='pcr-help'>No evidence-based suggestion is available. Search the project register and verify the code against the source.</p>}
                <div className='pcr-projects' role='radiogroup' aria-label='Target project'>{visibleProjects.map(project => <label className={`pcr-project ${String(project.id) === projectId ? 'is-selected' : ''}`} key={project.id}><input type='radio' name='reconciliation-project' aria-label={`Project ${project.code} ${project.name}`} checked={String(project.id) === projectId} onChange={() => selectProject(project.id)} /><div><div className='pcr-project-title'><strong>{project.code}</strong>{project.match_strength && <span className={`pcr-strength pcr-strength-${project.match_strength}`}>{project.match_strength === 'high' ? 'Strong match' : project.match_strength === 'medium' ? 'Possible match' : 'Review match'}</span>}</div><p>{project.name}</p><small>{[project.client_name, project.status?.replaceAll('_', ' ')].filter(Boolean).join(' · ') || 'Project register'}</small>{Boolean(project.reasons?.length) && <div className='pcr-evidence'>{project.reasons.map(evidence => <span key={evidence}><CheckCircle2 size={12} />{evidence}</span>)}</div>}</div></label>)}</div>
                {candidates.length > visibleProjects.length && <button type='button' className='pcr-button pcr-more-projects' onClick={() => setProjectLimit(value => value + 6)}>Show more projects <span>({visibleProjects.length} of {candidates.length})</span></button>}
                {!candidates.length && <p className='pcr-help'>No projects match this search. Try a different project code or name.</p>}
                {targetProject && <p className='pcr-selected-target'><CheckCircle2 size={16} /><span>Selected: <strong>{targetProject.code}</strong> · {targetProject.name}</span></p>}
                <div className='pcr-allocation-mode'><h3>Review action</h3><label><input type='radio' name='allocation-mode' checked={mode === 'entire'} onChange={() => chooseMode('entire')} />Link entire record</label>{selected.allocation && ['purchase_requisition', 'purchase_order'].includes(selected.record_type) && <label><input type='radio' name='allocation-mode' checked={mode === 'split'} onChange={() => chooseMode('split')} disabled={!canAllocate} />Allocate cost to WBS</label>}</div>
                {split && <><div className='pcr-allocation-fields'><label>Target WBS <span aria-hidden='true'>*</span><select aria-label='Target WBS' value={wbsId} disabled={!projectId || choicesLoading} onChange={event => { setWbsId(event.target.value); setBudgetId(''); setReviewed(false); }}><option value=''>{choicesLoading ? 'Loading WBS…' : 'Select WBS'}</option>{wbsNodes.map(node => <option key={node.id} value={node.id}>{node.code} — {node.name}</option>)}</select></label><label>Allocation amount <span aria-hidden='true'>*</span><input aria-label='Allocation amount' type='number' min='0.01' step='0.01' max={remaining} value={amount} onChange={event => { setAmount(event.target.value); setReviewed(false); }} /><small>Available: {formatMoney(remaining, selected.currency)}</small></label><label className='pcr-budget-field'>Approved budget (optional)<select aria-label='Approved budget' value={budgetId} disabled={!wbsId || choicesLoading} onChange={event => setBudgetId(event.target.value)}><option value=''>No budget line</option>{budgets.filter(budget => String(budget.wbs_node) === wbsId).map(budget => <option key={budget.id} value={budget.id}>{budget.code} — {budget.name}</option>)}</select></label></div>
                  {choicesError && <div className='pcr-message pcr-error' role='alert'>{choicesError}<button className='pcr-button' type='button' onClick={() => setChoicesRetry(value => value + 1)}>Retry WBS choices</button></div>}
                  {budgetError && <p className='pcr-message pcr-amber-message' role='status'>{budgetError}</p>}
                  {currencyMismatch && <p className='pcr-message pcr-amber-message'>The project uses {targetProject.currency}; the source uses {selected.currency}. Choose a project with the same currency for WBS allocation.</p>}
                  {!choicesLoading && projectId && !choicesError && !wbsNodes.length && <p className='pcr-help'>This project has no WBS nodes available. Choose another project or link the entire record.</p>}
                  <p className='pcr-help'>WBS allocations are saved as drafts for a separate approver. The source project link stays in the review queue.</p></>}
              </> : <div className='pcr-invoice-fields'>
                <div className='pcr-step-heading'><span>2</span><h3>Review purchase order match</h3></div>
                {Boolean(selected.invoice_match?.existing_pos?.length) && <div className='pcr-invoice-status'><strong>Existing PO matches</strong><p>{selected.invoice_match.existing_pos.join(', ')}</p><p>{(selected.invoice_match.exception_codes || []).map(code => code.replaceAll('_', ' ')).join(' · ') || 'Verification is pending.'}</p></div>}
                {invoiceFullyAllocated ? <div className='pcr-message pcr-amber-message'><AlertTriangle size={18} /><div><strong>Full invoice value is already allocated</strong><p>Review the existing PO match and receipt exceptions in Finance. Adding another allocation would duplicate the invoice value.</p><Link to={sourceUrl} target='_blank' rel='noopener noreferrer'>Open invoice review <ExternalLink size={13} /></Link></div></div> : <><label>Purchase order <span aria-hidden='true'>*</span><select aria-label='Purchase order' value={purchaseOrderId} onChange={event => { setPurchaseOrderId(event.target.value); setAmount(String(remaining ?? '')); setReviewed(false); }}><option value=''>Select a purchase order</option>{(data?.purchase_order_choices || []).map(order => <option key={order.id} value={order.id}>{order.po_number} — {order.project_code} — {order.vendor_name} — {formatMoney(order.amount, order.currency)}</option>)}</select></label><label>Invoice allocation amount <span aria-hidden='true'>*</span><input aria-label='Invoice allocation amount' type='number' min='0.01' max={remaining} step='0.01' value={amount} onChange={event => { setAmount(event.target.value); setReviewed(false); }} /><small>Available invoice value: {formatMoney(remaining, selected.currency)}</small></label></>}
                <p className='pcr-help'>The PO, receipt and invoice are checked together. A saved match with exceptions still requires review.</p></div>}
              <div className='pcr-step-heading'><span>3</span><h3>Review impact and confirm</h3></div>
              <div className='pcr-review-grid'><div className='pcr-impact'><h3><ShieldCheck size={16} />Preview impact</h3><ul><li>{invoice ? `Invoice will be matched to ${targetOrder?.po_number || 'the selected PO'}.` : split ? `A draft WBS allocation will be created for ${targetProject?.code || 'the selected project'}.` : `Project link changes from ${selected.current_project?.code || 'Unallocated'} to ${targetProject?.code || 'the selected project'}.`}</li><li>Source identifier remains {selected.identifier || 'unchanged'}.</li><li>Source value remains {formatMoney(selected.amount, selected.currency)}.</li><li>{split ? 'A separate approver must approve this allocation.' : invoice ? 'Only verified matches enter actual-cost reporting.' : 'Project Control and Finance reporting use the selected project.'}</li><li>{split || invoice ? 'Saving does not mark this record as fully reconciled.' : 'No ledger posting is changed.'}</li></ul></div>
                <div className='pcr-review-inputs'><label>Reason for manual link <span aria-hidden='true'>*</span><select aria-label='Reason for manual link' value={reasonChoice} onChange={event => { setReasonChoice(event.target.value); setReasonNote(''); }}><option value=''>Select a review reason</option>{Object.entries(REASONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                  {reasonChoice === 'other' && <label className='pcr-review-note'>Review reason<textarea aria-label='Review reason' rows={2} maxLength={500} value={reasonNote} onChange={event => setReasonNote(event.target.value)} placeholder='Explain the reviewed link or exception' /></label>}
                  <label className='pcr-reviewed'><input type='checkbox' checked={reviewed} onChange={event => setReviewed(event.target.checked)} />I reviewed the source and target project</label>
                  <div className='pcr-guard-note'><AlertTriangle size={19} /><span>{split ? 'This saves a draft allocation for independent approval.' : invoice ? 'A PO match must pass verification before it is treated as actual cost.' : 'This updates reporting relationships. It does not alter the original procurement document.'}</span></div>
                </div></div>
            </fieldset>
            {!canEdit && <p className='pcr-message pcr-amber-message'>{canAllocate && !invoice ? 'Project links are read-only. You can save WBS allocations for independent approval.' : 'You have read access. Project updates require procurement update access.'}</p>}
            {saveError && <div className='pcr-message pcr-error' role='alert'><AlertTriangle size={17} /><span>{saveError}</span></div>}
          </div>
            <footer className='pcr-resolver-footer'><label className='pcr-toggle'><input type='checkbox' role='switch' checked={moveNext} onChange={event => setMoveNext(event.target.checked)} disabled={saving} /><span aria-hidden='true' />Move to next after confirmation</label><div className='pcr-resolution-actions'><button className='pcr-button' type='button' onClick={() => nextRecord(1)} disabled={saving || selectedIndex >= filtered.length - 1}>Skip for now</button><button className='pcr-button pcr-secondary' type='button' onClick={() => submitReview('exception')} disabled={saving || loading || !validReason || !canEdit}>Save as exception</button><button className='pcr-button pcr-primary' type='button' onClick={() => submitReview('confirm')} disabled={!canConfirm}>{saving && <Loader2 size={15} className='pcr-spin' />}{invoice ? 'Confirm PO match' : split ? 'Save allocation for approval' : 'Confirm project link'}</button></div></footer>
          </>}
      </section>
    </div>
    <AuditLog open={auditOpen} onClose={() => setAuditOpen(false)} entries={data?.recent_resolutions || []} />
  </div>;
}
