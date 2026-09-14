import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Activity, AlertCircle, BookOpen, CalendarDays, CheckCircle2, ChevronRight, Clock, Cpu, Database, FileText, Globe, HardDrive, Info, Layers, Lock, MapPin, Network, Plus, RefreshCw, Search, Server, Settings, ShieldCheck, Users, Workflow, X } from 'lucide-react';
import { fetchCurrentUser, fetchUserStats } from '../store/slices/rbacSlice';
import { isUserAdmin } from '../utils/rbac.utils';
import analyticsService from '../services/analyticsService';
import AuditLogsTab from '../components/admin/AuditLogsTab';
import './AdminDashboard.css';

const SERVICES = [
  { name: 'PostgreSQL', key: 'database', icon: Database, group: 'Data', color: 'violet', description: 'Application database' },
  { name: 'Redis Cache', key: 'redis', icon: Layers, group: 'Platform', color: 'rose', description: 'Configured application cache' },
  { name: 'Celery Workers', key: 'celery', icon: Settings, group: 'Platform', color: 'violet', description: 'Background task processing' },
  { name: 'AWS S3 Storage', key: 'storage', icon: FileText, group: 'Data', color: 'violet', description: 'Document and media storage' },
  { name: 'API Server', key: 'api', icon: Globe, group: 'Platform', color: 'blue', description: 'Application API requests' },
  { name: 'AI Services', key: 'ai', icon: Cpu, group: 'AI', color: 'violet', description: 'Observed AI application routes' },
  { name: 'Authentication', key: 'authentication', icon: Users, group: 'Platform', color: 'blue', description: 'Authentication request outcomes' },
  { name: 'Server disk', key: 'disk', icon: HardDrive, group: 'Data', color: 'blue', description: 'Application server filesystem' },
];
const TABS = ['Overview', 'Incidents', 'Services', 'Dependencies', 'Capacity', 'Maintenance', 'Audit'];
const list = value => Array.isArray(value) ? value : value?.results || [];
const display = (value, suffix = '') => value == null ? '—' : `${value}${suffix}`;
const label = value => value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Unknown';
const time = value => value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
const target = item => item.target || item.metadata?.resource_repr || item.metadata?.resource_id || item.metadata?.request_path || 'Target not recorded';
const outcome = item => item.metadata?.success === true ? 'Success' : item.metadata?.success === false ? 'Failed' : 'Not recorded';
function Badge({ status }) {
  const Icon = status === 'healthy' ? CheckCircle2 : status === 'critical' || status === 'degraded' ? AlertCircle : Info;
  return <span className={`ac-badge ${status || 'unknown'}`}><Icon size={12} />{label(status)}</span>;
}
function Meter({ name, value, total, unit = '%', icon: Icon = Activity, threshold = 80 }) {
  const percent = value != null && total > 0 ? Math.min(100, Math.max(0, value / total * 100)) : null;
  const tone = percent == null ? 'unknown' : percent >= 95 ? 'critical' : percent >= threshold ? 'degraded' : 'healthy';
  return <div className="ac-resource"><div className="ac-resource-label"><Icon size={18} /><span>{name}</span><strong>{display(value == null ? null : Math.round(value * 10) / 10, unit === '%' ? '%' : ` ${unit}`)}</strong></div><div className={`ac-track ${tone}`} role="progressbar" aria-label={name} aria-valuenow={percent ?? undefined} aria-valuemin={0} aria-valuemax={100} aria-valuetext={percent == null ? 'Capacity not reported' : `${Math.round(percent)}%`}><span style={{ width: `${percent ?? 0}%` }} /></div><small>{percent == null ? value == null ? 'Measurement not reported' : 'Capacity limit not reported' : `${label(tone === 'healthy' ? 'normal' : tone)} (threshold ${threshold}%)`}</small></div>;
}
function History({ history, hours, now }) {
  const width = Number(hours) * 3600000 / 36;
  const ranks = { unknown: 0, healthy: 1, degraded: 2, critical: 3 };
  const bars = Array.from({ length: 36 }, (_, index) => {
    const start = now - Number(hours) * 3600000 + width * index;
    const samples = list(history).filter(row => { const date = new Date(row.check_time).getTime(); return date >= start && date < start + width; });
    const status = samples.reduce((worst, row) => ranks[row.overall_status] > ranks[worst] ? row.overall_status : worst, 'unknown');
    return { start, status };
  });
  return <section className="ac-panel ac-history"><h2>System status <span>(last {hours === '24' ? '24 hours' : hours === '168' ? '7 days' : '30 days'})</span></h2><div className="ac-history-body"><div className="ac-history-chart"><div className="ac-history-bars" aria-label="Recorded system health history">{bars.map(bar => <span key={bar.start} className={bar.status} title={`${new Date(bar.start).toLocaleString()}: ${bar.status === 'unknown' ? 'No recorded check' : label(bar.status)}`} />)}</div><div className="ac-history-axis">{[0, 9, 18, 27, 35].map(i => <span key={i}>{Number(hours) > 24 ? new Date(bars[i].start).toLocaleDateString([], { month: 'short', day: 'numeric' }) : time(bars[i].start)}</span>)}</div></div><div className="ac-legend">{['healthy', 'degraded', 'critical', 'unknown'].map(status => <span key={status}><i className={status} />{status === 'unknown' ? 'No data' : label(status)}</span>)}</div></div></section>;
}

