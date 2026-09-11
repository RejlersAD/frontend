import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Users, ShieldCheck, AlertTriangle, FileText, Search, ChevronDown, ArrowRight, Pencil, Lock, X } from 'lucide-react';
import { radaiConfirm } from '../../services/radaiDialog';
import rbacService from '../../services/rbac.service';
import { getRoleName, getRoleDescription } from '../../utils/roleDisplay.utils';

const ids = entries => new Set((entries || []).map(item => item.id));
const userName = profile => [profile.user?.first_name, profile.user?.last_name].filter(Boolean).join(' ') || profile.user?.email || 'User';
const privileged = permission => ['approve', 'delete', 'execute', 'admin', 'manage'].includes(permission.action) || /(?:^|[._])(?:admin|manage)$/.test(permission.code);
const columnFor = permission => permission.action;
const BASE_COLUMNS = [['read', 'View'], ['create', 'Create'], ['update', 'Edit'], ['approve', 'Approve'], ['delete', 'Delete'], ['export', 'Export']];

export function RoleHistory({ roleId, reviewsOnly = false }) {
  const [data, setData] = useState({ results: [], count: 0 });
  const [page, setPage] = useState(1);
  const [state, setState] = useState('loading');
  useEffect(() => { setPage(1); }, [roleId, reviewsOnly]);
  useEffect(() => {
    let active = true; setState('loading');
    rbacService.getAuditLogs({ resource_type: 'Role', ...(roleId && { resource_id: roleId }), ...(reviewsOnly && { reviewed: true }), page, page_size: 20 })
      .then(response => { if (active) { setData(response.data); setState('ready'); } })
      .catch(() => { if (active) setState('error'); });
    return () => { active = false; };
  }, [roleId, reviewsOnly, page]);
  return <section className="ra-history" aria-label={reviewsOnly ? 'Access reviews' : 'Role change history'}>
    <h2>{reviewsOnly ? 'Completed access reviews' : 'Change history'}</h2>
    {state === 'loading' ? <p role="status">Loading history…</p> : state === 'error' ? <p role="alert">Could not load role history.</p> : <>
      {data.results?.length ? <div className="ra-table-scroll"><table><thead><tr><th>Time</th><th>Actor</th><th>Action / target</th><th>Reason</th><th>Outcome</th></tr></thead><tbody>{data.results.map(log => <tr key={log.id}>
        <td>{new Date(log.timestamp).toLocaleString()}</td><td>{log.user_email}</td><td>{log.metadata?.action_label || log.action} <small>{log.resource_repr}</small></td><td>{log.metadata?.reason || 'Not recorded'}</td><td>{log.success ? 'Success' : 'Failed'}</td>
      </tr>)}</tbody></table></div> : <p>No {reviewsOnly ? 'completed access reviews' : 'role changes'} recorded.</p>}
      <div className="ra-history-pager"><span>{data.count || 0} events</span><button disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page}</span><button disabled={page * 20 >= data.count} onClick={() => setPage(page + 1)}>Next</button></div>
    </>}
  </section>;
}

