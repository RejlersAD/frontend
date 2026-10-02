import { useEffect, useId, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Check, Loader2, Sparkles, X } from 'lucide-react';
import salesService from '../../services/sales.service';
import { workspaceError } from './salesOpportunityWorkspace';
import { classificationState, classificationTone, commandIdentity, verifiedClassification } from './salesDocumentControl';

const stop = event => event.stopPropagation();
const sharedProps = { recordId: PropTypes.string.isRequired, folderKey: PropTypes.string.isRequired, file: PropTypes.object.isRequired, onSaved: PropTypes.func.isRequired };

export default function SalesDocumentType({ recordId, folderKey, file, onSaved }) {
  const alive = useRef(true);
  const running = useRef(false);
  const command = useRef(null);
  const [busy, setBusy] = useState(false);
  const [stale, setStale] = useState(false);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const value = file.classification;
  const pending = ['queued', 'running'].includes(value?.status);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const refresh = async () => {
    if (running.current) return;
    running.current = true; setBusy(true); setError('');
    try {
      const result = await salesService.getOpportunityDocumentClassification(recordId, folderKey, file.id);
      if (!verifiedClassification(result?.classification)) throw new Error('The current classification could not be verified.');
      if (!alive.current) return;
      onSaved({ id: file.id, classification: result.classification });
      command.current = null; setStale(false); setDenied(false);
      setNotice('Updated. Click AI to classify again.');
    } catch (failure) { if (alive.current) setError(workspaceError(failure, 'Classification could not be refreshed. Please retry.')); }
    finally { running.current = false; if (alive.current) setBusy(false); }
  };
  const classify = async () => {
    if (running.current || stale || denied || pending || !value?.can_retry) return;
    const payload = command.current ? JSON.parse(command.current.key) : { expected_revision: value.revision };
    command.current = commandIdentity(command.current, payload);
    running.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const result = await salesService.retryOpportunityClassification(recordId, folderKey, file.id, { ...payload, request_id: command.current.requestId });
      if (!verifiedClassification(result?.classification)) throw new Error('Classification could not be verified. Click AI to retry the same request.');
      if (!alive.current) return;
      command.current = null;
      onSaved({ id: file.id, classification: result.classification });
    } catch (failure) {
      if (alive.current) {
        setStale(failure?.response?.status === 409);
        if ([401, 403, 404].includes(failure?.response?.status)) setDenied(true);
        setError(workspaceError(failure, 'Classification could not start. Click AI to retry.'));
      }
    } finally { running.current = false; if (alive.current) setBusy(false); }
  };
  if (file.is_folder) return <span className="sow-muted">—</span>;
  const evidence = value?.evidence?.map(item => item.matched_text).filter(Boolean).join(' · ');
  return <div className="sdc-type-cell">
    <div className="sdc-type-actions" onClick={stop} onDoubleClick={stop}>
      <span className={`sdc-badge sdc-badge-${classificationTone(value?.color)}`} title={evidence || undefined}>{value?.label || 'Unclassified'}</span>
      {value && <button type="button" className="sdc-ai-button" aria-label={`AI classify ${file.name}`} title={pending ? 'Classification is pending' : !value.can_retry ? 'Classification is unavailable with current access' : 'Suggest a document type using rules and configured AI'} disabled={busy || pending || stale || denied || !value.can_retry} onClick={event => { stop(event); classify(); }} onDoubleClick={stop}>{busy || pending ? <Loader2 className="sdc-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}</button>}
    </div>
    <span className="sdc-type-state" role={busy || pending ? 'status' : undefined}>{busy ? 'Starting classification…' : classificationState(value)}</span>
    {error && <p className="sdc-inline-error" role="alert">{error}</p>}
    {(stale || denied) && <button type="button" className="sdc-inline-refresh" disabled={busy} onClick={event => { stop(event); refresh(); }} onDoubleClick={stop}>Refresh classification</button>}
    {notice && <span className="sdc-inline-notice" role="status">{notice}</span>}
  </div>;
}
SalesDocumentType.propTypes = sharedProps;

export function SalesDocumentTag({ recordId, folderKey, file, onSaved }) {
  const inputId = useId();
  const alive = useRef(true);
  const running = useRef(false);
  const command = useRef(null);
  const button = useRef(null);
  const wasEditing = useRef(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [stale, setStale] = useState(false);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const value = file.classification;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { if (wasEditing.current && !editing) button.current?.focus({ preventScroll: true }); wasEditing.current = editing; }, [editing]);

  const begin = () => {
    setDraft(value?.custom_tag || ''); setRevision(value?.revision || 0);
    command.current = null; setStale(false); setDenied(false); setError(''); setNotice(''); setEditing(true);
  };
  const cancel = () => { if (!running.current) { setEditing(false); setError(''); setNotice(''); } };
  const refresh = async () => {
    if (running.current) return;
    running.current = true; setBusy(true); setError('');
    try {
      const result = await salesService.getOpportunityDocumentClassification(recordId, folderKey, file.id);
      if (!verifiedClassification(result?.classification)) throw new Error('The current tag could not be verified.');
      if (!alive.current) return;
      setRevision(result.classification.revision); setStale(false); setDenied(false); command.current = null;
      onSaved({ id: file.id, classification: result.classification });
      setNotice(`Saved tag: ${result.classification.custom_tag || 'None'}. Your text is kept.`);
    } catch (failure) { if (alive.current) setError(workspaceError(failure, 'The tag could not be refreshed. Your text is retained.')); }
    finally { running.current = false; if (alive.current) setBusy(false); }
  };
  const save = async event => {
    event.preventDefault();
    if (running.current || stale || denied || !value?.can_edit) return;
    const payload = { custom_tag: draft, expected_revision: revision };
    command.current = commandIdentity(command.current, payload);
    running.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const result = await salesService.updateOpportunityDocumentType(recordId, folderKey, file.id, { ...payload, request_id: command.current.requestId });
      if (!verifiedClassification(result?.classification) || typeof result.classification.custom_tag !== 'string') throw new Error('The saved tag could not be verified. Your text is retained for retry.');
      if (!alive.current) return;
      command.current = null; onSaved({ id: file.id, classification: result.classification }); setEditing(false);
    } catch (failure) {
      if (alive.current) {
        setStale(failure?.response?.status === 409);
        if ([401, 403, 404].includes(failure?.response?.status)) setDenied(true);
        const fieldError = failure?.response?.data?.custom_tag;
        setError(Array.isArray(fieldError) ? fieldError.join(' ') : workspaceError(failure, 'The tag could not be saved. Your text is retained.'));
      }
    } finally { running.current = false; if (alive.current) setBusy(false); }
  };
  if (file.is_folder) return <span className="sow-muted">—</span>;
  if (!editing) return value?.can_edit
    ? <button ref={button} type="button" className="sdc-badge sdc-custom-tag" aria-label={`${value.custom_tag ? 'Edit' : 'Add'} custom tag for ${file.name}`} onClick={event => { stop(event); begin(); }} onDoubleClick={stop}>{value.custom_tag || '+ Add tag'}</button>
    : <span className={value?.custom_tag ? 'sdc-badge sdc-custom-tag' : 'sow-muted'}>{value?.custom_tag || '—'}</span>;
  return <form className="sdc-tag-editor" aria-label={`Custom tag for ${file.name}`} onSubmit={save} onClick={stop} onDoubleClick={stop} onKeyDown={event => { stop(event); if (event.key === 'Escape') { event.preventDefault(); cancel(); } }}>
    <label className="sod-sr-only" htmlFor={inputId}>Custom tag for {file.name}</label>
    <input id={inputId} value={draft} onChange={event => setDraft(event.target.value)} maxLength={80} placeholder="Type a custom tag" disabled={busy} autoFocus />
    <div className="sdc-tag-actions"><button type="submit" aria-label={`Save custom tag for ${file.name}`} title="Save tag (Enter)" disabled={busy || stale || denied || !value?.can_edit}>{busy ? <Loader2 className="sdc-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}</button><button type="button" aria-label={`Cancel custom tag for ${file.name}`} title="Cancel (Escape)" disabled={busy} onClick={cancel}><X aria-hidden="true" /></button></div>
    {error && <p className="sdc-inline-error" role="alert">{error}</p>}
    {(stale || denied) && <button type="button" className="sdc-inline-refresh" disabled={busy} onClick={refresh}>Refresh tag</button>}
    {notice && <span className="sdc-inline-notice" role="status">{notice}</span>}
    {!value?.can_edit && <span className="sdc-inline-notice">Tag editing is unavailable with current access.</span>}
  </form>;
}
SalesDocumentTag.propTypes = sharedProps;
