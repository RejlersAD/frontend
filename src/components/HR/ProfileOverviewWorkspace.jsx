import React from 'react';
import PropTypes from 'prop-types';
import { Home, Clock3, CalendarDays, CreditCard, TrendingUp, FileText, PenLine, ClipboardList, Calendar, MapPin, Boxes, MessagesSquare, Bell, BarChart3, Zap, Download, User as UserRound, CheckCircle2 } from 'lucide-react';
import './ProfileOverviewWorkspace.css';
import ProfileOrganizationPanel from './ProfileOrganizationPanel';

const PROFILE_TABS = [
  ['overview', 'Overview', Home],
  ['career', 'Career Profile', TrendingUp],
  ['signature', 'My Signature', PenLine],
  ['workspace', 'My Work', Boxes],
  ['leave', 'Leave', CalendarDays],
  ['attendance', 'Attendance', Clock3],
  ['timesheet', 'Timesheet', ClipboardList],
  ['payroll', 'Payroll', CreditCard],
  ['requests', 'My Requests', ClipboardList],
  ['performance', 'Performance', BarChart3],
  ['schedule', 'Schedule', Calendar],
  ['daily_tracker', 'Daily Tracker', FileText],
  ['site_visits', 'Site Visits', MapPin],
  ['twin', 'Digital Twin', Boxes],
  ['assistant', 'HR Assistant', MessagesSquare],
];

export function ProfileWorkspaceNavigation({ activeTab, onChange }) {
  return <nav className="epw-nav epw-all-tabs" aria-label="Employee profile sections">
    <div className="epw-primary-nav">{PROFILE_TABS.map(([id, title, Icon]) =>
      <button type="button" key={id} aria-current={activeTab === id ? 'page' : undefined} onClick={() => onChange(id)}><Icon />{title}</button>
    )}</div>
  </nav>;
}
ProfileWorkspaceNavigation.propTypes = { activeTab: PropTypes.string.isRequired, onChange: PropTypes.func.isRequired };

