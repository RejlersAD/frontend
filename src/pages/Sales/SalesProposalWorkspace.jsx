import { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { AlertCircle, Check, CheckCircle2, ChevronDown, Clock, Download, ExternalLink, FileText, FolderOpen, MoreHorizontal, Pencil, Plus, RefreshCw, ShieldCheck } from 'lucide-react';
import salesService from '../../services/sales.service';
import SalesProposalDocumentDialog from './SalesProposalDocumentDialog';
import SalesProposalPreparation from './SalesProposalPreparation';
import { proposalReviewError, proposalReviewProjection, reviewDate, reviewRevision } from './salesProposalReview';
import { proposalApproved, proposalBucket, proposalChecklist, proposalClient, proposalCode, proposalDate, proposalDeadline, proposalDeal, proposalOwner, proposalRevision, proposalStatus, proposalSubmitted, proposalTitle } from './salesProposalRegister';
import { opportunityMoney } from './salesOpportunityRegistration';
import './SalesProposalPreview.css';

export function ProposalMenu({ label, children, icon: Icon = ChevronDown, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const close = event => { if (ref.current && !ref.current.contains(event.target)) ref.current.open = false; };
    const escape = event => { if (event.key === 'Escape' && ref.current?.open) { ref.current.open = false; ref.current.querySelector('summary')?.focus(); } };
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape); };
  }, []);
  return <details className={`spg-menu ${className}`} ref={ref}><summary aria-label={label} className="spg-button"><Icon size={18} /><span>{label}</span>{label === 'Columns' && <ChevronDown size={12} />}</summary><div className="spg-menu-content" onClick={event => { if (event.target.closest('button')) ref.current.open = false; }}>{children}</div></details>;
}
ProposalMenu.propTypes = { label: PropTypes.string.isRequired, children: PropTypes.node, icon: PropTypes.elementType, className: PropTypes.string };

export function ProposalStatus({ record }) {
  return <span className={`spg-status spg-status-${proposalBucket(record)}`} title={`Proposal status: ${String(record.status || '').replace(/_/g, ' ')}`}>{proposalStatus(record)}</span>;
}
ProposalStatus.propTypes = { record: PropTypes.object.isRequired };

export function proposalTabKey(event, values, current, select) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const index = values.indexOf(current);
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? values.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + values.length) % values.length;
  select(values[next]); event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next]?.focus();
}

const sectionTabs = ['Summary', 'Preparation', 'Documents', 'Approvals', 'Submission'];
const formatTimestamp = value => value ? reviewDate(value) : 'Not recorded';
const fileKind = name => /\.pdf$/i.test(name) ? 'pdf' : /\.xlsx?$/i.test(name) ? 'excel' : /\.docx?$/i.test(name) ? 'word' : 'file';

