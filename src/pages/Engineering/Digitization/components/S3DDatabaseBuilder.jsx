import React, { useRef, useState } from 'react';
import { ArrowRight, FileText, Trash2, Check, FileCheck } from 'lucide-react';
import { CloudArrowUpIcon } from '@heroicons/react/24/outline';
import { SPEC_API_CONFIG } from '../../../../services/specCustomizationAPI';
import './S3DDatabaseBuilder.css';

const steps = [
  { title: 'Upload and extract', icon: FileCheck, text: 'Upload your document, then extract the database. Identical files reuse their project folder; different files create a new one.' },
  { title: 'Extracted Data Preview', icon: FileText, text: 'When extraction is done, the preview opens automatically. Review, validate and export your data here.' },
];

export default function S3DDatabaseBuilder({ onExtract, onHistory, busy = false, progressContent }) {
  const input = useRef(null);
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const loaded = file;
  const selectFile = selected => {
    if (busy) return;
    if (!selected) return;
    const ext = selected.name.split('.').pop().toLowerCase();
    if (!SPEC_API_CONFIG.acceptedExts.includes(ext)) {
      setError('Choose a supported engineering document (PDF, Excel or Word).');
      return;
    }
    if (selected.size > SPEC_API_CONFIG.maxFileSizeMB * 1024 * 1024) {
      setError(`File exceeds the ${SPEC_API_CONFIG.maxFileSizeMB} MB limit.`);
      return;
    }
    setFile(selected);
    setError('');
  };
  return <div className="s3db-shell">
      <section className="s3db-content" aria-label="S3D Database Builder">
        <div className="s3db-heading"><h1>RADAI S3D Database Builder</h1><p>Build your SmartPlant 3D database from engineering documents</p><button type="button" className="s3db-back" onClick={onHistory}>History Logs</button></div>
        <div className="s3db-grid">
          <section className="s3db-card s3db-upload" aria-labelledby="s3db-upload-title">
            <h2 id="s3db-upload-title">Upload Files</h2>
            <div className={`s3db-dropzone ${dragging ? 'is-dragging' : ''}`} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); selectFile(event.dataTransfer.files[0]); }}>
              <div className="s3db-upload-icon"><CloudArrowUpIcon width={74} height={74} strokeWidth={1.5} /></div>
              <h3>Drag &amp; Drop Files Here</h3><p>PDF, Excel and Word documents</p>
              <button className="s3db-primary" disabled={busy} onClick={() => input.current.click()}>Upload Files</button>
              <input ref={input} type="file" accept={SPEC_API_CONFIG.acceptedExts.map(ext => `.${ext}`).join(',')} hidden onChange={event => { selectFile(event.target.files[0]); event.target.value = ''; }} />
            </div>
            {error && <p className="s3db-error" role="alert">{error}</p>}
            <div className="s3db-files"><h3>Files Loaded</h3>{loaded ? <div className="s3db-file-row"><span className="s3db-check"><Check size={21} /></span><span className="s3db-file-icon"><FileText size={53} strokeWidth={1.2} /><b>{loaded.name.split('.').pop().toUpperCase()}</b></span><strong title={loaded.name}>{loaded.name}</strong><span className="s3db-uploaded"><span className="s3db-check"><Check size={15} /></span>Ready</span><button disabled={busy} aria-label={`Remove ${loaded.name}`} onClick={() => setFile(null)}><Trash2 size={24} /></button></div> : <p className="s3db-empty">No files loaded. Upload a document to get started.</p>}</div>
            {progressContent}
            <div className="s3db-extract"><button className="s3db-primary" disabled={!loaded || busy} onClick={() => onExtract(file)}>{busy ? 'Extracting…' : 'Extract Database'}<ArrowRight size={23} /></button></div>
          </section>
          <section className="s3db-card s3db-how" aria-labelledby="s3db-how-title"><h2 id="s3db-how-title">How it works</h2><ol>{steps.map(({ title, text, icon: Icon }, index) => <li key={title}><span className="s3db-step-number">{index + 1}</span><div className="s3db-step-icon"><Icon size={34} strokeWidth={2} /></div><div><h3>{title}</h3><p>{text}</p></div></li>)}</ol></section>
        </div>
      </section>
  </div>;
}
