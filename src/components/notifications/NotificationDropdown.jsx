import { forwardRef, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeftIcon, ArrowPathIcon, ArrowRightIcon, BellSlashIcon, ChartBarIcon,
  CheckCircleIcon, ClipboardDocumentListIcon, ClockIcon, Cog6ToothIcon,
  DevicePhoneMobileIcon, DocumentTextIcon, EllipsisHorizontalIcon,
  ExclamationTriangleIcon, InformationCircleIcon, MagnifyingGlassIcon,
  ShieldCheckIcon, SpeakerWaveIcon, SparklesIcon, TrashIcon, UserGroupIcon, XMarkIcon,
} from '@heroicons/react/24/outline'
import { canDecideOffboardingNotification } from '../../utils/approvalCapabilities'
import { formatDistanceToNow } from '../../utils/dateFormatter'
import { resolveNotificationTarget } from '../../utils/notificationNavigation'
import './NotificationDropdown.css'

const FILTERS = [
  { id: 'all', label: 'All' }, { id: 'unread', label: 'Unread' },
  { id: 'approvals', label: 'Approvals' }, { id: 'system', label: 'System' },
]

const CATEGORY_STYLE = {
  SYSTEM: { label: 'System', Icon: Cog6ToothIcon, tone: 'slate' },
  PROJECT: { label: 'Projects', Icon: ChartBarIcon, tone: 'violet' },
  QHSE: { label: 'QHSE', Icon: ShieldCheckIcon, tone: 'emerald' },
  DOCUMENT: { label: 'Documents', Icon: DocumentTextIcon, tone: 'blue' },
  USER: { label: 'People', Icon: UserGroupIcon, tone: 'violet' },
  ADMIN: { label: 'Administration', Icon: Cog6ToothIcon, tone: 'slate' },
  AI: { label: 'AI', Icon: SparklesIcon, tone: 'violet' },
  APPROVAL: { label: 'Approvals', Icon: ClockIcon, tone: 'amber' },
  ALERT: { label: 'Alerts', Icon: ExclamationTriangleIcon, tone: 'rose' },
  INFO: { label: 'Information', Icon: InformationCircleIcon, tone: 'blue' },
}

const categoryName = (notification) => String(
  notification.category_name || notification.category?.name || notification.category_detail?.name
  || (typeof notification.category === 'string' ? notification.category : '')
).toUpperCase()

const categoryStyle = (notification) => {
  const category = categoryName(notification)
  if (category === 'APPROVAL' && (
    notification.metadata?.decision_status === 'approved' || /\bapproved\b/i.test(notification.title)
  )) return { label: 'Approvals', Icon: CheckCircleIcon, tone: 'emerald' }
  return CATEGORY_STYLE[category] || CATEGORY_STYLE.INFO
}

// Native disclosure buttons support Tab / Enter without imposing menu-role keyboard rules.
function NotificationActions({ notification, busy, onMarkAsRead, onDelete }) {
  const [open, setOpen] = useState(false)
  const [opensUp, setOpensUp] = useState(false)
  const containerRef = useRef(null)
  const triggerRef = useRef(null)
  const actionsRef = useRef(null)
  const actionsId = useId()

  useLayoutEffect(() => {
    if (!open) return
    const button = triggerRef.current.getBoundingClientRect()
    const actions = actionsRef.current.getBoundingClientRect()
    const list = containerRef.current.closest('.notification-drawer__body').getBoundingClientRect()
    setOpensUp(button.bottom + actions.height + 4 > list.bottom && button.top - actions.height - 4 >= list.top)
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const closeOutside = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [open])

  const runAction = (handler) => {
    setOpen(false)
    triggerRef.current?.focus()
    handler(notification.id)
  }

  return (
    <div className="notification-drawer__actions" ref={containerRef}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation()
          setOpen(false)
          triggerRef.current?.focus()
        }
      }}
    >
      <button ref={triggerRef} type="button" className="notification-drawer__icon-button"
        aria-label={`Actions for ${notification.title}`} aria-expanded={open}
        aria-controls={actionsId} disabled={busy} onClick={() => setOpen((value) => !value)}
      >
        {busy ? <ArrowPathIcon aria-hidden="true" className="notification-drawer__spin" /> : <EllipsisHorizontalIcon aria-hidden="true" />}
      </button>
      {open && (
        <div ref={actionsRef} id={actionsId} className={`notification-drawer__action-list${opensUp ? ' notification-drawer__action-list--above' : ''}`}>
          {!notification.is_read && (
            <button type="button" onClick={() => runAction(onMarkAsRead)}>
              <CheckCircleIcon aria-hidden="true" /> Mark as read
            </button>
          )}
          <button type="button" className="notification-drawer__delete" onClick={() => runAction(onDelete)}>
            <TrashIcon aria-hidden="true" /> Delete notification
          </button>
        </div>
      )}
    </div>
  )
}

