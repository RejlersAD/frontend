/* eslint-disable react/prop-types */
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Database,
  Download,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  MoreVertical,
  Plus,
  RefreshCw,
  Save,
  Search,
  SlidersHorizontal,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { ProjectFormModal, ProjectSwitcher } from '../../../../components/ProjectOrganizer';
import { PROJECT_ORGANIZER_CONFIG } from '../../../../config/projectOrganizer.config';

const ACTIVE_PROJECT_STORAGE_KEY = 'hmbExtractorActiveProject';
const THEME = {
  ...PROJECT_ORGANIZER_CONFIG.defaultTheme,
  accent: '#175cd3',
  accentAlt: '#0b4fb3',
  accentSoft: '#eff6ff',
  accentBorder: '#bfd4f5',
};

const formatValue = (value) => {
  if (value === '' || value == null) return '—';
  const text = String(value).trim();
  const number = Number(text);
  if (!Number.isFinite(number) || !/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(text)) return text;
  return String(Math.round(number * 10000) / 10000);
};

const HMBComparisonWorkspace = ({ context: c }) => {
  const activeProfile = c.templateProfiles.find((profile) => profile.id === c.selectedTemplateProfileId);
  const storedFiles = c.casePreviewFileOptions.map((filename) => ({ filename, persisted: true }));
  const pendingFiles = c.caseFiles.map((file) => ({ filename: file.name, file, persisted: false }));
  const analysedFiles = (c.caseAnalysisResult?.files || []).map((file) => ({ ...file, persisted: false }));
  const caseCards = analysedFiles.length ? analysedFiles : pendingFiles.length ? pendingFiles : storedFiles;
  const caseNames = c.comparisonData?.case_names || c.projectSummary?.cases || [];
  const sections = [...new Set((c.comparisonData?.rows || []).map((row) => row.section).filter(Boolean))];
  const visibleRows = (c.comparisonData?.rows || []).filter((row) => {
    const query = c.comparisonQuery.trim().toLowerCase();
    const queryMatch = !query || [row.section, row.property, row.unit, c.comparisonStreamId]
      .some((value) => String(value || '').toLowerCase().includes(query));
    const sectionMatch = c.comparisonSection === 'all' || row.section === c.comparisonSection;
    const populated = caseNames.map((name) => row.values?.[name]).filter((value) => value !== '' && value != null);
    const differs = new Set(populated.map(String)).size > 1 || populated.length !== caseNames.length;
    return queryMatch && sectionMatch && (!c.differencesOnly || differs);
  });
  const exceptionCount = (c.comparisonData?.conflicts?.length || 0)
    + c.templateAlignmentAudit.missingCount
    + c.templateAlignmentAudit.unitMismatchCount
    + c.importExceptions.reduce((total, item) => total + item.unmatched_streams
      + item.duplicate_stream_matches + item.unit_mismatches + item.unmapped_properties
      + item.composition_sum_warnings, 0);
  const blockingCount = (c.caseAnalysisResult?.files || []).reduce((total, file) => total + (file.blocking_errors || 0), 0)
    + (c.comparisonData?.conflicts?.length || 0);
  const hasImportedCases = Boolean((c.projectSummary?.total_records || 0) > 0);
  const hasReviewData = Boolean(c.comparisonData?.rows?.length);
  const completedChecks = c.reviewChecklist.filter((item) => item.done).length
    + (c.templateAlignmentAudit.total > 0 && c.templateAlignmentAudit.missingCount === 0 && c.templateAlignmentAudit.unitMismatchCount === 0 ? 1 : 0)
    + (hasReviewData && !(c.comparisonData?.conflicts?.length) ? 1 : 0);
  const totalChecks = c.reviewChecklist.length + 2;
  const reviewPercent = Math.round((completedChecks / totalChecks) * 100);
  const exportBlocked = c.comparisonBusy || !hasReviewData || !c.outputTemplate || blockingCount > 0;
  const workflowSteps = [
    { label: 'Upload cases', detail: `${caseCards.length || c.projectSummary?.case_count || 0} cases available`, done: caseCards.length > 0 || hasImportedCases },
    { label: 'Validate extraction', detail: hasImportedCases ? `${c.projectSummary.total_records} values extracted` : c.caseAnalysisResult ? 'Preview ready for confirmation' : 'Awaiting analysis', done: hasImportedCases },
    { label: 'Align streams & units', detail: c.selectedTemplateProfileId ? `${c.projectSummary?.stream_count || 0} streams detected` : 'Template required', done: hasImportedCases && Boolean(c.selectedTemplateProfileId) },
    { label: 'Review comparison', detail: hasReviewData ? 'Review exceptions and results' : 'Select a stream to compare', active: c.workspaceView === 'review' },
    { label: 'Export', detail: c.outputTemplate ? 'Controlled template ready' : 'Output template required' },
  ];

  const switchProject = (project) => { c.setActiveProject(project); c.setProjectConfirmed(true); };
  const clearProject = () => { c.clearActiveProject(); c.setProjectConfirmed(false); };
  const openTemplate = () => c.setWorkspaceView('template');

  return (
    <div className="hmb-comparison-page">
      <input ref={c.caseFileInputRef} className="hmb-visually-hidden" type="file" accept=".xlsx,.xlsm,.csv,.pdf" multiple onChange={c.handleCaseFileSelection} />

      <header className="hmb-page-header">
        <nav className="hmb-breadcrumbs" aria-label="Breadcrumb"><span>Home</span><ChevronRight /><span>Engineering</span><ChevronRight /><span>Process</span><ChevronRight /><strong>H&amp;MB Comparison</strong></nav>
        <div className="hmb-title-row">
          <div><h1>Heat &amp; Material Balance Comparison</h1><p>Consolidate stream data from multiple H&amp;MB workbooks and export a controlled Excel comparison.</p></div>
          <div className="hmb-header-actions">
            <ProjectSwitcher projects={c.projects} activeProject={c.activeProject} loading={c.loadingProjects} theme={THEME}
              onSwitch={switchProject} onCreate={() => c.setShowCreate(true)} onClear={clearProject}
              onManage={() => c.navigate(PROJECT_ORGANIZER_CONFIG.routes.manage, { state: { returnTo: '/engineering/process/hmb-extractor', activeProjectStorageKey: ACTIVE_PROJECT_STORAGE_KEY } })} />
            <button className="hmb-button hmb-button-secondary" type="button" disabled title="Imports are saved only after review and confirmation."><Save /> Save draft</button>
            <button className="hmb-button hmb-button-primary" type="button" onClick={() => c.caseFileInputRef.current?.click()}><Upload /> Upload case files</button>
          </div>
        </div>
      </header>

      <section className="hmb-workflow" aria-label="HMB comparison workflow">
        {workflowSteps.map((step, index) => {
          const current = step.active || (!step.done && workflowSteps.slice(0, index).every((item) => item.done));
          return <div className={`hmb-workflow-step${step.done ? ' is-done' : ''}${current ? ' is-current' : ''}`} key={step.label}>
            <div className="hmb-step-marker">{step.done ? <CheckCircle2 /> : index + 1}</div>
            <div className="hmb-step-copy"><strong>{step.label}</strong><span>{step.detail}</span></div>
            {index < workflowSteps.length - 1 && <div className="hmb-step-line" />}
          </div>;
        })}
      </section>

      <section className="hmb-metrics" aria-label="Comparison summary">
        {[
          [FileSpreadsheet, c.projectSummary?.case_count || caseCards.length || 0, 'cases uploaded', 'blue'],
          [SlidersHorizontal, c.projectSummary?.stream_count || 0, 'streams detected', 'blue'],
          [CheckCircle2, c.templateAlignmentAudit.matched || 0, 'attributes aligned', 'green'],
          [Database, c.projectSummary?.total_records || 0, 'values extracted', 'blue'],
          [AlertTriangle, exceptionCount, 'exceptions', 'amber'],
        ].map(([Icon, value, label, tone]) => <div className="hmb-metric" key={label}><Icon className={`is-${tone}`} /><strong>{value}</strong><span>{label}</span></div>)}
        <div className="hmb-metric hmb-metric-time"><Clock3 /><span>{c.caseImportResult ? 'Import complete' : 'Current workspace'}</span></div>
      </section>

      {c.workspaceView === 'template' ? (
        <main className="hmb-template-workspace">
          <section className="hmb-panel">
            <div className="hmb-panel-heading hmb-template-heading"><div><h2>Template setup</h2><p>Configure the mapping master and controlled export workbook used by this project.</p></div><button type="button" className="hmb-button hmb-button-secondary" onClick={() => c.setWorkspaceView('review')}>Back to comparison</button></div>
            <div className="hmb-template-grid">
              <label>Mapping master<select value={c.selectedTemplateProfileId || ''} disabled={c.loadingProfiles || c.caseBusy} onChange={(event) => { c.setTemplateAnalysis(null); c.setSelectedTemplateProfileId(event.target.value || null); }}><option value="">Select master</option>{c.templateProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.template_name || profile.source_filename} · {profile.stream_count} streams</option>)}</select></label>
              <label>Template name<input value={c.templateName} onChange={(event) => c.setTemplateName(event.target.value)} placeholder="Optional template name" /></label>
              <label className="hmb-file-field">Master workbook<input type="file" accept=".xlsx,.xlsm" onChange={(event) => { c.setMasterTemplateFile(event.target.files?.[0] || null); c.setTemplateError(''); c.setTemplateNotice(''); }} /></label>
              <button className="hmb-button hmb-button-primary" type="button" onClick={c.handleAnalyzeTemplate} disabled={c.templateBusy || !c.masterTemplateFile}><Sparkles /> {c.templateBusy ? 'Analyzing…' : 'Analyze template'}</button>
              <label className="hmb-file-field">Final output template<input type="file" accept=".xlsx" disabled={c.outputBusy} onChange={(event) => c.setOutputTemplateFile(event.target.files?.[0] || null)} /></label>
              <button className="hmb-button hmb-button-secondary" type="button" onClick={c.saveOutputTemplate} disabled={c.outputBusy || !c.outputTemplateFile}><Upload /> {c.outputBusy ? 'Saving…' : 'Save final template'}</button>
            </div>
            {(c.templateError || c.outputError) && <div className="hmb-alert is-error" role="alert">{c.templateError || c.outputError}</div>}
            {c.templateNotice && <div className="hmb-alert is-success">{c.templateNotice}</div>}
            <div className="hmb-template-toolbar">
              <div><strong>{activeProfile?.template_name || activeProfile?.source_filename || 'No active template'}</strong><span>{c.outputTemplate?.filename || 'Final output template not configured'}</span></div>
              <label>Case group<select value={c.casePreviewName} onChange={(event) => { c.setCasePreviewName(event.target.value); c.setCasePreviewResolvedName(''); }}><option value="">Latest imported case</option>{c.casePreviewOptions.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
              <button className="hmb-icon-button" type="button" onClick={c.loadCasePreview} title="Refresh case preview"><RefreshCw /></button>
              <button className="hmb-button hmb-button-secondary" type="button" onClick={c.handleSyncTemplateStreams} disabled={c.syncStreamsBusy || !c.selectedTemplateProfileId}><RefreshCw /> {c.syncStreamsBusy ? 'Syncing…' : 'Sync streams'}</button>
              <button className="hmb-button hmb-button-secondary" type="button" onClick={c.exportTemplateCanvasExcel} disabled={!c.templateCanvasModel.rows.length}><Download /> Export canvas</button>
            </div>
            {(c.casePreviewError || c.canvasExportError) && <div className="hmb-alert is-error" role="alert">{c.casePreviewError || c.canvasExportError}</div>}
            <div className="hmb-alignment-summary"><span>Alignment score <strong>{c.templateAlignmentAudit.score}%</strong></span><span>Matched <strong>{c.templateAlignmentAudit.matched}/{c.templateAlignmentAudit.total}</strong></span><span>Missing <strong>{c.templateAlignmentAudit.missingCount}</strong></span><span>Unit mismatch <strong>{c.templateAlignmentAudit.unitMismatchCount}</strong></span></div>
            {c.templateCanvasBusy || c.casePreviewBusy ? <div className="hmb-empty-state">Loading template data…</div> : c.templateAnalysis?.success ? <div className="hmb-table-scroll hmb-template-table-scroll"><table className="hmb-data-table hmb-template-table"><thead><tr><th>Section</th><th>Property</th><th>Unit</th>{c.templateCanvasModel.streamColumns.map((stream) => <th key={stream.stream_id}>Stream {stream.stream_id}</th>)}</tr></thead><tbody>{c.templateCanvasModel.matrixRows.map((row) => <tr key={`${row.section}-${row.row}-${row.property}`}><td>{row.section}</td><td>{row.property}</td><td>{row.unit || '—'}</td>{row.streamValues.map((value, index) => <td key={`${row.row}-${index}`}>{formatValue(value)}</td>)}</tr>)}</tbody></table></div> : <div className="hmb-empty-state">Analyze or select a master template to preview its mapped attributes.</div>}
          </section>
        </main>
      ) : (
        <main className="hmb-main-grid">
          <div className="hmb-primary-column">
            <section className="hmb-panel hmb-cases-panel">
              <div className="hmb-panel-heading hmb-cases-heading"><div><h2>Case workbooks</h2><p>{caseCards.length || c.projectSummary?.case_count || 0} case files in this project</p></div><div className="hmb-heading-actions"><button className="hmb-text-button" type="button" onClick={openTemplate}><Sparkles /> Template setup</button><button className="hmb-button hmb-button-secondary hmb-button-small" type="button" onClick={() => c.caseFileInputRef.current?.click()}><Plus /> Add case</button></div></div>
              {caseCards.length ? <div className="hmb-case-cards">{caseCards.slice(0, 4).map((file) => {
                const warnings = Object.entries(file.exceptions || {}).filter(([key, count]) => key.endsWith('_count') && count > 0).reduce((sum, [, count]) => sum + count, 0);
                const blocking = file.blocking_errors > 0 || file.requires_mapping;
                return <article className="hmb-case-card" key={file.file_id || file.filename}><FileSpreadsheet className="hmb-excel-icon" /><div className="hmb-case-card-copy"><strong>{file.filename}</strong><span>{file.case_name || (file.persisted ? 'Imported case' : 'Pending analysis')}</span><em className={blocking ? 'is-error' : warnings ? 'is-warning' : 'is-ready'}>{blocking ? <><AlertTriangle /> Review required</> : warnings ? <><AlertTriangle /> {warnings} warnings</> : <><CheckCircle2 /> {file.persisted ? 'Imported' : 'Ready'}</>}</em>{(file.stream_count != null || file.record_count != null) && <small>{file.stream_count || 0} streams · {file.record_count || 0} values</small>}</div>{!file.persisted && file.file ? <button className="hmb-icon-button" type="button" onClick={() => c.removeCaseFile(file.file)} title="Remove file"><X /></button> : <MoreVertical className="hmb-card-menu" />}</article>;
              })}</div> : <button className="hmb-case-empty" type="button" onClick={() => c.caseFileInputRef.current?.click()}><Upload /><strong>Upload H&amp;MB case files</strong><span>Excel, CSV, or PDF · up to 50 MB each</span></button>}
              {c.caseFiles.length > 0 && !c.caseAnalysisResult && <div className="hmb-case-actions"><label><input type="checkbox" checked={c.extractAllStreams} onChange={(event) => { c.setExtractAllStreams(event.target.checked); c.setCasePreviewConfirmed(false); }} /> Extract all source streams</label><button className="hmb-button hmb-button-secondary" type="button" onClick={c.clearCaseFiles} disabled={c.caseBusy}>Clear</button><button className="hmb-button hmb-button-primary" type="button" onClick={() => c.handleAnalyzeCases()} disabled={c.caseBusy || !c.selectedTemplateProfileId}><Sparkles /> {c.caseBusy ? 'Analyzing…' : 'Analyze files'}</button></div>}
              {!c.selectedTemplateProfileId && <div className="hmb-alert is-warning">Select or analyze a master template before validating case files.</div>}
              {c.caseError && <div className="hmb-alert is-error" role="alert">{c.caseError}</div>}
              {c.caseNotice && <div className="hmb-alert is-success">{c.caseNotice}</div>}
            </section>

            {c.caseAnalysisResult?.files?.length > 0 && <section className="hmb-panel hmb-validation-panel"><div className="hmb-panel-heading"><div><h2>Validate extraction</h2><p>Confirm case assignments and warnings before records are imported.</p></div></div><datalist id="hmb-case-slots">{c.projectCaseSlots.map((slot) => <option key={slot} value={slot} />)}</datalist><div className="hmb-validation-files">{c.caseAnalysisResult.files.map((file) => <div className={`hmb-validation-file${file.blocking_errors > 0 ? ' has-error' : ''}`} key={file.file_id || file.filename}><div><strong>{file.filename}</strong><span>{file.detected_format || 'Unknown format'} · {file.stream_count} streams · {file.record_count} values</span></div><label>Case slot<input list="hmb-case-slots" value={c.caseAssignments[file.file_id || file.filename] || ''} onChange={(event) => { c.setCaseAssignments((current) => ({ ...current, [file.file_id || file.filename]: event.target.value })); c.setCasePreviewConfirmed(false); }} /></label></div>)}{(c.caseAnalysisResult.failures || []).map((failure, index) => <div className="hmb-alert is-error" role="alert" key={`${failure.filename}-${index}`}>{failure.filename}: {failure.error}</div>)}</div><div className="hmb-confirmation-row"><label><input type="checkbox" checked={c.replaceExisting} onChange={(event) => { c.setReplaceExisting(event.target.checked); c.setCasePreviewConfirmed(false); }} /> Replace existing cases with the same assigned names</label><label><input type="checkbox" checked={c.casePreviewConfirmed} onChange={(event) => c.setCasePreviewConfirmed(event.target.checked)} /> I reviewed the mappings, sample values, and warnings.</label><button className="hmb-button hmb-button-primary" type="button" onClick={c.handleExecuteCases} disabled={c.caseBusy || !c.casePreviewConfirmed || blockingCount > 0}><Database /> {c.caseBusy ? 'Importing…' : 'Execute import'}</button></div></section>}

            <section className="hmb-panel hmb-comparison-panel">
              <div className="hmb-comparison-heading"><div><h2>Consolidated stream comparison</h2><p>Normalized project units · source-linked extracted values</p></div><div className="hmb-view-toggle"><button className="is-active" type="button">Stream rows</button><button type="button" onClick={openTemplate}>Property matrix</button></div></div>
              <div className="hmb-filter-bar"><label className="hmb-search-control"><Search /><input value={c.comparisonQuery} onChange={(event) => c.setComparisonQuery(event.target.value)} placeholder="Search stream, tag or description…" /></label><select aria-label="Comparison stream" value={c.comparisonStreamId} onChange={(event) => c.setComparisonStreamId(event.target.value)}>{(c.projectSummary?.stream_ids || []).map((streamId) => <option key={streamId} value={streamId}>Stream {streamId}</option>)}</select><select aria-label="Property group" value={c.comparisonSection} onChange={(event) => c.setComparisonSection(event.target.value)}><option value="all">Property group</option>{sections.map((section) => <option key={section} value={section}>{section}</option>)}</select><label className="hmb-switch"><input type="checkbox" checked={c.differencesOnly} onChange={(event) => c.setDifferencesOnly(event.target.checked)} /><span /> Differences only</label><button className="hmb-button hmb-button-secondary hmb-button-small" type="button" onClick={c.loadStreamComparison} disabled={c.comparisonBusy || !c.comparisonStreamId}><RefreshCw /> Refresh</button></div>
              {c.comparisonError && <div className="hmb-alert is-error" role="alert">{c.comparisonError}</div>}
              {c.comparisonBusy ? <div className="hmb-empty-state">Loading multi-case comparison…</div> : visibleRows.length ? <div className="hmb-table-scroll"><table className="hmb-data-table"><thead><tr><th>Stream ↑</th><th>Description</th><th>Property</th><th>Unit</th>{caseNames.map((name, index) => <th key={name}>{name}<small>({index + 1})</small></th>)}<th>Validation</th><th>Source</th></tr></thead><tbody>{visibleRows.map((row) => {
                const missing = caseNames.some((name) => row.values?.[name] === '' || row.values?.[name] == null);
                const sourceEntry = caseNames.map((name) => ({ name, source: row.sources?.[name] || {} })).find((entry) => entry.source.filename || entry.source.cell);
                return <tr key={`${row.section_key}-${row.row_index}`} className={missing ? 'has-warning' : ''}><td><strong>{c.comparisonStreamId || '—'}</strong></td><td>{c.comparisonData?.stream?.description || '—'}</td><td>{row.property}</td><td>{row.unit || '—'}</td>{caseNames.map((name) => <td key={name} className={row.values?.[name] === '' || row.values?.[name] == null ? 'is-missing' : ''}><button className="hmb-value-button" type="button" onClick={() => c.setInspectedValue({ caseName: name, property: row.property, unit: row.unit, value: row.values?.[name], source: row.sources?.[name] || {} })}>{formatValue(row.values?.[name])}</button></td>)}<td><span className={`hmb-validation-status ${missing ? 'is-warning' : 'is-valid'}`}>{missing ? <AlertTriangle /> : <CheckCircle2 />}{missing ? 'Missing' : 'Valid'}</span></td><td><button className="hmb-source-link" type="button" disabled={!sourceEntry} onClick={() => sourceEntry && c.setInspectedValue({ caseName: sourceEntry.name, property: row.property, unit: row.unit, value: row.values?.[sourceEntry.name], source: sourceEntry.source })}>{sourceEntry ? `${sourceEntry.source.filename || 'Source'}${sourceEntry.source.cell ? `:${sourceEntry.source.cell}` : ''}` : 'Not recorded'}</button></td></tr>;
              })}</tbody></table></div> : <div className="hmb-empty-state"><BarChart3 /><strong>No comparison rows to display</strong><span>Import cases and select a stream, or adjust the active filters.</span></div>}
              <div className="hmb-table-footer"><span>{visibleRows.length} of {c.comparisonData?.rows?.length || 0} rows</span><span>Stream {c.comparisonStreamId || '—'} · {caseNames.length} cases</span></div>
            </section>
          </div>

          <aside className="hmb-review-panel hmb-panel">
            <div className="hmb-review-header"><h2>Review &amp; export readiness</h2><p>{c.projectSummary?.case_count || 0} cases · {c.projectSummary?.stream_count || 0} streams</p><span>{completedChecks} of {totalChecks} checks complete</span><div className="hmb-progress"><i style={{ width: `${reviewPercent}%` }} /></div><strong>{reviewPercent}%</strong></div>
            <div className="hmb-checklist">{c.reviewChecklist.map((item) => <div key={item.key}><span className={item.done ? 'is-done' : 'is-pending'}>{item.done ? <CheckCircle2 /> : <AlertTriangle />}</span><p><strong>{item.label}</strong><small>{item.detail}</small></p><em>{item.done ? 'Complete' : 'Pending'}</em></div>)}<div><span className={c.templateAlignmentAudit.missingCount || c.templateAlignmentAudit.unitMismatchCount ? 'is-warning' : 'is-done'}>{c.templateAlignmentAudit.missingCount || c.templateAlignmentAudit.unitMismatchCount ? <AlertTriangle /> : <CheckCircle2 />}</span><p><strong>Attribute alignment</strong><small>{c.templateAlignmentAudit.missingCount} missing · {c.templateAlignmentAudit.unitMismatchCount} unit conflicts</small></p><em>{c.templateAlignmentAudit.score}%</em></div><div><span className={c.comparisonData?.conflicts?.length ? 'is-error' : hasReviewData ? 'is-done' : 'is-pending'}>{c.comparisonData?.conflicts?.length ? <AlertTriangle /> : hasReviewData ? <CheckCircle2 /> : <Clock3 />}</span><p><strong>Comparison reviewed</strong><small>{c.comparisonData?.conflicts?.length || 0} duplicate conflicts</small></p><em>{hasReviewData ? 'Ready' : 'Pending'}</em></div></div>
            <div className="hmb-needs-review"><h3>Needs review ({exceptionCount})</h3>{c.templateAlignmentAudit.missing.slice(0, 2).map((item, index) => <button type="button" key={`${item.section}-${item.property}-${index}`} onClick={openTemplate}><AlertTriangle /><span><strong>Missing template attribute</strong><small>{item.section} · {item.property}</small></span><ChevronRight /></button>)}{c.templateAlignmentAudit.mismatches.slice(0, 2).map((item, index) => <button type="button" key={`${item.expected.property}-${index}`} onClick={openTemplate}><AlertTriangle /><span><strong>Unit normalization conflict</strong><small>{item.expected.property} · expected {item.expected.unit}</small></span><ChevronRight /></button>)}{(c.comparisonData?.conflicts || []).slice(0, 2).map((item, index) => <div className="hmb-review-item-static" key={index}><AlertTriangle /><span><strong>Duplicate extracted value</strong><small>{item.property || 'Review source mapping'}</small></span></div>)}{!exceptionCount && <div className="hmb-review-clear"><CheckCircle2 /> No extraction exceptions require attention.</div>}</div>
            <div className="hmb-export-package"><h3>Export package</h3><label>Workbook template<input readOnly value={c.outputTemplate?.filename || 'Not configured'} /></label><label className="hmb-checkbox-row"><input type="checkbox" checked readOnly /> Comparison sheet<small>Consolidated stream data</small></label><label className="hmb-checkbox-row"><input type="checkbox" checked readOnly /> Exceptions sheet<small>Validation issues and unmapped streams</small></label><label className="hmb-checkbox-row"><input type="checkbox" checked readOnly /> Source audit sheet<small>Cell references and conversion details</small></label><label>Export scope<select value={c.exportScope} onChange={(event) => c.setExportScope(event.target.value)}><option value="selected">Selected stream</option><option value="all">All master streams</option></select></label><button className="hmb-button hmb-button-secondary hmb-button-wide" type="button" onClick={openTemplate}><Eye /> Preview workbook</button><button className="hmb-button hmb-button-primary hmb-button-wide" type="button" onClick={c.exportStreamComparison} disabled={exportBlocked}><Download /> Export Excel</button>{exportBlocked && <p className="hmb-export-warning"><AlertTriangle /> Complete setup and resolve blocking conflicts before export.</p>}</div>
          </aside>
        </main>
      )}

      {c.inspectedValue && <div className="hmb-source-popover" role="dialog" aria-modal="true" aria-label="Extracted value source"><button className="hmb-popover-close" type="button" onClick={() => c.setInspectedValue(null)} aria-label="Close source details"><X /></button><h3>Extracted value</h3><dl><div><dt>Workbook</dt><dd>{c.inspectedValue.source.filename || 'Not recorded'}</dd></div><div><dt>Worksheet</dt><dd>{c.inspectedValue.source.sheet || '—'}</dd></div><div><dt>Cell</dt><dd>{c.inspectedValue.source.cell || '—'}</dd></div><div><dt>Original</dt><dd>{c.inspectedValue.source.value ?? c.inspectedValue.value ?? '—'} {c.inspectedValue.source.unit || ''}</dd></div><div><dt>Normalized</dt><dd>{c.inspectedValue.value ?? '—'} {c.inspectedValue.unit || ''}</dd></div><div><dt>Rule</dt><dd>{c.inspectedValue.source.status || 'Project template mapping'}</dd></div></dl><button className="hmb-button hmb-button-secondary hmb-button-wide" type="button" onClick={() => c.setInspectedValue(null)}><ExternalLink /> Close source</button></div>}

      <footer className="hmb-sticky-footer"><button className="hmb-button hmb-button-secondary" type="button" onClick={() => c.setWorkspaceView(c.workspaceView === 'review' ? 'upload' : 'review')}>Back</button><div><CheckCircle2 /> {c.caseImportResult ? 'Latest import saved' : 'Confirmed imports save automatically'}</div><button className="hmb-button hmb-button-primary" type="button" onClick={() => { c.setWorkspaceView('review'); c.loadStreamComparison(); }} disabled={!hasImportedCases}>Continue to review <ChevronRight /></button></footer>
      {c.showCreate && <ProjectFormModal theme={THEME} busy={c.busy} onClose={() => c.setShowCreate(false)} onSubmit={c.handleCreate} />}
    </div>
  );
};

export default HMBComparisonWorkspace;
