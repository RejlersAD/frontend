import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, AlertTriangle, CheckCircle2, Clock, Database, FileText, Info, Plus, RefreshCw, Search, Server, ShieldCheck, Users, Workflow, X } from 'lucide-react';
import { fetchCurrentUser, fetchUserStats } from '../store/slices/rbacSlice';
import { isUserAdmin } from '../utils/rbac.utils';
import analyticsService from '../services/analyticsService';
import AuditLogsTab from '../components/admin/AuditLogsTab';
import SystemHealthTab from '../components/admin/SystemHealthTab';
import './AdminDashboard.css';

const SERVICES = [
  { name: 'Authentication', key: 'authentication', icon: Users, group: 'Platform' },
  { name: 'API Gateway', key: 'api', icon: Workflow, group: 'Platform' },
  { name: 'PostgreSQL', key: 'database', icon: Database, group: 'Data' },
  { name: 'AWS S3 Storage', key: 'storage', icon: Server, group: 'Data' },
  { name: 'Background Jobs', key: 'celery', icon: Workflow, group: 'Platform' },
  { name: 'AI Services', key: 'ai', icon: Activity, group: 'AI' },
];
const TABS = ['Overview', 'Operations', 'Security', 'Usage & capacity', 'Audit'];
const list = value => Array.isArray(value) ? value : value?.results || [];
const display = (value, suffix = '') => value == null ? '—' : `${value}${suffix}`;
const label = value => value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Unknown';
const time = value => value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
function Badge({ status }) { return <span className={`ac-badge ${status || 'unknown'}`}><i />{label(status)}</span>; }
function Capacity({ name, used, total, unit = 'GB' }) {
  const percent = used != null && total > 0 ? Math.round(used / total * 100) : null;
  return <div className="ac-capacity-row"><span>{name}</span><div><div className="ac-track" role="progressbar" aria-label={name} aria-valuenow={percent ?? undefined} aria-valuemin={0} aria-valuemax={100} aria-valuetext={percent == null ? 'Unavailable' : `${percent}%`}><span style={{ width: `${Math.min(percent || 0, 100)}%` }} /></div><small>{used != null && total > 0 ? `${used} / ${total} ${unit}` : 'Telemetry unavailable'}</small></div><span>{display(percent, '%')}</span></div>;
}