export default function RoleAccessEditor({ role, modules, groups, users, usersLoading, isSuperAdmin, ownRole, tab, setTab, onSaved, onDirtyChange, onDelete, onReload, children }) {
  const [catalogue, setCatalogue] = useState([]);
  const [catalogueState, setCatalogueState] = useState('loading');
  const [moduleIds, setModuleIds] = useState(() => ids(role.modules));
  const [permissionIds, setPermissionIds] = useState(() => ids(role.permissions));
  const [query, setQuery] = useState('');
  const [accessFilter, setAccessFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [grantedOnly, setGrantedOnly] = useState(false);
  const [collapsed, setCollapsed] = useState(new Set());
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dialog = useRef(null);
  const baselineModules = useMemo(() => ids(role.modules), [role]);
  const baselinePermissions = useMemo(() => ids(role.permissions), [role]);
  const locked = !isSuperAdmin || ownRole || role.code === 'super_admin';
  const implicit = role.code === 'super_admin';
  useEffect(() => {
    let active = true;
    let latestRequest = 0;
    const refresh = async () => {
      const request = ++latestRequest;
      try {
        const response = await rbacService.getPermissionCatalogue();
        if (!Array.isArray(response.data)) throw new Error('Invalid permission catalogue');
        if (active && request === latestRequest) { setCatalogue(response.data.filter(p => p.is_active)); setCatalogueState('ready'); }
      } catch {
        if (active && request === latestRequest) setCatalogueState('error');
      }
    };
    const visible = () => { if (document.visibilityState === 'visible') refresh(); };
    refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', visible);
    const timer = tab === 'modules' ? window.setInterval(visible, 60000) : null;
    return () => {
      active = false;
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', visible);
      if (timer !== null) window.clearInterval(timer);
    };
  }, [tab, role.id]);
  useEffect(() => { setModuleIds(ids(role.modules)); setPermissionIds(ids(role.permissions)); }, [role]);
  const changes = useMemo(() => {
    const diff = (before, after, source, kind) => [...new Set([...before, ...after])].filter(id => before.has(id) !== after.has(id)).map(id => ({ id, kind, granted: after.has(id), label: source.find(item => item.id === id)?.name || id }));
    return [...diff(baselineModules, moduleIds, modules, 'Application access'), ...diff(baselinePermissions, permissionIds, catalogue, 'Permission')];
  }, [baselineModules, baselinePermissions, moduleIds, permissionIds, modules, catalogue]);
  useEffect(() => { onDirtyChange(changes.length > 0); return () => onDirtyChange(false); }, [changes.length, onDirtyChange]);
  useEffect(() => {
    if (!changes.length) return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [changes.length]);
  const columns = BASE_COLUMNS;
  const effective = catalogue.filter(permission => implicit || permissionIds.has(permission.id));
  const riskCount = effective.filter(privileged).length;
  const affected = role.user_count ?? users.length;
  const byModule = useMemo(() => {
    const result = new Map(); catalogue.forEach(permission => { const list = result.get(permission.module) || []; list.push(permission); result.set(permission.module, list); }); return result;
  }, [catalogue]);
  const rows = modules.filter(module => {
    const permissions = byModule.get(module.id) || [];
    const granted = implicit || moduleIds.has(module.id) || permissions.some(p => permissionIds.has(p.id));
    return (!query || `${module.name} ${module.description} ${permissions.map(p => `${p.name} ${p.code}`).join(' ')}`.toLowerCase().includes(query.toLowerCase()))
      && (!accessFilter || permissions.some(p => columnFor(p) === accessFilter))
      && (!grantedOnly || granted) && (!sourceFilter || (sourceFilter === 'direct' ? !implicit && granted : !granted));
  });
  const grouped = [...groups, { id: 'other', label: 'Other applications', moduleCodes: modules.filter(module => !groups.some(group => group.moduleCodes.includes(module.code))).map(module => module.code) }]
    .map(group => ({ ...group, rows: rows.filter(module => group.moduleCodes.includes(module.code)) })).filter(group => group.rows.length);
  const toggle = (setter, identifiers, enabled) => setter(previous => { const next = new Set(previous); identifiers.forEach(id => enabled ? next.add(id) : next.delete(id)); return next; });
  const discard = () => { setModuleIds(ids(role.modules)); setPermissionIds(ids(role.permissions)); setReason(''); setError(''); };
  const changeTab = async next => {
    if (next === tab) return;
    if (changes.length && !(await radaiConfirm('Discard the unsaved access changes?'))) return;
    if (changes.length) discard();
    setTab(next);
  };
  const reload = async () => {
    setSaving(true);
    try { await onReload(); setReason(''); setError(''); dialog.current.close(); }
    catch { setError('Could not reload this role. Reopen the Roles page to try again.'); }
    finally { setSaving(false); }
  };
  const save = async event => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const response = await rbacService.reviewRoleAccess(role.id, { module_ids: [...moduleIds], permission_ids: [...permissionIds], original_module_ids: [...baselineModules], original_permission_ids: [...baselinePermissions], reason: reason.trim() });
      onSaved(response.data); dialog.current.close(); setReason(''); window.dispatchEvent(new Event('radai:access-changed'));
    } catch (failure) { setError(failure.response?.data?.detail || 'Changes were not saved. Check the role and try again.'); }
    finally { setSaving(false); }
  };
  return <>
    <main className="ra-editor ra-panel">
      <div className="ra-role-heading"><span className="ra-large-icon"><Users size={28} /></span><div><div className="ra-role-title"><h2>{getRoleName(role)}</h2><span className="ra-chip">{role.is_system_role ? 'System' : 'Custom'}</span><span className="ra-support"><Users size={14} />{affected} assigned users</span></div><p>{getRoleDescription(role) || role.description || 'Manage application access and permissions.'}</p></div>{!role.is_system_role && isSuperAdmin && <button className="ra-delete" onClick={() => onDelete(role)} aria-label="Delete role">Delete</button>}</div>
      <div className="ra-tabs ra-detail-tabs" role="tablist" aria-label="Role details">{[['users', 'Assigned users'], ['modules', 'Permissions'], ['history', 'Change history']].map(([key, label]) => <button key={key} role="tab" aria-selected={tab === key} onClick={() => changeTab(key)}>{label}</button>)}</div>
      <div className="ra-editor-content">
        {tab === 'modules' && <>
          <div className="ra-notice ra-warning"><AlertTriangle size={16} /><span>{role.is_system_role ? 'System role' : 'Custom role'} · permission changes affect {affected} users</span>{role.is_system_role && <small>System roles cannot be deleted.</small>}</div>
          {locked && <p className="ra-readonly"><Lock size={14} />{implicit ? 'Super Administrator access is governed by system policy.' : ownRole ? 'Your own effective access is protected. Another Super Administrator must review changes to this role.' : 'Only Super Administrators can edit permissions.'}</p>}
          <div className="ra-matrix-filters"><label className="ra-search"><Search size={16} /><input aria-label="Search permissions" placeholder="Search permissions…" value={query} onChange={event => setQuery(event.target.value)} /></label><select aria-label="Access level" value={accessFilter} onChange={event => setAccessFilter(event.target.value)}><option value="">All access levels</option>{columns.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select aria-label="Permission source" value={sourceFilter} onChange={event => setSourceFilter(event.target.value)}><option value="">All sources</option><option value="direct">Direct</option><option value="none">Not granted</option></select><label className="ra-granted"><input type="checkbox" checked={grantedOnly} onChange={event => setGrantedOnly(event.target.checked)} />Show granted only</label></div>
          {catalogueState === 'loading' ? <p role="status">Loading permission catalogue…</p> : catalogueState === 'error' ? <p role="alert">Permissions could not be loaded. Reopen this role to try again.</p> : <div className="ra-table-scroll"><table className="ra-matrix"><thead><tr><th>Application / capability</th>{columns.map(([key, label]) => <th key={key}>{label}</th>)}<th>Source</th></tr></thead><tbody>
            {grouped.map(group => <React.Fragment key={group.id}><tr className="ra-group"><th colSpan={columns.length + 2}><button aria-expanded={!collapsed.has(group.id)} onClick={() => toggle(setCollapsed, [group.id], !collapsed.has(group.id))}><ChevronDown size={14} style={{ transform: collapsed.has(group.id) ? 'rotate(-90deg)' : undefined }} />{group.label}</button></th></tr>{!collapsed.has(group.id) && group.rows.map(module => {
              const permissions = byModule.get(module.id) || [];
              const granted = implicit || moduleIds.has(module.id) || permissions.some(p => permissionIds.has(p.id));
              return <tr key={module.id}><td><label className="ra-capability"><input type="checkbox" aria-label={`${module.name}: application access`} checked={implicit || moduleIds.has(module.id)} disabled={locked || saving} onChange={event => toggle(setModuleIds, [module.id], event.target.checked)} /><strong>{module.name}</strong></label><small>{module.description || "Application access and action permissions"}</small></td>{columns.map(([action]) => {
                const matching = permissions.filter(p => columnFor(p) === action);
                const checked = matching.length > 0 && matching.every(p => implicit || permissionIds.has(p.id));
                const mixed = !checked && matching.some(p => permissionIds.has(p.id));
                return <td key={action} className={checked && matching.some(privileged) ? "ra-privileged-cell" : undefined}>{matching.length ? <input type="checkbox" ref={node => { if (node) node.indeterminate = mixed; }} aria-label={`${module.name}: ${action}`} checked={checked} disabled={locked || saving} title={matching.map(p => `${p.name}${privileged(p) ? ' (privileged)' : ''}`).join(', ')} onChange={event => toggle(setPermissionIds, matching.map(p => p.id), event.target.checked)} /> : <span className="ra-unavailable" title="No permission defined for this action">—</span>}</td>;
              })}<td><span className={`ra-chip ${granted ? 'ra-direct' : ''}`}>{implicit ? 'System policy' : granted ? 'Direct' : 'Not granted'}</span></td></tr>;
            })}</React.Fragment>)}
            {!rows.length && <tr><td colSpan={columns.length + 2}>No permissions match these filters.</td></tr>}
          </tbody></table></div>}
          <p className="ra-footnote">Permission changes apply to all users assigned to this role and keep their assignments unchanged. Application access controls navigation. A dash means the action is not defined.</p>
        </>}
        {tab === 'users' && children}
        {tab === 'history' && <RoleHistory roleId={role.id} />}
      </div>
    </main>
    <aside className="ra-impact ra-panel"><h2>Access impact</h2><div className="ra-impact-stats"><div><Users size={20} /><small>Users affected</small><strong>{affected}</strong></div><div><FileText size={20} /><small>Granted permissions</small><strong>{catalogueState === 'ready' ? effective.length : '—'}</strong></div><div><AlertTriangle size={20} /><small>Privileged permissions</small><strong className="ra-danger">{catalogueState === 'ready' ? riskCount : '—'}</strong></div></div>
      <div className="ra-section-title"><h3>Assigned users ({affected})</h3><button className="ra-link" onClick={() => changeTab('users')}>Manage assignments <ArrowRight size={13} /></button></div>
      <div className="ra-people">{usersLoading ? <p>Loading users…</p> : users.slice(0, 3).map(profile => <div key={profile.id}><span className="ra-avatar">{userName(profile).split(/[ .@]/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase()}</span><div><strong>{userName(profile)}</strong><small>{profile.user?.email}</small></div></div>)}{!usersLoading && !users.length && <p>No users assigned.</p>}</div>
      <section><h3>Risk checks</h3><dl className="ra-risk"><dt><AlertTriangle size={15} />Privileged access</dt><dd>{riskCount ? `${riskCount} permissions` : 'None granted'}</dd><dt><ShieldCheck size={15} />Self-access</dt><dd>{ownRole || implicit ? 'Protected' : 'Not affected'}</dd><dt><Lock size={15} />MFA / duty conflicts</dt><dd>Not evaluated</dd></dl></section>
      <section><h3>Change requirements</h3><dl className="ra-risk"><dt><FileText size={15} />Reason for change</dt><dd>Required</dd><dt><Users size={15} />Who can save</dt><dd>Super Administrator</dd><dt><ShieldCheck size={15} />Changes audited</dt><dd>Yes</dd></dl></section>
      <button className="ra-link" onClick={() => { setTab('modules'); setGrantedOnly(true); setQuery(''); setSourceFilter(''); setAccessFilter(''); }}>View granted access <ArrowRight size={14} /></button><div className="ra-notice"><ShieldCheck size={16} />You cannot modify your own effective access.</div>
    </aside>
    <footer className="ra-review-bar"><Pencil size={20} /><strong>{changes.length} access changes <span>· affects {affected} users</span></strong><span className="ra-review-spacer" /><button disabled={!changes.length || saving} onClick={discard}>Discard</button><button className="ra-primary" disabled={!changes.length || locked || catalogueState !== 'ready' || saving} onClick={() => dialog.current.showModal()}>Review changes <ArrowRight size={16} /></button></footer>
    <dialog ref={dialog} className="ra-review-dialog" aria-labelledby="ra-review-title" onCancel={event => { if (saving) event.preventDefault(); }}><form onSubmit={save}><div className="ra-section-title"><h2 id="ra-review-title">Review access changes</h2><button type="button" aria-label="Close review" disabled={saving} onClick={() => dialog.current.close()}><X size={18} /></button></div><p>{getRoleName(role)} · {affected} users affected</p><ul>{changes.map(change => <li key={`${change.kind}-${change.id}`}><span className={`ra-chip ${change.granted ? 'ra-direct' : ''}`}>{change.granted ? 'Grant' : 'Revoke'}</span><span>{change.label}<small>{change.kind}</small></span></li>)}</ul><label>Reason for change<textarea required maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} placeholder="Explain why this access is needed" /></label>{error && <div><p role="alert">{error}</p><button type="button" className="ra-link" disabled={saving} onClick={reload}>Reload role and discard draft</button></div>}<div className="ra-dialog-actions"><button type="button" disabled={saving} onClick={() => dialog.current.close()}>Back</button><button className="ra-primary" disabled={saving || !reason.trim()}>{saving ? 'Saving…' : 'Confirm changes'}</button></div></form></dialog>
  </>;
}
