import { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowDown, ArrowUp, Building2, ChevronsUpDown, ExternalLink, FileText, Mail, MoreHorizontal, Pencil, Plus, RefreshCw, User } from 'lucide-react';
import salesService from '../../services/sales.service';
import SalesActionDialog from './SalesActionDialog';
import SalesOpportunityRegistrationDialog from './SalesOpportunityRegistrationDialog';
import { clientIndustry, loadClientPages } from './salesClientRegister';
import { displayDate, humanize } from './salesOpportunityRegister';

const TABS = ['Overview', 'Contacts', 'Opportunities', 'Proposals', 'Frameworks', 'Activity'];
const RELATED_SOURCES = {
  opportunities: params => salesService.getDeals(params),
  proposals: params => salesService.getQuotes(params),
  frameworks: params => salesService.getFrameworks(params),
  activities: params => salesService.getActivities(params),
};
const CONTACT_ACTION = {
  title: 'Add contact', submitLabel: 'Add contact',
  fields: [
    { name: 'first_name', label: 'First name', required: true },
    { name: 'last_name', label: 'Last name', required: true },
    { name: 'email', label: 'Email', type: 'email', required: true },
    { name: 'job_title', label: 'Job title' },
    { name: 'phone', label: 'Phone', type: 'tel' },
    { name: 'is_primary', label: 'Primary contact', type: 'checkbox' },
  ],
};
const ACTIVITY_ACTION = {
  title: 'Log activity', submitLabel: 'Log activity',
  fields: [
    { name: 'activity_type', label: 'Type', type: 'select', required: true, options: [
      { value: 'call', label: 'Phone call' }, { value: 'email', label: 'Email' },
      { value: 'meeting', label: 'Meeting' }, { value: 'demo', label: 'Demo / presentation' },
      { value: 'site_visit', label: 'Site visit' }, { value: 'proposal', label: 'Proposal submitted' },
      { value: 'follow_up', label: 'Follow-up' }, { value: 'negotiation', label: 'Negotiation' },
      { value: 'other', label: 'Other' },
    ] },
    { name: 'subject', label: 'Subject', required: true },
    { name: 'outcome', label: 'Outcome', type: 'textarea' },
    { name: 'follow_up_date', label: 'Follow-up date', type: 'date' },
  ],
};
const missing = value => typeof value === 'string' && value.trim() ? value.trim() : '—';
const dateLabel = value => value ? displayDate(value) : '—';
const ownerName = record => record.account_manager_name?.trim()
  || record.account_manager_details?.full_name?.trim()
  || [record.account_manager_details?.first_name, record.account_manager_details?.last_name].filter(Boolean).join(' ')
  || record.account_manager_details?.username
  || (record.account_manager ? 'Name unavailable' : 'Unassigned');
const statusName = status => status === 'former' ? 'Former client' : humanize(status) || 'Unavailable';
const safeWebsite = value => {
  try {
    const url = new URL(String(value || ''));
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
};
const sourceError = (error, fallback) => {
  if (error?.response?.status === 403) return 'You do not have permission to view these records.';
  if (error?.response?.status === 401) return 'Your session has expired. Sign in again to view these records.';
  return fallback;
};
const actionError = error => {
  if ([401, 403].includes(error?.response?.status)) return 'You do not have permission to save this action. Your entries are retained.';
  if (error?.response?.status === 409) return 'This record changed. Your entries are retained; review the latest client before retrying.';
  const data = error?.response?.data;
  if (error?.response?.status === 400 && data && typeof data === 'object') {
    const messages = Object.entries(data).flatMap(([field, value]) => {
      const message = Array.isArray(value) ? value[0] : value;
      return typeof message === 'string' ? [`${field === 'detail' || field === 'non_field_errors' ? '' : `${humanize(field)}: `}${message}`] : [];
    });
    if (messages.length) return messages.slice(0, 3).join(' ');
  }
  return 'The action could not be saved. Your entries are retained; please retry.';
};

function ClientStatus({ status }) {
  return <span className={`scl-status scl-status-${['active', 'prospect'].includes(status) ? status : 'inactive'}`}>{statusName(status)}</span>;
}
ClientStatus.propTypes = { status: PropTypes.string };

function ClientMenu({ onEdit, onOpenFullRecord, onRefresh }) {
  const ref = useRef(null);
  useEffect(() => {
    const close = event => { if (ref.current && !ref.current.contains(event.target)) ref.current.open = false; };
    const escape = event => { if (event.key === 'Escape' && ref.current?.open) { ref.current.open = false; ref.current.querySelector('summary')?.focus(); } };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape); };
  }, []);
  return <details className="scl-menu" ref={ref}>
    <summary className="scl-button scl-icon-button" aria-label="More client actions"><MoreHorizontal size={19} /></summary>
    <div className="scl-menu-content" onClick={event => { if (event.target.closest('button')) ref.current.open = false; }}>
      <button type="button" onClick={onOpenFullRecord}><FileText size={16} />Open full client record</button>
      <button type="button" onClick={onEdit}><Pencil size={16} />Edit client</button>
      <button type="button" onClick={onRefresh}><RefreshCw size={16} />Refresh client</button>
    </div>
  </details>;
}
ClientMenu.propTypes = { onEdit: PropTypes.func.isRequired, onOpenFullRecord: PropTypes.func.isRequired, onRefresh: PropTypes.func.isRequired };

