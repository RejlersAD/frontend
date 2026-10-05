import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { ChevronLeft, ChevronRight, Download, FileText, X } from 'lucide-react';
import salesService from '../../services/sales.service';
import SalesProposalPdfViewer from './SalesProposalPdfViewer';
import SalesOfficeFilePreview from './SalesOfficeFilePreview';
import { fileSize, workspaceError } from './salesOpportunityWorkspace';
import { filePreviewType, previewContent } from './salesOpportunityPreview';
import { OFFICE_PREVIEW_MAX_BYTES } from './salesOfficePreview';
import './SalesOpportunityFilePreview.css';

export default function SalesOpportunityFilePreview({ recordId, folderKey, storage, file, onClose }) {
  const dialog = useRef(null);
  const closeButton = useRef(null);
  const downloadController = useRef(null);
  const alive = useRef(false);
  const assetUrl = useRef('');
  const [detail, setDetail] = useState(null);
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [renderError, setRenderError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [zoom, setZoom] = useState(1);
  useEffect(() => { setRenderError(''); }, [page, zoom]);

  useEffect(() => {
    alive.current = true;
    const previous = document.activeElement;
    const node = dialog.current;
    node.showModal(); closeButton.current?.focus();
    return () => {
      alive.current = false; downloadController.current?.abort(); node.close();
      if (assetUrl.current) URL.revokeObjectURL(assetUrl.current);
      assetUrl.current = '';
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    if (assetUrl.current) URL.revokeObjectURL(assetUrl.current);
    assetUrl.current = '';
    setLoading(true); setError(''); setRenderError(''); setContent(null); setDetail(null); setDownloadError('');
    setPage(1); setPages(0); setZoom(1);
    const load = async () => {
      try {
        const current = await salesService.getOpportunityWorkspaceFile(recordId, folderKey, file.id, { signal: controller.signal });
        if (disposed) return;
        if (current?.id !== file.id || current.folder_key !== folderKey || current.is_folder !== false || (current.storage_provider || 'sharepoint') !== storage) throw new Error('The selected file could not be verified. Refresh the folder and try again.');
        setDetail(current);
        if (current.can_download !== true) throw new Error('Preview is unavailable with your current file download access.');
        const type = filePreviewType(current);
        if (type.kind === 'unsupported') { setContent(type); return; }
        if (['xlsx', 'docx', 'msg'].includes(type.kind) && current.size > OFFICE_PREVIEW_MAX_BYTES) throw new Error('This file is too large for the browser preview. Download the original to open it.');
        const { blob } = await salesService.downloadOpportunityWorkspaceFile(recordId, folderKey, file.id, { signal: controller.signal });
        if (disposed) return;
        if (!(blob instanceof Blob) || (Number.isSafeInteger(current.size) && blob.size !== current.size)) throw new Error('The file changed while loading. Retry the preview to load its current content.');
        const result = await previewContent(blob, type, { signal: controller.signal });
        if (disposed) return;
        if (result.blob) { assetUrl.current = URL.createObjectURL(result.blob); result.url = assetUrl.current; }
        setContent(result);
      } catch (failure) {
        if (!disposed) {
          if ([401, 403, 404].includes(failure?.response?.status)) setDetail(null);
          setError(workspaceError(failure, 'The preview could not be loaded. Please retry.'));
        }
      } finally { if (!disposed) setLoading(false); }
    };
    void load();
    return () => { disposed = true; controller.abort(); };
  }, [recordId, folderKey, storage, file.id, retry]);

  const download = async () => {
    if (!detail?.can_download || downloadController.current) return;
    const controller = new AbortController(); downloadController.current = controller;
    setDownloading(true); setDownloadError('');
    try {
      const { blob, filename } = await salesService.downloadOpportunityWorkspaceFile(recordId, folderKey, file.id, { signal: controller.signal });
      if (!alive.current || controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename || detail.name;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (failure) {
      if (alive.current && !controller.signal.aborted) {
        if ([401, 403, 404].includes(failure?.response?.status)) {
          setContent(null); setDetail(null);
          if (assetUrl.current) URL.revokeObjectURL(assetUrl.current);
          assetUrl.current = '';
          setError(workspaceError(failure, 'File access is unavailable.'));
        } else setDownloadError(workspaceError(failure, 'The file could not be downloaded. Please retry.'));
      }
    } finally { if (downloadController.current === controller) downloadController.current = null; if (alive.current) setDownloading(false); }
  };

  return <dialog ref={dialog} className="sop-preview" aria-label="File preview" onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="sop-header"><div><span>File preview</span><h2>{file.name}</h2><p>{detail ? fileSize(detail.size) : loading ? 'Loading file information…' : 'File information unavailable'}</p></div><button ref={closeButton} type="button" className="sow-icon" aria-label="Close preview" onClick={onClose}><X aria-hidden="true" /></button></header>
    <div className="sop-toolbar">
      {detail?.version && <span className="sop-version-label">{detail.is_current === false ? 'Historical version' : 'Version'} {detail.version}</span>}
      {content?.kind === 'pdf' && <div className="sop-page-controls"><button type="button" aria-label="Previous page" disabled={page <= 1 || !pages} onClick={() => setPage(value => value - 1)}><ChevronLeft aria-hidden="true" /></button><label>Page<input aria-label="Preview page number" type="number" min="1" max={pages || 1} value={page} disabled={!pages} onChange={event => { const next = Number(event.target.value); if (Number.isInteger(next) && next >= 1 && next <= pages) setPage(next); }} /></label><span>of {pages || '—'}</span><button type="button" aria-label="Next page" disabled={!pages || page >= pages} onClick={() => setPage(value => value + 1)}><ChevronRight aria-hidden="true" /></button><label>Zoom<select aria-label="Preview zoom" value={zoom} onChange={event => setZoom(Number(event.target.value))}>{[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3].map(value => <option key={value} value={value}>{value === 1 ? 'Fit width' : `${value * 100}%`}</option>)}</select></label></div>}
      <button type="button" className="sow-upload sop-download" onClick={download} disabled={loading || !detail?.can_download || downloading}><Download aria-hidden="true" />{downloading ? 'Downloading…' : 'Download'}</button>
    </div>
    {downloadError && <p className="sop-error" role="alert">{downloadError}</p>}
    <div className="sop-content" aria-busy={loading}>
      {loading ? <p className="sop-state" role="status">Loading file preview…</p> : error ? <div className="sop-state"><p role="alert">{error}</p><button type="button" className="sow-upload" onClick={() => setRetry(value => value + 1)}>Retry preview</button></div> : content?.kind === 'pdf' ? <>
        {renderError && <div className="sop-render-error"><button type="button" className="sow-upload" onClick={() => setRetry(value => value + 1)}>Retry preview</button></div>}
        <SalesProposalPdfViewer url={content.url} documentKey={`${recordId}:${folderKey}:${file.id}:${retry}`} title={file.name} ariaLabel="File PDF pages" pageNumber={page} onPageChange={setPage} zoom={zoom} onZoomChange={setZoom} onDocumentLoad={result => setPages(result.numPages)} onError={setRenderError} />
      </> : ['xlsx', 'docx', 'msg'].includes(content?.kind) ? <SalesOfficeFilePreview content={content} onClose={onClose} /> : content?.kind === 'image' ? <div className="sop-image">{renderError && <p role="alert">{renderError}</p>}<img src={content.url} alt={`Preview of ${file.name}`} onError={() => setRenderError('This image could not be displayed. Download the original to inspect it.')} /></div> : content?.kind === 'text' ? <div className="sop-text">{content.truncated && <p role="status">Showing the first 256 KB. Download the original for the complete file.</p>}<pre aria-label="File text preview">{content.text || 'This file contains no text.'}</pre></div> : <div className="sop-state"><FileText aria-hidden="true" /><h3>Preview is not available for this file type</h3><p>Download the original file to open it in a compatible application.</p></div>}
    </div>
  </dialog>;
}

SalesOpportunityFilePreview.propTypes = { recordId: PropTypes.string.isRequired, folderKey: PropTypes.string.isRequired, storage: PropTypes.oneOf(['radai', 'sharepoint']).isRequired, file: PropTypes.object.isRequired, onClose: PropTypes.func.isRequired };
