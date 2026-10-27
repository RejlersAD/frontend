import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Check, Search, ShieldCheck, Users } from 'lucide-react';
import rbacService from '../../services/rbac.service';

const TABS = [
  ['executive_dashboard.view_overview', 'Overview'],
  ['executive_dashboard.view_financial', 'Financial performance'],
  ['executive_dashboard.view_portfolio', 'Project portfolio'],
  ['executive_dashboard.view_commercial', 'Commercial pipeline'],
  ['executive_dashboard.view_workforce', 'Workforce'],
  ['executive_dashboard.view_risk', 'Risk & Compliance'],
];
const userLabel = user => [user.user?.first_name, user.user?.last_name].filter(Boolean).join(' ') || user.user?.email || user.email;
const initials = user => userLabel(user).split(/[\s.@]+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase();
const TAB_DESCRIPTIONS = {
  'executive_dashboard.view_overview': 'Company performance and priorities',
  'executive_dashboard.view_financial': 'Invoicing, collections and financial outlook',
  'executive_dashboard.view_portfolio': 'Project delivery and portfolio performance',
  'executive_dashboard.view_commercial': 'Sales pipeline and client exposure',
  'executive_dashboard.view_workforce': 'Capacity, utilization and workforce risk',
  'executive_dashboard.view_risk': 'Enterprise risk, QHSE and assurance',
};

export default function ExecutiveTabAssignment({ canAssign }) {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [access, setAccess] = useState(null);
  const [checked, setChecked] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const requestId = useRef(0);

  useEffect(() => {
    let active = true;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const response = await rbacService.getUsers({ search: query.trim(), page_size: 20 });
        const body = response.data ?? response;
        if (active) { setUsers(Array.isArray(body) ? body : body.results || []); setError(''); }
      } catch { if (active) setError('Could not load users. Try searching again.'); }
      finally { if (active) setSearching(false); }
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [query]);

  useEffect(() => () => { requestId.current += 1; }, []);

  const selectUser = async user => {
    const current = ++requestId.current;
    setSelected(user); setAccess(null); setChecked({}); setMessage(''); setError(''); setLoading(true);
    try {
      const response = await rbacService.getUserPermissionOverrides(user.id);
      if (current !== requestId.current) return;
      setAccess(response.data);
      setChecked(Object.fromEntries(response.data.permissions.map(p => [p.code, p.effective])));
    } catch { if (current === requestId.current) setError('Could not load this user’s access. Select the user to try again.'); }
    finally { if (current === requestId.current) setLoading(false); }
  };

  const rows = TABS.map(([code, label]) => ({ code, label, permission: access?.permissions.find(p => p.code === code) }));
  const unavailable = rows.some(row => !row.permission);
  const locked = !canAssign || access?.locked;
  const readDenied = rows.some(row => checked[row.code]) && access?.permissions.some(
    permission => permission.code === 'executive_dashboard.read' && permission.effect === 'deny',
  );
  const changes = rows.filter(row => row.permission && row.permission.effect !== (checked[row.code] ? 'allow' : 'deny'))
    .map(row => ({ permission_id: row.permission.id, effect: checked[row.code] ? 'allow' : 'deny' }));
  const assign = async event => {
    event.preventDefault();
    if (!access || locked || saving || unavailable || readDenied) return;
    if (!changes.length) { setMessage('This user already has the selected tab access.'); return; }
    setSaving(true); setError(''); setMessage('');
    try {
      const names = rows.filter(row => checked[row.code]).map(row => row.label);
      const response = await rbacService.saveUserPermissionOverrides(selected.id, {
        snapshot: access.snapshot,
        reason: `Executive tab assignment: ${names.join(', ') || 'no tabs selected'}.`,
        changes,
      });
      setAccess(response.data);
      setChecked(Object.fromEntries(response.data.permissions.map(p => [p.code, p.effective])));
      setMessage(`Tab access assigned to ${userLabel(selected)}.`);
      window.dispatchEvent(new Event('radai:access-changed'));
    } catch (failure) {
      setError(failure.response?.status === 409
        ? 'This user’s access changed. Select the user again to load the latest access.'
        : failure.response?.data?.detail || 'Access was not assigned. Try again.');
    } finally { setSaving(false); }
  };

  return <section className="ra-panel ra-executive-assignment" aria-labelledby="executive-assignment-title">
    <div className="ra-executive-heading"><h2 id="executive-assignment-title">Executive tab access</h2>
      <p>Choose a user, select the tabs they can see, then click Assign.</p></div>
    <div className="ra-executive-assignment-grid">
      <section className="ra-executive-user-panel" aria-label="Select user">
        <div className="ra-executive-search-area">
          <label className="ra-executive-search-label" htmlFor="executive-user-search">Select user</label>
          <div className="ra-executive-search-field"><Search size={16} aria-hidden="true" /><input id="executive-user-search" aria-label="Search user for Executive access" placeholder="Search by name or email" value={query} disabled={saving} onChange={event => setQuery(event.target.value)} /></div>
          <p className="ra-executive-list-count">{searching ? 'Searching users…' : `${users.length} users shown`}</p>
        </div>
        <div className="ra-executive-users" aria-label="Users for Executive access" aria-busy={searching}>
          {searching ? <p className="ra-executive-list-message" role="status">Loading users…</p> : users.length ? users.map(user => <button key={user.id} type="button" aria-pressed={selected?.id === user.id} disabled={saving} onClick={() => selectUser(user)}>
            <span className="ra-executive-avatar" aria-hidden="true">{initials(user)}</span>
            <span className="ra-executive-user-identity"><strong>{userLabel(user)}</strong><span>{user.user?.email || user.email}</span></span>
            {selected?.id === user.id && <Check className="ra-executive-user-check" size={17} aria-hidden="true" />}
          </button>) : <p className="ra-executive-list-message">No matching users. Try another name or email.</p>}
        </div>
      </section>
      <form className="ra-executive-editor" aria-label="Assign Executive tabs" onSubmit={assign}>
        {!selected ? <div className="ra-executive-empty"><span className="ra-executive-empty-icon"><Users size={28} aria-hidden="true" /></span><h3>Select a user to assign access</h3><p>Choose a name from the list to manage their Executive tabs.</p></div>
          : <div className="ra-executive-selection-header"><span className="ra-executive-avatar" aria-hidden="true">{initials(selected)}</span><div><h3>{userLabel(selected)}</h3><p>{selected.user?.email || selected.email}</p></div></div>}
        {loading && <p className="ra-executive-feedback" role="status">Loading tab access…</p>}
        {access && <>
          <div className="ra-executive-choices"><h3>Tabs this user can see</h3><p>Tick a tab to allow access. Leave it unticked to hide it.</p>
            {rows.map(row => <label className={`ra-executive-tab-choice${checked[row.code] ? ' is-selected' : ''}`} key={row.code}><input type="checkbox" aria-label={row.label} checked={Boolean(checked[row.code])} disabled={locked || saving || !row.permission} onChange={event => { setChecked(previous => ({ ...previous, [row.code]: event.target.checked })); setMessage(''); }} /><span><strong>{row.label}</strong><small>{TAB_DESCRIPTIONS[row.code]}</small></span></label>)}
            {unavailable && <p role="alert">Executive tab permissions are not available on this server yet.</p>}
            {readDenied && <p role="alert">This user has an explicit denial for Executive View. Remove that denial in their individual permissions before assigning tab access.</p>}
            {locked && <p>{access.lock_reason || 'Only a Super Administrator can assign access.'}</p>}
          </div>
          <div className="ra-executive-assignment-footer"><p><ShieldCheck size={16} aria-hidden="true" />Changes apply to this user only.</p><button className="ra-primary" type="submit" disabled={locked || saving || unavailable || readDenied}>{saving ? 'Assigning…' : 'Assign'}</button></div>
          <p className="ra-executive-access-note">A selected tab includes access to the Executive page. Department data restrictions and explicit access denials still apply.</p>
        </>}
        {error && <p className="ra-executive-feedback" role="alert">{error}</p>}
        {message && <p className="ra-executive-feedback" role="status">{message}</p>}
      </form>
    </div>
  </section>;
}

ExecutiveTabAssignment.propTypes = { canAssign: PropTypes.bool.isRequired };
