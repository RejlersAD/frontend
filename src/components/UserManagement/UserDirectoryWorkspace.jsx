import { useCurrentProfilePhoto } from '../Layout/ProfilePhotoContext';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Users, CheckCircle2, Shield, AlertTriangle, Download, Upload, Plus, Search, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, MoreHorizontal, X, UserPlus, Ban, Clock3, FileText, RefreshCw, ExternalLink, Info } from 'lucide-react';
import rbacService from '../../services/rbac.service';
import './UserDirectoryWorkspace.css';

const nameOf = u => u.full_name || [u.first_name || u.user?.first_name, u.last_name || u.user?.last_name].filter(Boolean).join(' ') || u.email || u.user?.email || 'Unnamed user';
const emailOf = u => u.email || u.user?.email || '';
const rolesOf = u => (u.roles || []).filter(r => r && typeof r === 'object');
const statusOf = u => u.status && u.status !== 'active' ? u.status : u.user?.is_active === false ? 'inactive' : u.status === 'active' || u.user?.is_active === true ? 'active' : 'unknown';
const privileged = u => u.user?.is_superuser === true || rolesOf(u).some(r => ['super_admin', 'superadmin', 'admin', 'ict_admin'].includes(r.code));
const statusLabels = { active: 'Enabled', inactive: 'Disabled', pending: 'Pending', suspended: 'Suspended', unknown: 'Not reported' };
const dateOf = value => value && !Number.isNaN(new Date(value).getTime()) ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) : 'Not recorded';
const lastSeen = value => {
  if (!value) return 'Never';
  const stamp = new Date(value); if (Number.isNaN(stamp.getTime())) return 'Not recorded';
  const today = new Date(); const days = Math.round((new Date(today.getFullYear(), today.getMonth(), today.getDate()) - new Date(stamp.getFullYear(), stamp.getMonth(), stamp.getDate())) / 86400000);
  return days === 0 ? `Today ${stamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : days === 1 ? 'Yesterday' : days > 1 && days < 8 ? `${days} days ago` : dateOf(value);
};
const issuesOf = u => [
  statusOf(u) === 'active' && u.is_mfa_enabled === false && 'MFA missing',
  statusOf(u) === 'pending' && 'Activation pending',
  statusOf(u) === 'suspended' && 'Account suspended',
  !emailOf(u) && 'Email missing',
  statusOf(u) === 'active' && ['terminated', 'inactive', 'resigned', 'exited'].includes(u.employment_status?.toLowerCase()) && 'Employment status requires review',
].filter(Boolean);

function Avatar({ user, large = false }) {
  const [failed, setFailed] = useState(false);
  const sharedPhoto = useCurrentProfilePhoto();
  const ownPhoto = String(user.user?.id || user.login_account_id) === String(sharedPhoto.userId) || (emailOf(user) && emailOf(user) === sharedPhoto.email);
  const photo = (ownPhoto ? sharedPhoto.photo : null) || user.profile_photo;
  useEffect(() => setFailed(false), [photo]);
  return <span className={`ua-avatar${large ? ' ua-avatar-large' : ''}`}>{photo && !failed ? <img key={photo} src={photo} alt="" onError={() => setFailed(true)} /> : nameOf(user).split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()}</span>;
}
Avatar.propTypes = { user: PropTypes.object.isRequired, large: PropTypes.bool };

function Status({ user }) {
  const status = statusOf(user);
  return <span className={`ua-chip ${status === 'active' ? 'ua-green' : status === 'pending' || status === 'suspended' ? 'ua-amber' : 'ua-neutral'}`}><span className="ua-dot" />{statusLabels[status] || status}</span>;
}
Status.propTypes = { user: PropTypes.object.isRequired };
function Mfa({ user }) {
  return user.is_mfa_enabled === true ? <span className="ua-chip ua-green"><CheckCircle2 />Enabled</span> : user.is_mfa_enabled === false ? <span className="ua-chip ua-amber"><AlertTriangle />Missing</span> : <span className="ua-chip ua-neutral">Not reported</span>;
}
Mfa.propTypes = { user: PropTypes.object.isRequired };

function SelectionBox({ checked, mixed, ...props }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = mixed; }, [mixed]);
  return <input ref={ref} type="checkbox" checked={checked} {...props} />;
}
SelectionBox.propTypes = { checked: PropTypes.bool, mixed: PropTypes.bool };

export default function UserDirectoryWorkspace({ users = [], roles = [], organizations = [], totalCount, currentUser, canManage, canDisable, onCreate, onImport, onExport, exporting, onEdit, onOpen, onRoles, onReset, onActivate, onDelete, onRefresh }) {
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [org, setOrg] = useState('all');
  const [role, setRole] = useState('all');
  const [mfa, setMfa] = useState('all');
  const [signal, setSignal] = useState('all');
  const [descending, setDescending] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [selected, setSelected] = useState(new Set());
  const [detailId, setDetailId] = useState(undefined);
  const [detailData, setDetailData] = useState(null);
  const [detailError, setDetailError] = useState('');
  const [detailBusy, setDetailBusy] = useState(false);
  const [activity, setActivity] = useState([]);
  const [activityError, setActivityError] = useState('');
  const [revision, setRevision] = useState(0);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [menu, setMenu] = useState(null);
  const menuRef = useRef(null);
  const [audit, setAudit] = useState({ rows: [], count: 0, busy: false, error: '' });
  const [auditPage, setAuditPage] = useState(1);
  const [auditRevision, setAuditRevision] = useState(0);
  const [operation, setOperation] = useState(null);
  const [chosenRole, setChosenRole] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [operationError, setOperationError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const refreshDirectory = async () => { setRefreshing(true); try { await onRefresh(); setRevision(n => n + 1); } catch { setMessage('The directory could not refresh. Please try again.'); } finally { setRefreshing(false); } };
  const [message, setMessage] = useState('');
  const dialogRef = useRef(null);

  const organizationOf = useCallback(u => u.organization_name || u.organization?.name || organizations.find(o => String(o.id) === String(u.organization))?.name || 'Not specified', [organizations]);
  const orgNames = [...new Set(users.map(organizationOf))].sort();
  const ownId = currentUser?.user?.id ?? currentUser?.id;
  const isSelf = u => ownId != null && String(u.user?.id) === String(ownId);
  const selectedUsers = users.filter(u => selected.has(String(u.id)));
  const activeId = detailId === undefined ? users[0]?.id : detailId;
  const activeUser = users.find(u => String(u.id) === String(activeId));
  const detail = activeUser ? { ...activeUser, ...(detailData?.id === activeUser.id ? detailData : {}) } : null;
  const attention = users.filter(u => issuesOf(u).length);
  const missingMfa = users.filter(u => statusOf(u) === 'active' && u.is_mfa_enabled === false).length;
  const pending = users.filter(u => statusOf(u) === 'pending').length;

  useEffect(() => {
    setSelected(previous => new Set([...previous].filter(id => users.some(u => String(u.id) === id))));
  }, [users]);
  useEffect(() => { setPage(1); }, [search, status, org, role, mfa, signal, tab, pageSize]);
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    setDetailData(null); setDetailError(''); setActivity([]); setActivityError(''); setDetailBusy(true);
    rbacService.getUserById(activeId).then(res => { if (!cancelled) setDetailData(res.data); }).catch(() => { if (!cancelled) setDetailError('Some user details could not be loaded.'); }).finally(() => { if (!cancelled) setDetailBusy(false); });
    rbacService.getAuditLogs({ resource_type: 'UserProfile', resource_id: activeId, page_size: 3, ordering: '-timestamp' }).then(res => { if (!cancelled) setActivity(res.data?.results || (Array.isArray(res.data) ? res.data : [])); }).catch(() => { if (!cancelled) setActivityError('Activity is unavailable or you do not have access.'); });
    return () => { cancelled = true; };
  }, [activeId, revision, users]);
  useEffect(() => {
    if (tab !== 'audit') return;
    let cancelled = false;
    setAudit(previous => ({ ...previous, busy: true, error: '' }));
    rbacService.getAuditLogs({ resource_type: 'UserProfile', page: auditPage, page_size: 10, ordering: '-timestamp' }).then(res => { if (!cancelled) setAudit({ rows: res.data?.results || [], count: res.data?.count || 0, busy: false, error: '' }); }).catch(() => { if (!cancelled) setAudit({ rows: [], count: 0, busy: false, error: 'Account audit could not be loaded. Check your access or try again.' }); });
    return () => { cancelled = true; };
  }, [tab, auditPage, auditRevision]);
  useEffect(() => {
    if (!menu) return;
    const outside = event => { if (!menuRef.current?.contains(event.target)) setMenu(null); };
    const escape = event => { if (event.key === 'Escape') setMenu(null); };
    document.addEventListener('mousedown', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', outside); document.removeEventListener('keydown', escape); };
  }, [menu]);
  useEffect(() => {
    if (operation && dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal();
  }, [operation]);

  const filtered = useMemo(() => users.filter(u => {
    const query = search.trim().toLowerCase();
    return (!query || [nameOf(u), emailOf(u), u.employee_id, u.department, u.job_title].some(v => String(v || '').toLowerCase().includes(query))) &&
      (status === 'all' || statusOf(u) === status) && (org === 'all' || organizationOf(u) === org) &&
      (role === 'all' || rolesOf(u).some(r => String(r.id) === role)) &&
      (mfa === 'all' || (mfa === 'enabled' ? u.is_mfa_enabled === true : mfa === 'missing' ? u.is_mfa_enabled === false : u.is_mfa_enabled == null)) &&
      (signal === 'all' || signal === 'enabled' && statusOf(u) === 'active' || signal === 'privileged' && privileged(u) || signal === 'attention' && issuesOf(u).length > 0) &&
      (tab !== 'invitations' || statusOf(u) === 'pending') && (tab !== 'lifecycle' || issuesOf(u).length > 0);
  }).sort((a, b) => nameOf(a).localeCompare(nameOf(b)) * (descending ? -1 : 1)), [users, search, status, org, role, mfa, signal, tab, descending, organizationOf]); // organization labels are resolved from the current directory
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pages);
  const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const selectable = visible.filter(u => !isSelf(u));
  const selectedOnPage = selectable.filter(u => selected.has(String(u.id))).length;
  const pageNumbers = [...new Set([1, ...Array.from({ length: 5 }, (_, i) => safePage - 2 + i).filter(n => n > 1 && n < pages), pages])].sort((a, b) => a - b);
  const clearFilters = () => { setSearch(''); setStatus('all'); setOrg('all'); setRole('all'); setMfa('all'); setSignal('all'); setPage(1); };
  const chooseTab = value => { setTab(value); clearFilters(); setSelected(new Set()); };
  const selectOne = id => setSelected(previous => { const next = new Set(previous); next.has(String(id)) ? next.delete(String(id)) : next.add(String(id)); return next; });
  const selectPage = () => setSelected(previous => { const next = new Set(previous); selectable.forEach(u => selectedOnPage === selectable.length ? next.delete(String(u.id)) : next.add(String(u.id))); return next; });
  const chooseSignal = value => { chooseTab('all'); setSignal(value); };
  const openMenu = (event, user = null, kind = 'user') => { event.stopPropagation(); const box = event.currentTarget.getBoundingClientRect(); setMenu({ user, kind, left: Math.max(8, Math.min(box.right - 210, window.innerWidth - 218)), top: Math.max(8, Math.min(box.bottom + 5, window.innerHeight - 285)) }); };
  const openOperation = (kind, targets) => { setMenu(null); setOperation({ kind, targets: targets.filter(u => !isSelf(u) && (kind !== 'disable' || statusOf(u) === 'active')) }); setReason(''); setChosenRole(''); setOperationError(''); };
  const runOperation = async event => {
    event.preventDefault(); if (busy || !operation?.targets.length) return;
    if (operation.kind === 'disable' && (!canDisable || !reason.trim()) || operation.kind === 'role' && (!canManage || !chosenRole)) return;
    setBusy(true); setOperationError('');
    const failures = []; let completed = 0;
    for (const user of operation.targets) {
      try { if (operation.kind === 'disable') await rbacService.deactivateUser(user.id, reason.trim()); else await rbacService.assignRole(user.id, chosenRole, false); completed += 1; }
      catch { failures.push(user); }
    }
    let refreshFailed = false;
    try { await onRefresh(); setRevision(n => n + 1); } catch { refreshFailed = true; setMessage('Changes were submitted, but the directory could not refresh. Reload the page to check the latest state.'); }
    setSelected(previous => new Set([...previous].filter(id => !operation.targets.some(u => String(u.id) === id) || failures.some(u => String(u.id) === id))));
    setBusy(false);
    if (failures.length) { setOperation({ ...operation, targets: failures }); setOperationError(`${completed} completed; ${failures.length} failed. Only failed accounts remain in this review.`); }
    else { if (!refreshFailed) setMessage(`${completed} account${completed === 1 ? '' : 's'} ${operation.kind === 'disable' ? 'disabled' : 'updated with the selected role'}.`); setOperation(null); }
  };

  const signals = [
    { id: 'all', label: 'Total users', value: totalCount ?? users.length, hint: `Across ${orgNames.filter(n => n !== 'Not specified').length} organizations`, icon: Users, color: 'blue' },
    { id: 'enabled', label: 'Enabled accounts', value: users.filter(u => statusOf(u) === 'active').length, hint: 'Can sign in', icon: CheckCircle2, color: 'green' },
    { id: 'privileged', label: 'Privileged users', value: users.filter(privileged).length, hint: 'Admin-level access', icon: Shield, color: 'indigo' },
    { id: 'attention', label: 'Attention required', value: attention.length, hint: 'MFA or account issues', icon: AlertTriangle, color: 'amber' },
  ];
  return <div className="ua-workspace">

    <header className="ua-page-heading"><div><h1>Users Management </h1><p>Manage identities, account status and assigned access.</p></div><div className="ua-actions"><button onClick={event => openMenu(event, null, 'export')} disabled={exporting}><Download />{exporting ? 'Exporting…' : 'Export users'}</button><button onClick={onImport} disabled={!canManage}><Upload />Import users</button><button className="ua-primary" onClick={onCreate} disabled={!canManage}><Plus />Add user</button></div></header>
    {message && <div className="ua-message" role="status">{message}<button className="ua-icon-button" aria-label="Dismiss message" onClick={() => setMessage('')}><X /></button></div>}
    <div className={`ua-grid${detail ? '' : ' ua-no-context'}`}><main className="ua-main">
      <div className="ua-signals">{signals.map(({ id, label, value, hint, icon: Icon, color }) => <button key={id} data-tone={color} className={`ua-signal${signal === id && id !== 'all' ? ' ua-signal-selected' : ''}`} aria-pressed={signal === id} onClick={() => chooseSignal(id)}><span className={`ua-signal-icon ua-${color}`}><Icon /></span><span><span className="ua-signal-label">{label}</span><strong className={id === 'attention' && value > 0 ? 'ua-warning-number' : ''}>{value}</strong><span className="ua-support">{hint}</span></span></button>)}</div>
      <div className="ua-tabs" role="tablist" aria-label="User workspace">{[['all', 'All users'], ['invitations', 'Invitations'], ['lifecycle', 'Lifecycle tasks'], ['audit', 'Audit']].map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => chooseTab(id)}>{label}</button>)}</div>
      {!bannerDismissed && attention.length > 0 && <div className="ua-review-banner"><AlertTriangle /><strong>{attention.length} account{attention.length === 1 ? '' : 's'} require review</strong><span>{[missingMfa > 0 && `${missingMfa} missing MFA`, pending > 0 && `${pending} pending activation`].filter(Boolean).join(' · ') || 'Account or employee information needs attention'}</span><button onClick={() => chooseSignal('attention')}>Review accounts</button><button className="ua-icon-button" aria-label="Dismiss account review banner" onClick={() => setBannerDismissed(true)}><X /></button></div>}
      {tab === 'audit' ? <section className="ua-directory"><div className="ua-section-heading"><h2>Account audit</h2><button onClick={() => setAuditRevision(n => n + 1)} aria-label="Reload account audit"><RefreshCw /></button></div>{audit.busy ? <p className="ua-empty" role="status">Loading account changes…</p> : audit.error ? <p className="ua-empty ua-error" role="alert">{audit.error}</p> : <><div className="ua-table-wrap"><table><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Account</th><th>Outcome</th></tr></thead><tbody>{audit.rows.map(log => <tr key={log.id}><td>{dateOf(log.timestamp)}</td><td>{log.user_email || 'System'}</td><td>{(log.action || '').replaceAll('_', ' ')}</td><td>{log.resource_repr || log.resource_id || 'Not recorded'}</td><td><span className={`ua-chip ${log.success === false ? 'ua-amber' : 'ua-green'}`}>{log.success === false ? 'Failed' : 'Success'}</span></td></tr>)}</tbody></table>{!audit.rows.length && <p className="ua-empty">No account changes recorded.</p>}</div><div className="ua-pagination"><span>{audit.count} account changes</span><div className="ua-actions"><button disabled={auditPage === 1} onClick={() => setAuditPage(n => n - 1)}>Previous</button><span>Page {auditPage}</span><button disabled={auditPage * 10 >= audit.count} onClick={() => setAuditPage(n => n + 1)}>Next</button></div></div></>}</section> : <section className="ua-directory" aria-label="User directory">
        <div className="ua-section-heading"><h2>{tab === 'invitations' ? 'Pending accounts' : tab === 'lifecycle' ? 'Account review queue' : 'User directory'}</h2><span>{filtered.length} users</span></div>
        {tab === 'invitations' && <p className="ua-tab-note">Accounts waiting for activation. Invitation delivery status is not available.</p>}
        {tab === 'lifecycle' && <p className="ua-tab-note">Review MFA, activation and employment status before changing account access.</p>}
        <div className="ua-filters"><label className="ua-search"><Search /><input aria-label="Search users" placeholder="Search name, email, employee ID or job title…" value={search} onChange={e => setSearch(e.target.value)} /></label><select aria-label="Account status" value={status} onChange={e => setStatus(e.target.value)}><option value="all">Account status</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select aria-label="Organization" value={org} onChange={e => setOrg(e.target.value)}><option value="all">Organization</option>{orgNames.map(n => <option key={n}>{n}</option>)}</select><select aria-label="Role" value={role} onChange={e => setRole(e.target.value)}><option value="all">Role</option>{roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select><select aria-label="MFA" value={mfa} onChange={e => setMfa(e.target.value)}><option value="all">MFA</option><option value="enabled">Enabled</option><option value="missing">Missing</option><option value="unknown">Not reported</option></select><button className="ua-text-button" onClick={clearFilters}>Clear filters</button></div>
        {totalCount > users.length && <p className="ua-tab-note">{users.length} of {totalCount} accounts loaded. Filters apply to the loaded directory.</p>}
        <div className="ua-table-wrap"><table><thead><tr><th className="ua-select-cell"><SelectionBox aria-label="Select users on this page" checked={selectable.length > 0 && selectedOnPage === selectable.length} mixed={selectedOnPage > 0 && selectedOnPage < selectable.length} onChange={selectPage} disabled={!selectable.length} /></th><th><button className="ua-sort" onClick={() => setDescending(v => !v)}>User {descending ? <ArrowDown /> : <ArrowUp />}</button></th><th>Organization</th><th>Department</th><th>Roles</th><th>MFA</th><th>Last sign-in</th><th>Account status</th><th>Actions</th></tr></thead><tbody>{visible.map(user => <tr key={user.id} className={selected.has(String(user.id)) || String(activeId) === String(user.id) ? 'ua-row-selected' : ''} onClick={() => setDetailId(user.id)}><td onClick={e => e.stopPropagation()}><input aria-label={`Select ${nameOf(user)}`} type="checkbox" checked={selected.has(String(user.id))} disabled={isSelf(user)} title={isSelf(user) ? 'Your own access is protected' : undefined} onChange={() => selectOne(user.id)} /></td><td><button className="ua-user-button" onClick={() => setDetailId(user.id)} aria-label={`View details for ${nameOf(user)}`}><Avatar user={user} /><span><strong>{nameOf(user)}</strong><small>{user.job_title || emailOf(user) || 'Title not specified'}</small></span></button></td><td>{organizationOf(user)}</td><td>{user.department || 'Not specified'}</td><td><div className="ua-role-list"><span className="ua-role">{rolesOf(user)[0]?.name || 'Unassigned'}</span>{rolesOf(user).length > 1 && <span className="ua-role" title={rolesOf(user).slice(1).map(r => r.name).join(', ')}>+{rolesOf(user).length - 1}</span>}</div></td><td><Mfa user={user} /></td><td className="ua-muted" title={dateOf(user.last_login_at)}>{lastSeen(user.last_login_at)}</td><td><Status user={user} /></td><td onClick={e => e.stopPropagation()}><div className="ua-row-actions"><button onClick={() => onOpen(user)} aria-label={`Open ${nameOf(user)}`}>Open</button><button className="ua-icon-button" aria-label={`Actions for ${nameOf(user)}`} aria-haspopup="menu" onClick={e => openMenu(e, user)}><MoreHorizontal /></button></div></td></tr>)}</tbody></table>{!visible.length && <div className="ua-empty"><Users /><strong>No users match this view</strong><p>Try another search or clear your filters.</p><button onClick={clearFilters}>Clear filters</button></div>}</div>
        {selectedUsers.length > 0 && <div className="ua-selection-bar"><SelectionBox aria-label="Clear user selection" checked mixed={false} onChange={() => setSelected(new Set())} /><strong>{selectedUsers.length} users selected</strong><span>{new Set(selectedUsers.map(organizationOf)).size} organizations affected</span><div className="ua-actions"><button disabled={!canManage} onClick={() => openOperation('role', selectedUsers)}><UserPlus />Assign role</button><button disabled title="MFA enrollment and enforcement are not available in this directory"><Shield />Require MFA</button><button className="ua-danger" disabled={!canDisable || !selectedUsers.some(u => statusOf(u) === 'active')} onClick={() => openOperation('disable', selectedUsers)}><Ban />Disable accounts…</button><button className="ua-text-button" onClick={() => setSelected(new Set())}>Clear</button></div></div>}
        <div className="ua-pagination"><span>Showing <strong>{filtered.length ? (safePage - 1) * pageSize + 1 : 0}–{Math.min(safePage * pageSize, filtered.length)}</strong> of <strong>{filtered.length}</strong> users</span><nav className="ua-pages" aria-label="User directory pages"><button aria-label="Previous page" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}><ChevronLeft /></button>{pageNumbers.map((number, index) => <React.Fragment key={number}>{index > 0 && number - pageNumbers[index - 1] > 1 && <span>…</span>}<button aria-label={`Page ${number}`} aria-current={safePage === number ? 'page' : undefined} onClick={() => setPage(number)}>{number}</button></React.Fragment>)}<button aria-label="Next page" disabled={safePage === pages} onClick={() => setPage(safePage + 1)}><ChevronRight /></button></nav><label className="ua-page-size">Rows per page <select aria-label="Rows per page" value={pageSize} onChange={e => setPageSize(Number(e.target.value))}>{[6, 10, 20, 50].map(n => <option key={n}>{n}</option>)}</select></label></div>
        {canManage && <div className="ua-directory-footer"><span>Account access is managed independently of employment status.</span><button className="ua-text-button" disabled={refreshing} onClick={refreshDirectory}><RefreshCw />Refresh directory</button></div>}
      </section>}
    </main>{detail && <aside className="ua-details" aria-label="User details" aria-busy={detailBusy}><div className="ua-section-heading"><h2>User details</h2><button className="ua-icon-button" aria-label="Close user details" onClick={() => setDetailId(null)}><X /></button></div><div className="ua-person"><Avatar user={detail} large /><div><h3>{nameOf(detail)}</h3><p>{detail.job_title || 'Title not specified'}</p><small>Employee ID: {detail.employee_id || detail.canonical_identity?.employee_number || 'Not recorded'}</small></div><div className="ua-actions"><button className="ua-primary" onClick={() => onOpen(detail)}>Open user</button><button className="ua-icon-button" aria-label="Selected user actions" onClick={e => openMenu(e, detail)}><MoreHorizontal /></button></div></div>
      {detailError && <div className="ua-tab-note ua-error" role="alert">{detailError}<button className="ua-text-button" onClick={() => setRevision(n => n + 1)}>Retry</button></div>}
      <section><h3>Identity information</h3><dl><dt>Account status</dt><dd><Status user={detail} /></dd><dt>Identity source</dt><dd>{detail.canonical_employee || detail.canonical_identity?.employee_uuid ? 'Employee directory' : 'Application account'}</dd><dt>Organization</dt><dd>{organizationOf(detail)}</dd><dt>Department</dt><dd>{detail.department || 'Not specified'}</dd><dt>Email</dt><dd>{emailOf(detail) ? <a href={`mailto:${emailOf(detail)}`}>{emailOf(detail)}</a> : 'Not recorded'}{detail.user?.is_verified === true && <span className="ua-verified"><CheckCircle2 />Verified</span>}</dd></dl></section>
      <section><div className="ua-security-heading"><h3>Sign-in security</h3><Mfa user={detail} /><button disabled title="MFA enrollment and enforcement are not available in this directory">Require MFA</button></div><dl><dt>Last sign-in</dt><dd>{lastSeen(detail.last_login_at)}</dd><dt>Active sessions</dt><dd>{detail.active_sessions ?? 'Not reported'}</dd></dl></section>
      <section><h3>Access</h3><dl><dt>Roles</dt><dd><div className="ua-role-list">{rolesOf(detail).map(r => <span className="ua-role" key={r.id}>{r.name}</span>)}{!rolesOf(detail).length && 'Unassigned'}</div><button className="ua-text-button" onClick={() => onOpen(detail)}>View effective access <ExternalLink /></button></dd><dt>Privileged access</dt><dd>{privileged(detail) ? 'Admin-level access' : 'None'}</dd></dl></section>
      <section><h3>Employee information</h3><dl><dt>Employee status</dt><dd>{detail.employment_status ? <span className={`ua-chip ${detail.employment_status.toLowerCase() === 'active' ? 'ua-green' : 'ua-neutral'}`}><span className="ua-dot" />{detail.employment_status}</span> : 'Not recorded'}</dd><dt>Manager</dt><dd>{detail.manager_detail?.id ? <Link to={`/admin/users/${detail.manager_detail.id}`}>{detail.manager_name || detail.manager_detail.name}</Link> : detail.manager_name || 'Not recorded'}</dd><dt>Joined date</dt><dd>{dateOf(detail.join_date)}</dd><dt>Account provisioned</dt><dd>{dateOf(detail.created_at)}</dd></dl></section>
      <section><h3>Recent activity</h3>{activityError ? <p className="ua-support">{activityError}</p> : activity.length ? <ol className="ua-activity">{activity.map(log => <li key={log.id}><span className="ua-activity-icon"><Clock3 /></span><span>{(log.action || 'Account update').replaceAll('_', ' ')}</span><time dateTime={log.timestamp} title={dateOf(log.timestamp)}>{lastSeen(log.timestamp)}</time></li>)}</ol> : <p className="ua-support">{detailBusy ? 'Loading activity…' : 'No account changes recorded.'}</p>}</section>
      <div className="ua-impact-note"><AlertTriangle /><span>Disabling an account blocks sign-in and requires a reason.</span></div><div className="ua-audit-note"><Info />Account and access changes are recorded in the audit log.</div>
    </aside>}</div>
    {menu && createPortal(<div ref={menuRef} className="ua-menu" role="menu" style={{ left: menu.left, top: menu.top }}>{menu.kind === 'export' ? <><button role="menuitem" onClick={() => { setMenu(null); onExport('csv'); }}><FileText />Export as CSV</button><button role="menuitem" onClick={() => { setMenu(null); onExport('xlsx'); }}><FileText />Export as Excel</button></> : <><button role="menuitem" onClick={() => { onOpen(menu.user); setMenu(null); }}>Open user</button><button role="menuitem" disabled={!canManage} onClick={() => { onEdit(menu.user); setMenu(null); }}>Edit account</button><button role="menuitem" disabled={!canManage || isSelf(menu.user)} onClick={() => { onRoles(menu.user); setMenu(null); }}>Manage roles</button><button role="menuitem" disabled={!canDisable || isSelf(menu.user)} onClick={() => { onReset(menu.user); setMenu(null); }}>Reset password</button>{statusOf(menu.user) === 'active' ? <button role="menuitem" className="ua-danger" disabled={!canDisable || isSelf(menu.user)} onClick={() => openOperation('disable', [menu.user])}>Disable account…</button> : <button role="menuitem" disabled={!canDisable || isSelf(menu.user)} onClick={() => { onActivate(menu.user); setMenu(null); }}>Enable account</button>}{onDelete && <button role="menuitem" className="ua-danger" disabled={!canDisable || isSelf(menu.user)} onClick={() => { onDelete(menu.user); setMenu(null); }}>Delete account?</button>}</>}</div>, document.body)}
    {operation && <dialog ref={dialogRef} className="ua-confirm" aria-labelledby="ua-operation-title" onCancel={event => { event.preventDefault(); if (!busy) setOperation(null); }}><form onSubmit={runOperation}><div className="ua-section-heading"><h2 id="ua-operation-title">{operation.kind === 'disable' ? 'Disable accounts' : 'Assign role'}</h2><button type="button" className="ua-icon-button" disabled={busy} onClick={() => setOperation(null)} aria-label="Close action review"><X /></button></div><p>{operation.targets.length} accounts across {new Set(operation.targets.map(organizationOf)).size} organizations will be affected.</p><ul className="ua-targets">{operation.targets.map(u => <li key={u.id}><strong>{nameOf(u)}</strong><span>{emailOf(u)}</span></li>)}</ul>{operation.kind === 'disable' ? <><div className="ua-impact-note"><AlertTriangle />These accounts will lose sign-in access. Their role assignments are retained.</div><label className="ua-field">Reason for disabling accounts<textarea required value={reason} disabled={busy} onChange={e => setReason(e.target.value)} placeholder="Explain why access is being disabled…" /></label></> : <><label className="ua-field">Role to add<select value={chosenRole} disabled={busy} required onChange={e => setChosenRole(e.target.value)}><option value="">Select a role</option>{roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label><p className="ua-support">Adds the selected role while preserving existing assignments.</p>{roles.find(r => String(r.id) === chosenRole)?.code?.includes('admin') && <div className="ua-impact-note"><AlertTriangle />This role grants privileged access. Review every affected account before continuing.</div>}</>}{operationError && <p role="alert" className="ua-error">{operationError}</p>}<div className="ua-confirm-footer"><button type="button" disabled={busy} onClick={() => setOperation(null)}>Cancel</button><button className={operation.kind === 'disable' ? 'ua-destructive' : 'ua-primary'} disabled={busy || !operation.targets.length || (operation.kind === 'disable' ? !reason.trim() : !chosenRole)}>{busy ? 'Applying…' : operation.kind === 'disable' ? `Disable ${operation.targets.length} accounts` : 'Assign role'}</button></div></form></dialog>}
  </div>;
}

UserDirectoryWorkspace.propTypes = {
  users: PropTypes.array, roles: PropTypes.array, organizations: PropTypes.array, totalCount: PropTypes.number,
  currentUser: PropTypes.object, canManage: PropTypes.bool, canDisable: PropTypes.bool, exporting: PropTypes.bool,
  onCreate: PropTypes.func.isRequired, onImport: PropTypes.func.isRequired, onExport: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired, onOpen: PropTypes.func.isRequired, onRoles: PropTypes.func.isRequired,
  onReset: PropTypes.func.isRequired, onActivate: PropTypes.func.isRequired, onDelete: PropTypes.func, onRefresh: PropTypes.func.isRequired,
};