export default function AdminDashboard() {
  const dispatch = useDispatch();
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
  const [region, setRegion] = useState('all');
  const [selectedKey, setSelectedKey] = useState(null);
  const [period, setPeriod] = useState('24');
  const [detail, setDetail] = useState(null);
  const [taskOpen, setTaskOpen] = useState(false);
  const [tasks, setTasks] = useState([]);
  const dialogRef = useRef(null);
  const inFlight = useRef(false);
  const loadedPeriod = useRef(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { dispatch(fetchCurrentUser()); dispatch(fetchUserStats()); }, [dispatch]);
  const refresh = useCallback(async () => {
    if (!allowed || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    // Overview refreshes the collectors; read snapshots only after it finishes.
    const overviewResult = await Promise.allSettled([analyticsService.getDashboardOverview()]);
    const results = [...overviewResult, ...await Promise.allSettled([
      analyticsService.getLatestHealthCheck(),
      analyticsService.getSecurityAlerts({ active: true }), analyticsService.getHighPriorityInsights(),
      analyticsService.getRealTimeActivity(50, Number(period)), analyticsService.getLatestMetrics(),
      analyticsService.getHealthCheckHistory(Number(period)),
    ])];
    const keys = ['overview', 'health', 'alerts', 'insights', 'activity', 'metrics', 'history'];
    setData(Object.fromEntries(results.map((result, index) => [keys[index], result.status === 'fulfilled' ? result.value : null])));
    setError(results.some(result => result.status === 'rejected') ? 'Some live data could not be loaded. Unavailable values are marked with a dash.' : '');
    setUpdated(new Date());
    loadedPeriod.current = period;
    setBusy(false);
    inFlight.current = false;
  }, [allowed, period]);
  useEffect(() => { refresh(); const id = setInterval(refresh, 30000); return () => clearInterval(id); }, [refresh]);
  useEffect(() => { if (!busy && loadedPeriod.current !== period) refresh(); }, [busy, period, refresh]);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  useEffect(() => {
    if (detail || taskOpen) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [detail, taskOpen]);
  const overview = data.overview;
  const health = data.health;
  const s3 = overview?.s3;
  const alerts = list(data.alerts).filter(alert => ['new', 'investigating'].includes(alert.status || 'new'));
  const insights = list(data.insights);
  const services = SERVICES.map(service => ({
    ...service,
    status: service.key === 'storage' ? s3?.status === 'connected' ? 'healthy' : s3?.status === 'offline' ? 'critical' : 'unknown' : health?.[`${service.key}_status`] || 'unknown',
    checkedAt: service.key === 'storage' ? s3?.checked_at : health?.check_time,
    region: service.key === 'storage' ? s3?.region : overview?.region,
    owner: health?.resource_usage?.owners?.[service.key] || 'Unassigned',
    dependencies: list(health?.resource_usage?.dependencies?.[service.key]),
  }));
  const selected = services.find(service => service.key === selectedKey) || services.find(service => service.status === 'critical') || services.find(service => service.key === 'storage');
  const SelectedIcon = selected.icon;
  const regions = [...new Set(services.map(service => service.region).filter(Boolean))];
  const filtered = services.filter(service => service.name.toLowerCase().includes(query.toLowerCase()) && (status === 'all' || service.status === status) && (group === 'all' || service.group === group) && (region === 'all' || service.region === region));
  const activities = list(data.activity).filter(item => new Date(item.timestamp).getTime() >= now - Number(period) * 3600000);
  const changes = activities.filter(item => [item.metadata?.resource_type, item.metadata?.resource_repr, item.metadata?.request_path, item.target].filter(Boolean).join(' ').toLowerCase().includes(selected.key === 'storage' ? 'storage' : selected.key)).slice(0, 3);
  const failing = services.find(service => service.status === 'critical');
  const issue = alerts.find(alert => alert.severity === 'critical') || alerts[0] || (!failing ? insights[0] : null);
  const issueIsAlert = alerts.includes(issue);
  const incidentTone = issueIsAlert || failing ? 'critical' : issue ? 'degraded' : 'healthy';
  const issueTime = issue?.detection_time || issue?.created_at || failing?.checkedAt;
  const healthyCount = services.filter(service => service.status === 'healthy').length;
  const successRate = health?.error_rates?.api == null ? null : Math.round((100 - health.error_rates.api) * 100) / 100;
  const cards = [
    { title: 'Services healthy', value: health ? `${healthyCount} of ${services.length}` : '—', icon: CheckCircle2, tone: !health || !services.length ? 'muted' : healthyCount === services.length ? 'healthy' : 'degraded' },
    { title: 'Active incidents', value: data.alerts == null ? '—' : data.alerts.count ?? alerts.length, icon: AlertCircle, tone: data.alerts == null ? 'muted' : (data.alerts.count ?? alerts.length) > 0 ? 'critical' : 'healthy' },
    { title: 'Request success', value: display(successRate, '%'), icon: Activity, tone: successRate == null ? 'muted' : 'blue', note: 'Observed API requests · last 5 min' },
    { title: 'Average response', value: display(health?.response_times?.api == null ? null : Math.round(health.response_times.api), ' ms'), icon: Clock, tone: health?.response_times?.api == null ? 'muted' : 'blue', note: 'Observed API requests · last 5 min' },
  ];
  const closeDialog = () => { setDetail(null); setTaskOpen(false); };
  const reviewIssue = () => setDetail({ title: issue?.title || `${failing?.name || 'Service'} requires attention`, description: issue?.description || issue?.message || 'Review the latest service check.', raw: issue, alertId: issueIsAlert ? issue.id : null });
  const serviceTable = <section className="ac-panel ac-services">
    <div className="ac-panel-heading"><h2>Service status</h2><span>{services.length} services</span></div>
    <div className="ac-filters"><label className="ac-search"><Search size={16} /><input aria-label="Filter services" placeholder="Search services…" value={query} onChange={event => setQuery(event.target.value)} /></label><select aria-label="Service status" value={status} onChange={event => setStatus(event.target.value)}><option value="all">All status</option>{['healthy', 'degraded', 'critical', 'unknown'].map(value => <option key={value} value={value}>{label(value)}</option>)}</select><select aria-label="Service group" value={group} onChange={event => setGroup(event.target.value)}><option value="all">All service groups</option>{['Platform', 'Data', 'AI'].map(value => <option key={value}>{value}</option>)}</select><select aria-label="Service region" value={region} onChange={event => setRegion(event.target.value)}><option value="all">All regions</option>{regions.map(value => <option key={value}>{value}</option>)}</select></div>
    <div className="ac-table-scroll"><table><thead><tr>{['Service', 'Status', 'Request success', 'Response time', 'Throughput', 'Dependency', 'Owner', ''].map(text => <th key={text}>{text}</th>)}</tr></thead><tbody>{filtered.map(service => {
      const count = health?.resource_usage?.sample_counts?.[service.key];
      return <tr key={service.key} className={`${service.status === 'critical' ? 'is-critical' : ''} ${selected.key === service.key ? 'is-selected' : ''}`}><td><span className={`ac-service-name ${service.color}`}><service.icon size={21} /><span>{service.name}</span></span></td><td><Badge status={service.status} /></td><td>{display(health?.error_rates?.[service.key] == null ? null : Math.round((100 - health.error_rates[service.key]) * 100) / 100, '%')}</td><td>{display(health?.response_times?.[service.key] == null ? null : Math.round(health.response_times[service.key]), ' ms')}</td><td>{display(count == null ? null : Math.round(count / 5 * 10) / 10, ' req/min')}</td><td>{service.dependencies.length ? `${service.dependencies.length} services` : '—'}</td><td>{service.owner}</td><td><button className="ac-detail-button" aria-pressed={selected.key === service.key} onClick={() => setSelectedKey(service.key)}>View service</button></td></tr>;
    })}{!filtered.length && <tr><td colSpan={8} className="ac-empty">No services match your filters.</td></tr>}</tbody></table></div>
    <p className="ac-table-note">Request metrics cover the last 5 minutes. Infrastructure response times are probes; S3 uses its recorded inventory check.</p>
    <section className="ac-activity"><div className="ac-panel-heading"><h2>Recent administrative activity</h2><button className="ac-text-button" onClick={() => setTab('Audit')}>View audit log <ChevronRight size={14} /></button></div><div className="ac-table-scroll"><table><thead><tr><th>Time</th><th>Action</th><th>Target</th><th>Actor</th><th>Outcome</th><th /></tr></thead><tbody>{activities.slice(0, 3).map((item, index) => <tr key={item.id || index}><td className="ac-timeline-time"><i className={item.metadata?.success === false ? 'critical' : 'healthy'} />{time(item.timestamp)}</td><td>{item.description}</td><td>{target(item)}</td><td title={item.user_email}>{item.actor_name || item.user_email || 'System'}</td><td>{outcome(item)}</td><td><button className="ac-text-button" onClick={() => setDetail({ title: item.description, activity: item })}>Details</button></td></tr>)}{!activities.length && <tr><td colSpan={6} className="ac-empty">{data.activity == null ? 'Activity data unavailable.' : 'No recorded administrative events in this period.'}</td></tr>}</tbody></table></div></section>
  </section>;
  const serviceDetails = <aside className="ac-panel ac-service-details" aria-label="Selected service details">
    <h2>Service details</h2><div className="ac-selected-heading"><span className={`ac-selected-icon ${selected.color}`}><SelectedIcon size={27} /></span><div><h3>{selected.name}</h3><div className="ac-selected-status"><Badge status={selected.status} /><span>{selected.description}</span></div></div></div>
    <div className="ac-detail-meta"><div><small>Owner</small><span>{selected.owner}</span></div><div><small>Region</small><span>{selected.region || 'Not reported'}</span></div><div><small>Last checked</small><span>{time(selected.checkedAt)}</span></div></div>
    <section className="ac-detail-section ac-s3"><h3>{selected.key === 'storage' ? 'Storage inventory' : 'Capacity & performance'}</h3>{selected.key === 'storage' ? s3?.status === 'connected' ? <><div className="ac-storage-total"><strong>{display(s3.total_size_gb, ' GB')}</strong><span>{s3.total_files?.toLocaleString()} files</span></div><dl className="ac-key-values"><dt>Bucket</dt><dd>{s3.bucket}</dd><dt>Source</dt><dd>AWS Data Status</dd></dl><p className="ac-support">Shared S3 inventory · refreshed every 5 minutes.</p></> : <p className="ac-support">{s3?.message || 'S3 inventory unavailable.'}</p> : selected.key === 'disk' ? <Meter name="Disk space" value={overview?.disk_total_gb > 0 ? overview.disk_used_gb / overview.disk_total_gb * 100 : null} total={100} icon={HardDrive} threshold={85} /> : <dl className="ac-key-values"><dt>Response / probe time</dt><dd>{display(health?.response_times?.[selected.key], ' ms')}</dd><dt>Observed errors</dt><dd>{display(health?.error_rates?.[selected.key], '%')}</dd></dl>}</section>
    <section className="ac-detail-section"><h3><Network size={16} />Dependencies {selected.dependencies.length ? `(${selected.dependencies.length})` : ''}</h3><div className="ac-detail-list">{selected.dependencies.length ? selected.dependencies.map((dependency, index) => <div key={index}><Workflow size={17} /><span>{dependency.name || dependency}</span><small>{dependency.relationship || 'Reported dependency'}</small></div>) : <p className="ac-support">No dependency information reported for this service.</p>}</div></section>
    <section className="ac-detail-section"><h3><Clock size={16} />Recent changes</h3><div className="ac-detail-list">{changes.length ? changes.map((item, index) => <button key={item.id || index} onClick={() => setDetail({ title: item.description, activity: item })}><RefreshCw size={16} /><span>{item.description}<small>{item.actor_name || item.user_email}</small></span><small>{time(item.timestamp)}</small></button>) : <p className="ac-support">No recorded administrative changes for this service in this period.</p>}</div></section>
    <section className="ac-detail-section"><h3><BookOpen size={16} />Runbook</h3><p className="ac-support">No runbook linked to this service.</p><button className="ac-text-button" onClick={() => setTab('Audit')}>Open audit log <ChevronRight size={14} /></button></section>
    <div className="ac-info"><Lock size={15} /><span>Administrative changes require the appropriate role and are recorded in the audit log.</span></div>
  </aside>;
  const resources = <section className="ac-panel ac-resources"><h2>Resource utilization</h2><div className="ac-resource-grid"><Meter name="CPU usage" value={data.metrics?.cpu_usage_percentage} total={100} icon={Cpu} /><Meter name="Memory" value={data.metrics?.memory_usage_mb} total={null} unit="MB" icon={Server} /><Meter name="Disk space" value={overview?.disk_total_gb > 0 ? overview.disk_used_gb / overview.disk_total_gb * 100 : null} total={100} icon={HardDrive} threshold={85} /><Meter name="Connections" value={data.metrics?.active_connections} unit="" total={null} icon={Network} /></div></section>;
  if (!allowed) return <div className="admin-console ac-access"><ShieldCheck size={32} /><h1>{currentUser ? 'Access denied' : 'Checking administrator access…'}</h1><p>This console requires an administrator role.</p><Link to="/dashboard">Go to dashboard</Link></div>;
  return <div className="admin-console">
    <header className="ac-context-bar"><div className="ac-breadcrumb"><Workflow size={18} /><span>Administration</span><span>/</span><strong>System health</strong></div><div className="ac-toolbar"><span className="ac-context-value"><Database size={16} />{overview?.environment ? label(overview.environment) : 'Current environment'}</span><span className="ac-context-value"><MapPin size={16} />{overview?.region || 'Region not reported'}</span><label className="ac-period"><CalendarDays size={17} /><select aria-label="Activity time range" value={period} onChange={event => setPeriod(event.target.value)}><option value="24">Last 24 hours</option><option value="168">Last 7 days</option><option value="720">Last 30 days</option></select></label><button className="ac-refresh" onClick={refresh} disabled={busy}><RefreshCw size={17} className={busy ? 'ac-spin' : ''} />Refresh</button></div></header>
    <main className="ac-main"><div className="ac-heading"><div><h1>System Health</h1><p>Monitor services, dependencies, capacity and active incidents.</p></div><p className="ac-live"><i className={error ? 'degraded' : 'healthy'} />{busy ? 'Refreshing' : error ? 'Partial data' : updated ? 'Live' : 'Connecting'}<span> · {updated ? `updated ${Math.max(0, Math.floor((now - updated.getTime()) / 1000))} seconds ago` : 'waiting for data'}</span></p></div>
      <nav className="ac-tabs" role="tablist" aria-label="System health sections">{TABS.map(item => <button key={item} role="tab" id={`ac-tab-${item.replaceAll(' ', '-')}`} aria-controls="ac-tabpanel" aria-selected={tab === item} onClick={() => setTab(item)}>{item}</button>)}</nav>
      {error && <p className="ac-data-warning" role="status"><Info size={16} />{error}</p>}
      <div id="ac-tabpanel" role="tabpanel" aria-labelledby={`ac-tab-${tab.replaceAll(' ', '-')}`}>
        {tab === 'Overview' && <>
          <section className={`ac-incident ${incidentTone}`} aria-label="Priority health finding"><AlertCircle className="ac-incident-icon" size={34} /><div className="ac-incident-copy"><h2>{issue ? `${issueIsAlert ? 'Active incident' : 'Attention required'} · ${issue.title}` : failing ? `Service requires attention · ${failing.name}` : data.alerts == null ? 'Incident status unavailable' : 'No active incidents reported'}</h2><p>{issue?.description || issue?.message || (failing ? 'Review the latest service check and related administrative changes.' : 'Monitor the live service checks below.')}</p></div>{(issue || failing) && <><div className="ac-incident-meta"><div><small>Severity</small><strong>{label(issue?.severity || issue?.impact_level || (failing ? 'critical' : 'high'))}</strong></div><div><small>Owner</small><span>{issue?.assigned_to_name || 'Unassigned'}</span></div><div><small>Detected</small><b>{time(issueTime)}</b></div></div><button className="ac-primary" onClick={reviewIssue}>{issueIsAlert ? 'Review incident' : 'Review finding'}</button><button className="ac-detail-button" onClick={reviewIssue}>Open details</button></>}</section>
          <section className="ac-signals" aria-label="Health signals">{cards.map(({ title, value, icon: Icon, tone, note }) => <article className="ac-signal" data-tone={tone} key={title}><span className={`ac-signal-icon ${tone}`}><Icon size={34} /></span><div><p>{title}</p><strong>{value}</strong>{note && <small>{note}</small>}</div></article>)}</section>
          <div className="ac-content-grid">{serviceTable}{serviceDetails}</div><div className="ac-bottom-grid">{resources}<History history={data.history} hours={period} now={now} /></div>
        </>}
        {tab === 'Services' && <div className="ac-content-grid">{serviceTable}{serviceDetails}</div>}
        {tab === 'Dependencies' && <div className="ac-content-grid"><section className="ac-panel"><h2>Service dependencies</h2><p className="ac-support">Select a service to inspect its reported dependencies and recent changes.</p><div className="ac-service-picker">{services.map(service => <button key={service.key} className={selected.key === service.key ? 'is-selected' : ''} onClick={() => setSelectedKey(service.key)}><service.icon size={20} />{service.name}<Badge status={service.status} /></button>)}</div></section>{serviceDetails}</div>}
        {tab === 'Incidents' && <section className="ac-panel"><h2>Security incidents</h2>{data.alerts == null ? <p className="ac-support">Security incident status unavailable.</p> : !alerts.length ? <p className="ac-support">No active security incidents.</p> : alerts.map(alert => <div className="ac-incident-list-item" key={alert.id}><AlertCircle size={24} /><div><h3>{alert.title}</h3><p>{alert.description}</p></div><button className="ac-primary" onClick={() => setDetail({ title: alert.title, description: alert.description, raw: alert, alertId: alert.id })}>Review incident</button></div>)}</section>}
        {tab === 'Capacity' && <><div className="ac-bottom-grid">{resources}<section className="ac-panel"><h2>AWS S3 inventory</h2><dl className="ac-key-values"><dt>Storage used</dt><dd>{display(s3?.total_size_gb, ' GB')}</dd><dt>Total files</dt><dd>{display(s3?.total_files)}</dd><dt>Last checked</dt><dd>{time(s3?.checked_at)}</dd><dt>Database used</dt><dd>{display(overview?.database_used_gb, ' GB')}</dd><dt>Requests today</dt><dd>{display(overview?.api_requests_count)}</dd></dl></section></div><section className="ac-panel ac-account-summary"><div className="ac-panel-heading"><h2>Security & usage</h2><Link className="ac-text-button" to="/usage-analytics">Open usage analytics</Link></div><dl className="ac-detail-meta"><div><dt>Active users today</dt><dd>{display(overview?.active_users_today)}</dd></div><div><dt>Total users</dt><dd>{display(overview?.total_users ?? stats?.total_users)}</dd></div><div><dt>MFA adoption</dt><dd>{display(overview?.mfa_adoption_percentage, '%')}</dd></div><div><dt>Privileged admins</dt><dd>{display(overview?.privileged_admins)}</dd></div></dl></section></>}
        {tab === 'Maintenance' && <section className="ac-panel"><div className="ac-panel-heading"><h2>Administrative work</h2><button className="ac-primary" onClick={() => setTaskOpen(true)}><Plus size={16} />Create admin task</button></div><p className="ac-support">{insights.length} findings · {tasks.length} session drafts. No maintenance schedule is connected.</p>{insights.map((item, index) => <div className="ac-maintenance-item" key={item.id || index}><FileText size={20} /><span>{item.title}</span><button className="ac-detail-button" onClick={() => setDetail({ title: item.title, description: item.description, raw: item })}>Review finding</button></div>)}{tasks.map((task, index) => <div className="ac-maintenance-item" key={index}><Clock size={20} /><span>{task.title}</span><small>Session draft</small></div>)}</section>}
        {tab === 'Audit' && <AuditLogsTab />}
      </div>
    </main>
    <dialog ref={dialogRef} className="ac-dialog" onCancel={closeDialog} onClick={event => { if (event.target === event.currentTarget) closeDialog(); }} aria-labelledby="ac-dialog-title"><button className="ac-dialog-close" aria-label="Close dialog" onClick={closeDialog}><X size={20} /></button><h2 id="ac-dialog-title">{taskOpen ? 'Create admin task' : detail?.title}</h2>{taskOpen ? <form onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); setTasks(previous => [...previous, { title: form.get('title'), notes: form.get('notes') }]); setTaskOpen(false); setDetail({ title: 'Task draft created', description: 'Saved for this console session. Server-side task management is not connected.' }); }}><p className="ac-support">Create a local draft for this console session.</p><label>Task title<input name="title" required maxLength={150} autoFocus /></label><label>Notes<textarea name="notes" rows={4} /></label><button className="ac-primary" type="submit">Save draft</button></form> : <><p className="ac-support">{detail?.description}</p>{detail?.activity && <dl className="ac-key-values"><dt>Actor</dt><dd>{detail.activity.actor_name || detail.activity.user_email || 'System'}</dd><dt>Time</dt><dd>{new Date(detail.activity.timestamp).toLocaleString()}</dd><dt>Action</dt><dd>{detail.activity.description}</dd><dt>Target</dt><dd>{target(detail.activity)}</dd><dt>Outcome</dt><dd>{outcome(detail.activity)}</dd></dl>}{detail?.activity && Object.keys(detail.activity.metadata?.changes || {}).length > 0 && <><h3>Recorded changes</h3><pre>{JSON.stringify(detail.activity.metadata.changes, null, 2)}</pre></>}{detail?.raw && <pre>{JSON.stringify(detail.raw, null, 2)}</pre>}{detail?.alertId && <button className="ac-primary" disabled={busy} onClick={async () => { setBusy(true); try { await analyticsService.investigateAlert(detail.alertId); closeDialog(); setBusy(false); await refresh(); } catch { setDetail(previous => ({ ...previous, description: 'Unable to start investigation. Please try again.' })); setBusy(false); } }}>Start investigation</button>}</>}</dialog>
  </div>;
}