function useClientRelated(clientId, revision) {
  const empty = () => Object.fromEntries(Object.keys(RELATED_SOURCES).map(key => [key, { records: [], loading: true, error: '' }]));
  const [sources, setSources] = useState(empty);
  const generation = useRef(0);
  const requests = useRef({});
  const load = useCallback(async key => {
    const current = generation.current;
    const request = (requests.current[key] || 0) + 1;
    requests.current[key] = request;
    setSources(previous => ({ ...previous, [key]: { records: [], loading: true, error: '' } }));
    try {
      const data = await loadClientPages(params => RELATED_SOURCES[key]({ ...params, client: clientId }));
      if (current !== generation.current || request !== requests.current[key]) return;
      // A linked register must never render a row for a different client.
      if (data.results.some(row => String(row.client) !== String(clientId))) throw new Error('Unexpected linked client.');
      setSources(previous => ({ ...previous, [key]: { records: data.results, loading: false, error: '' } }));
    } catch (error) {
      if (current === generation.current && request === requests.current[key]) setSources(previous => ({ ...previous, [key]: { records: [], loading: false, error: sourceError(error, `Linked ${key === 'activities' ? 'activity' : key} could not be loaded.`) } }));
    }
  }, [clientId]);
  useEffect(() => {
    const currentGeneration = generation;
    ++currentGeneration.current;
    Object.keys(RELATED_SOURCES).forEach(key => { void load(key); });
    return () => { ++currentGeneration.current; };
  }, [load, revision]);
  return [sources, load];
}

function RelatedState({ source, name, onRetry, children }) {
  if (source.loading) return <p className="scl-inline-state" role="status">Loading {name}…</p>;
  if (source.error) return <div className="scl-inline-state scl-inline-error" role="alert"><AlertCircle size={17} /><span>{source.error}</span><button type="button" className="scl-text-button" onClick={onRetry}>Retry</button></div>;
  if (!source.records.length) return <p className="scl-inline-state">No {name} linked to this client.</p>;
  return children;
}
RelatedState.propTypes = { source: PropTypes.object.isRequired, name: PropTypes.string.isRequired, onRetry: PropTypes.func.isRequired, children: PropTypes.node };

function Contacts({ contacts, overview, onAdd, onViewAll }) {
  const sorted = [...contacts].sort((a, b) => Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)));
  const shown = overview ? sorted.filter(contact => contact.is_active !== false).slice(0, 2) : sorted;
  return <section className="scl-section scl-contacts-section">
    <div className="scl-section-heading"><h3>{overview ? 'Key contacts' : 'Contacts'}</h3><button type="button" className="scl-text-button" onClick={onAdd}><Plus size={16} />Add contact</button></div>
    {shown.length ? <div className="scl-contact-list">{shown.map(contact => <div className="scl-contact-row" key={contact.id}>
      <User size={22} aria-hidden="true" />
      <span className="scl-contact-name"><span>{contact.full_name || [contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'Unnamed contact'}{!overview && contact.job_title && <small>{contact.job_title}</small>}</span>{contact.is_primary && <span className="scl-primary-badge">Primary</span>}{contact.is_active === false && <span className="scl-primary-badge">Inactive</span>}</span>
      <span className="scl-contact-email"><Mail size={20} aria-hidden="true" />{contact.email ? <a href={`mailto:${encodeURIComponent(contact.email)}`}>{contact.email}</a> : <span>—</span>}</span>
      {!overview && contact.phone && <span className="scl-contact-phone">{contact.phone}</span>}
    </div>)}</div> : <p className="scl-inline-state">No {overview ? 'active ' : ''}contacts recorded.</p>}
    {overview && contacts.length > shown.length && <button type="button" className="scl-link" onClick={onViewAll}>View all contacts</button>}
  </section>;
}
Contacts.propTypes = { contacts: PropTypes.array.isRequired, overview: PropTypes.bool, onAdd: PropTypes.func.isRequired, onViewAll: PropTypes.func.isRequired };