function SelectedWorkspace({ record, actions, locked, onAction, onEdit, onOpenFullRecord, onRefresh, onPrepared }) {
  const [tab, setTab] = useState('Summary');
  const [preparationOpened, setPreparationOpened] = useState(false);
  useEffect(() => { if (tab === 'Preparation') setPreparationOpened(true); }, [tab]);
  const [documents, setDocuments] = useState({ files: [], next_cursor: null, error: '', loading: true });
  const [review, setReview] = useState(null);
  const [reviewError, setReviewError] = useState('');
  const [reviewLoading, setReviewLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [documentDialog, setDocumentDialog] = useState(false);
  const [actionError, setActionError] = useState('');
  const [downloading, setDownloading] = useState('');
  const alive = useRef(true);
  const generation = useRef(0);
  const dealId = record.deal || proposalDeal(record).id;
  const workspaceUrl = dealId ? `/sales/opportunities?record=${encodeURIComponent(dealId)}&workspace=1&folder=proposal` : '';
  const previewUrl = `/sales/proposals/${encodeURIComponent(record.id)}/preview`;
  const reviewDocument = review?.selected_document;
  const approveAction = actions.find(action => action.id === 'approve_proposal');
  const submitAction = proposalApproved(record) ? actions.find(action => action.id === 'submit_proposal') : null;

  useEffect(() => { const requests = generation; alive.current = true; return () => { alive.current = false; ++requests.current; }; }, []);
  useEffect(() => {
    const requests = generation;
    const request = ++generation.current;
    const controller = new AbortController();
    setReview(null); setReviewError(''); setReviewLoading(true); setActionError(''); setDownloading('');
    setDocuments({ files: [], next_cursor: null, error: '', loading: true });
    salesService.getProposalReview(record.id, {}, controller.signal).then(data => {
      if (request === generation.current) setReview(proposalReviewProjection(data, record.id));
    }).catch(error => { if (request === generation.current) setReviewError(proposalReviewError(error, 'Proposal review documents could not be loaded.')); }).finally(() => { if (request === generation.current) setReviewLoading(false); });
    if (dealId) salesService.getOpportunityWorkspaceFiles(dealId, 'proposal', null, 'radai').then(data => {
      if (request !== generation.current) return;
      if (!Array.isArray(data.files) || data.files.some(file => !String(file.id).startsWith('radai-') || file.storage_provider !== 'radai' || typeof file.name !== 'string')) throw new Error('Invalid document response.');
      setDocuments({ ...data, error: '', loading: false });
    }).catch(error => { if (request === generation.current) setDocuments({ files: [], next_cursor: null, error: proposalReviewError(error, 'Opportunity attachments could not be loaded.'), loading: false }); });
    else setDocuments({ files: [], next_cursor: null, error: 'The linked opportunity is unavailable.', loading: false });
    return () => { controller.abort(); ++requests.current; };
  }, [record.id, record.updated_at, dealId, refresh]);

  const loadMore = async () => {
    if (documents.loading || !documents.next_cursor) return;
    const request = generation.current;
    setDocuments(previous => ({ ...previous, loading: true, error: '' }));
    try {
      const data = await salesService.getOpportunityWorkspaceFiles(dealId, 'proposal', documents.next_cursor, 'radai');
      if (request !== generation.current) return;
      if (!Array.isArray(data.files) || data.files.some(file => !String(file.id).startsWith('radai-') || file.storage_provider !== 'radai' || typeof file.name !== 'string')) throw new Error();
      setDocuments(previous => ({ ...data, files: [...new Map([...previous.files, ...data.files].map(file => [file.id, file])).values()], loading: false, error: '' }));
    } catch (error) { if (request === generation.current) setDocuments(previous => ({ ...([403, 404].includes(error?.response?.status) ? { files: [], next_cursor: null } : previous), loading: false, error: proposalReviewError(error, 'More attachments could not be loaded.') })); }
  };

  const downloadReview = async () => {
    if (!reviewDocument || review?.capabilities.can_download !== true || downloading) return;
    const request = generation.current;
    setDownloading(reviewDocument.id); setActionError('');
    try {
      const { blob, filename } = await salesService.getProposalReviewPdf(record.id, reviewDocument.id, true);
      if (request !== generation.current || !alive.current) return;
      const url = URL.createObjectURL(blob), anchor = document.createElement('a');
      anchor.href = url; anchor.download = filename || reviewDocument.name; document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      if (request === generation.current) { setActionError(proposalReviewError(error, 'The PDF could not be downloaded.')); if ([403, 404].includes(error?.response?.status)) { setReview(null); setRefresh(value => value + 1); } }
    } finally { if (request === generation.current) setDownloading(''); }
  };

  const boundIds = new Set((review?.documents || []).map(document => document.file_id));
  const supportingFiles = documents.files.filter(file => !boundIds.has(file.id));
  const shownDocuments = [ ...(reviewDocument ? [{ ...reviewDocument, isReview: true }] : []), ...supportingFiles ];
  const displayedDocuments = tab === 'Summary' ? shownDocuments.slice(0, 2) : shownDocuments;
  const checklist = proposalChecklist(record);
  const stage = ['submitted', 'sent', 'viewed', 'clarification', 'negotiation', 'won', 'accepted'].includes(record.status) ? 3 : proposalApproved(record) ? 2 : ['internal_review', 'approval'].includes(record.status) ? 1 : 0;
  const service = (record.service_categories || proposalDeal(record).service_categories || []).map(value => String(value).replace(/_/g, ' ')).join(', ');
  const approvalHistory = Array.isArray(record.approval_history) ? record.approval_history : [];
  const reloadDocuments = useCallback(() => setRefresh(value => value + 1), []);

  const documentsSection = <section className="spg-documents" aria-label="Proposal documents">
    <div className="spg-section-heading"><h3>Proposal documents</h3>{tab === 'Summary' ? <button type="button" onClick={() => setTab('Documents')}>Manage documents</button> : <Link to={previewUrl}><ExternalLink size={15} />Preview &amp; comment</Link>}</div>
    {(reviewLoading || documents.loading) && <p className="spg-muted" role="status">Loading documents…</p>}
    {reviewError && <div className="spg-inline-error" role="alert">{reviewError}<button type="button" onClick={reloadDocuments}>Retry review documents</button></div>}
    {documents.error && <div className="spg-inline-error" role="alert">{documents.error}<button type="button" onClick={reloadDocuments}>Retry attachments</button></div>}
    <div className="spg-document-table-scroll"><table data-table-typography="preserve"><thead><tr><th>Document</th><th>Version</th><th>Review</th>{tab === 'Documents' && <th><span className="spg-sr-only">Document actions</span></th>}</tr></thead><tbody>
      {displayedDocuments.map(file => <tr key={file.id}><td><span className={`spg-file-icon spg-file-${fileKind(file.name)}`}>{fileKind(file.name) === 'word' ? 'W' : fileKind(file.name) === 'excel' ? 'X' : fileKind(file.name) === 'pdf' ? 'PDF' : <FileText size={20} />}</span><span className="spg-document-name"><Link to={file.isReview ? previewUrl : workspaceUrl} title={`${file.name} · ${file.isReview ? 'Proposal review PDF' : 'Opportunity attachment'}`}>{file.name}</Link>{tab === 'Documents' && <small>{file.isReview ? 'Proposal review PDF' : 'Opportunity attachment'}</small>}</span></td><td>{file.isReview ? `PDF rev ${String(file.revision).padStart(2, '0')}` : file.version ? `v${file.version}` : '—'}</td><td><span className={`spg-document-review ${file.isReview && review?.counts.open ? 'spg-document-review-open' : ''}`}>{file.isReview ? review?.counts.open ? `${review.counts.open} open ${review.counts.open === 1 ? 'comment' : 'comments'}` : review?.counts.all ? 'Comments resolved' : 'No comments' : 'Not recorded'}</span></td>{tab === 'Documents' && <td>{file.isReview ? <button type="button" className="spg-icon-button" aria-label={`Download ${file.name}`} disabled={!review?.capabilities.can_download || Boolean(downloading)} onClick={downloadReview}><Download size={17} /></button> : <Link className="spg-icon-button" to={workspaceUrl} aria-label={`Open ${file.name} in opportunity workspace`}><ExternalLink size={17} /></Link>}</td>}</tr>)}
      {!reviewLoading && !documents.loading && !shownDocuments.length && <tr><td colSpan={tab === 'Documents' ? 4 : 3} className="spg-document-empty">{reviewError || documents.error ? 'Document availability could not be verified.' : 'No review PDF or RADAI attachments are saved here yet.'}</td></tr>}
    </tbody></table></div>
    {tab === 'Summary' && shownDocuments.length > 2 && <details className="spg-supporting"><summary>Supporting documents ({shownDocuments.length - 2}{documents.next_cursor ? '+' : ''})<ChevronDown size={15} /></summary><ul>{shownDocuments.slice(2).map(file => <li key={file.id}><FileText size={17} /><Link to={workspaceUrl}>{file.name}</Link></li>)}</ul></details>}
    {documents.next_cursor && <button type="button" className="spg-text-button" disabled={documents.loading} onClick={loadMore}>Load more attachments</button>}
    {tab === 'Documents' && <div className="spg-document-actions"><button type="button" className="spg-button" onClick={() => setDocumentDialog(true)} disabled={review?.capabilities.can_bind !== true}><Plus size={16} />{reviewDocument ? 'Add PDF revision' : 'Select PDF'}</button>{workspaceUrl && <Link className="spg-button" to={workspaceUrl}><FolderOpen size={17} />Upload files</Link>}</div>}
    {tab === 'Documents' && <p className="spg-footnote">Review revisions belong to this proposal. RADAI attachments belong to the opportunity’s Proposal folder. File versions and internal feedback do not grant proposal approval.</p>}
    {tab === 'Documents' && review?.documents?.length > 1 && <section className="spg-history"><h3>PDF review revisions</h3>{review.documents.map(document => <div key={document.id}><FileText size={16} /><span>{reviewRevision(document)} · {document.name}</span><span>{document.is_current ? 'Current' : 'Historical'}</span></div>)}<Link to={previewUrl}>Choose a revision in the PDF preview</Link></section>}
  </section>;

  return <>
    <header className="spg-workspace-header"><div className="spg-identity"><div>{dealId ? <Link to={`/sales/opportunities?record=${encodeURIComponent(dealId)}`}>{proposalCode(record)}<ExternalLink size={14} /></Link> : <strong>{proposalCode(record)}</strong>}<span className="spg-revision">{proposalRevision(record).replace('Rev ', 'Revision ')}</span></div><h2 title={proposalTitle(record)}>{proposalTitle(record)}</h2><p><span>{proposalClient(record)}</span><ProposalStatus record={record} /></p></div><div className="spg-workspace-header-actions"><button type="button" className="spg-button" onClick={onEdit} disabled={locked}><Pencil size={16} />Edit</button><ProposalMenu label="More proposal actions" icon={MoreHorizontal} className="spg-icon-menu"><button type="button" onClick={onOpenFullRecord}>Full record</button><button type="button" onClick={onRefresh}><RefreshCw size={15} />Refresh proposal</button><Link to={previewUrl}>Preview &amp; comment</Link></ProposalMenu></div></header>
    <ol className="spg-progress" aria-label="Proposal progress">{['Draft', 'In review', 'Approved', 'Submitted'].map((name, index) => { const complete = index < stage && (index !== 2 || proposalApproved(record)); return <li key={name} className={complete ? 'spg-step-complete' : index === stage ? 'spg-step-current' : ''} aria-current={index === stage ? 'step' : undefined}><span>{complete ? <Check size={12} /> : null}</span>{name}</li>; })}</ol>
    <div className="spg-workspace-tabs" role="tablist" aria-label="Proposal workspace">{sectionTabs.map(name => <button key={name} id={`spg-tab-${name}`} type="button" role="tab" aria-controls={`spg-panel-${name}`} aria-selected={tab === name} tabIndex={tab === name ? 0 : -1} onClick={() => setTab(name)} onKeyDown={event => proposalTabKey(event, sectionTabs, tab, setTab)}>{name}</button>)}</div>
    <div className="spg-workspace-content" id={`spg-panel-${tab}`} role="tabpanel" aria-labelledby={`spg-tab-${tab}`}>
      {actionError && <div className="spg-inline-error" role="alert">{actionError}</div>}
      {tab === 'Summary' && <><h3>Proposal details</h3><dl className="spg-facts"><div><dt>Owner</dt><dd>{proposalOwner(record)}</dd></div><div><dt>Submission deadline</dt><dd>{proposalDate(proposalDeadline(record))}</dd></div><div><dt>Proposal value</dt><dd>{opportunityMoney(record.total_amount, record.currency)}</dd></div><div><dt>Service line</dt><dd>{service || 'Not provided'}</dd></div></dl>
        {workspaceUrl && <Link className="spg-workspace-link" to={workspaceUrl}><FolderOpen size={20} />Open opportunity workspace<ExternalLink size={17} /></Link>}
        {documentsSection}
        <section className="spg-checklist"><div className="spg-section-heading"><h3>Approval checklist</h3><button type="button" onClick={() => setTab('Approvals')}>View all</button></div>{checklist.map(item => <div key={item.label} className={`spg-checklist-row ${item.complete ? 'spg-check-complete' : ''}`}><span>{item.label}</span><span>{item.complete ? <CheckCircle2 size={18} /> : <Clock size={18} />}{item.complete ? 'Recorded' : 'Not complete'}</span></div>)}</section>
        {!proposalApproved(record) && <div className="spg-notice"><AlertCircle size={18} /><span>Proposal approval is required before submission to the client.</span></div>}
      </>}
      {tab === 'Documents' && documentsSection}
      {preparationOpened && <div hidden={tab !== 'Preparation'}><section className="spg-section-heading"><div><h3>Proposal content</h3><p className="spg-muted">Write or revise scope, deliverables, assumptions and exclusions, with optional AI help.</p></div><button type="button" className="spg-button" onClick={onEdit} disabled={locked || !['draft', 'scope_development', 'estimation', 'internal_review', 'approval'].includes(record.status) || Boolean(record.approved_at)}><Pencil size={15} />Edit proposal content</button></section><SalesProposalPreparation quoteId={String(record.id)} dealId={String(dealId || '')} onPrepared={onPrepared} /></div>}
      {tab === 'Approvals' && <><section className="spg-approval-summary"><ShieldCheck size={25} /><div><h3>Proposal approval</h3><p>{proposalApproved(record) ? `Approval recorded ${formatTimestamp(record.approved_at)}.` : 'No proposal approval is recorded.'}</p></div></section><p className="spg-muted">This approval controls client submission. PDF review comments are separate internal feedback.</p>
        {approvalHistory.length ? <ol className="spg-approval-history">{approvalHistory.map((entry, index) => <li key={`${entry.at || ''}-${index}`}><CheckCircle2 size={18} /><div><strong>{String(entry.decision || 'Decision recorded').replace(/_/g, ' ')}</strong><span>{formatTimestamp(entry.at)}</span>{entry.actor && <span>{entry.actor}</span>}{entry.comment && <p>{entry.comment}</p>}</div></li>)}</ol> : <p className="spg-empty-note">No approval history is recorded.</p>}
        {approveAction && <button type="button" className="spg-button spg-primary" onClick={() => onAction(approveAction.id)}><ShieldCheck size={17} />Review and approve</button>}
        <Link className="spg-review-link" to={previewUrl}><FileText size={17} />Open PDF review comments</Link>
      </>}
      {tab === 'Submission' && <><h3>Client submission</h3><dl className="spg-facts"><div><dt>Submission recipient</dt><dd>{record.submission_recipient || 'Not recorded'}</dd></div><div><dt>Sent</dt><dd>{formatTimestamp(record.sent_date)}</dd></div><div><dt>Proposal validity</dt><dd>{proposalDate(record.valid_until)}</dd></div><div><dt>Submitted evidence</dt><dd>{record.submitted_version_hash ? 'Version snapshot recorded' : 'Not recorded'}</dd></div></dl>{record.submission_evidence && <div className="spg-evidence"><h3>Submission evidence</h3><p>{record.submission_evidence}</p></div>}
        {proposalSubmitted(record) ? <div className="spg-success"><CheckCircle2 size={18} />This proposal has a recorded client submission.</div> : !proposalApproved(record) ? <div className="spg-notice"><AlertCircle size={18} />Complete proposal approval before submission.</div> : <p className="spg-muted">Record the client recipient and submission evidence using the existing submission command.</p>}
        {submitAction && <button type="button" className="spg-button spg-primary" onClick={() => onAction(submitAction.id)}>Submit to client</button>}
      </>}
    </div>
    <footer className="spg-workspace-footer"><div><button type="button" className="spg-button spg-primary" onClick={() => setTab('Approvals')}>Review approvals</button><button type="button" className="spg-button" disabled={!submitAction} title={submitAction ? 'Record client submission' : 'Proposal must be ready to submit'} onClick={() => submitAction && onAction(submitAction.id)}>Prepare submission</button></div><p>{submitAction ? 'Record the client recipient and submission evidence.' : proposalSubmitted(record) ? 'Submitted proposal evidence is preserved.' : 'Complete proposal approval before preparing the client submission.'}</p></footer>
    <SalesProposalDocumentDialog key={record.id} open={documentDialog} quote={review?.quote} currentDocument={reviewDocument} canBind={review?.capabilities.can_bind === true} onClose={() => setDocumentDialog(false)} onBound={() => { setDocumentDialog(false); reloadDocuments(); }} onRefresh={reloadDocuments} />
  </>;
}
SelectedWorkspace.propTypes = { record: PropTypes.object.isRequired, actions: PropTypes.array.isRequired, locked: PropTypes.bool.isRequired, onAction: PropTypes.func.isRequired, onEdit: PropTypes.func.isRequired, onOpenFullRecord: PropTypes.func.isRequired, onRefresh: PropTypes.func.isRequired, onPrepared: PropTypes.func.isRequired };

export default function SalesProposalWorkspace({ record, loading, error, onRetry, ...props }) {
  return <aside className="spg-workspace" aria-label="Selected proposal" aria-busy={loading}>{loading || error || !record ? <div className="spg-panel-state">{loading ? <RefreshCw className="spg-spin" size={28} /> : error ? <AlertCircle size={28} /> : <FileText size={28} />}<h2>{loading ? 'Loading proposal…' : error ? 'Proposal unavailable' : 'Select a proposal'}</h2><p>{error || (loading ? 'Loading the selected proposal and its current details.' : 'Select a row to view its documents, approvals and submission.')}</p>{error && <button type="button" className="spg-button" onClick={onRetry}>Retry proposal</button>}</div> : <SelectedWorkspace key={record.id} record={record} {...props} />}</aside>;
}
SalesProposalWorkspace.propTypes = { record: PropTypes.object, loading: PropTypes.bool.isRequired, error: PropTypes.string, onRetry: PropTypes.func.isRequired };
