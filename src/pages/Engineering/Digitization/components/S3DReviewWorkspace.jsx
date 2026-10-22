import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { AlertTriangle, ArrowRight, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Columns, FileText, Link2, Loader2, Maximize2, Search, XCircle } from 'lucide-react';
import api from '../../../../services/specCustomizationAPI';
import WorkbookCanvas from './WorkbookCanvas';
import S3DEvidencePanel from './S3DEvidencePanel';
import BuhasaPropertySelect from './BuhasaPropertySelect';
import S3DCandidateDiffs from './S3DCandidateDiffs';
import { resolveBuhasaAttribute } from '../../../../services/buhasaCodelists';

const PAGE_SIZE = 12;
const aliases = [
  { label: 'Component', keys: ['ComponentName', 'Component', 'ShortMaterialDescription', 'Description', 'CommodityType'] },
  { label: 'Size', keys: ['Npd[1]', 'Npd[1]:Primary', 'FirstSizeFrom', 'NominalSize', 'SizeFrom', 'Npd'] },
  { label: 'Schedule', category: 'ScheduleThickness', keys: ['Schedule', 'ScheduleThickness', 'ScheduleThickness[1]', 'ScheduleOrRating', 'Schedule[1]', 'WallThicknessSchedule[1]'] },
  { label: 'Material', category: 'MaterialsGrade', keys: ['MaterialGrade', 'MaterialsGrade', 'MaterialStandard', 'Material'] },
  { label: 'Rating', category: 'PressureRating', keys: ['PressureRating[1]', 'PressureRating[1]:Primary', 'PressureRating', 'Rating1', 'Rating'] },
  { label: 'End connection', category: 'EndPreparation', keys: ['EndConnection', 'EndPreparation', 'EndPreparation[1]', 'EndPreparation[1]:Primary', 'EndPrep1'] },
  { label: 'Flange facing', category: 'FlangeFacing', keys: ['FlangeFacing', 'FlangeFacing[1]'] },
  { label: 'Bolt type', category: 'BoltType', keys: ['BoltType'] },
  { label: 'Spec', keys: ['SpecName', 'Class', 'PipingMaterialsClass'] },
  { label: 'Short code', keys: ['ShortCode', 'ShortMaterialDescription'] },
];
const humanize = value => String(value || '').replaceAll('_', ' ');
const errorMessage = error => error?.response?.data?.error || error?.response?.data?.detail || error?.message || 'The request failed. Try again.';
const matchLoadError = error => {
  const status = error?.response?.status;
  if (status === 404) return 'The matching API is unavailable on the running backend. Reload the local backend with the current S3D routes, then refresh.';
  if (status === 401 || status === 403) return 'Match decisions could not be loaded because access was denied. Sign in again or check project access.';
  return 'Match decisions could not be loaded. Check the backend connection, then refresh to retry.';
};
const shortName = row => row?.component?.sub_type ? `${row.component.sub_type} ${row.component.component_type}` : row?.decision?.pdf_component_name || row?.cells?.ComponentName || row?.cells?.ShortMaterialDescription || row?.cells?.Description || row?.source?.class_code || row?.sheetName || 'Record';
const getIssue = (row, findings) => {
  if (row?.decision?.review_decision === 'rejected') return { label: 'Rejected', tone: 'error', issue: true };
  if (findings.some(item => item.severity === 'high')) return { label: 'Validation error', tone: 'error', issue: true };
  if (['approved', 'remapped'].includes(row?.decision?.review_decision)) return { label: 'Approved', tone: 'success', issue: false };
  const state = row?.decision?.state;
  if (state === 'ambiguous') return { label: 'Ambiguous', tone: 'warning', issue: true };
  if (state === 'unmatched') return { label: 'Unmatched', tone: 'unmatched', issue: true };
  if (state === 'ineligible') return { label: 'Ineligible', tone: 'warning', issue: true };
  if (state === 'invalid_reference') return { label: 'Invalid reference', tone: 'error', issue: true };
  if (findings.length) return { label: 'Warning', tone: 'warning', issue: true };
  if (state === 'unique_match') return { label: 'Review match', tone: 'neutral', issue: true };
  return { label: 'Not reviewed', tone: 'neutral', issue: false };
};
function Badge({ item, suffix = '' }) {
  const Icon = ['success', 'unmatched'].includes(item.tone) ? CheckCircle2 : item.tone === 'error' ? XCircle : AlertTriangle;
  return <span className={`s3d-badge s3d-badge--${item.tone}`}><Icon />{item.label}{suffix}</span>;
}
Badge.propTypes = { item: PropTypes.object.isRequired, suffix: PropTypes.string };

