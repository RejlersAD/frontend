import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { FileText, Trash2, Check, FileCheck, Plus, History, HelpCircle, ChevronDown, ChevronRight, Database, Info, AlertCircle, AlertTriangle, RotateCw, Upload, X, FileInput, ArrowUpCircle } from 'lucide-react';
import { CloudArrowUpIcon } from '@heroicons/react/24/outline';
import { useHelpContext } from '../../../../components/help/HelpContext';
import { SPEC_API_CONFIG } from '../../../../services/specCustomizationAPI';
import './S3DDatabaseBuilder.css';
const guide = [
  ['Upload documents', 'Add PDF, Excel or Word files.', FileInput],
  ['Confirm successful uploads', 'Ensure all files are uploaded without errors.', FileText],
  ['Extract data', 'Generate workbook content from the documents.', FileCheck],
  ['Review & validate', 'Check fields and resolve issues.', ArrowUpCircle],
  ['Export', 'Download reviewed workbooks (SPEC and CAT).', Upload],
];
export default function S3DDatabaseBuilder({ onExtract, onHistory, onSelectionChange, busy = false, progressContent, requestError = '', uploading = false, jobStatus = '' }) {
  const input = useRef(null);
  const details = useRef(null);
  const { openHelp } = useHelpContext();
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const failed = Boolean(requestError && file && !busy);
  const confirmed = Boolean(jobStatus && !uploading);
  const selectFile = selected => {
    if (busy || !selected) return;
    const ext = selected.name.split('.').pop().toLowerCase();
    if (!SPEC_API_CONFIG.acceptedExts.includes(ext)) { setError('Choose a supported engineering document (PDF, Excel or Word).'); return; }
    if (selected.size > SPEC_API_CONFIG.maxFileSizeMB * 1024 * 1024) { setError(`File exceeds the ${SPEC_API_CONFIG.maxFileSizeMB} MB limit.`); return; }
    onSelectionChange(); setFile(selected); setError(''); setExpanded(true); setDismissed(false);
  };
  const extract = () => { setDismissed(false); setExpanded(true); onExtract(file); };
  const status = failed ? 'Needs retry' : uploading ? 'Uploading' : confirmed ? 'Confirmed' : 'Ready';
  const failureText = confirmed ? 'Review the error and retry extraction.' : 'The server returned an error. Retry the upload before extraction.';
  return <div className="s3db-shell"><section className="s3db-content" aria-label="S3D Database Builder">
    <nav className="s3db-breadcrumb" aria-label="Breadcrumb">Engineering / Digitization / SmartPlant 3D</nav>
    <div className="s3db-heading"><div><h1>S3D Database Builder</h1><p>Build SPEC and CAT workbooks from engineering documents.</p></div><div className="s3db-heading-actions"><button type="button" className="s3db-outline" onClick={onHistory}><History size={18} />History logs</button><button type="button" className="s3db-outline s3db-help" onClick={e => openHelp(e.currentTarget)}><HelpCircle size={18} />Help</button></div></div>
    <ol className="s3db-stages" aria-label="Extraction workflow">{['Upload files', 'Extract data', 'Review & validate', 'Export'].map((label, i) => <li key={label} className={i === (confirmed && busy ? 1 : 0) ? 'is-active' : ''} aria-current={i === (confirmed && busy ? 1 : 0) ? 'step' : undefined}><span>{i + 1}</span><b>{label}</b><i /></li>)}</ol>
    <div className="s3db-grid"><div className="s3db-main-column">
      <section className="s3db-card s3db-upload" aria-labelledby="s3db-upload-title">
        <div className="s3db-card-heading"><h2 id="s3db-upload-title">Source documents <span className="s3db-count">{file ? '1 file' : '0 files'}</span></h2><button type="button" className="s3db-outline" disabled={busy} onClick={() => input.current.click()}><Plus size={19} />Add files</button></div>
        <div className={`s3db-dropzone ${dragging ? 'is-dragging' : ''}`} onDragOver={e => { e.preventDefault(); if (!busy) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); selectFile(e.dataTransfer.files[0]); }}>
          <div className="s3db-upload-icon"><CloudArrowUpIcon width={40} height={40} strokeWidth={1.7} /></div><div><h3>Drag &amp; drop files here</h3><p>PDF, Excel and Word documents</p></div><button type="button" className="s3db-primary" disabled={busy} onClick={() => input.current.click()}>Browse files</button>
          <input ref={input} type="file" accept={SPEC_API_CONFIG.acceptedExts.map(ext => `.${ext}`).join(',')} hidden onChange={e => { selectFile(e.target.files[0]); e.target.value = ''; }} />
        </div>
        {error && <p className="s3db-error" role="alert">{error}</p>}
        <div className="s3db-files" role="table" aria-label="Source documents">
          <div className="s3db-file-head" role="row">{['File', 'Type', 'Upload status', 'Actions'].map(label => <span role="columnheader" key={label}>{label}</span>)}</div>
          {file ? <><div className="s3db-file-row" role="row">
            <div className="s3db-file-name" role="cell"><button type="button" className="s3db-icon-button" aria-label="Toggle upload details" aria-expanded={expanded} onClick={() => setExpanded(v => !v)}><ChevronDown size={17} className={!expanded ? 'is-collapsed' : ''} /></button><span className="s3db-file-icon"><FileText size={34} strokeWidth={1.4} /><b>{file.name.split('.').pop().toUpperCase()}</b></span><strong title={file.name}>{file.name}</strong></div>
            <span role="cell"><span className="s3db-type">{file.name.split('.').pop().toUpperCase()}</span></span>
            <span role="cell"><span className={`s3db-status ${failed ? 'is-warning' : confirmed ? 'is-confirmed' : ''}`}>{failed ? <AlertTriangle size={16} /> : confirmed ? <Check size={16} /> : null}{status}</span></span>
            <div className="s3db-row-actions" role="cell">{failed && <button type="button" className="s3db-outline" onClick={extract}><RotateCw size={18} />Retry</button>}<button type="button" className="s3db-icon-button" disabled={busy} aria-label={`Remove ${file.name}`} onClick={() => { setFile(null); setError(''); onSelectionChange(); }}><Trash2 size={20} /></button></div>
          </div>{failed && expanded && !dismissed && <div className="s3db-upload-error" role="alert"><AlertCircle size={24} /><div><strong>{confirmed ? 'Extraction could not be completed' : 'Upload could not be confirmed'}</strong><p>{failureText}</p><details ref={details}><summary>Server response</summary><p>{requestError}</p></details></div><button type="button" className="s3db-link" onClick={() => { details.current.open = !details.current.open; }}>View details</button><button type="button" className="s3db-icon-button" aria-label="Dismiss upload message" onClick={() => setDismissed(true)}><X size={18} /></button></div>}</> : <p className="s3db-empty">No files added. Browse or drop a document to get started.</p>}
        </div>
        {!file && requestError && <p className="s3db-error" role="alert">{requestError}</p>}{progressContent}
        <div className="s3db-extract"><p>{confirmed ? '1 file confirmed' : '0 files confirmed'}{failed && <> · <span>1 requires retry</span></>}</p><div><small>{failed ? 'Confirm an upload to enable extraction.' : 'Upload and extraction start together.'}</small><button type="button" className="s3db-primary" disabled={!file || busy || (failed && !confirmed)} onClick={extract}><Database size={18} />{busy ? 'Extracting…' : 'Extract database'}</button></div></div>
      </section>
      <section className="s3db-card s3db-preview"><div className="s3db-card-heading"><h2>Workbook preview <span className="s3db-caption">Available after extraction</span></h2></div><div className="s3db-preview-table"><div><span>Sheet</span><span>Rows</span><span>Source status</span></div><p><FileText size={19} />Your extracted SPEC and CAT sheets will appear here.</p></div></section>
      <section className="s3db-card s3db-activity"><h2>Activity</h2><ol><li><i /><div><strong>{file ? 'File selected' : 'Ready for documents'}</strong><p>{file ? file.name : 'Add a source document to begin.'}</p></div></li>{(busy || failed || confirmed) && <li className={failed ? 'is-error' : ''}><i /><div><strong>{failed ? (confirmed ? 'Extraction error' : 'Upload error') : uploading ? 'Uploading document' : 'Extracting data'}</strong><p>{failed ? failureText : 'Processing your engineering document.'}</p></div></li>}</ol></section>
    </div><aside className="s3db-side-column" aria-label="Extraction information">
      <section className="s3db-card s3db-setup"><h2>Extraction setup</h2><p className="s3db-label">Output workbooks</p><div className="s3db-outputs">{[['SPEC', 'Specification'], ['CAT', 'Catalogue']].map(([code, label]) => <div key={code}><span className="s3db-selected"><Check size={17} /></span><span>{code} <em>({label})</em></span></div>)}</div><label className="s3db-label" htmlFor="s3db-source-type">Source type</label><div className="s3db-select"><select id="s3db-source-type" defaultValue="auto"><option value="auto">Auto-detect</option></select><ChevronDown size={16} /></div><div className="s3db-info"><Info size={17} />Identical files reuse the existing project folder.</div></section>
      <section className="s3db-card s3db-guide"><h2>Workflow guide</h2><ol>{guide.map(([title, text, Icon]) => <li key={title}><button type="button" onClick={e => openHelp(e.currentTarget)}><span className="s3db-guide-icon"><Icon size={23} strokeWidth={1.8} /></span><span><strong>{title}</strong><small>{text}</small></span><ChevronRight size={17} /></button></li>)}</ol></section>
      <section className="s3db-card s3db-checklist"><h2>Before extraction</h2>{[['Upload confirmed', confirmed], ['Supported format (PDF, Excel, Word)', Boolean(file)], ['Source available', Boolean(file)]].map(([label, ready]) => <div key={label}><FileCheck size={18} /><span>{label}</span><small className={ready ? 'is-ready' : ''}><i />{ready ? 'Ready' : 'Pending'}</small></div>)}</section>
    </aside></div>
  </section><div className="s3db-bottom-status" role="status"><i />{failed ? 'Upload pending confirmation' : busy ? 'Extraction in progress' : file ? 'Document ready for upload' : 'Ready to upload documents'}</div></div>;
}
S3DDatabaseBuilder.propTypes = { onExtract: PropTypes.func.isRequired, onHistory: PropTypes.func.isRequired, onSelectionChange: PropTypes.func.isRequired, busy: PropTypes.bool, progressContent: PropTypes.node, requestError: PropTypes.string, uploading: PropTypes.bool, jobStatus: PropTypes.string };