export default function AdminDashboard() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector(state => state.auth);
  const { currentUser, stats } = useSelector(state => state.rbac);
  const allowed = isUserAdmin(user) || currentUser?.roles?.some(role => ['super_admin', 'admin'].includes(role.code));
  const [tab, setTab] = useState('Overview');
  const [data, setData] = useState({});
  const [busy, setBusy] = useState(false);
  const [updated, setUpdated] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [group, setGroup] = useState('all');
  const [period, setPeriod] = useState('24');
  const [detail, setDetail] = useState(null);
  const [taskOpen, setTaskOpen] = useState(false);
  const [tasks, setTasks] = useState([]);
  const dialogRef = useRef(null);
  const inFlight = useRef(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { dispatch(fetchCurrentUser()); dispatch(fetchUserStats()); }, [dispatch]);
  const refresh = useCallback(async () => {
    if (!allowed || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    const results = await Promise.allSettled([
      analyticsService.getDashboardOverview(), analyticsService.getLatestHealthCheck(),
      analyticsService.getSecurityAlerts({ is_resolved: false }), analyticsService.getHighPriorityInsights(),
      analyticsService.getRealTimeActivity(50), analyticsService.getLatestMetrics(),
    ]);
    const keys = ['overview', 'health', 'alerts', 'insights', 'activity', 'metrics'];
    setData(Object.fromEntries(results.map((result, index) => [keys[index], result.status === 'fulfilled' ? result.value : null])));
    setError(results.some(result => result.status === 'rejected') ? 'Some live data could not be loaded. Unavailable values are marked with a dash.' : '');
    setUpdated(new Date());
    setBusy(false);
    inFlight.current = false;
  }, [allowed]);
  useEffect(() => { refresh(); const id = setInterval(refresh, 30000); return () => clearInterval(id); }, [refresh]);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  useEffect(() => {
    if (detail || taskOpen) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [detail, taskOpen]);
  const overview = data.overview;
  const health = data.health;
  const alerts = list(data.alerts).filter(alert => !alert.is_resolved && alert.status !== 'resolved');
  const insights = list(data.insights);
  const services = SERVICES.map(service => ({ ...service, status: health?.[`${service.key}_status`] || 'unknown' }));
  const filtered = services.filter(service => service.name.toLowerCase().includes(query.toLowerCase()) && (status === 'all' || service.status === status) && (group === 'all' || service.group === group));
  const activities = list(data.activity).filter(item => new Date(item.timestamp).getTime() >= now - Number(period) * 3600000);
  const issue = alerts[0] || insights[0];
  const taskCount = data.insights == null ? null : insights.length + tasks.length;
  const closeDialog = () => { setDetail(null); setTaskOpen(false); };
  const cards = [
    { title: 'Platform status', value: label(health?.overall_status), note: health?.check_time ? `Last checked ${time(health.check_time)}` : 'Waiting for health telemetry', icon: CheckCircle2, tone: health?.overall_status === 'healthy' ? 'green' : health?.overall_status === 'critical' ? 'rose' : health?.overall_status === 'degraded' ? 'amber' : 'neutral' },
    { title: 'Active users', value: display(overview?.active_users_count ?? overview?.active_users_today), note: `${display(overview?.total_users ?? stats?.total_users)} total users`, icon: Users, tone: 'blue' },
    { title: 'Open incidents', value: display(data.alerts == null ? null : alerts.length), note: data.alerts == null ? 'Awaiting security data' : alerts.length ? 'Requires investigation' : 'No active incidents', icon: FileText, tone: data.alerts == null ? 'neutral' : alerts.some(alert => alert.severity === 'critical') ? 'rose' : alerts.length ? 'amber' : 'green' },
    { title: 'Admin tasks due', value: display(taskCount), note: tasks.length ? `${tasks.length} local draft(s)` : taskCount ? 'Requires attention' : 'No pending findings', icon: Clock, tone: taskCount == null ? 'neutral' : taskCount ? 'amber' : 'green' },
  ];
  if (!allowed) return <div className="ac-access"><ShieldCheck size={32} /><h1>{currentUser ? 'Access denied' : 'Checking administrator access…'}</h1><p>This console requires an administrator role.</p><Link to="/dashboard">Go to dashboard</Link></div>;

  return <div className="admin-console">
    <div className="ac-workspace">
      <main className="ac-main">
        <div className="ac-heading"><div><p className="ac-breadcrumb">Administration <span>/</span> {tab}</p><h1>Admin Console</h1><p className="ac-subtitle">Monitor platform health, security and administrative work.</p></div>
          <div className="ac-toolbar"><div className="ac-toolbar-buttons"><span className="ac-environment"><Server size={16} />{overview?.environment || 'Current environment'}</span><label className="ac-period"><Clock size={16} /><select aria-label="Activity time range" value={period} onChange={event => setPeriod(event.target.value)}><option value="24">Last 24 hours</option><option value="168">Last 7 days</option><option value="720">Last 30 days</option></select></label><button onClick={refresh} disabled={busy}><RefreshCw size={16} className={busy ? 'ac-spin' : ''} />Refresh</button><button className="ac-primary" onClick={() => setTaskOpen(true)}><Plus size={17} />Create admin task</button></div><p className="ac-live"><i className={error ? 'warning' : ''} />{busy ? 'Refreshing' : error ? 'Partial data' : updated ? 'Live' : 'Connecting'}<span> · {updated ? `updated ${Math.max(0, Math.floor((now - updated.getTime()) / 1000))} seconds ago` : 'waiting for data'}</span></p></div>
        </div>
        <div className="ac-tabs" role="tablist" aria-label="Console sections">{TABS.map(item => <button key={item} role="tab" id={`ac-tab-${TABS.indexOf(item)}`} aria-controls="ac-panel" aria-selected={tab === item} onClick={() => setTab(item)}>{item}</button>)}</div>
        {error && <p className="ac-data-warning" role="status"><Info size={15} />{error}</p>}
        <div role="tabpanel" id="ac-panel" aria-labelledby={`ac-tab-${TABS.indexOf(tab)}`}>
        {tab === 'Overview' && <>
          <section className="ac-signals" aria-label="Operational signals">{cards.map(({ title, value, note, icon: Icon, tone }) => <article className="ac-signal" data-tone={tone} key={title}><span className={`ac-signal-icon ${tone}`}><Icon size={23} /></span><div><p>{title}</p><strong className={tone === 'green' ? 'ac-green' : tone === 'amber' ? 'ac-amber' : ''}>{value}</strong><small>{note}</small></div></article>)}</section>
          {issue && <section className="ac-attention"><h2><AlertTriangle size={22} />Attention required</h2><div className="ac-issue"><div><strong>{issue.title || 'Review administrative finding'}</strong><p>{issue.description || issue.message || 'Review the latest finding and assign an owner.'}</p></div><div><small>Severity</small><span className="ac-severity">{label(issue.severity || issue.priority || 'high')}</span></div><div><small>Owner</small><span>{issue.assigned_to_name || 'Unassigned'}</span></div><div><small>Detected</small><span>{time(issue.created_at || issue.detected_at)}</span></div><button className="ac-primary" onClick={() => setDetail({ title: issue.title || 'Administrative finding', description: issue.description || issue.message, raw: issue, alertId: alerts.includes(issue) ? issue.id : null })}>Assign and review</button></div></section>}
          <div className={`ac-security-strip ${alerts.length || data.alerts == null ? 'pending' : ''}`}><CheckCircle2 size={18} />{data.alerts == null ? 'Security incident status unavailable.' : alerts.length ? `${alerts.length} security incident(s) require review.` : 'No active security incidents.'}</div>
          <div className="ac-content-grid"><div className="ac-left-column">
            <section className="ac-panel ac-services"><div className="ac-panel-heading"><h2>Service health</h2><span>{services.length} services</span></div><div className="ac-filters"><label className="ac-service-search"><Search size={16} /><input aria-label="Filter services" placeholder="Search services…" value={query} onChange={event => setQuery(event.target.value)} /></label><label>Status<select value={status} onChange={event => setStatus(event.target.value)}><option value="all">All</option><option value="healthy">Healthy</option><option value="degraded">Degraded</option><option value="critical">Critical</option><option value="unknown">Unknown</option></select></label><label>Service group<select value={group} onChange={event => setGroup(event.target.value)}><option value="all">All</option><option>Platform</option><option>Data</option><option>AI</option></select></label><label>Region<select aria-label="Region"><option>All</option></select></label></div>
            <div className="ac-table-scroll"><table><thead><tr>{['Service', 'Status', 'Availability', 'Response time', 'Errors', 'Last checked', 'Action'].map(text => <th key={text}>{text}</th>)}</tr></thead><tbody>{filtered.map(service => <tr key={service.key}><td><span className="ac-service-name"><service.icon size={17} />{service.name}</span></td><td><Badge status={service.status} /></td><td>{display(health?.availability?.[service.key], '%')}</td><td>{display(health?.response_times?.[service.key], ' ms')}</td><td>{display(health?.error_rates?.[service.key], '%')}</td><td>{service.status === 'unknown' ? '—' : time(health?.check_time)}</td><td><button className="ac-detail-button" onClick={() => setDetail({ title: service.name, description: `${label(service.status)} · ${service.group}`, raw: { status: service.status, response_time: health?.response_times?.[service.key] ?? 'Unavailable', error_rate: health?.error_rates?.[service.key] ?? 'Unavailable', last_checked: health?.check_time ?? 'Unavailable' } })}>View details</button></td></tr>)}{!filtered.length && <tr><td colSpan={7} className="ac-empty">No services match your filters.</td></tr>}</tbody></table></div></section>
            <section className="ac-panel ac-activity"><div className="ac-panel-heading"><h2>Recent administrative activity</h2></div><div className="ac-table-scroll"><table><thead><tr>{['Time', 'Actor', 'Action', 'Target', 'Outcome', ''].map(text => <th key={text}>{text}</th>)}</tr></thead><tbody>{activities.slice(0, 4).map((item, index) => <tr key={`${item.timestamp}-${index}`}><td>{time(item.timestamp)}</td><td>{item.user_email || 'System'}</td><td>{item.description}</td><td>{item.metadata?.resource_id || '—'}</td><td><span className={item.metadata?.success ? 'ac-success' : ''}>{item.metadata?.success ? 'Success' : 'Failed'}</span></td><td><button className="ac-detail-button" onClick={() => setDetail({ title: item.description, raw: item })}>View details</button></td></tr>)}{!activities.length && <tr><td colSpan={6} className="ac-empty">{data.activity == null ? 'Activity data unavailable.' : 'No recent administrative activity in this period.'}</td></tr>}</tbody></table></div></section>
          </div><aside className="ac-right-column">
            <section className="ac-panel ac-environment-summary"><h2><Server size={18} />Environment summary</h2><div className="ac-environment-title"><Server size={18} /><strong>{overview?.environment || 'Current environment'}</strong><Badge status={health?.overall_status} /></div><dl><dt>Region</dt><dd>{display(overview?.region)}</dd><dt>Version</dt><dd>{display(overview?.version)}</dd><dt>Deploy state</dt><dd>{display(overview?.deploy_state)}</dd><dt>Active connections</dt><dd>{display(data.metrics?.active_connections ?? overview?.active_connections)}</dd><dt>Storage used</dt><dd><strong>{display(overview?.storage_used_gb ?? data.metrics?.disk_usage_gb, ' GB')}</strong></dd></dl></section>
            <section className="ac-panel ac-capacity"><h2>Capacity</h2><Capacity name="Database" used={overview?.database_used_gb} total={overview?.database_total_gb} /><Capacity name="Storage" used={overview?.storage_used_gb ?? data.metrics?.disk_usage_gb} total={overview?.storage_total_gb} /><Capacity name="API quota" used={overview?.api_requests_count} total={overview?.api_requests_limit} unit="requests" /></section>
            <section className="ac-panel ac-posture"><h2><ShieldCheck size={18} />Security posture</h2><div className="ac-posture-grid"><div><small>MFA adoption</small><strong className="ac-green">{display(overview?.mfa_adoption_percentage, '%')}</strong></div><div><small>Privileged admins</small><strong>{display(overview?.privileged_admins)}</strong></div><div><small>Last access review</small><strong className="ac-green">{display(overview?.last_access_review)}</strong></div><button className="ac-detail-button" onClick={() => setTab('Security')}>Open security</button></div></section>
            <div className="ac-info"><Info size={18} />All administrative changes are logged.</div>
          </aside></div>
        </>}
        {tab === 'Operations' && <SystemHealthTab healthData={health} />}
        {tab === 'Audit' && <AuditLogsTab onRefresh={refresh} />}
        {tab === 'Security' && <section className="ac-panel ac-tab-content"><h2>Security incidents</h2>{data.alerts == null ? <p>Security data unavailable. Refresh to try again.</p> : !alerts.length ? <p>No active security incidents.</p> : alerts.map(alert => <div className="ac-security-item" key={alert.id}><div><h3>{alert.title || 'Security alert'}</h3><p>{alert.description}</p></div><button onClick={() => setDetail({ title: alert.title, description: alert.description, raw: alert, alertId: alert.id })}>Review incident</button></div>)}</section>}
        {tab === 'Usage & capacity' && <section className="ac-panel ac-tab-content"><h2>Usage & capacity</h2><Capacity name="Storage" used={overview?.storage_used_gb ?? data.metrics?.disk_usage_gb} total={overview?.storage_total_gb} /><Capacity name="CPU" used={data.metrics?.cpu_usage_percentage} total={100} unit="%" /><button onClick={() => navigate('/usage-analytics')}>Open usage analytics</button></section>}
        </div>
      </main>
    </div>
    <dialog ref={dialogRef} className="ac-dialog" onCancel={closeDialog} onClick={event => { if (event.target === event.currentTarget) closeDialog(); }} aria-labelledby="ac-dialog-title"><button className="ac-dialog-close ac-icon-button" aria-label="Close dialog" onClick={closeDialog}><X /></button><h2 id="ac-dialog-title">{taskOpen ? 'Create admin task' : detail?.title}</h2>
      {taskOpen ? <form onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); setTasks(previous => [...previous, { title: form.get('title'), notes: form.get('notes') }]); setTaskOpen(false); setDetail({ title: 'Task draft created', description: 'Your task is saved in this console session. Server-side task management is not connected yet.' }); }}><p>Create a local task draft for this console session.</p><label>Task title<input name="title" required maxLength={150} autoFocus /></label><label>Notes<textarea name="notes" rows={4} /></label><button className="ac-primary" type="submit">Save draft</button></form> : <><p>{detail?.description}</p>{detail?.raw && <pre>{JSON.stringify(detail.raw, null, 2)}</pre>}{detail?.action && <button className="ac-primary" onClick={() => navigate(detail.action)}>{detail.actionLabel}</button>}{detail?.alertId && <button className="ac-primary" disabled={busy} onClick={async () => { setBusy(true); try { await analyticsService.investigateAlert(detail.alertId); closeDialog(); setBusy(false); await refresh(); } catch { setDetail(previous => ({ ...previous, description: 'Unable to start investigation. Please try again.' })); setBusy(false); } }}>Start investigation</button>}</>}
    </dialog>
  </div>;
}
