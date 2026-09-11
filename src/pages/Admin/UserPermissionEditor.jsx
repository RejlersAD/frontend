import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { ChevronDown, Search, ShieldCheck, X } from 'lucide-react';
import rbacService from '../../services/rbac.service';
import { radaiConfirm } from '../../services/radaiDialog';

const actions = [['read', 'View'], ['create', 'Create'], ['update', 'Edit'], ['approve', 'Approve'], ['delete', 'Delete'], ['export', 'Export']];

export default function UserPermissionEditor({ user, modules, groups, onClose }) {
  const dialog = useRef(null);
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState({});
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState(new Set());
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const name = [user.user?.first_name, user.user?.last_name].filter(Boolean).join(' ') || user.user?.email || user.email;
  const permissions = data?.permissions || [];
  const changes = permissions.filter(p => draft[p.id] !== undefined && draft[p.id] !== p.effect).map(p => ({ permission_id: p.id, effect: draft[p.id] }));
  const effective = p => (draft[p.id] ?? p.effect) === 'inherit' ? p.inherited : (draft[p.id] ?? p.effect) === 'allow';
  useEffect(() => { dialog.current.showModal(); }, []);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    rbacService.getUserPermissionOverrides(user.id).then(response => {
      if (active) { setData(response.data); setDraft({}); setReason(''); }
    }).catch(err => {
      if (!active) return;
      const status = err.response?.status;
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : status === 404
        ? 'This user or the permission endpoint could not be found. Reload the assigned users list.'
        : status === 401 ? 'Your session has expired. Sign in again to edit permissions.'
        : status === 403 ? 'Only a Super Administrator can edit individual permissions.'
        : err.isTimeout || err.code === 'ECONNABORTED' ? 'The permission request timed out. Reload permissions to try again.'
        : 'Could not connect to the permission service. Reload permissions to try again.');
    })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user.id, reloadKey]);
  useEffect(() => {
    if (!changes.length) return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [changes.length]);
  const close = async () => {
    if (saving) return;
    if (changes.length && !await radaiConfirm('Discard unsaved changes to this user’s permissions?')) return;
    onClose();
  };
  const reload = async () => {
    if (changes.length && !await radaiConfirm('Reload and discard this user’s unsaved permission changes?')) return;
    setReloadKey(key => key + 1);
  };
  const save = async event => {
    event.preventDefault();
    if (!changes.length || !reason.trim() || saving || data.locked) return;
    setSaving(true); setError(''); setSaved(false);
    try {
      const response = await rbacService.saveUserPermissionOverrides(user.id, { snapshot: data.snapshot, reason: reason.trim(), changes });
      setData(response.data); setDraft({}); setReason(''); setSaved(true);
    } catch (err) { setError(err.response?.data?.detail || 'Could not save permissions. Your changes have been kept.'); }
    finally { setSaving(false); }
  };
  const columns = actions;

  const groupFor = module => groups.find(group => group.moduleCodes.includes(module.code) || group.id === module.code)?.id || 'other';
  const moduleGroups = [...groups, { id: 'other', label: 'Other applications' }];
  const grouped = moduleGroups.map(group => ({ ...group, rows: modules.filter(module => groupFor(module) === group.id && `${group.label} ${module.name} ${module.code} ${module.description || ''}`.toLowerCase().includes(query.toLowerCase())) })).filter(group => group.rows.length);
  const shownCount = grouped.reduce((sum, group) => sum + group.rows.length, 0);
  const checkbox = (matching, label, complete = true) => {
    const granted = matching.filter(effective).length;
    return <input type="checkbox" aria-label={label}
      checked={matching.length > 0 && granted === matching.length}
      ref={node => { if (node) node.indeterminate = granted > 0 && granted < matching.length; }}
      disabled={data.locked || saving || !matching.length || !complete}
      title={complete ? label : 'Permission catalogue is loading. Reload permissions if this persists.'}
      onChange={event => {
        const checked = event.target.checked;
        setDraft(previous => ({ ...previous, ...Object.fromEntries(matching.filter(p => effective(p) !== checked).map(p => [p.id, checked ? 'allow' : 'deny'])) }));
        setSaved(false);
      }} />;
  };

  return <dialog ref={dialog} className="ra-user-permission-dialog" aria-labelledby="ra-user-permission-title" onCancel={event => { event.preventDefault(); close(); }}>
    <form onSubmit={save}>
      <div className="ra-section-title"><div><h2 id="ra-user-permission-title">Edit permissions · {name}</h2><p>{user.user?.email || user.email}</p></div><button type="button" aria-label="Close user permissions" disabled={saving} onClick={close}><X size={18} /></button></div>
      <div className="ra-notice"><ShieldCheck size={18} /><span>Changes apply only to this user. Their role assignments and other users stay unchanged.</span></div>
      {loading ? <p role="status">Loading user permissions…</p> : data && <>
        {data.locked && <p className="ra-readonly">{data.lock_reason}</p>}
        <div className="ra-users-toolbar"><label className="ra-search"><Search size={16} /><input aria-label="Search user permissions" placeholder="Search applications…" value={query} onChange={event => setQuery(event.target.value)} /></label><button type="button" disabled={data.locked || saving} onClick={() => { setDraft(Object.fromEntries(permissions.filter(p => actions.some(([action]) => action === p.action)).map(p => [p.id, 'inherit']))); setSaved(false); }}>Use role permissions</button></div>
        <div className="ra-users-toolbar ra-user-module-summary"><span>{shownCount} of {modules.length} modules - select an action for a group or a single row</span><button type="button" onClick={() => setCollapsed(collapsed.size ? new Set() : new Set(moduleGroups.map(group => group.id)))}>{collapsed.size ? 'Expand all groups' : 'Collapse all groups'}</button></div>
        <div className="ra-table-scroll ra-user-module-table"><table className="ra-matrix"><thead><tr><th>Application</th>{columns.map(([key, label]) => <th key={key}>{label}</th>)}<th>Source</th></tr></thead><tbody>
          {grouped.map(group => <React.Fragment key={group.id}>
            <tr className="ra-group"><th><button type="button" aria-expanded={Boolean(query) || !collapsed.has(group.id)} onClick={() => setCollapsed(previous => { const next = new Set(previous); next.has(group.id) ? next.delete(group.id) : next.add(group.id); return next; })}><ChevronDown size={14} style={{ transform: !query && collapsed.has(group.id) ? 'rotate(-90deg)' : undefined }} />{group.label}<span className="ra-chip">{group.rows.length}</span></button></th>
              {columns.map(([action, label]) => {
                const matching = permissions.filter(p => p.action === action && group.rows.some(module => module.id === p.module));
                return <th key={action}>{checkbox(matching, `Group ${group.label}: ${label}`, group.rows.every(module => matching.some(p => p.module === module.id)))}</th>;
              })}<th><span className="ra-support">Group</span></th></tr>
            {(query || !collapsed.has(group.id)) && group.rows.map(module => {
              const rows = permissions.filter(p => p.module === module.id);
              return <tr key={module.id} data-module-code={module.code}><td><strong>{module.name}</strong></td>
                {columns.map(([action, label]) => <td key={action}>{checkbox(rows.filter(p => p.action === action), `${module.name}: ${label}`)}</td>)}
                <td><span className="ra-chip">{rows.some(p => actions.some(([action]) => action === p.action) && (draft[p.id] ?? p.effect) !== 'inherit') ? 'User override' : 'From roles'}</span></td>
              </tr>;
            })}</React.Fragment>)}
          {!shownCount && <tr><td colSpan={columns.length + 2}>No matching permissions.</td></tr>}
        </tbody></table></div>
        <p className="ra-footnote">Group checkboxes apply to the matching module rows in that category. A mixed checkbox means only some rows are selected. Changes affect this user only; role assignments stay unchanged.</p>
        {changes.length > 0 && <><p><strong>{changes.length} permission changes</strong> for {name}</p><label className="ra-user-reason">Reason for change<textarea aria-label="Reason for user permission change" required maxLength={1000} value={reason} disabled={saving} onChange={event => setReason(event.target.value)} /></label></>}
      </>}
      {error && <div role="alert">{error} <button type="button" disabled={saving || loading} onClick={reload}>Reload permissions</button></div>}
      {saved && <p role="status">Permissions saved for {name}. Role assignments unchanged.</p>}
      <div className="ra-dialog-actions"><button type="button" onClick={close} disabled={saving}>Close</button><button className="ra-primary" disabled={!data || data.locked || loading || saving || !changes.length || !reason.trim()}>{saving ? 'Saving…' : 'Save user permissions'}</button></div>
    </form>
  </dialog>;
}
UserPermissionEditor.propTypes = { user: PropTypes.object.isRequired, modules: PropTypes.array.isRequired, groups: PropTypes.array.isRequired, onClose: PropTypes.func.isRequired };