const S3DReviewWorkspace = forwardRef(function S3DReviewWorkspace({ job, documentMeta, onStatusChange, onLinkSource, onRefreshReferences }, ref) {
  const [workbook, setWorkbook] = useState('spec');
  const [data, setData] = useState(null);
  const [decisions, setDecisions] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [referenceError, setReferenceError] = useState('');
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState('');
  const [sheet, setSheet] = useState('all');
  const [selectedId, setSelectedId] = useState('');
  const [checked, setChecked] = useState(new Set());
  const [page, setPage] = useState(1);
  const [detailTab, setDetailTab] = useState('properties');
  const [editMode, setEditMode] = useState(true);
  const [hidden, setHidden] = useState(new Set());
  const [columnMenu, setColumnMenu] = useState(false);
  const [grid, setGrid] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [lastSaved, setLastSaved] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [candidate, setCandidate] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [validation, setValidation] = useState(null);
  const [validating, setValidating] = useState(false);
  const [activeSource, setActiveSource] = useState(null);
  const pending = useRef(new Map());
  const inflight = useRef(null);
  const workspace = useRef(null);
  const columns = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(''); setSelectedId('');
    Promise.allSettled([api.getWorkbookPreview(job.id, workbook), api.listMatchDecisions({ job: job.id }), api.getJobClasses(job.id)]).then(results => {
      if (cancelled) return;
      const [preview, matches, piping] = results;
      if (preview.status === 'fulfilled') setData(preview.value);
      else { setData(null); setError(errorMessage(preview.reason)); }
      setDecisions(matches.status === 'fulfilled' ? matches.value.items || [] : []);
      setReferenceError(matches.status === 'rejected' ? matchLoadError(matches.reason) : '');
      setClasses(piping.status === 'fulfilled' ? (Array.isArray(piping.value) ? piping.value : piping.value.items || piping.value.results || []) : []);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [job.id, workbook, retry]);
  useEffect(() => {
    if (!columnMenu) return undefined;
    const close = event => { if (!columns.current?.contains(event.target) || event.key === 'Escape') setColumnMenu(false); };
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', close);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close); };
  }, [columnMenu]);

  const records = useMemo(() => {
    const all = (data?.sheets || []).flatMap(item => (item.rows || []).map(row => ({ ...row, sheetName: item.name, id: `${item.name}:${row.row_key}` })));
    const extracted = all.filter(row => row.source?.component_id || row.source?.class_id);
    const selectedSheet = sheet !== 'all' ? all.filter(row => row.sheetName === sheet) : null;
    // Static template rows belong to their named sections/full grid, not the
    // extracted-record queue when a run produced no source-bound records.
    const chosen = selectedSheet || extracted;
    const byIdentity = new Map();
    for (const row of chosen) {
      const identity = selectedSheet ? row.id : row.source?.component_id || row.source?.class_id || row.id;
      const score = (row.source?.component_id ? 100 : 0) + (row.match_decision ? 10 : 0) + (row.sheetName === 'PipingCommodityFilter' ? 5 : 0);
      if (!byIdentity.has(identity) || score > byIdentity.get(identity).score) byIdentity.set(identity, { ...row, score });
    }
    return Array.from(byIdentity.values()).map(row => {
      const decision = decisions.find(item => item.id === row.match_decision?.id);
      const pc = classes.find(item => item.id === row.source?.class_id);
      const component = selectedClass?.id === row.source?.class_id ? selectedClass?.components?.find(item => item.id === row.source?.component_id) : null;
      const findings = (validation?.issues || []).filter(item => item.row_key === row.row_key && item.sheet_name === row.sheetName);
      const result = { ...row, decision, pipingClass: pc, component, findings };
      return { ...result, issue: getIssue(result, findings) };
    });
  }, [data, sheet, classes, decisions, selectedClass, validation]);
  const filtered = useMemo(() => records.filter(row => `${shortName(row)} ${row.source?.class_code || ''} ${Object.values(row.cells || {}).join(' ')} ${row.issue.label}`.toLowerCase().includes(search.toLowerCase())), [records, search]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = filtered.find(row => row.id === selectedId) || filtered.find(row => row.decision?.state === 'ambiguous') || filtered[0] || null;
  const visible = filtered.slice((Math.min(page, pages) - 1) * PAGE_SIZE, Math.min(page, pages) * PAGE_SIZE);
  const index = current ? filtered.findIndex(row => row.id === current.id) : -1;
  const issueCount = records.filter(row => row.issue.issue).length;
  useEffect(() => { if (current?.id) setChecked(previous => new Set([...previous, current.id])); }, [current?.id]);
  const pcId = current?.source?.class_id;
  useEffect(() => {
    setSelectedClass(null);
    if (!pcId) return undefined;
    let cancelled = false;
    api.getClass(pcId).then(value => { if (!cancelled) setSelectedClass(value); }).catch(() => {});
    return () => { cancelled = true; };
  }, [pcId]);
  useEffect(() => { setPage(1); }, [search, sheet, workbook]);
  useEffect(() => { setCandidate(current?.decision?.discriminators_matched?.codelists?.selected_candidate_id || (current?.decision?.discriminators_matched?.codelists ? current?.decision?.state === 'unique_match' ? current.decision.candidates?.[0]?.candidate_id || '' : '' : current?.decision?.final_commodity_code || current?.decision?.matched_commodity_code || '')); }, [current?.id, current?.decision]);
  useEffect(() => {
    onStatusChange({ records: records.length, issues: issueCount, saveStatus, lastSaved, sheets: data?.sheets?.length ?? null,
      sourceLinked: Boolean(current?.decision?.discriminators_matched?.source_reference) });
  }, [records.length, issueCount, saveStatus, lastSaved, data?.sheets?.length, onStatusChange, current?.decision]);

  const saveChanges = useCallback(async () => {
    if (inflight.current) { await inflight.current; if (pending.current.size) return saveChanges(); return; }
    const cells = Array.from(pending.current.values());
    if (!cells.length) return;
    setSaveStatus('saving'); setError('');
    const operation = (async () => {
      try {
        await api.batchSaveWorkbookCells(job.id, cells);
        const saved = {};
        for (const cell of cells) {
          const key = `${cell.workbook}:${cell.sheet_name}:${cell.row_key}:${cell.column_name}`;
          if (pending.current.get(key)?.value === cell.value) { pending.current.delete(key); saved[key] = cell.value; }
        }
        setData(previous => previous ? { ...previous, sheets: previous.sheets.map(item => ({ ...item, rows: item.rows.map(row => ({ ...row,
          cells: Object.fromEntries(Object.entries(row.cells).map(([column, value]) => [column, saved[`${workbook}:${item.name}:${row.row_key}:${column}`] ?? value])),
        })) })) } : previous);
        setDrafts(previous => Object.fromEntries(Object.entries(previous).filter(([key, value]) => !Object.hasOwn(saved, key) || saved[key] !== value)));
        setSaveStatus(pending.current.size ? 'unsaved' : 'saved'); setLastSaved(new Date().toISOString());
      } catch (reason) { setSaveStatus('error'); setError(errorMessage(reason)); throw reason; }
    })();
    inflight.current = operation;
    try { await operation; } finally { inflight.current = null; }
  }, [job.id, workbook]);
  useImperativeHandle(ref, () => ({ saveChanges }), [saveChanges]);
  const switchWorkbook = async value => { try { await saveChanges(); setWorkbook(value); setSheet('all'); setValidation(null); } catch { /* Preserve unsaved input. */ } };
  const changeValue = (column, value) => {
    const key = `${workbook}:${current.sheetName}:${current.row_key}:${column}`;
    const cell = { workbook, sheet_name: current.sheetName, row_key: current.row_key, column_name: column, value };
    pending.current.set(key, cell); setDrafts(previous => ({ ...previous, [key]: value })); setSaveStatus('unsaved'); setValidation(null);
  };
  const selectRow = row => { setSelectedId(row.id); setChecked(previous => { const next = new Set(previous); next.add(row.id); return next; }); };
  const nextRow = direction => {
    const target = filtered[Math.max(0, Math.min(filtered.length - 1, index + direction))];
    if (target) { setSelectedId(target.id); setPage(Math.floor(filtered.indexOf(target) / PAGE_SIZE) + 1); }
  };
  const nextIssue = filtered.slice(index + 1).find(row => row.issue.issue);
  const advanceIssue = () => { if (nextIssue) { selectRow(nextIssue); setPage(Math.floor(filtered.indexOf(nextIssue) / PAGE_SIZE) + 1); } };
  const canConfirm = Boolean(current?.decision && candidate && !reviewing && ['unique_match', 'ambiguous'].includes(current.decision.state)
    && !Object.values(current.decision.discriminators_matched?.codelists?.attributes || {}).some(value => ['UNMAPPED_CODELIST', 'AMBIGUOUS'].includes(value.status)));
  const review = async (action, advance = false) => {
    if (!current?.decision || reviewing || (action === 'approved' && !canConfirm)) return;
    setReviewing(true); setError('');
    try {
      await saveChanges();
      const selected = current.decision.candidates?.find(item => (item.candidate_id || item.commodity_code) === candidate);
      const source = activeSource?.recordId === current.id ? activeSource.reference : null;
      const updated = await api.reviewMatchDecision({ decision_id: current.decision.id, review_decision: action, final_commodity_code: action === 'approved' ? selected?.commodity_code || candidate : '', ...(selected?.candidate_id ? { candidate_id: selected.candidate_id } : {}),
        ...(action === 'approved' && source?.page ? { source_reference: source } : {}) });
      setDecisions(previous => previous.map(item => item.id === updated.id ? updated : item));
      setLastSaved(new Date().toISOString()); setSaveStatus('saved'); onRefreshReferences?.();
      try { setData(await api.getWorkbookPreview(job.id, workbook)); }
      catch { setError('The review was saved, but the workbook could not be refreshed. Refresh to load its current values.'); }
      if (advance) advanceIssue();
    } catch (reason) { setError(errorMessage(reason)); } finally { setReviewing(false); }
  };
  const normalizeProperty = async (field, entry) => {
    if (!current || reviewing) return;
    setReviewing(true); setError('');
    try {
      await saveChanges();
      if (current.decision) {
        const updated = await api.reviewMatchDecision({ decision_id: current.decision.id, review_decision: 'normalized', codelist_selections: { [field.category]: entry } });
        setDecisions(previous => previous.map(item => item.id === updated.id ? updated : item));
        setCandidate('');
      } else if (field.column) {
        changeValue(field.column, String(entry.code));
        await saveChanges();
      }
      setSaveStatus('saved'); setLastSaved(new Date().toISOString()); setValidation(null); onRefreshReferences?.();
    } catch (reason) { setError(errorMessage(reason)); setSaveStatus('error'); throw reason; }
    finally { setReviewing(false); }
  };
  const validate = async () => {
    setValidating(true); setError('');
    try { await saveChanges(); setValidation(await api.validateWorkbook(job.id, { workbook_scope: workbook, active_workbook: workbook })); }
    catch (reason) { setError(errorMessage(reason)); } finally { setValidating(false); }
  };
  const fields = aliases.map(field => {
    const column = field.keys.find(key => Object.hasOwn(current?.cells || {}, key));
    const fallback = { Component: shortName(current), Material: current?.decision?.material_grade || current?.pipingClass?.material_grade,
      Rating: current?.decision?.pressure_rating || current?.pipingClass?.pressure_rating, Size: current?.decision?.nominal_size,
      'End connection': current?.decision?.end_connection, 'Flange facing': current?.pipingClass?.flange_facing,
      'Bolt type': current?.component?.component_type === 'bolt' ? current.component.sub_type : '', Schedule: current?.component?.schedule_or_rating, Spec: current?.source?.class_code }[field.label];
    const value = column ? drafts[`${workbook}:${current.sheetName}:${current.row_key}:${column}`] ?? current.cells[column] : fallback || '';
    const normalized = field.category ? current?.decision?.discriminators_matched?.codelists?.attributes?.[field.category]
      || resolveBuhasaAttribute(field.category, fallback || value, { catalog: !fallback && Boolean(column) }) : null;
    return { ...field, column, value: String((field.category ? normalized?.raw : value) ?? ''), normalized, entry: normalized?.status === 'RESOLVED' ? normalized.candidates?.[0] : null };
  });
  const sourcePages = selectedClass?.source_pages || current?.pipingClass?.source_pages || [];
  const normalizedAttributes = Object.fromEntries(fields.filter(field => field.category).map(field => [field.category, field.normalized]));
  const savedReference = current?.decision?.discriminators_matched?.source_reference;
  const suppliedReference = current?.source?.reference || current?.source_reference || current?.component?.source_reference || savedReference;
  const sourcePage = suppliedReference?.page || sourcePages.find(value => Number.isInteger(value) && value > 0) || null;
  const sourceReference = useMemo(() => {
    if (!sourcePage) return null;
    return { page: sourcePage, ...(suppliedReference?.table_id ? { table_id: suppliedReference.table_id } : {}),
      ...(Array.isArray(suppliedReference?.bbox) && suppliedReference.bbox.length === 4
        ? { bbox: suppliedReference.bbox, coordinate_space: suppliedReference.coordinate_space || 'pdf_points' } : {}) };
  }, [sourcePage, suppliedReference]);
  const activeReferenceChanged = useCallback(reference => setActiveSource(previous => previous && previous.recordId === current?.id && JSON.stringify(previous.reference) === JSON.stringify(reference) ? previous : { recordId: current?.id, reference }), [current?.id]);
  const linked = Boolean(savedReference);
  const linkSource = () => onLinkSource({ page: sourcePage, linked });
  const detailKeyDown = event => {
    if (event.defaultPrevented || event.altKey || event.metaKey) return;
    if (event.key === 'Escape') { event.preventDefault(); setCandidate(''); return; }
    if (reviewing) return;
    if (event.target.closest('input:not([type="radio"]), select, textarea, [contenteditable="true"]')) return;
    if (/^[123]$/.test(event.key) && !event.ctrlKey) {
      const selected = current?.decision?.candidates?.[Number(event.key) - 1];
      if (selected) { event.preventDefault(); setCandidate(selected.candidate_id || selected.commodity_code); }
    }
    if (event.key === 'Enter' && (!event.target.closest('button') || event.ctrlKey || event.target.closest('.s3d-confirm-match'))) { event.preventDefault(); if (canConfirm) void review('approved', true); }
  };

  if (grid) return <div className="s3d-legacy-grid"><button type="button" className="s3d-text-button" onClick={() => setGrid(false)}><ChevronLeft /> Back to review workspace</button><WorkbookCanvas job={job} variant="hub" /></div>;
  return <div className="s3d-review" ref={workspace}>
    <div className="s3d-review-toolbar">
      <div className="s3d-workbook-switch" role="group" aria-label="Workbook">{['spec', 'cat'].map(value => <button type="button" key={value} aria-pressed={workbook === value} onClick={() => switchWorkbook(value)}>{value.toUpperCase()}</button>)}</div>
      <span className="s3d-toolbar-divider" />
      <div className="s3d-sheet-picker"><FileText /><select aria-label="Workbook section" value={sheet} onChange={event => { if (event.target.value === '__grid__') { saveChanges().then(() => setGrid(true)).catch(() => {}); } else setSheet(event.target.value); }}><option value="all">Piping components</option>{data?.sheets?.map(item => <option key={item.name} value={item.name}>{item.name}</option>)}<option value="__grid__">Open full workbook grid</option></select><ChevronDown /></div>
      <label className="s3d-search"><Search /><input type="search" aria-label="Search records" placeholder="Search records..." value={search} onChange={event => setSearch(event.target.value)} /></label>
      <div className="s3d-columns-control" ref={columns}><button type="button" className="s3d-button" onClick={() => setColumnMenu(value => !value)} aria-expanded={columnMenu}><Columns /> Columns</button>{columnMenu && <div className="s3d-columns-menu">{['Issue', 'Confidence'].map(value => <label key={value}><input type="checkbox" checked={!hidden.has(value)} onChange={() => setHidden(previous => { const next = new Set(previous); if (next.has(value)) next.delete(value); else next.add(value); return next; })} />{value}</label>)}<button type="button" className="s3d-text-button" onClick={() => { saveChanges().then(() => setGrid(true)).catch(() => {}); setColumnMenu(false); }}>Edit all workbook columns <ArrowRight /></button></div>}</div>
      <span className="s3d-toolbar-divider" />
      <button type="button" className="s3d-edit-toggle" role="switch" aria-checked={editMode} onClick={() => setEditMode(value => !value)}><span />Edit mode</button>
      <span className={`s3d-save-indicator s3d-save-indicator--${saveStatus}`}>{saveStatus === 'saving' ? <Loader2 className="s3d-spin" /> : saveStatus === 'error' ? <AlertTriangle /> : <CheckCircle2 />}{saveStatus === 'saving' ? 'Saving…' : saveStatus === 'error' ? 'Save failed' : saveStatus === 'unsaved' ? 'Unsaved changes' : 'Saved'}</span>
      <button type="button" className="s3d-button s3d-fullscreen" onClick={() => workspace.current?.requestFullscreen?.().catch(() => {})}><Maximize2 /> Full screen</button>
    </div>
    {(error || referenceError) && <div className="s3d-inline-error" role="alert">{error || referenceError}<button type="button" onClick={() => setRetry(value => value + 1)}>Refresh</button></div>}
    <div className="s3d-review-columns">
      <section className="s3d-panel s3d-queue" aria-label="Review queue"><div className="s3d-panel-heading"><h2>Review Queue</h2><span>{issueCount} {issueCount === 1 ? 'issue' : 'issues'}</span></div>
        <div className="s3d-queue-scroll"><table><thead><tr><th aria-label="Selection" /><th>Record</th>{!hidden.has('Issue') && <th>Issue</th>}{!hidden.has('Confidence') && <th>Confidence</th>}</tr></thead><tbody>
          {visible.map(row => <tr key={row.id} className={current?.id === row.id ? 'is-selected' : ''} onClick={() => selectRow(row)}><td><input type="checkbox" aria-label={`Select ${shortName(row)}`} checked={checked.has(row.id)} onClick={event => event.stopPropagation()} onChange={() => setChecked(previous => { const next = new Set(previous); if (next.has(row.id)) next.delete(row.id); else next.add(row.id); return next; })} /></td><td><button type="button" title={`${row.source?.class_code || ''} · ${shortName(row)}`} onClick={() => selectRow(row)}>{row.source?.class_code && <span>{row.source.class_code} · </span>}{shortName(row)}</button></td>{!hidden.has('Issue') && <td><Badge item={row.issue} /></td>}{!hidden.has('Confidence') && <td className="s3d-confidence" title="Match rankings are not calibrated probabilities.">—</td>}</tr>)}
        </tbody></table>{loading && <div className="s3d-queue-empty" role="status"><Loader2 className="s3d-spin" /> Loading records…</div>}{!loading && !filtered.length && <div className="s3d-queue-empty"><FileText /><p>{search ? 'No records match your search.' : 'No extracted records are available in this workbook.'}</p><button type="button" className="s3d-text-button" onClick={() => setGrid(true)}>Open workbook grid</button></div>}</div>
        <div className="s3d-queue-footer"><span>{filtered.length ? `${(Math.min(page, pages) - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)}` : '0'} of {filtered.length}</span><div><button type="button" className="s3d-icon-button" aria-label="Previous queue page" disabled={page <= 1} onClick={() => setPage(value => value - 1)}><ChevronLeft /></button><span className="s3d-page-number">{Math.min(page, pages)}</span><button type="button" className="s3d-icon-button" aria-label="Next queue page" disabled={page >= pages} onClick={() => setPage(value => value + 1)}><ChevronRight /></button></div></div>
      </section>
      <section className="s3d-panel s3d-record-details" aria-label="Record details" tabIndex={0} aria-keyshortcuts="1 2 3 Enter Control+Enter Escape" onKeyDown={detailKeyDown}><div className="s3d-panel-heading"><h2>Record Details</h2><div className="s3d-record-navigation"><button type="button" className="s3d-icon-button" aria-label="Previous record" disabled={index <= 0} onClick={() => nextRow(-1)}><ChevronLeft /></button><button type="button" className="s3d-icon-button" aria-label="Next record" disabled={index < 0 || index >= filtered.length - 1} onClick={() => nextRow(1)}><ChevronRight /></button></div></div>
        {current ? <><div className="s3d-record-title"><h3>{current.source?.class_code ? `${current.source.class_code} / ` : ''}{shortName(current)}</h3><Badge item={current.issue} suffix={current.decision?.state === 'ambiguous' && !current.decision.review_decision ? ' match' : ''} /></div>
          <div className="s3d-detail-tabs" role="tablist" aria-label="Record detail views">{['properties', 'matching', 'validation'].map(value => <button type="button" key={value} role="tab" aria-selected={detailTab === value} onClick={() => setDetailTab(value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}</div>
          <div className="s3d-detail-scroll">
            {detailTab === 'properties' && <div className="s3d-properties">{fields.map(field => <div className="s3d-property" key={field.label}>
              <label htmlFor={`s3d-property-${field.label.replaceAll(' ', '-')}`}>{field.label}</label>
              {field.category ? ((editMode || ['Unmatched', 'Validation error'].includes(current.issue.label))
                ? <BuhasaPropertySelect key={`${current.id}:${field.category}`} id={`s3d-property-${field.label.replaceAll(' ', '-')}`} label={field.label} category={field.category} value={field.value} entry={field.entry} disabled={reviewing || (!current.decision && !field.column)} onSelect={entry => normalizeProperty(field, entry)} />
                : <output id={`s3d-property-${field.label.replaceAll(' ', '-')}`}>{field.entry ? `${field.entry.shortDesc} (${field.entry.code})` : field.value || 'Not supplied'}</output>)
                : <input id={`s3d-property-${field.label.replaceAll(' ', '-')}`} value={field.value} placeholder="Not available" maxLength={2000} readOnly={!editMode || !field.column} onChange={event => changeValue(field.column, event.target.value)} onBlur={() => { if (pending.current.size) saveChanges().catch(() => {}); }} />}
              <button type="button" className="s3d-property-link" onClick={linkSource} aria-label={`View ${field.label.toLowerCase()} source`}><Link2 /></button>
              {field.normalized && ['UNMAPPED_CODELIST', 'AMBIGUOUS'].includes(field.normalized.status) && <small className="s3d-property-warning">{field.normalized.status === 'AMBIGUOUS' ? 'Choose a canonical value to resolve ambiguity.' : 'Unmapped codelist. Choose a canonical value.'}</small>}
            </div>)}</div>}
            {detailTab === 'matching' && <div className="s3d-match-explanation"><h4>Match evidence</h4><p>{current.decision ? humanize(current.decision.state) : 'No persisted match decision for this record.'}</p><p>{current.decision?.discriminators_matched?.reason || 'Select a catalog candidate and confirm it explicitly. Ranking values are review aids, not calibrated probabilities.'}</p></div>}
            {detailTab === 'validation' ? <div className="s3d-validation"><button type="button" className="s3d-button" disabled={validating} onClick={validate}>{validating ? <Loader2 className="s3d-spin" /> : <CheckCircle2 />}{validating ? 'Validating…' : 'Validate workbook'}</button><p>{validation ? `${validation.issues_total || 0} workbook findings` : 'Validation has not been run in this review session.'}</p>{current.findings.map((item, i) => <div className="s3d-validation-issue" key={i}><Badge item={{ label: humanize(item.severity), tone: item.severity === 'high' ? 'error' : 'warning' }} /><p>{item.message}</p><small>{item.column_name}</small></div>)}</div> : <div className="s3d-candidates"><h4>Suggested catalog matches</h4>{current.decision?.candidates?.length ? current.decision.candidates.map((item, i) => <label className={`s3d-candidate ${candidate === (item.candidate_id || item.commodity_code) ? 'is-selected' : ''}`} key={`${item.commodity_code}-${i}`}><input type="radio" disabled={reviewing} name="s3d-candidate" value={item.candidate_id || item.commodity_code} checked={candidate === (item.candidate_id || item.commodity_code)} onChange={() => setCandidate(item.candidate_id || item.commodity_code)} /><span className="s3d-candidate-content"><strong>{item.commodity_code}</strong><span>{item.description || 'Catalog candidate'}</span><S3DCandidateDiffs candidate={item} attributes={normalizedAttributes} /></span>{Number.isFinite(item.ranking_score) && <span className="s3d-candidate-rank"><strong>{item.ranking_score}</strong><small>rank</small></span>}</label>) : <div className="s3d-no-candidates"><Search /><p>{current.decision ? 'No catalog candidates satisfy the supplied criteria.' : 'Run matching with a reference workbook to see catalog candidates.'}</p></div>}</div>}
          </div>
          {current.decision?.discriminators_matched?.codelists && <p className="text-sm text-amber-800">Review canonical BUHASA values and resolve unmapped or ambiguous fields in the Matching tab before confirming a catalog row.</p>}
          <div className="s3d-record-actions"><button type="button" className="s3d-button" disabled={reviewing || !current.decision} onClick={() => review('rejected')}><XCircle /> Reject match</button><button type="button" className="s3d-button s3d-button--primary s3d-confirm-match" disabled={!canConfirm} onClick={() => review('approved')}>{reviewing ? <Loader2 className="s3d-spin" /> : <Check />} Confirm match</button><button type="button" className="s3d-text-button" disabled={!nextIssue} onClick={advanceIssue}>Next issue <ArrowRight /></button></div>
        </> : <div className="s3d-queue-empty"><FileText /><p>Select a record to view its properties, matches and validation.</p></div>}
      </section>
      <S3DEvidencePanel documentMeta={documentMeta} sourceReference={sourceReference} onActiveReferenceChange={activeReferenceChanged} sourcePage={sourcePage} quote={current?.component?.description || current?.decision?.pdf_component_name || ''} sourceLinked={linked} onLinkSource={linkSource} />
    </div>
  </div>;
});

S3DReviewWorkspace.propTypes = { job: PropTypes.object.isRequired, documentMeta: PropTypes.object, onStatusChange: PropTypes.func.isRequired, onLinkSource: PropTypes.func.isRequired, onRefreshReferences: PropTypes.func };
export default S3DReviewWorkspace;