const NotificationDropdown = forwardRef(({
  notifications = [], loading = false, unreadCount = 0,
  onMarkAsRead, onMarkAllAsRead, onDelete, onRefresh,
  onOffboardingDecision, decisionLoadingId, decisionMessage,
  soundEnabled, onToggleSound, pushState, onTogglePush,
  onClose, onNavigate, busyIds = [], bulkBusy = false, errorMessage = '', hasMore = false,
}, ref) => {
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const searchRef = useRef(null)
  const searchToggleRef = useRef(null)
  const preferencesRef = useRef(null)
  const preferencesToggleRef = useRef(null)

  useEffect(() => {
    if (searchOpen && !preferencesOpen) searchRef.current?.focus()
  }, [searchOpen, preferencesOpen])
  useEffect(() => {
    if (preferencesOpen) preferencesRef.current?.focus()
  }, [preferencesOpen])

  const searchTerm = query.trim().toLocaleLowerCase()
  const visibleNotifications = notifications.filter((notification) => {
    const category = categoryName(notification)
    if (filter === 'unread' && notification.is_read) return false
    if (filter === 'approvals' && category !== 'APPROVAL') return false
    if (filter === 'system' && category !== 'SYSTEM') return false
    return !searchTerm || [notification.title, notification.message, categoryStyle(notification).label]
      .some((value) => String(value || '').toLocaleLowerCase().includes(searchTerm))
  })
  const today = new Date().toDateString()
  const groups = [
    { label: 'Today', items: visibleNotifications.filter((item) => new Date(item.created_at).toDateString() === today) },
    { label: 'Earlier', items: visibleNotifications.filter((item) => new Date(item.created_at).toDateString() !== today) },
  ].filter((group) => group.items.length)
  const recentUnreadCount = notifications.filter((notification) => !notification.is_read).length
  const limitedList = hasMore || unreadCount > recentUnreadCount
  const pushDisabled = pushState?.busy || pushState?.supported === false
    || (!pushState?.enabled && (pushState?.available === false || pushState?.permission === 'denied'))
  const pushDescription = pushState?.supported === false
    ? 'Browser notifications are not supported on this device.'
    : pushState?.permission === 'denied'
      ? 'Allow notifications in your browser settings to enable this.'
      : pushState?.available === false
        ? 'Browser notifications are not configured for this workspace.'
        : 'Receive updates on this device when RADAI is in the background.'

  return (
    <section id="notification-drawer" ref={ref} className="notification-drawer" role="dialog" aria-modal="true"
      aria-labelledby="notification-drawer-title" tabIndex={-1}
    >
      <header className="notification-drawer__header">
        <div className="notification-drawer__heading">
          <h2 id="notification-drawer-title">Notifications</h2>
          <span className="notification-drawer__count">{unreadCount} unread</span>
        </div>
        <div className="notification-drawer__header-actions">
          <button type="button" className="notification-drawer__text-button notification-drawer__mark-all"
            disabled={unreadCount === 0 || bulkBusy || busyIds.length > 0} onClick={onMarkAllAsRead} aria-busy={bulkBusy}
          >{bulkBusy ? 'Marking all read…' : 'Mark all read'}</button>
          <button ref={preferencesToggleRef} type="button" className="notification-drawer__icon-button"
            aria-label="Notification preferences" aria-expanded={preferencesOpen} aria-controls="notification-drawer-preferences"
            onClick={() => setPreferencesOpen((value) => !value)}
          ><Cog6ToothIcon aria-hidden="true" /></button>
          <button type="button" className="notification-drawer__icon-button" aria-label="Close notifications" onClick={onClose}>
            <XMarkIcon aria-hidden="true" />
          </button>
        </div>
      </header>

      {!preferencesOpen && (
        <div className="notification-drawer__filters">
          <div className="notification-drawer__filter-buttons" role="group" aria-label="Filter notifications">
            {FILTERS.map((item) => (
              <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>
                {item.label}
                {item.id === 'unread' && unreadCount > 0 && <span className="notification-drawer__filter-count">{unreadCount}</span>}
              </button>
            ))}
          </div>
          <button ref={searchToggleRef} type="button" className="notification-drawer__icon-button"
            aria-label="Search notifications" aria-expanded={searchOpen} aria-controls="notification-drawer-search"
            onClick={() => { setSearchOpen((value) => !value); setQuery('') }}
          ><MagnifyingGlassIcon aria-hidden="true" /></button>
        </div>
      )}
      {!preferencesOpen && searchOpen && (
        <div className="notification-drawer__search" id="notification-drawer-search">
          <MagnifyingGlassIcon aria-hidden="true" />
          <input ref={searchRef} type="search" aria-label="Search notifications" placeholder="Search recent notifications"
            value={query} onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.stopPropagation()
                setQuery(''); setSearchOpen(false); searchToggleRef.current?.focus()
              }
            }}
          />
        </div>
      )}
      {errorMessage && <div className="notification-drawer__notice notification-drawer__notice--error" role="alert">{errorMessage}</div>}
      {decisionMessage && <div className="notification-drawer__notice" role="status">{decisionMessage}</div>}
      {pushState?.error && <div className="notification-drawer__notice notification-drawer__notice--error" role="alert">{pushState.error}</div>}

      <div className="notification-drawer__body">
        {preferencesOpen ? (
          <section id="notification-drawer-preferences" className="notification-drawer__preferences" aria-labelledby="notification-preferences-title">
            <button type="button" className="notification-drawer__text-button notification-drawer__back"
              onClick={() => { setPreferencesOpen(false); preferencesToggleRef.current?.focus() }}
            ><ArrowLeftIcon aria-hidden="true" /> Back to notifications</button>
            <h3 ref={preferencesRef} tabIndex={-1} id="notification-preferences-title">Notification preferences</h3>
            <p className="notification-drawer__settings-intro">Choose how this browser alerts you to new updates.</p>
            <div className="notification-drawer__setting">
              <SpeakerWaveIcon aria-hidden="true" />
              <div><strong id="notification-sound-label">Notification sounds</strong><p>Play a sound when a new notification arrives.</p></div>
              <button type="button" className="notification-drawer__switch" role="switch"
                aria-checked={Boolean(soundEnabled)} aria-labelledby="notification-sound-label" onClick={onToggleSound}
              ><span /></button>
            </div>
            <div className="notification-drawer__setting">
              <DevicePhoneMobileIcon aria-hidden="true" />
              <div><strong id="notification-push-label">Browser push notifications</strong><p id="notification-push-description">{pushDescription}</p></div>
              <button type="button" className="notification-drawer__switch" role="switch"
                aria-checked={Boolean(pushState?.enabled)} aria-labelledby="notification-push-label"
                aria-describedby="notification-push-description" aria-busy={Boolean(pushState?.busy)}
                disabled={pushDisabled} onClick={onTogglePush}
              ><span /></button>
            </div>
          </section>
        ) : (
          <>
            <div className="notification-drawer__scope">
              <span>{limitedList ? 'Latest notifications · View the notification center for all.' : 'Your recent updates'}</span>
              <button type="button" className="notification-drawer__icon-button" aria-label="Refresh notifications" disabled={loading} onClick={onRefresh}>
                <ArrowPathIcon aria-hidden="true" className={loading ? 'notification-drawer__spin' : ''} />
              </button>
            </div>
            {loading && notifications.length === 0 ? (
              <div className="notification-drawer__empty" role="status">
                <ArrowPathIcon aria-hidden="true" className="notification-drawer__spin" /><h3>Loading notifications…</h3>
              </div>
            ) : visibleNotifications.length === 0 ? (
              <div className="notification-drawer__empty" role="status">
                <BellSlashIcon aria-hidden="true" />
                <h3>{notifications.length === 0 ? (errorMessage ? 'Notifications unavailable' : 'No notifications yet') : 'No matching notifications'}</h3>
                <p>{notifications.length === 0 && errorMessage ? 'Refresh to try loading your notifications again.'
                  : searchTerm || filter !== 'all' ? 'Try another filter or search your notification center.' : 'New updates will appear here.'}</p>
              </div>
            ) : (
              <div className="notification-drawer__groups" aria-busy={loading}>
                {groups.map((group) => (
                  <section key={group.label} aria-label={group.label}>
                    <h3 className="notification-drawer__group-title">{group.label}</h3>
                    <ul className="notification-drawer__list">
                      {group.items.map((notification) => {
                        const { label, Icon, tone } = categoryStyle(notification)
                        const actionTarget = resolveNotificationTarget(notification)
                        const busy = bulkBusy || busyIds.some((id) => String(id) === String(notification.id))
                        const decisionBusy = busy || decisionLoadingId === notification.id
                        return (
                          <li key={notification.id} aria-label={notification.title} data-notification-id={notification.id}
                            className={`notification-drawer__item${notification.is_read ? '' : ' notification-drawer__item--unread'}`} aria-busy={busy}
                          >
                            <div className={`notification-drawer__category notification-drawer__category--${tone}`}><Icon aria-hidden="true" /></div>
                            <div className="notification-drawer__content">
                              <h4>{notification.title}</h4>
                              <p className="notification-drawer__message">{notification.message}</p>
                              <p className="notification-drawer__metadata">
                                <span>{label}</span><span aria-hidden="true">·</span>
                                <time dateTime={notification.created_at}>{formatDistanceToNow(notification.created_at)}</time>
                                {['HIGH', 'URGENT'].includes(notification.priority?.toUpperCase()) && (
                                  <span className="notification-drawer__priority">{notification.priority.toUpperCase() === 'URGENT' ? 'Urgent' : 'High priority'}</span>
                                )}
                              </p>
                              {notification.metadata?.action_type === 'offboarding_project_manager_decision' && (
                                canDecideOffboardingNotification(notification) ? (
                                  <div className="notification-drawer__decisions">
                                    <button type="button" disabled={decisionBusy} onClick={() => onOffboardingDecision(notification, 'approved')}>
                                      <CheckCircleIcon aria-hidden="true" /> Approve
                                    </button>
                                    <button type="button" className="notification-drawer__reject" disabled={decisionBusy} onClick={() => onOffboardingDecision(notification, 'rejected')}>
                                      <XMarkIcon aria-hidden="true" /> Reject
                                    </button>
                                  </div>
                                ) : (
                                  <p className="notification-drawer__decision-status">
                                    {notification.metadata?.decision_status === 'pending' ? 'View the exit request for its current approval status.'
                                      : `Exit process ${notification.metadata?.decision_status || 'updated'}`}
                                  </p>
                                )
                              )}
                              {actionTarget && (
                                <Link to={actionTarget.href} reloadDocument={actionTarget.isExternal} className="notification-drawer__record-link"
                                  onClick={() => {
                                    if (!notification.is_read && !busy) onMarkAsRead(notification.id)
                                    onNavigate?.(notification)
                                  }}
                                >
                                  {actionTarget.isRecordPreview ? 'Preview' : notification.action_label || 'View details'}<ArrowRightIcon aria-hidden="true" />
                                </Link>
                              )}
                              {busy && <span className="notification-drawer__row-status" role="status">Updating notification…</span>}
                            </div>
                            <div className="notification-drawer__row-actions">
                              {!notification.is_read && <span className="notification-drawer__unread-dot"><span className="notification-drawer__sr-only">Unread</span></span>}
                              <NotificationActions notification={notification} busy={decisionBusy} onMarkAsRead={onMarkAsRead} onDelete={onDelete} />
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <footer className="notification-drawer__footer">
        <Link to="/notifications" onClick={() => onNavigate?.()}>
          <ClipboardDocumentListIcon aria-hidden="true" /> View notification center <ArrowRightIcon aria-hidden="true" />
        </Link>
        <button type="button" onClick={() => setPreferencesOpen(true)}>
          <Cog6ToothIcon aria-hidden="true" /> Notification preferences
        </button>
      </footer>
    </section>
  )
})

NotificationDropdown.displayName = 'NotificationDropdown'

export default NotificationDropdown