function Opportunities({ records, compact }) {
  const [sort, setSort] = useState({ key: 'deal_code', direction: 'asc' });
  const columns = [['deal_code', 'VF code'], ['deal_name', 'Opportunity'], ['submission_due_date', 'Deadline']];
  const rows = [...records].sort((a, b) => {
    const left = a[sort.key], right = b[sort.key];
    if (!left) return right ? 1 : 0;
    if (!right) return -1;
    return String(left).localeCompare(String(right), 'en', { numeric: true }) * (sort.direction === 'asc' ? 1 : -1);
  });
  return <div className="scl-related-table-wrap"><table className="scl-related-table"><thead><tr>{columns.map(([key, label]) => <th key={key} scope="col" aria-sort={sort.key === key ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'}><button type="button" onClick={() => setSort(previous => ({ key, direction: previous.key === key && previous.direction === 'asc' ? 'desc' : 'asc' }))}>{label}{sort.key === key ? sort.direction === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} /> : <ChevronsUpDown size={12} />}</button></th>)}</tr></thead><tbody>{(compact ? rows.slice(0, 2) : rows).map(row => <tr key={row.id}><td><Link to={`/sales/opportunities?record=${encodeURIComponent(row.id)}`}>{missing(row.deal_code)}</Link></td><td>{missing(row.deal_name)}</td><td>{dateLabel(row.submission_due_date)}</td></tr>)}</tbody></table></div>;
}
Opportunities.propTypes = { records: PropTypes.array.isRequired, compact: PropTypes.bool };

function Frameworks({ records }) {
  return <div className="scl-framework-list">{records.map(row => <div className="scl-framework-row" key={row.id}><FileText size={22} aria-hidden="true" /><Link to={`/sales/frameworks?record=${encodeURIComponent(row.id)}`}>{missing(row.framework_number)}</Link><span className="scl-framework-title">{missing(row.title)}</span><span>{row.expiry_date ? `Valid until ${dateLabel(row.expiry_date)}` : 'Validity not recorded'}</span><ClientStatus status={row.status} /></div>)}</div>;
}
Frameworks.propTypes = { records: PropTypes.array.isRequired };

function SelectedClient({ record, onEdit, onOpenFullRecord, onRefresh }) {
  const navigate = useNavigate();
  const authUser = useSelector(state => state.auth?.user);
  const actorId = authUser?.user?.id ?? authUser?.id;
  const [tab, setTab] = useState('Overview');
  const [sources, reloadSource] = useClientRelated(record.id, record.updated_at);
  const [dialog, setDialog] = useState(null);
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [registering, setRegistering] = useState(false);
  const alive = useRef(true);
  const inFlight = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const contacts = Array.isArray(record.contacts) ? record.contacts : [];
  const website = safeWebsite(record.website);
  const activeFrameworks = sources.frameworks.records.filter(row => row.status === 'active');
  const openAction = kind => {
    setDialog(kind); setValues(kind === 'contact' ? { is_primary: false } : { activity_type: 'call' }); setError(''); setNotice('');
  };
  const submit = async event => {
    event.preventDefault();
    if (inFlight.current) return;
    if (dialog === 'activity' && !actorId) { setError('Your current user could not be verified. Sign in again; your entries are retained.'); return; }
    inFlight.current = true; setBusy(true); setError('');
    try {
      if (dialog === 'contact') await salesService.createContact({ ...values, client: record.id });
      else await salesService.createActivity({ ...values, client: record.id, performed_by: actorId, follow_up_date: values.follow_up_date || null });
      if (!alive.current) return;
      setDialog(null); setNotice(dialog === 'contact' ? 'Contact added.' : 'Activity logged.');
      if (dialog === 'contact') {
        // A failed follow-up read must not turn a successful create into a retry.
        Promise.resolve().then(() => onRefresh()).catch(() => { if (alive.current) setNotice('Contact added. Refresh the client to see the latest contact list.'); });
      }
      else { void reloadSource('activities'); setTab('Activity'); }
    } catch (caught) { if (alive.current) setError(actionError(caught)); }
    finally { inFlight.current = false; if (alive.current) setBusy(false); }
  };
  const keyTab = event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length - 1 : (TABS.indexOf(tab) + (event.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
    setTab(TABS[next]); event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next]?.focus();
  };
  const relationCount = (key, title, single, plural) => {
    const source = sources[key];
    return <button type="button" className="scl-link" onClick={() => setTab(title)}>{source.loading ? `Loading ${plural}…` : source.error ? `${title} unavailable` : `${source.records.length} ${source.records.length === 1 ? single : plural}`}</button>;
  };
  return <>
    <header className="scl-workspace-header">
      <div className="scl-client-avatar"><Building2 size={34} strokeWidth={1.65} aria-hidden="true" /></div>
      <div className="scl-client-identity"><div className="scl-client-title"><h2>{missing(record.company_name)}</h2><ClientStatus status={record.status} /></div><p className="scl-client-meta"><span>{missing(record.client_code)}</span><span aria-hidden="true"> · </span><span>{clientIndustry(record.industry_type)}</span><span aria-hidden="true"> · </span><span>{missing(record.country)}</span></p></div>
      <div className="scl-workspace-actions"><button type="button" className="scl-button" onClick={onEdit}><Pencil size={18} />Edit client</button><ClientMenu onEdit={onEdit} onOpenFullRecord={onOpenFullRecord} onRefresh={onRefresh} /></div>
    </header>
    <div className="scl-workspace-tabs" role="tablist" aria-label="Client workspace sections">{TABS.map(name => <button key={name} type="button" role="tab" id={`scl-tab-${name.toLowerCase()}`} aria-controls="scl-client-panel" aria-selected={tab === name} tabIndex={tab === name ? 0 : -1} onClick={() => setTab(name)} onKeyDown={keyTab}>{name}</button>)}</div>
    <div className="scl-workspace-content" role="tabpanel" id="scl-client-panel" aria-labelledby={`scl-tab-${tab.toLowerCase()}`} tabIndex={0}>
      {notice && <p className="scl-notice" role="status">{notice}</p>}
      {tab === 'Overview' && <section className="scl-section scl-company-section"><div className="scl-section-heading"><h3>Company information</h3></div><div className="scl-company-grid">
        <dl><dt>Legal name</dt><dd>{missing(record.legal_name)}</dd><dt>Industry</dt><dd>{clientIndustry(record.industry_type)}</dd><dt>City</dt><dd>{missing(record.city)}</dd><dt>Website</dt><dd>{website ? <a href={website} target="_blank" rel="noopener noreferrer">{website.replace(/^https?:\/\//, '').replace(/\/$/, '')}<ExternalLink size={16} aria-label="Opens in a new tab" /></a> : missing(record.website)}</dd></dl>
        <dl><dt>Account owner</dt><dd>{ownerName(record)}</dd><dt>Country</dt><dd>{missing(record.country)}</dd><dt>Currency</dt><dd>—</dd><dt>Client ID</dt><dd>{missing(record.client_code)}</dd></dl>
      </div></section>}
      {['Overview', 'Contacts'].includes(tab) && <Contacts contacts={contacts} overview={tab === 'Overview'} onAdd={() => openAction('contact')} onViewAll={() => setTab('Contacts')} />}
      {['Overview', 'Opportunities'].includes(tab) && <section className="scl-section scl-opportunities-section"><div className="scl-section-heading"><h3>Linked opportunities</h3>{tab === 'Overview' && <button type="button" className="scl-link" onClick={() => setTab('Opportunities')}>View all</button>}</div><RelatedState source={sources.opportunities} name="opportunities" onRetry={() => reloadSource('opportunities')}><Opportunities records={sources.opportunities.records} compact={tab === 'Overview'} /></RelatedState>{tab === 'Overview' && <div className="scl-related-counts">{relationCount('opportunities', 'Opportunities', 'opportunity', 'opportunities')}<span>·</span>{relationCount('proposals', 'Proposals', 'proposal', 'proposals')}<span>·</span>{relationCount('frameworks', 'Frameworks', 'framework', 'frameworks')}</div>}</section>}
      {tab === 'Proposals' && <section className="scl-section"><div className="scl-section-heading"><h3>Linked proposals</h3></div><RelatedState source={sources.proposals} name="proposals" onRetry={() => reloadSource('proposals')}><div className="scl-related-table-wrap"><table className="scl-related-table"><thead><tr><th scope="col">Proposal</th><th scope="col">Opportunity</th><th scope="col">Status</th></tr></thead><tbody>{sources.proposals.records.map(row => <tr key={row.id}><td><Link to={`/sales/proposals?record=${encodeURIComponent(row.id)}`}>{missing(row.quote_number)}</Link></td><td>{row.deal_name || row.deal_details?.deal_name || '—'}</td><td>{humanize(row.status) || '—'}</td></tr>)}</tbody></table></div></RelatedState></section>}
      {['Overview', 'Frameworks'].includes(tab) && <section className="scl-section scl-frameworks-section"><div className="scl-section-heading"><h3>{tab === 'Overview' ? 'Active framework' : 'Frameworks'}</h3></div><RelatedState source={sources.frameworks} name="frameworks" onRetry={() => reloadSource('frameworks')}>{tab === 'Overview' && !activeFrameworks.length ? <p className="scl-inline-state">No active framework recorded.</p> : <Frameworks records={tab === 'Overview' ? activeFrameworks : sources.frameworks.records} />}</RelatedState></section>}
      {tab === 'Activity' && <section className="scl-section"><div className="scl-section-heading"><h3>Activity</h3></div><RelatedState source={sources.activities} name="activities" onRetry={() => reloadSource('activities')}><div className="scl-activity-list">{sources.activities.records.map(row => <article className="scl-activity-row" key={row.id}><FileText size={20} aria-hidden="true" /><div><h4>{missing(row.subject)}</h4><p>{row.activity_type_display || humanize(row.activity_type)}<span> · </span>{row.performed_by_name || 'Name unavailable'}<span> · </span>{row.activity_date && Number.isFinite(Date.parse(row.activity_date)) ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' }).format(new Date(row.activity_date)) : 'Date not recorded'}</p>{row.outcome && <p>{row.outcome}</p>}{row.follow_up_date && <p>Follow-up: {dateLabel(row.follow_up_date)}</p>}</div></article>)}</div></RelatedState></section>}
    </div>
    <footer className="scl-workspace-footer"><button type="button" className="scl-button scl-primary" onClick={() => setRegistering(true)}><Plus size={20} />New opportunity</button><button type="button" className="scl-button" onClick={() => openAction('activity')}><FileText size={19} />Log activity</button></footer>
    {dialog && <SalesActionDialog action={dialog === 'contact' ? CONTACT_ACTION : ACTIVITY_ACTION} values={values} busy={busy} error={error} onChange={(name, value) => setValues(previous => ({ ...previous, [name]: value }))} onClose={() => { if (!inFlight.current) setDialog(null); }} onSubmit={submit} />}
    {registering && <SalesOpportunityRegistrationDialog onClose={() => setRegistering(false)} onCreated={created => { if (alive.current) { setRegistering(false); navigate(`/sales/opportunities?record=${encodeURIComponent(created.id)}`); } }} />}
  </>;
}
SelectedClient.propTypes = { record: PropTypes.object.isRequired, onEdit: PropTypes.func.isRequired, onOpenFullRecord: PropTypes.func.isRequired, onRefresh: PropTypes.func.isRequired };

export default function SalesClientWorkspace({ record, loading, error, onRetry, onEdit, onOpenFullRecord, onRefresh }) {
  return <section className="scl-workspace" aria-label="Selected client" aria-busy={loading || undefined}>
    {loading ? <div className="scl-workspace-state" role="status"><RefreshCw size={24} /><p>Loading client…</p></div> : error ? <div className="scl-workspace-state" role="alert"><AlertCircle size={26} /><p>{error}</p><button type="button" className="scl-button" onClick={onRetry}>Retry</button></div> : record ? <SelectedClient key={record.id} record={record} onEdit={onEdit} onOpenFullRecord={onOpenFullRecord} onRefresh={onRefresh} /> : <div className="scl-workspace-state"><Building2 size={30} /><h2>Select a client</h2><p>Choose a client to view its information and linked records.</p></div>}
  </section>;
}
SalesClientWorkspace.propTypes = { record: PropTypes.object, loading: PropTypes.bool, error: PropTypes.string, onRetry: PropTypes.func.isRequired, onEdit: PropTypes.func.isRequired, onOpenFullRecord: PropTypes.func.isRequired, onRefresh: PropTypes.func.isRequired };
