import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Upload, X } from 'lucide-react';
import salesService from '../../services/sales.service';
import { fileSize, uploadFileError, uploadTransferPercent, workspaceError } from './salesOpportunityWorkspace';
import { commandIdentity } from './salesDocumentControl';

export default function SalesDocumentVersionUpload({ recordId, folderKey, file, detail, onSaved }) {
  const dialog = useRef(null);
  const alive = useRef(true);
  const running = useRef(false);
  const command = useRef(null);
  const restoreFocus = useRef(null);
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState('');
  const [current, setCurrent] = useState(detail);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [stale, setStale] = useState(false);
  const [denied, setDenied] = useState(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const refresh = async () => {
    if (running.current) return;
    running.current = true; setLoading(true); setError('');
    try {
      const result = await salesService.getOpportunityWorkspaceFile(recordId, folderKey, file.id);
      if (result?.id !== file.id || result.folder_key !== folderKey || result.storage_provider !== 'radai' || typeof result.head_token !== 'string') throw new Error('The current document version could not be verified.');
      if (!alive.current) return;
      setCurrent(result); setStale(false); setDenied(false); command.current = null;
      setNotice(`Current version: ${result.head_version || (result.is_current ? result.version : 'see version history')}. Your file and note are kept.`);
    } catch (failure) { if (alive.current) { setDenied(true); setError(workspaceError(failure, 'The current version could not be loaded. Your input is retained.')); } }
    finally { running.current = false; if (alive.current) setLoading(false); }
  };
  const begin = event => {
    restoreFocus.current = event.currentTarget;
    setCurrent(detail);
    dialog.current?.showModal();
  };
  const close = () => {
    if (running.current) return;
    dialog.current?.close();
    restoreFocus.current?.focus();
  };
  const save = async event => {
    event.preventDefault();
    if (running.current || !selected || !current?.can_upload_version || !current.head_token || stale || denied) return;
    const validation = uploadFileError(selected, current.max_upload_bytes);
    if (validation) { setError(validation); return; }
    const payload = { name: selected.name, size: selected.size, modified: selected.lastModified, note, token: current.head_token };
    command.current = commandIdentity(command.current, payload);
    running.current = true; setSaving(true); setError(''); setNotice(''); setProgress(null);
    try {
      const result = await salesService.uploadOpportunityDocumentVersion(recordId, folderKey, file.id, selected, command.current.requestId, current.head_token, note, {
        onUploadProgress: event => { if (alive.current) setProgress(uploadTransferPercent(event)); },
      });
      if (!result?.id?.startsWith('radai-') || result.storage_provider !== 'radai' || !result.document_id || result.document_id !== detail.document_id) throw new Error('The saved version could not be verified. Retry with the retained file and note.');
      let saved = result;
      if (result.is_current === false && result.head_file_id && result.head_file_id !== result.id) {
        saved = await salesService.getOpportunityWorkspaceFile(recordId, folderKey, result.head_file_id);
        if (saved?.id !== result.head_file_id || saved.document_id !== result.document_id || saved.folder_key !== folderKey || saved.storage_provider !== 'radai') throw new Error('Your version was saved, but the current document could not be verified. Retry to refresh the saved result.');
      }
      if (!alive.current) return;
      dialog.current?.close(); onSaved(saved);
    } catch (failure) {
      if (alive.current) {
        setStale(failure?.response?.status === 409);
        if ([401, 403, 404].includes(failure?.response?.status)) setDenied(true);
        setError(workspaceError(failure, 'The new version could not be uploaded. Your file and note are retained for retry.'));
      }
    } finally { running.current = false; if (alive.current) setSaving(false); }
  };
  const busy = loading || saving;
  return <>
    <button type="button" className="sow-upload" disabled={!detail.can_upload_version} onClick={begin}><Upload aria-hidden="true" />Upload new version</button>
    {!detail.can_upload_version && <p className="sow-muted">A new version is unavailable with current access or while another version is being saved.</p>}
    <dialog ref={dialog} className="sow-upload-dialog sdc-version-dialog" aria-label="Upload new version" onCancel={event => { event.preventDefault(); close(); }}>
      <form onSubmit={save}>
        <header><h3>Upload new version</h3><button type="button" className="sow-icon" aria-label="Close version upload" disabled={busy} onClick={close}><X aria-hidden="true" /></button></header>
        <p><strong>{detail.document_name || file.name}</strong></p>
        <p>Earlier versions remain available. Uploading a version does not approve the document or change existing proposal references.</p>
        {error && <p className="sow-message sow-error" role="alert">{error}</p>}
        {notice && <p className="sow-message" role="status">{notice}</p>}
        {(!current?.can_upload_version || denied) && <p className="sow-message">Version upload is unavailable with the current file access. Your file and note are retained.</p>}
        {(stale || denied) && <button type="button" className="sow-upload" disabled={busy} onClick={refresh}>Refresh current version</button>}
        <fieldset disabled={busy}>
          <label>Revision file<input type="file" aria-label="Revision file" onChange={event => { const next = event.target.files?.[0]; if (next) { setSelected(next); command.current = null; setError(''); } event.target.value = ''; }} /></label>
          {selected && <p className="sow-selected-file">Selected: {selected.name} · {fileSize(selected.size)}</p>}
          <label>Revision note (optional)<textarea aria-label="Revision note" rows={3} maxLength={1000} value={note} onChange={event => setNote(event.target.value)} /></label>
          {current?.max_upload_bytes > 0 && <p className="sow-muted">Maximum file size: {fileSize(current.max_upload_bytes)}.</p>}
        </fieldset>
        {saving && <div role="status"><p>{progress === 100 ? 'Processing and saving the new version…' : progress == null ? 'Uploading the new version…' : `Uploading ${progress}%`}</p>{progress != null && <progress aria-label="Version upload progress" max="100" value={progress} />}</div>}
        {loading && <p role="status">Checking the current version…</p>}
        <footer><button type="button" className="sow-upload" disabled={busy} onClick={close}>Cancel</button><button type="submit" className="sow-upload sod-primary" disabled={busy || stale || denied || !selected || !current?.can_upload_version || !current.head_token}>{saving ? 'Uploading…' : 'Upload version'}</button></footer>
      </form>
    </dialog>
  </>;
}
SalesDocumentVersionUpload.propTypes = { recordId: PropTypes.string.isRequired, folderKey: PropTypes.string.isRequired, file: PropTypes.object.isRequired, detail: PropTypes.object.isRequired, onSaved: PropTypes.func.isRequired };
