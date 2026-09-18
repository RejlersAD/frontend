/* eslint-disable react/prop-types */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowPathIcon, ArrowRightIcon, ChartBarIcon, CheckCircleIcon, ChevronRightIcon, ClockIcon, Cog6ToothIcon, DocumentTextIcon, FolderOpenIcon, InboxIcon, MagnifyingGlassIcon, PaperAirplaneIcon, ShoppingCartIcon, UsersIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { fetchCurrentUser } from '../store/slices/rbacSlice'
import ApprovalReviewDialog from '../components/approvals/ApprovalReviewDialog'
import WorkHubCalendar from '../components/workhub/WorkHubCalendar'
import WorkHubNotices from '../components/workhub/WorkHubNotices'
import AssignedTaskDetail from '../components/workhub/AssignedTaskDetail'
import useWorkHubData from '../components/workhub/useWorkHubData'
import { availableWorkspaces, calendarSource, defaultShortcuts, DEFAULT_PREFERENCES, displayDate, humanize, isReady, loadPreferences, metric, numberValue, presentActivity, safeRoute, taskIsOverdue } from '../components/workhub/workHubPresentation'
import './MyWorkHub.css'

const ICONS = { engineering: Cog6ToothIcon, document_management: DocumentTextIcon, project_control: ChartBarIcon, procurement: ShoppingCartIcon, human_resource: UsersIcon, support: InboxIcon }
const SECTIONS = { calendar: 'HR calendar', notices: 'Important notices', workspaces: 'Workspaces', activity: 'Activity overview' }

