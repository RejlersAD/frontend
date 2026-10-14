import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import salesService from '../../services/sales.service';
import { workspaceError } from './salesOpportunityWorkspace';

export default function SalesOpportunityFolderTag({ opportunityId, folder, canEdit, onSaved, onReload }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const alive = useRef(true);
  const pending = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const begin = () => {
    setDraft(folder.tag || ''); setToken(folder.tag_token);
    setError(''); setNotice(''); setStale(false); setEditing(true);
  };
  const save = async event => {
    event.preventDefault();
    if (!canEdit || !token || stale || pending.current) return;
    pending.current = true; setSaving(true); setError(''); setNotice('');
    try {
      const result = await salesService.updateOpportunityFolderTag(opportunityId, folder.key, { tag: draft, expected_token: token });
      if (result?.folder_key !== folder.key || typeof result.tag !== 'string' || typeof result.expected_token !== 'string' || !result.expected_token) throw new Error('The saved tag could not be verified. Refresh the tag before trying again.');
      if (!alive.current) return;
      onSaved(result); setEditing(false);
    } catch (failure) {
      if (alive.current) {
        setStale(failure?.response?.status === 409);
        const fieldError = failure?.response?.data?.tag;
        setError(Array.isArray(fieldError) ? fieldError.join(' ') : workspaceError(failure, 'The tag could not be saved. Your text is retained.'));
      }
    } finally { pending.current = false; if (alive.current) setSaving(false); }
  };
  const reload = async () => {
    if (pending.current) return;
    pending.current = true; setSaving(true);
    const current = await onReload();
    pending.current = false;
    if (!alive.current) return;
    setSaving(false);
    if (!current?.tag_token) { setError('The current tag could not be loaded. Your text is retained.'); return; }
    setToken(current.tag_token); setStale(false); setError('');
    setNotice(`Saved tag: ${current.tag || 'None'}. Your text is kept for review.`);
  };

  if (!editing) return canEdit && folder.tag_token
    ? <button type="button" className="sow-folder-tag sow-tag-button" onClick={begin} aria-label={`${folder.tag ? 'Edit' : 'Add'} tag for ${folder.name}`}>{folder.tag || '+ Add tag'}</button>
    : <span className={folder.tag ? 'sow-folder-tag' : 'sow-muted'}>{folder.tag || '—'}</span>;

  return <form className="sow-tag-editor" onSubmit={save} aria-label={`Edit ${folder.name} tag`}>
    <input aria-label={`Tag for ${folder.name}`} value={draft} onChange={event => setDraft(event.target.value)} maxLength={64} disabled={saving} autoFocus />
    <div className="sow-tag-actions"><button type="submit" disabled={saving || stale || !canEdit}>{saving ? 'Saving…' : 'Save'}</button><button type="button" disabled={saving} onClick={() => setEditing(false)}>Cancel</button></div>
    {error && <p className="sow-tag-error" role="alert">{error}</p>}
    {stale && <button type="button" className="sow-tag-refresh" onClick={reload} disabled={saving}>Refresh tag</button>}
    {notice && <p role="status">{notice}</p>}
    <span className="sow-tag-hint">Leave blank to clear.</span>
  </form>;
}

SalesOpportunityFolderTag.propTypes = { opportunityId: PropTypes.string.isRequired, folder: PropTypes.object.isRequired, canEdit: PropTypes.bool.isRequired, onSaved: PropTypes.func.isRequired, onReload: PropTypes.func.isRequired };
