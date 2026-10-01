import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Download, FileText, Lock, Maximize, MessageSquare, Plus, RefreshCw, Reply, Send, X } from 'lucide-react';
import PropTypes from 'prop-types';
import salesService from '../../services/sales.service';
import SalesProposalPdfViewer from './SalesProposalPdfViewer';
import SalesProposalDocumentDialog from './SalesProposalDocumentDialog';
import { mergeReviewComments, proposalReviewError, proposalReviewProjection, proposalThreads, reviewActor, reviewDate, reviewRevision, reviewStatus } from './salesProposalReview';
import './SalesProposalPreview.css';

const blankDraft = () => ({ body: '', selection: null, kind: 'comment' });

function ProposalReview({ proposalId }) {
  const [projection, setProjection] = useState(null);
  const [revisionId, setRevisionId] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [stale, setStale] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const [paging, setPaging] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [pageCount, setPageCount] = useState(0);
  const [zoom, setZoom] = useState(.9);
  const [pdfState, setPdfState] = useState({ documentId: '', url: '', error: '', loading: false });
  const [pdfRetry, setPdfRetry] = useState(0);
  const [filter, setFilter] = useState('open');
  const [selectedThread, setSelectedThread] = useState('');
  const [drafts, setDrafts] = useState({});
  const [replyDrafts, setReplyDrafts] = useState({});
  const [replyTarget, setReplyTarget] = useState('');
  const [reviewDrafts, setReviewDrafts] = useState({});
  const [documentDialog, setDocumentDialog] = useState(false);
  const pending = useRef(false);
  const requests = useRef(new Map());
  const activeRevision = useRef('');
  const composerRef = useRef(null);
  const quote = projection?.quote;
  const selectedDocument = projection?.selected_document;
  const documentId = selectedDocument?.id || '';
  activeRevision.current = documentId;
  const caps = projection?.capabilities || {};
  const draft = drafts[documentId] || blankDraft();
  const reviewDraft = reviewDrafts[documentId] || { outcome: 'request_changes', note: '' };
  const currentPdf = pdfState.documentId === documentId ? pdfState : { url: '', error: '', loading: Boolean(documentId) };
  const counts = projection?.counts;
  const threads = proposalThreads(projection?.comments || []);
  const shownThreads = threads.filter(thread => filter === 'all' || (filter === 'resolved' ? thread.is_resolved : !thread.is_resolved));
  const replyingTo = threads.find(thread => thread.id === replyTarget);
  const writable = Boolean(selectedDocument?.is_current) && !loading && !loadError && !busy;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setLoadError('');
    salesService.getProposalReview(proposalId, revisionId ? { document_id: revisionId } : {}, controller.signal).then(data => {
      if (controller.signal.aborted) return;
      setProjection(proposalReviewProjection(data, proposalId, revisionId));
    }).catch(error => {
      if (controller.signal.aborted) return;
      setLoadError(proposalReviewError(error, 'Proposal review could not be loaded. Try again.'));
      if ([403, 404].includes(error?.response?.status)) setProjection(null);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [proposalId, revisionId, refresh]);

  useEffect(() => {
    setPageNumber(1); setPageInput('1'); setPageCount(selectedDocument?.page_count || 0); setZoom(.9); setSelectedThread(''); setReplyTarget('');
  }, [documentId, selectedDocument?.page_count]);

  useEffect(() => {
    if (!documentId || !caps.can_preview) { setPdfState({ documentId, url: '', error: '', loading: false }); return undefined; }
    const controller = new AbortController();
    let url;
    setPdfState({ documentId, url: '', error: '', loading: true });
    salesService.getProposalReviewPdf(proposalId, documentId, false, controller.signal).then(async result => {
      const blob = result.blob;
      if (!(blob instanceof Blob) || blob.size > 50 * 1024 * 1024 || !(await blob.slice(0, 1024).text()).trimStart().startsWith('%PDF-')) throw new Error('Invalid PDF response.');
      if (controller.signal.aborted) return;
      url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      setPdfState({ documentId, url, error: '', loading: false });
    }).catch(error => {
      if (!controller.signal.aborted) setPdfState({ documentId, url: '', error: proposalReviewError(error, 'The proposal PDF could not be displayed.'), loading: false });
      if (!controller.signal.aborted && error?.response?.status === 403) setRefresh(value => value + 1);
    });
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [proposalId, documentId, caps.can_preview, pdfRetry]);

  const setDraft = changes => setDrafts(previous => ({ ...previous, [documentId]: { ...(previous[documentId] || blankDraft()), ...changes } }));
  const setReviewDraft = changes => setReviewDrafts(previous => ({ ...previous, [documentId]: { ...(previous[documentId] || { outcome: 'request_changes', note: '' }), ...changes } }));
  const goToPage = useCallback(value => {
    const next = Math.min(Math.max(1, Math.trunc(Number(value) || 1)), pageCount || 1);
    setPageNumber(next); setPageInput(String(next));
  }, [pageCount]);
  const documentLoaded = useCallback(({ numPages }) => setPageCount(numPages), []);
  const viewerError = useCallback(message => setPdfState(previous => ({ ...previous, error: message })), []);
  const selectThread = useCallback(id => {
    setSelectedThread(id);
    const thread = projection?.comments.find(item => item.id === id);
    setFilter(previous => (previous === 'open' && thread?.is_resolved) || (previous === 'resolved' && !thread?.is_resolved) ? 'all' : previous);
    if (thread?.page_number) goToPage(thread.page_number);
    requestAnimationFrame(() => document.getElementById(`spr-thread-${id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  }, [projection?.comments, goToPage]);
  const selectAnchor = selection => {
    if (!caps.can_comment || !selectedDocument?.is_current) return;
    setReplyTarget(''); setDraft({ selection }); composerRef.current?.focus();
  };

  const perform = async (key, payload, capability, command, onSuccess, successMessage) => {
    if (pending.current || !documentId || !selectedDocument.is_current || caps[capability] !== true || loading || loadError) return;
    pending.current = true; setBusy(key); setActionError(''); setNotice(''); setStale(false);
    const operationKey = `${documentId}:${key}`;
    const fingerprint = JSON.stringify(payload);
    let intent = requests.current.get(operationKey);
    if (!intent || intent.fingerprint !== fingerprint) {
      intent = { fingerprint, payload: { ...payload, expected_version: selectedDocument.feedback_version, request_id: crypto.randomUUID() } };
      requests.current.set(operationKey, intent);
    }
    try {
      const result = await command(intent.payload);
      if (result?.document_id !== documentId || result?.request_id !== intent.payload.request_id || !Number.isInteger(result?.feedback_version)) throw new Error('The saved review response could not be verified.');
      requests.current.delete(operationKey); onSuccess?.(); setNotice(successMessage); setRefresh(value => value + 1);
    } catch (error) {
      setActionError(proposalReviewError(error)); setStale(error?.response?.status === 409);
      if (error?.response?.status === 403) setRefresh(value => value + 1);
    } finally { pending.current = false; setBusy(''); }
  };

  const addComment = event => {
    event.preventDefault(); if (!draft.body.trim()) return;
    const selection = draft.selection;
    void perform('comment', { body: draft.body.trim(), kind: draft.kind, page_number: selection?.page_number || null, anchor: selection?.anchor || null, context: '', parent_id: null }, 'can_comment', payload => salesService.addProposalReviewComment(proposalId, documentId, payload), () => setDraft({ body: '', selection: null, kind: 'comment' }), 'Comment saved.');
  };
  const reply = (event, thread) => {
    event.preventDefault(); const text = replyDrafts[thread.id] || ''; if (!text.trim()) return;
    void perform(`reply:${thread.id}`, { body: text.trim(), page_number: null, anchor: null, context: '', parent_id: thread.id }, 'can_comment', payload => salesService.addProposalReviewComment(proposalId, documentId, payload), () => { setReplyDrafts(previous => ({ ...previous, [thread.id]: '' })); setReplyTarget(''); }, 'Reply saved.');
  };
  const resolve = thread => void perform(`resolve:${thread.id}`, { is_resolved: !thread.is_resolved }, 'can_resolve', payload => salesService.resolveProposalReviewComment(proposalId, documentId, thread.id, payload), null, thread.is_resolved ? 'Comment reopened.' : 'Comment resolved.');
  const submitReview = event => {
    event.preventDefault();
    void perform('review', { outcome: reviewDraft.outcome, note: reviewDraft.note.trim() }, 'can_submit', payload => salesService.submitProposalReview(proposalId, documentId, payload), () => setReviewDraft({ note: '' }), 'Internal review submitted.');
  };
  const loadMoreComments = async () => {
    if (paging || !projection?.next_comments_cursor || !documentId) return;
    const id = documentId; setPaging(true);
    try {
      const result = proposalReviewProjection(await salesService.getProposalReview(proposalId, { document_id: id, comments_cursor: projection.next_comments_cursor }), proposalId, id);
      if (activeRevision.current === id) setProjection(previous => ({ ...result, comments: mergeReviewComments(previous.comments, result.comments) }));
    } catch (error) { if (activeRevision.current === id) setActionError(proposalReviewError(error, 'More comments could not be loaded.')); }
    finally { setPaging(false); }
  };
  const downloadPdf = async () => {
    if (pending.current || caps.can_download !== true || !documentId) return;
    pending.current = true; setBusy('download'); setActionError('');
    try {
      const result = await salesService.getProposalReviewPdf(proposalId, documentId, true);
      const url = URL.createObjectURL(result.blob), link = document.createElement('a');
      link.href = url; link.download = result.filename || selectedDocument.name || 'Proposal.pdf'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setActionError(proposalReviewError(error, 'The PDF could not be downloaded.')); if (error?.response?.status === 403) setRefresh(value => value + 1); }
    finally { pending.current = false; setBusy(''); }
  };
  const switchRevision = id => {
    if (pending.current) return;
    setRevisionId(id); setProjection(null); setNotice(''); setActionError(''); setStale(false);
  };
  const refreshReview = () => {
    if (pending.current) return;
    // A stale command is replaced only after this explicit refresh. Network-error
    // retries keep their original payload and identity for server replay.
    if (stale) requests.current.clear();
    setStale(false); setActionError(''); setRefresh(value => value + 1);
  };

  return <div className="spr-page">
    <header className="spr-identity"><Link className="spr-back" to={`/sales/proposals?record=${encodeURIComponent(proposalId)}`}><ArrowLeft />Back to proposals</Link><div className="spr-identity-name">{quote?.deal_id && <Link className="spr-opportunity" to={`/sales/opportunities?record=${encodeURIComponent(quote.deal_id)}`}>{quote.deal_code || quote.quote_number}</Link>}<h1 title={quote?.deal_name || 'Proposal Preview & Commenting'}>{quote?.deal_name || 'Proposal Preview & Commenting'}</h1></div><div className="spr-identity-actions">{quote && <span className={`spr-status ${quote.status === 'internal_review' ? 'spr-status-review' : ''}`}>{reviewStatus(quote.status)}</span>}<button className="spr-button" type="button" disabled={!caps.can_download || !documentId || Boolean(busy)} onClick={downloadPdf}><Download />Download</button></div></header>
    <div className="spr-toolbar" aria-label="Proposal PDF controls"><div className="spr-file-select"><span className="spr-pdf-icon" aria-hidden="true">PDF</span><span className="spr-file-name"><strong title={selectedDocument?.name}>{selectedDocument?.name || 'Proposal PDF'}</strong>{quote && <small>{quote.quote_number} · {quote.client_name || 'Client not provided'}</small>}</span><select aria-label="Document revision" className="spr-revision-select" value={documentId} disabled={!projection?.documents.length || Boolean(busy) || loading} onChange={event => switchRevision(event.target.value)}>{!documentId && <option value="">No revision</option>}{projection?.documents.map(item => <option key={item.id} value={item.id}>{reviewRevision(item)}</option>)}</select><button type="button" className="spr-icon-button" aria-label={documentId ? 'Add document revision' : 'Select proposal PDF'} title={documentId ? 'Add document revision' : 'Select proposal PDF'} disabled={!caps.can_bind || Boolean(busy)} onClick={() => setDocumentDialog(true)}><Plus /></button></div><div className="spr-page-controls"><button type="button" className="spr-icon-button" aria-label="Previous page" disabled={!currentPdf.url || pageNumber <= 1} onClick={() => goToPage(pageNumber - 1)}><ChevronLeft /></button><input className="spr-page-input" aria-label="Page number" inputMode="numeric" value={pageInput} disabled={!currentPdf.url} onChange={event => setPageInput(event.target.value)} onBlur={() => goToPage(pageInput)} onKeyDown={event => { if (event.key === 'Enter') goToPage(pageInput); }} /><span className="spr-page-total">/ {pageCount || '—'}</span><button type="button" className="spr-icon-button" aria-label="Next page" disabled={!currentPdf.url || pageNumber >= pageCount} onClick={() => goToPage(pageNumber + 1)}><ChevronRight /></button></div><div className="spr-zoom-controls"><select aria-label="PDF zoom" className="spr-zoom-select" value={zoom} disabled={!currentPdf.url} onChange={event => setZoom(Number(event.target.value))}>{[...new Set([.5, .75, .9, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, zoom])].sort((a, b) => a - b).map(value => <option key={value} value={value}>{Math.round(value * 100)}%</option>)}</select><button type="button" className="spr-icon-button" aria-label="Fit PDF width" title="Fit width" disabled={!currentPdf.url} onClick={() => setZoom(1)}><Maximize /></button></div><button type="button" className="spr-button spr-button-comment" disabled={!caps.can_comment || !writable} onClick={() => { setReplyTarget(''); if (!draft.selection) setDraft({ selection: { page_number: pageNumber, anchor: null } }); composerRef.current?.focus(); }}><MessageSquare />Add comment</button></div>
    {loadError && projection && <div className="spr-notice" role="alert">{loadError} <button type="button" className="spr-text-button" onClick={refreshReview}>Retry review</button></div>}
    <div className="spr-body"><section className="spr-document" aria-label="Proposal document preview">{loading && !projection ? <div className="spr-empty" role="status"><RefreshCw /><p>Loading proposal review…</p></div> : loadError && !projection ? <div className="spr-empty" role="alert"><FileText /><h2>Proposal review unavailable</h2><p>{loadError}</p><button type="button" className="spr-button" onClick={refreshReview}>Retry review</button></div> : !documentId ? <div className="spr-empty"><FileText /><h2>No proposal PDF selected</h2><p>Select or upload a PDF to start a document review.</p><button type="button" className="spr-button spr-button-primary" disabled={!caps.can_bind || Boolean(busy)} onClick={() => setDocumentDialog(true)}><Plus />Select PDF</button>{!caps.can_bind && <p>{caps.deny_reason || 'A permitted proposal editor can add the first PDF.'}</p>}</div> : !caps.can_preview ? <div className="spr-empty"><Lock /><h2>PDF preview unavailable</h2><p>{caps.deny_reason || 'Document preview requires the current Sales read and export permissions.'}</p></div> : currentPdf.loading ? <div className="spr-empty" role="status"><RefreshCw /><p>Loading PDF…</p></div> : currentPdf.error ? <div className="spr-empty" role="alert"><FileText /><p>{currentPdf.error}</p><button type="button" className="spr-button" onClick={() => setPdfRetry(value => value + 1)}>Retry PDF</button></div> : currentPdf.url ? <SalesProposalPdfViewer url={currentPdf.url} documentKey={documentId} title={selectedDocument.name} pageNumber={pageNumber} onPageChange={goToPage} zoom={zoom} onZoomChange={setZoom} threads={threads} selectedThreadId={selectedThread} onThreadSelect={selectThread} onSelection={selectAnchor} onDocumentLoad={documentLoaded} onError={viewerError} /> : null}</section>
      <aside className="spr-review" aria-label="Proposal review comments"><header className="spr-review-header"><div className="spr-review-heading"><h2>Review comments</h2><span className="spr-internal"><Lock />Internal</span></div><p className="spr-review-subtitle">{documentId ? `Comments on ${reviewRevision(selectedDocument)}` : 'Select a PDF to begin'}</p><div className="spr-comment-tabs" role="tablist" aria-label="Comment status">{['open', 'resolved', 'all'].map(value => <button key={value} type="button" role="tab" aria-selected={filter === value} onClick={() => setFilter(value)}>{reviewStatus(value)}{Number.isInteger(counts?.[value]) && <span className="spr-comment-count">{counts[value]}</span>}</button>)}</div></header>
        <div className="spr-thread-list" aria-label={`${reviewStatus(filter)} review comments`}>{shownThreads.map(thread => <article key={thread.id} id={`spr-thread-${thread.id}`} className="spr-thread" aria-current={selectedThread === thread.id || undefined}><div className="spr-thread-top"><button type="button" className={`spr-thread-marker ${thread.is_resolved ? 'spr-thread-marker-resolved' : threads.indexOf(thread) % 2 ? 'spr-thread-marker-amber' : ''}`} aria-label={`Go to comment ${threads.indexOf(thread) + 1}`} onClick={() => selectThread(thread.id)}>{threads.indexOf(thread) + 1}</button><strong className="spr-thread-author">{reviewActor(thread.author)}</strong><time className="spr-thread-time" dateTime={thread.created_at}>{reviewDate(thread.created_at)}</time></div><div className="spr-thread-context">{thread.page_number ? <button type="button" onClick={() => { goToPage(thread.page_number); setSelectedThread(thread.id); }}>Page {thread.page_number}</button> : <span>General comment</span>}{thread.context && <span>· {thread.context}</span>}</div>{thread.anchor?.quote && <blockquote className="spr-thread-quote">“{thread.anchor.quote}”</blockquote>}<p className="spr-thread-text">{thread.body}</p>{thread.kind === 'required_change' && <div className="spr-thread-tags"><span className="spr-required-tag">Required change</span></div>}{thread.is_resolved && <div className="spr-thread-tags"><span className="spr-resolved-tag"><Check />Resolved</span></div>}<div className="spr-thread-actions"><button type="button" className="spr-text-button" disabled={!caps.can_comment || !writable} onClick={() => { setReplyTarget(thread.id); setSelectedThread(thread.id); composerRef.current?.focus(); }}><Reply />Reply</button><button type="button" className="spr-text-button" disabled={!caps.can_resolve || !writable} onClick={() => resolve(thread)}><Check />{thread.is_resolved ? 'Reopen' : 'Resolve'}</button></div>{thread.replies.length > 0 && <div className="spr-replies">{thread.replies.map(item => <div key={item.id} className="spr-reply"><div className="spr-reply-top"><strong>{reviewActor(item.author)}</strong><time dateTime={item.created_at}>{reviewDate(item.created_at)}</time></div><p>{item.body}</p></div>)}</div>}</article>)}{!shownThreads.length && <p className="spr-threads-empty">{loading ? 'Loading comments…' : documentId ? `No ${filter === 'all' ? '' : `${filter} `}comments ${projection?.next_comments_cursor ? 'in the loaded results' : 'on this revision'}.` : 'Review comments will appear here.'}</p>}{projection?.next_comments_cursor && <button type="button" className="spr-button" disabled={paging} onClick={loadMoreComments}>{paging ? 'Loading…' : 'Load more comments'}</button>}</div>
        <form className="spr-composer" onSubmit={event => replyingTo ? reply(event, replyingTo) : addComment(event)}><label htmlFor="spr-new-comment">{replyingTo ? `Reply to ${reviewActor(replyingTo.author)}` : 'Add a comment'}</label>{replyingTo && <div className="spr-composer-anchor"><span>Comment {threads.indexOf(replyingTo) + 1}{replyingTo.page_number ? ` · Page ${replyingTo.page_number}` : ''}</span><button type="button" className="spr-icon-button" aria-label="Cancel reply" disabled={Boolean(busy)} onClick={() => setReplyTarget('')}><X /></button></div>}{!replyingTo && draft.selection && <div className="spr-composer-anchor"><span>Page {draft.selection.page_number}{draft.selection.anchor?.quote ? ` · ${draft.selection.anchor.quote.slice(0, 72)}` : ''}</span><button type="button" className="spr-icon-button" aria-label="Remove comment anchor" disabled={Boolean(busy)} onClick={() => setDraft({ selection: null })}><X /></button></div>}<div className="spr-composer-input"><textarea rows={1} ref={composerRef} id="spr-new-comment" placeholder={replyingTo ? 'Write a reply…' : 'Write an internal comment…'} value={replyingTo ? replyDrafts[replyingTo.id] || '' : draft.body} disabled={!caps.can_comment || !selectedDocument?.is_current || Boolean(busy)} maxLength={4000} onChange={event => replyingTo ? setReplyDrafts(previous => ({ ...previous, [replyingTo.id]: event.target.value })) : setDraft({ body: event.target.value })} /><button type="submit" className="spr-button spr-button-primary" disabled={!caps.can_comment || !writable || !(replyingTo ? replyDrafts[replyingTo.id] || '' : draft.body).trim()}><Send />{replyingTo ? 'Post reply' : 'Post'}</button></div>{!replyingTo && <div className="spr-composer-tools"><label><input type="checkbox" checked={draft.kind === 'required_change'} disabled={!caps.can_comment || !writable} onChange={event => setDraft({ kind: event.target.checked ? 'required_change' : 'comment' })} />Required change</label></div>}{selectedDocument && !selectedDocument.is_current && <p className="spr-composer-help">Earlier revisions are read-only. Select the current revision to comment.</p>}{documentId && selectedDocument.is_current && !caps.can_comment && <p className="spr-composer-help">{caps.deny_reason || 'You do not have permission to add comments.'}</p>}{actionError && <div role="alert" className="spr-inline-error">{actionError}{stale && <button type="button" className="spr-text-button" disabled={Boolean(busy)} onClick={refreshReview}>Refresh review, keep my draft</button>}</div>}{notice && <p role="status" className="spr-inline-success">{notice}</p>}</form>
        <form className="spr-review-footer" onSubmit={submitReview}><div className="spr-review-decision"><label htmlFor="spr-review-outcome">Review decision</label><select id="spr-review-outcome" value={reviewDraft.outcome} disabled={!caps.can_submit || !writable} onChange={event => setReviewDraft({ outcome: event.target.value })}><option value="request_changes">Request changes</option><option value="reviewed">Reviewed</option></select></div><button type="submit" className="spr-button spr-button-primary" disabled={!caps.can_submit || !writable}><Check />Submit review</button><p className="spr-review-note">Internal feedback only. Commercial approval is separate.</p>{projection?.submissions[0] && <p className="spr-review-note">Latest: {reviewStatus(projection.submissions[0].outcome)} · {reviewActor(projection.submissions[0].actor)} · {reviewDate(projection.submissions[0].created_at)}</p>}</form>
      </aside>
    </div>
    <SalesProposalDocumentDialog open={documentDialog} onRefresh={refreshReview} quote={quote} currentDocument={projection?.documents.find(item => item.is_current) || null} canBind={caps.can_bind === true && !loading && !loadError} onClose={() => setDocumentDialog(false)} onBound={id => { setDocumentDialog(false); setRevisionId(id); setProjection(null); setRefresh(value => value + 1); setNotice('Proposal PDF saved as a document revision.'); }} />
  </div>;
}

ProposalReview.propTypes = { proposalId: PropTypes.string.isRequired };
export default function SalesProposalPreviewPage() {
  const { proposalId } = useParams();
  return <ProposalReview key={proposalId} proposalId={proposalId} />;
}
