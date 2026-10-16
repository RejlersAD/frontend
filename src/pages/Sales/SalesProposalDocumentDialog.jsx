import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Upload, X } from 'lucide-react';
import salesService from '../../services/sales.service';
import { proposalReviewError } from './salesProposalReview';

export default function SalesProposalDocumentDialog({ open, quote, currentDocument, canBind, onClose, onBound, onRefresh }) {
  const [listing, setListing] = useState({ files: [], next_cursor: null });
  const [storage, setStorage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('existing');
  const [selected, setSelected] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [stale, setStale] = useState(false);
  const [retry, setRetry] = useState(0);
  const uploadIntent = useRef(null);
  const bindIntent = useRef(null);
  const focusBeforeOpen = useRef(null);
  const dialogRef = useRef(null);
  const pending = useRef(false);

  useEffect(() => {
    if (!open || !quote?.deal_id) return undefined;
    let disposed = false;
    setLoading(true); setError(''); setStorage(null);
    Promise.all([salesService.getOpportunityWorkspace(quote.deal_id), salesService.getOpportunityWorkspaceFiles(quote.deal_id, 'proposal', null, 'radai')]).then(([workspace, response]) => {
      if (disposed) return;
      if (!Array.isArray(response.files) || response.files.some(item => item.storage_provider !== 'radai' || !String(item.id).startsWith('radai-'))) throw new Error('Invalid file listing.');
      setStorage(workspace.radai_storage || null); setListing(response);
    }).catch(failure => { if (!disposed) setError(proposalReviewError(failure, 'The opportunity PDFs could not be loaded.')); }).finally(() => { if (!disposed) setLoading(false); });
    return () => { disposed = true; };
  }, [open, quote?.deal_id, retry]);

  useEffect(() => {
    if (!open) return undefined;
    focusBeforeOpen.current = document.activeElement;
    dialogRef.current?.querySelector('button')?.focus();
    return () => focusBeforeOpen.current?.focus?.();
  }, [open]);

  const loadMore = async () => {
    if (loading || !listing.next_cursor) return;
    setLoading(true);
    try {
      const response = await salesService.getOpportunityWorkspaceFiles(quote.deal_id, 'proposal', listing.next_cursor, 'radai');
      if (!Array.isArray(response.files)) throw new Error();
      setListing(previous => ({ ...response, files: [...new Map([...previous.files, ...response.files].map(item => [item.id, item])).values()] }));
    } catch (failure) { setError(proposalReviewError(failure, 'More PDFs could not be loaded.')); }
    finally { setLoading(false); }
  };

  const submit = async event => {
    event.preventDefault();
    if (pending.current || !canBind || (mode === 'upload' && (!file || storage?.status !== 'ready' || storage.can_upload !== true)) || (mode === 'existing' && !selected)) return;
    pending.current = true; setBusy(true); setError(''); setStale(false);
    try {
      let fileId = selected;
      if (mode === 'upload') {
        if (storage.max_upload_bytes > 0 && file.size > storage.max_upload_bytes) throw new Error('This PDF is larger than the permitted upload size.');
        if (!uploadIntent.current || uploadIntent.current.file !== file) uploadIntent.current = { file, requestId: crypto.randomUUID(), result: null };
        if (!uploadIntent.current.result) uploadIntent.current.result = await salesService.uploadOpportunityWorkspaceFile(quote.deal_id, 'proposal', file, uploadIntent.current.requestId, 'radai');
        fileId = uploadIntent.current.result?.id;
        if (!String(fileId).startsWith('radai-') || uploadIntent.current.result.storage_provider !== 'radai') throw new Error('The saved attachment could not be verified.');
      }
      if (!bindIntent.current || bindIntent.current.file_id !== fileId) bindIntent.current = { file_id: fileId, request_id: crypto.randomUUID(), expected_document_id: currentDocument?.id || null, expected_quote_updated_at: quote.updated_at };
      const response = await salesService.bindProposalReviewDocument(quote.id, bindIntent.current);
      if (typeof response?.document_id !== 'string' || !response.document_id || response.request_id !== bindIntent.current.request_id || !Number.isInteger(response.feedback_version)) throw new Error('The saved document revision could not be verified.');
      bindIntent.current = null; uploadIntent.current = null; setFile(null); setSelected('');
      onBound(response.document_id);
    } catch (failure) {
      setError(proposalReviewError(failure, failure instanceof Error && !failure.response ? failure.message : undefined));
      setStale(failure?.response?.status === 409);
      if (failure?.response?.status === 403) onRefresh();
    } finally { pending.current = false; setBusy(false); }
  };

  if (!open) return null;
  const pdfs = listing.files.filter(item => item.mime_type === 'application/pdf' || /\.pdf$/i.test(item.name || ''));
  const uploadAllowed = storage?.status === 'ready' && storage.can_upload === true;
  return <div className="spr-dialog-overlay" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="spr-document-dialog-title" className="spr-dialog" onKeyDown={event => {
      if (event.key === 'Escape' && !busy) onClose();
      if (event.key !== 'Tab') return;
      const controls = [...event.currentTarget.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], textarea:not([disabled])')];
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
      <header className="spr-dialog-header"><h2 id="spr-document-dialog-title">{currentDocument ? 'Add document revision' : 'Select proposal PDF'}</h2><button type="button" className="spr-icon-button" disabled={busy} aria-label="Close document selection" onClick={onClose}><X /></button></header>
      <p>Use a private PDF from this opportunity’s Proposal folder. Each saved revision keeps its own review history.</p>
      <form onSubmit={submit}>
        <label>PDF source<select aria-label="PDF source" value={mode} disabled={busy} onChange={event => setMode(event.target.value)}><option value="existing">Existing RADAI attachment</option><option value="upload">Upload a PDF</option></select></label>
        {mode === 'existing' ? <><label>Proposal PDF<select aria-label="Proposal PDF" value={selected} disabled={busy || loading} onChange={event => { setSelected(event.target.value); bindIntent.current = null; }}><option value="">{loading ? 'Loading PDFs…' : 'Choose a PDF'}</option>{pdfs.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{!loading && !pdfs.length && <p>No PDF attachments are listed in this folder. Choose Upload a PDF to add one.</p>}{listing.next_cursor && <button type="button" className="spr-text-button" disabled={busy || loading} onClick={loadMore}>Load more attachments</button>}</> : <><label>PDF file<input aria-label="PDF file" type="file" accept="application/pdf,.pdf" disabled={busy} onChange={event => { setFile(event.target.files?.[0] || null); uploadIntent.current = null; bindIntent.current = null; }} /></label>{file && <p>{file.name}</p>}{!uploadAllowed && <p>{storage?.message || 'Private upload permission or storage is currently unavailable.'}</p>}<p>Your selected PDF is kept while this workspace stays open.</p></>}
        {error && <div role="alert" className="spr-inline-error">{error}<button type="button" className="spr-text-button" disabled={busy} onClick={() => { if (stale) bindIntent.current = null; setStale(false); setRetry(value => value + 1); onRefresh(); }}>Refresh proposal and attachments</button></div>}
        {!canBind && <p>The current proposal cannot accept a new document revision.</p>}
        <footer className="spr-dialog-actions"><button type="button" className="spr-button" disabled={busy} onClick={onClose}>Cancel</button><button type="submit" className="spr-button spr-button-primary" disabled={busy || !canBind || loading || (mode === 'upload' ? !file || !uploadAllowed : !selected)}><Upload />{busy ? 'Saving PDF…' : 'Use this PDF'}</button></footer>
      </form>
    </section>
  </div>;
}

SalesProposalDocumentDialog.propTypes = { open: PropTypes.bool.isRequired, quote: PropTypes.object, currentDocument: PropTypes.object, canBind: PropTypes.bool.isRequired, onClose: PropTypes.func.isRequired, onBound: PropTypes.func.isRequired, onRefresh: PropTypes.func.isRequired };