export default function MyWorkHub() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const user = useSelector(state => state.auth?.user)
  const profile = useSelector(state => state.rbac?.currentUser)
  const profileLoading = useSelector(state => state.rbac?.loading === true)
  const userId = user?.id || user?.user?.id || 'unknown'
  const preferenceKey = `wh.preferences.v1.${userId}`
  const [revision, setRevision] = useState(0)
  const [today, setToday] = useState(() => new Date())
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [tab, setTab] = useState('tasks')
  const [dialog, setDialog] = useState(null)
  const [review, setReview] = useState(null)
  const [taskSaving, setTaskSaving] = useState(false)
  const taskBusy = useRef(false)
  const [preferences, setPreferences] = useState(() => ({ key: preferenceKey, value: loadPreferences(preferenceKey) }))
  const [preferenceMessage, setPreferenceMessage] = useState('')
  const trigger = useRef(null)
  const currentPreferences = preferences.key === preferenceKey ? preferences.value : DEFAULT_PREFERENCES
  const data = useWorkHubData({ user, profile, profileLoading, revision, month, today })
  const bundle = data.bundle.data
  const tasks = bundle?.tasks, hours = bundle?.hours, leave = bundle?.leave
  const activity = useMemo(() => presentActivity(bundle?.activity), [bundle?.activity])
  const approvals = data.approvals.data
  const approvalRows = approvals?.rows || []
  const taskRows = isReady(tasks) ? tasks.rows : []
  const recentRows = isReady(activity) ? activity.rows : []
  const calendar = calendarSource(data.calendar.data, data.calendar.loading, data.calendar.error)
  const noticeSource = { state: data.notices.loading ? 'loading' : data.notices.error ? 'error' : 'ready', ...data.notices.data, message: data.notices.error }
  const workspaces = useMemo(() => availableWorkspaces(data.features.data, profile), [data.features.data, profile])
  const shortcutIds = currentPreferences.shortcuts ?? defaultShortcuts(workspaces)
  const shortcuts = shortcutIds.map(id => workspaces.find(item => item.id === id)).filter(Boolean)
  const firstName = (user?.first_name || user?.user?.first_name || user?.full_name?.split(' ')[0] || user?.username || 'there').trim()
  const greeting = today.getHours() < 12 ? 'Good morning' : today.getHours() < 18 ? 'Good afternoon' : 'Good evening'
  const hasRightColumn = currentPreferences.calendar || currentPreferences.notices

  useEffect(() => { if (user && !profile) dispatch(fetchCurrentUser()) }, [dispatch, user, profile])
  useEffect(() => {
    setPreferences({ key: preferenceKey, value: loadPreferences(preferenceKey) })
    setDialog(null); setReview(null); setTab('tasks'); setPreferenceMessage('')
  }, [preferenceKey])
  useEffect(() => { setReview(null) }, [profile])
  const refresh = () => { if (user && !profile) dispatch(fetchCurrentUser()); setToday(new Date()); setRevision(value => value + 1) }
  const openDialog = value => { trigger.current = document.activeElement; setDialog({ ...value, userId }) }
  const closeDialog = useCallback(() => { if (taskBusy.current) return; setDialog(null); requestAnimationFrame(() => trigger.current?.focus()) }, [])
  const taskBusyChanged = useCallback(value => { taskBusy.current = value; setTaskSaving(value) }, [])
  const openApproval = item => { trigger.current = document.activeElement; setReview({ item, userId, profile }) }
  const closeReview = useCallback(() => { setReview(null); requestAnimationFrame(() => trigger.current?.focus()) }, [])
  const openItem = row => {
    if (tab === 'approvals') { openApproval(row); return }
    if (tab === 'tasks') {
      if (!dialog) trigger.current = document.activeElement
      setDialog({ type: 'task', item: row, userId })
      return
    }
    const route = safeRoute(row.route)
    if (route) navigate(route)
    else openDialog({ type: 'activity', item: row })
  }
  const showTasks = () => { setTab('tasks'); document.getElementById('wh-work-title')?.scrollIntoView({ block: 'nearest' }) }
  const savePreferences = value => {
    setPreferences({ key: preferenceKey, value })
    try { localStorage.setItem(preferenceKey, JSON.stringify(value)); setPreferenceMessage('Your work hub preferences have been saved on this device.') }
    catch { setPreferenceMessage('Preferences applied for this visit. This browser could not save them.') }
    closeDialog()
  }
  const workLoading = tab === 'approvals' ? data.approvals.loading : data.bundle.loading
  const workError = tab === 'approvals' ? data.approvals.error || approvals && !approvals.available : data.bundle.error || (tab === 'tasks' ? tasks?.status === 'error' : activity?.status === 'error')
  const workUnavailable = tab === 'approvals' ? false : (tab === 'tasks' ? tasks?.status === 'unavailable' : activity?.status === 'unavailable')
  const workRows = tab === 'approvals' ? approvalRows : tab === 'tasks' ? taskRows : recentRows
  const workReason = tab === 'tasks' ? tasks?.reason : activity?.reason
  const workTruncated = tab === 'approvals' ? approvals?.partial : tab === 'tasks' ? tasks?.truncated : activity?.truncated
  const approvalsValue = data.approvals.loading || !approvals?.available ? '—' : `${approvalRows.length}${approvals.partial ? '+' : ''}`

  return <div className="wh-page" data-testid="my-work-hub">
    <header className="wh-page-header"><div><nav className="wh-breadcrumb" aria-label="Breadcrumb"><span>Home</span><span aria-hidden="true">/</span><span>My Work Hub</span></nav><h1>{greeting}, {firstName}</h1><p>Your work, approvals, schedule and company updates in one place.</p></div><div className="wh-header-actions"><time dateTime={today.toISOString()}>{today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</time><button className="wh-button" onClick={refresh} disabled={data.bundle.loading || data.approvals.loading}><ArrowPathIcon aria-hidden="true" className={data.bundle.loading ? 'wh-spin' : ''} />Refresh</button><button className="wh-button" onClick={() => openDialog({ type: 'customize' })}><Cog6ToothIcon aria-hidden="true" />Customize</button></div></header>
    {preferenceMessage && <div className="wh-message" role="status"><CheckCircleIcon aria-hidden="true" /><span>{preferenceMessage}</span><button className="wh-icon-button" aria-label="Dismiss preferences message" onClick={() => setPreferenceMessage('')}><XMarkIcon aria-hidden="true" /></button></div>}
    <div className={`wh-columns${hasRightColumn ? '' : ' wh-columns--full'}`}><div className="wh-main-column">
      <section className="wh-kpis" aria-label="My work at a glance" data-testid="workhub-kpis">
        <Kpi title="Tasks due" value={isReady(tasks) ? metric(tasks.counts?.due) : '—'} note={isReady(tasks) ? `${metric(tasks.counts?.overdue)} overdue` : data.bundle.loading ? 'Loading your tasks' : 'Task data unavailable'} description="Open project tasks assigned to you with a deadline today or earlier." icon={CheckCircleIcon} tone="blue" alert={numberValue(tasks?.counts?.overdue) > 0} onClick={showTasks} />
        <Kpi title="Approvals waiting" value={approvalsValue} note={data.approvals.loading ? 'Loading your queues' : !approvals?.available ? 'Approval data unavailable' : approvals.partial ? 'Partial queue coverage' : `${approvalRows.filter(row => row._details.priority.code === 'urgent').length} urgent`} description="Requests awaiting your decision in connected approval queues." icon={ClockIcon} tone="amber" alert={approvalRows.some(row => row._details.priority.code === 'urgent')} onClick={() => setTab('approvals')} />
        <Kpi title="Leave balance" value={isReady(leave) && numberValue(leave.balance, true) !== null ? `${metric(leave.balance, true)} days` : '—'} note={isReady(leave) ? `${leave.year} annual ledger` : data.bundle.loading ? 'Loading your balance' : 'Balance not available'} description="Recorded annual leave balance; no accrual projection is applied." icon={PaperAirplaneIcon} tone="green" onClick={() => navigate('/profile?tab=leave')} />
        <Kpi title="Hours this month" value={isReady(hours) && numberValue(hours.value) !== null ? `${metric(hours.value)}h` : '—'} note={isReady(hours) ? 'Logged work hours' : data.bundle.loading ? 'Loading your hours' : 'Hours not available'} description="Hours entered in your Daily Tracker this month, across all review states." icon={ClockIcon} tone="purple" onClick={() => navigate('/profile?tab=daily_tracker')} />
      </section>
      <section className="wh-panel wh-work" aria-labelledby="wh-work-title"><div className="wh-panel-heading"><h2 id="wh-work-title">My work today</h2>{tab === 'approvals' ? <Link className="wh-text-button" to="/approvals">View all<ChevronRightIcon aria-hidden="true" /></Link> : <button className="wh-text-button" disabled={!workRows.length} onClick={() => openDialog({ type: 'work' })}>View all<ChevronRightIcon aria-hidden="true" /></button>}</div>
        <nav className="wh-tabs" aria-label="My work views">{['tasks', 'approvals', 'recent'].map(id => <button key={id} aria-current={tab === id ? 'page' : undefined} className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}>{humanize(id)}</button>)}</nav>
        <WorkTable tab={tab} rows={workRows.slice(0, 5)} loading={workLoading} error={workError} unavailable={workUnavailable} reason={workReason} onRetry={refresh} onOpen={openItem} asOf={bundle?.as_of} timeZone={bundle?.period.timezone} />
        {tab === 'recent' ? isReady(activity) && <p className="wh-source-note">{workRows.length > 5 || workTruncated ? 'Showing your latest activity. Use View all for more. ' : ''}Recorded actions and workspace visits.</p> : workTruncated && <p className="wh-source-note">Showing available records. {tab === 'approvals' ? 'Some queues are unavailable or have more requests.' : 'More records are available in the source workspace.'}</p>}
      </section>
      {currentPreferences.workspaces && <section className="wh-panel wh-workspaces"><div className="wh-panel-heading"><h2>Your workspaces</h2><button className="wh-text-button" onClick={() => openDialog({ type: 'workspaces' })}>View all<ChevronRightIcon aria-hidden="true" /></button></div><div className="wh-shortcuts">{shortcuts.map(item => <Workspace key={item.id} item={item} />)}</div>{data.features.error && <p className="wh-source-note">Some workspaces could not be loaded. <button className="wh-text-button" onClick={refresh}>Retry</button></p>}{!shortcuts.length && <p className="wh-source-note">Choose your shortcuts in Customize.</p>}</section>}
      {currentPreferences.activity && <ActivityOverview source={activity} loading={data.bundle.loading} error={data.bundle.error} onRetry={refresh} />}
    </div>{hasRightColumn && <div className="wh-side-column">
      {currentPreferences.calendar && <WorkHubCalendar source={calendar} month={month} onMonthChange={setMonth} onRetry={refresh} onOpenFull={() => openDialog({ type: 'calendar' })} />}
      {currentPreferences.notices && <WorkHubNotices source={noticeSource} onRetry={refresh} onOpenNotice={item => openDialog({ type: 'notice', item })} onViewAll={() => navigate('/notifications')} />}
    </div>}</div>
    <footer className="wh-page-footer"><span>{bundle ? `Updated ${new Date(bundle.as_of).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : data.bundle.loading ? 'Updating your work hub…' : 'Work summary unavailable'}</span><span>Personal records · Source availability is shown in each panel</span></footer>
    {dialog?.userId === userId && <HubDialog title={{ customize: 'Customize your work hub', calendar: 'HR calendar', workspaces: 'Available workspaces', work: tab === 'tasks' ? 'My assigned tasks' : 'Recent activity', task: 'Assigned task', notice: 'Notice details', activity: 'Activity details' }[dialog.type]} onClose={closeDialog} busy={dialog.type === 'task' && taskSaving} wide={['work', 'workspaces'].includes(dialog.type)}>
      {dialog.type === 'task' && <AssignedTaskDetail key={`${userId}:${dialog.item.id}`} taskId={dialog.item.id} onSaved={refresh} onClose={closeDialog} onBusyChange={taskBusyChanged} />}
      {dialog.type === 'customize' && <Customize preferences={currentPreferences} workspaces={workspaces} onSave={savePreferences} onCancel={closeDialog} />}
      {dialog.type === 'calendar' && <WorkHubCalendar source={calendar} month={month} onMonthChange={setMonth} onRetry={refresh} expanded />}
      {dialog.type === 'workspaces' && <WorkspaceDirectory items={workspaces} />}
      {dialog.type === 'work' && <><WorkTable tab={tab} rows={workRows} loading={workLoading} error={workError} unavailable={workUnavailable} reason={workReason} onRetry={refresh} onOpen={openItem} asOf={bundle?.as_of} timeZone={bundle?.period.timezone} />{workTruncated && <p className="wh-source-note">{tab === 'recent' ? `Showing the latest ${workRows.length} activity records from the last 7 days.` : 'This is a limited preview. Open the source workspace for all records.'}</p>}{tab === 'tasks' && safeRoute(tasks?.route) && <Link className="wh-button" to={safeRoute(tasks.route)}>Open project workspace<ArrowRightIcon aria-hidden="true" /></Link>}</>}
      {['notice', 'activity'].includes(dialog.type) && <div className="wh-detail"><h3>{dialog.item.title || humanize(dialog.item.type)}</h3><p className="wh-muted">{displayDate(dialog.item.created_at || dialog.item.timestamp)}</p><p>{dialog.item.message || dialog.item.description || 'No description recorded.'}</p>{safeRoute(dialog.item.action_url || dialog.item.route) && <Link className="wh-button wh-button--primary" to={safeRoute(dialog.item.action_url || dialog.item.route)}>Open source<ArrowRightIcon aria-hidden="true" /></Link>}</div>}
    </HubDialog>}
    {review?.userId === userId && review.profile === profile && <ApprovalReviewDialog item={review.item} initialAction="view" onClose={closeReview} onDecision={refresh} />}
  </div>
}

function Kpi({ title, value, note, description, icon: Icon, tone, alert, onClick }) {
  return <button className={`wh-kpi wh-kpi--${tone}`} onClick={onClick} title={description || note}><span className="wh-kpi-icon"><Icon aria-hidden="true" /></span><span className="wh-kpi-copy"><span className="wh-kpi-title">{title}</span><strong>{value}</strong><small className={alert ? 'wh-danger' : ''}>{note}</small></span><ChevronRightIcon className="wh-kpi-arrow" aria-hidden="true" /></button>
}
function WorkTable({ tab, rows, loading, error, unavailable, reason, onRetry, onOpen, asOf, timeZone }) {
  if (loading || error || unavailable || !rows.length) return <div className="wh-work-empty" role={error ? 'alert' : 'status'}><InboxIcon aria-hidden="true" /><h3>{loading ? 'Loading your work' : error ? 'This work list could not be loaded' : unavailable ? 'Work list unavailable' : tab === 'approvals' ? 'No approvals waiting' : tab === 'recent' ? 'No recent activity yet' : 'No open tasks assigned'}</h3><p>{reason || (error ? 'Retry to get the latest records.' : loading ? 'Retrieving your personal records.' : tab === 'recent' ? 'Your workspace visits and recorded actions will appear here.' : 'New records will appear here when available.')}</p>{error && <button className="wh-button" onClick={onRetry}>Retry work list</button>}</div>
  return <div className="wh-table-scroll" role="region" aria-label="Scrollable work list" tabIndex={0}><table className="wh-work-table" data-testid="workhub-tasks"><thead><tr><th aria-label="Type" /><th>Title</th><th>{tab === 'recent' ? 'Recorded' : 'Due date'}</th><th>Source</th><th>Status</th><th>Action</th></tr></thead><tbody>{rows.map(row => {
    const detail = row._details
    const title = tab === 'approvals' ? `Review ${detail.reference}` : row.title
    const description = tab === 'approvals' ? detail.title : tab === 'recent' ? row.description : row.project_name || row.project_code
    const date = tab === 'approvals' ? detail.dueAt : tab === 'recent' ? row.timestamp : row.due_date
    const status = tab === 'approvals' ? detail.stageLabel : tab === 'recent' ? row.status_label : humanize(row.status)
    const action = tab === 'approvals' ? 'Review' : tab === 'recent' && !safeRoute(row.route) ? 'View details' : 'Open'
    return <tr key={row._queueKey || row.id}><td><span className="wh-work-icon"><DocumentTextIcon aria-hidden="true" /></span></td><td><strong>{tab === 'tasks' ? <button className="wh-task-title-button" onClick={() => onOpen(row)}>{title || 'Untitled task'}</button> : title || 'Untitled record'}</strong><small title={description}>{description}</small></td><td className={tab === 'approvals' && detail.overdue || tab === 'tasks' && taskIsOverdue(date, asOf, timeZone) ? 'wh-danger' : ''}>{displayDate(date)}</td><td>{tab === 'approvals' ? row._approvalLabel : tab === 'tasks' ? 'Project Control' : row.source_label}</td><td><span className={`wh-status wh-status--${/fail|reject|blocked/i.test(status) ? 'danger' : /progress|review/i.test(status) ? 'blue' : /pending|not started|todo|to do/i.test(status) ? 'amber' : 'neutral'}`}>{status}</span></td><td><button className={`wh-button wh-work-action${tab === 'approvals' ? ' wh-button--primary' : ''}`} aria-label={`${action}${action === 'View details' ? ' for' : ''} ${detail?.reference || title}`} onClick={() => onOpen(row)}>{action}</button></td></tr>
  })}</tbody></table></div>
}
function Workspace({ item }) {
  const Icon = ICONS[item.category] || FolderOpenIcon
  return <Link className="wh-shortcut" to={item.route}><Icon aria-hidden="true" /><strong>{item.title}</strong><span>{item.description}</span><ChevronRightIcon className="wh-shortcut-arrow" aria-hidden="true" /></Link>
}
function WorkspaceDirectory({ items }) {
  const [search, setSearch] = useState('')
  const filtered = items.filter(item => `${item.title} ${item.description}`.toLowerCase().includes(search.toLowerCase()))
  return <><label className="wh-search"><MagnifyingGlassIcon aria-hidden="true" /><input aria-label="Search workspaces" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search available workspaces..." /></label><div className="wh-shortcuts wh-shortcuts--directory">{filtered.map(item => <Workspace item={item} key={item.id} />)}</div>{!filtered.length && <p>No matching workspaces.</p>}</>
}
function ActivityOverview({ source, loading, error, onRetry }) {
  const ready = isReady(source) && Array.isArray(source.series)
  const series = ready ? source.series : []
  const maximum = Math.max(1, ...series.map(row => numberValue(row.count) ?? 0))
  return <section className="wh-panel wh-activity" aria-label="Activity overview" data-testid="workhub-activity"><div className="wh-panel-heading"><h2>Activity overview</h2><span className="wh-muted">Last 7 days</span></div>{loading || error || !ready ? <div className="wh-activity-empty" role="status"><ChartBarIcon aria-hidden="true" /><span>{loading ? 'Loading your activity…' : 'Personal activity is not available.'}</span>{(error || source?.status === 'error') && <button className="wh-text-button" onClick={onRetry}>Retry activity</button>}</div> : <div className="wh-activity-content"><div className="wh-chart" role="img" aria-label={`Recorded actions and workspace visits over seven days: ${series.map(row => `${row.date}: ${row.count}`).join('; ')}`}><div className="wh-chart-axis"><span>{maximum}</span><span>{Math.round(maximum / 2)}</span><span>0</span></div><div className="wh-chart-columns">{series.map(row => <div className="wh-chart-day" key={row.date}><div className="wh-chart-bar-area"><div className="wh-chart-bar" style={{ height: `${((numberValue(row.count) ?? 0) / maximum) * 100}%` }} title={`${row.count} activity records`} /></div><span>{new Date(`${row.date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })}</span></div>)}</div></div><div className="wh-activity-metrics"><div><CheckCircleIcon aria-hidden="true" /><span><strong>{metric(source.total_count)}</strong><span>Recorded activity</span><small>Actions and page visits</small></span></div><div><DocumentTextIcon aria-hidden="true" /><span><strong>{series.filter(row => row.count > 0).length}</strong><span>Active days</span><small>Last 7 days</small></span></div></div></div>}</section>
}
function HubDialog({ title, onClose, children, wide, busy = false }) {
  const element = useRef(null)
  useEffect(() => {
    const dialog = element.current
    dialog.showModal()
    const cancel = event => { event.preventDefault(); onClose() }
    const trapTab = event => {
      if (event.key !== 'Tab') return
      const controls = [...dialog.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex="0"]')].filter(control => control.getClientRects().length)
      const first = controls[0], last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    dialog.addEventListener('cancel', cancel)
    dialog.addEventListener('keydown', trapTab)
    return () => { dialog.removeEventListener('cancel', cancel); dialog.removeEventListener('keydown', trapTab); dialog.close() }
  }, [onClose])
  return <dialog ref={element} className={`wh-dialog${wide ? ' wh-dialog--wide' : ''}`} aria-labelledby="wh-dialog-title"><header><h2 id="wh-dialog-title">{title}</h2><button className="wh-icon-button" aria-label="Close dialog" onClick={onClose} disabled={busy}><XMarkIcon aria-hidden="true" /></button></header>{children}</dialog>
}
function Customize({ preferences, workspaces, onSave, onCancel }) {
  const [draft, setDraft] = useState({ ...preferences, shortcuts: preferences.shortcuts ?? defaultShortcuts(workspaces) })
  return <form className="wh-customize" onSubmit={event => { event.preventDefault(); onSave(draft) }}><p>Choose the panels and up to six workspace shortcuts shown on this device.</p><fieldset><legend>Visible panels</legend>{Object.entries(SECTIONS).map(([key, label]) => <label key={key}><input type="checkbox" checked={draft[key]} onChange={event => setDraft(current => ({ ...current, [key]: event.target.checked }))} />{label}</label>)}</fieldset><fieldset><legend>Workspace shortcuts ({draft.shortcuts.length}/6)</legend>{workspaces.map(item => <label key={item.id}><input type="checkbox" checked={draft.shortcuts.includes(item.id)} disabled={!draft.shortcuts.includes(item.id) && draft.shortcuts.length >= 6} onChange={event => setDraft(current => ({ ...current, shortcuts: event.target.checked ? [...current.shortcuts, item.id] : current.shortcuts.filter(id => id !== item.id) }))} />{item.title}</label>)}</fieldset><footer><button type="button" className="wh-text-button" onClick={() => setDraft({ ...DEFAULT_PREFERENCES, shortcuts: defaultShortcuts(workspaces) })}>Restore defaults</button><button type="button" className="wh-button" onClick={onCancel}>Cancel</button><button type="submit" className="wh-button wh-button--primary">Save preferences</button></footer></form>
}