const numeric = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
const decimal = value => numeric(value) === null ? 'Not available' : Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 });
const hours = value => {
  const number = numeric(value);
  if (number === null) return 'Not available';
  const minutes = Math.round(number * 60);
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};
const date = value => {
  if (!value) return 'Date not available';
  const parsed = new Date(String(value).length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(parsed.getTime()) ? 'Date not available' : parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};
const pending = request => ['PENDING', 'RM_APPROVED'].includes(request.status?.toUpperCase());

function Panel({ title, icon: Icon, children, action, className = '' }) {
  return <section className={`epw-panel ${className}`}><header><div><Icon /><h2>{title}</h2></div>{action}</header>{children}</section>;
}
Panel.propTypes = { title: PropTypes.string, icon: PropTypes.elementType, children: PropTypes.node, action: PropTypes.node, className: PropTypes.string };

export default function ProfileOverviewWorkspace({ profile, organizationEmployees, todayData, monthlyTs, leaveRecord, leaveRequests = [], slips = [], documents, leaveAvailable = true, onNavigate, onDownloadPayslip, downloading, downloadError }) {
  const now = new Date();
  const month = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const checkIn = todayData?.check_in_time || todayData?.first_in;
  const checkOut = todayData?.check_out_time || todayData?.last_out;
  const attendanceKnown = Boolean(checkIn || checkOut || (todayData?.status && !['missing', 'unknown'].includes(String(todayData.status).toLowerCase())));
  const todayLabel = checkIn ? (checkOut ? 'Checked out' : 'Checked in') : attendanceKnown ? 'Not checked in' : 'Not available';
  const openRequests = leaveRequests.filter(pending);
  const balance = numeric(leaveRecord?.leave_balance);
  const entitlement = numeric(leaveRecord?.annual_entitlement);
  const taken = leaveAvailable ? leaveRequests.filter(item => item.status?.toUpperCase() === 'APPROVED').reduce((sum, item) => sum + Number(item.days_requested ?? item.duration_days ?? item.days ?? 0), 0) : null;
  const used = balance !== null && entitlement > 0 ? Math.max(0, Math.min(100, (1 - balance / entitlement) * 100)) : null;
  const latestSlip = slips[0];
  const slipName = slip => `${slip.month && slip.year ? new Date(slip.year, slip.month - 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : slip.run_cycle || 'Latest'} payslip`;
  const upcoming = leaveRequests.filter(item => item.status?.toUpperCase() === 'APPROVED' && new Date(`${String(item.start_date).slice(0, 10)}T23:59:59`) >= now).sort((a, b) => String(a.start_date).localeCompare(String(b.start_date))).slice(0, 4);
  const recentDocs = [
    ...(latestSlip ? [{ id: `pay-${latestSlip.id}`, name: slipName(latestSlip), category: 'Payslip', updated: latestSlip.updated_at || latestSlip.created_at, status: latestSlip.status || null, tab: 'payroll' }] : []),
    ...(documents || []).map(doc => ({ id: doc.id, name: doc.document_type_display || doc.document_file_name || doc.document_type || 'Profile document', category: 'Personal document', updated: doc.updated_at || doc.uploaded_at || doc.created_at, status: doc.status, tab: 'documents' })),
  ].sort((a, b) => String(b.updated || '').localeCompare(String(a.updated || ''))).slice(0, 3);
  const actions = [
    ...openRequests.slice(0, 2).map(item => ({ id: item.id, icon: CalendarDays, tone: 'amber', title: 'Leave request awaiting approval', detail: `Submitted ${date(item.created_at)}`, badge: item.status === 'RM_APPROVED' ? 'With HR' : 'Pending', action: 'View request', tab: 'leave' })),
    ...(numeric(monthlyTs?.expected_hours) !== null && numeric(monthlyTs?.total_hours) !== null && Number(monthlyTs.total_hours) < Number(monthlyTs.expected_hours) ? [{ id: 'hours', icon: BarChart3, tone: 'amber', title: 'Monthly hours below expected', detail: `${hours(monthlyTs.total_hours)} recorded`, badge: 'Needs attention', action: 'Open timesheet', tab: 'timesheet' }] : []),
    ...(latestSlip ? [{ id: 'payslip', icon: FileText, tone: 'blue', title: `${slipName(latestSlip)} available`, detail: latestSlip.status || 'View your pay details privately', badge: 'Available', action: 'View payslip', tab: 'payroll' }] : []),
  ].slice(0, 3);
  const link = (title, tab) => <button className="epw-text-button" onClick={() => onNavigate(tab)}>{title}</button>;
  return <div className="epw-overview">
    <section className="epw-signals" aria-label="Personal summary">
      {[
        [Clock3, 'Today', todayLabel, checkIn ? 'Biometric attendance' : attendanceKnown ? 'No check-in recorded' : 'Attendance not yet available', 'amber'],
        [BarChart3, 'Month hours', hours(monthlyTs?.total_hours), month, 'blue'],
        [CalendarDays, 'Leave balance', balance === null ? 'Not available' : `${decimal(balance)} days`, 'Annual entitlement remaining', 'green'],
        [ClipboardList, 'Open requests', leaveAvailable ? openRequests.length : 'Not available', 'Leave awaiting approval', 'indigo'],
      ].map(([Icon, label, value, caption, tone]) => <article className={`epw-signal ${tone}`} key={label}><Icon /><div><h2>{label}</h2><strong>{value}</strong><p>{caption}</p></div></article>)}
    </section>
    <div className="epw-grid">
      <ProfileOrganizationPanel profile={profile} employees={organizationEmployees} />
      <Panel title="Needs your attention" icon={Bell}>
        <div className="epw-rows">{actions.length ? actions.map(({ id, icon: Icon, tone, title, detail, badge, action, tab }) => <div className="epw-action-row" key={id}><span className={`epw-row-icon ${tone}`}><Icon /></span><div className="epw-row-copy"><strong>{title}</strong><p>{detail}</p></div><span className={`epw-badge ${tone}`}>{badge}</span><button className="epw-button" onClick={() => onNavigate(tab)}>{action}</button></div>) : <div className="epw-empty"><CheckCircle2 /><strong>{leaveAvailable ? 'You’re all caught up' : 'Request status unavailable'}</strong><p>{leaveAvailable ? 'No pending actions in your loaded records.' : 'Open Leave to review your requests.'}</p></div>}</div>
      </Panel>
      <Panel title="Upcoming" icon={CalendarDays} action={link('View all', 'schedule')}>
        {upcoming.length ? <div className="epw-rows">{upcoming.map(item => <button className="epw-upcoming" key={item.id} onClick={() => onNavigate('leave')}><CalendarDays /><b>{date(item.start_date)}</b><strong>{item.leave_type_detail?.name || 'Approved leave'}</strong><span>Until {date(item.end_date)}</span></button>)}</div> : <div className="epw-empty"><CalendarDays /><strong>{leaveAvailable ? 'No upcoming leave scheduled' : 'Upcoming leave unavailable'}</strong><p>{leaveAvailable ? 'Your approved future leave will appear here.' : 'Open Leave to review your requests.'}</p><button className="epw-text-button" onClick={() => onNavigate('schedule')}>View your work schedule</button></div>}
      </Panel>
      <Panel title="Recent documents" icon={FileText} action={link('View all', 'documents')}>
        <div className="epw-rows">{recentDocs.length ? recentDocs.map(doc => <div className="epw-document" key={doc.id}><span className="epw-row-icon"><FileText /></span><div className="epw-row-copy"><strong>{doc.name}</strong><p>{doc.category}{doc.updated ? ` · Updated ${date(doc.updated)}` : ''}</p></div>{doc.status && <span className="epw-badge blue">{doc.status.replaceAll('_', ' ')}</span>}<button className="epw-button" onClick={() => onNavigate(doc.tab)}>Open</button></div>) : <div className="epw-empty"><FileText /><strong>{documents === null ? 'Documents not available' : 'No documents yet'}</strong><p>Manage your personal files in Documents.</p></div>}</div>
      </Panel>
      <Panel title="Quick actions" icon={Zap} className="epw-quick-actions">
        <div className="epw-buttons"><button className="epw-button primary" onClick={() => onNavigate('leave')}><CalendarDays />Request leave</button><button className="epw-button" onClick={() => onNavigate('daily_tracker')}><Clock3 />Submit timesheet</button><button className="epw-button" disabled={!latestSlip || downloading} onClick={() => onDownloadPayslip(latestSlip)} title={!latestSlip ? 'No payslip available' : 'Download latest payslip'}><Download />{downloading ? 'Downloading…' : 'Download payslip'}</button><button className="epw-button" onClick={() => onNavigate('career')}><UserRound />Update personal details</button></div>
        {downloadError && <p role="alert" className="epw-error">{downloadError}</p>}
      </Panel>
      <Panel title="Leave summary" icon={CalendarDays} action={link('Open leave details →', 'leave')} className="epw-leave-summary">
        <div className="epw-leave-values"><div><p>Annual entitlement</p><strong>{entitlement === null ? 'Not available' : `${decimal(entitlement)} days`}</strong></div><div className="epw-remaining"><p>Remaining</p><strong>{balance === null ? 'Not available' : `${decimal(balance)} days`}</strong></div><div className="epw-progress-wrap"><div className="epw-progress" role="progressbar" aria-label="Annual leave used" aria-valuenow={used ?? undefined} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${used ?? 0}%` }} /></div><small>{used === null ? 'Usage unavailable' : `${Math.round(used)}% used`}</small></div><div><p>Taken</p><strong>{taken === null ? 'Not available' : `${decimal(taken)} days`}</strong></div><div className="epw-pending"><p>Pending</p><strong>{leaveAvailable ? `${openRequests.length} request${openRequests.length === 1 ? '' : 's'}` : 'Not available'}</strong></div></div>
      </Panel>
    </div>
  </div>;
}
ProfileOverviewWorkspace.propTypes = { profile: PropTypes.object, organizationEmployees: PropTypes.array, todayData: PropTypes.object, monthlyTs: PropTypes.object, leaveRecord: PropTypes.object, leaveRequests: PropTypes.array, slips: PropTypes.array, documents: PropTypes.array, leaveAvailable: PropTypes.bool, onNavigate: PropTypes.func.isRequired, onDownloadPayslip: PropTypes.func.isRequired, downloading: PropTypes.bool, downloadError: PropTypes.string };
