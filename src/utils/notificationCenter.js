import { resolveNotificationTarget } from './notificationNavigation'

export const notificationCategory = (notification) => String(
  notification.category_detail?.name || notification.category_name || notification.category?.name || 'INFO',
).toUpperCase()

export const notificationPriority = (notification) => String(notification.priority || 'NORMAL').toUpperCase()

export const isApprovalNotification = (notification) => notificationCategory(notification) === 'APPROVAL'

export const isUrgentNotification = (notification) => ['HIGH', 'URGENT', 'CRITICAL'].includes(notificationPriority(notification))

export const notificationSourceKey = (notification) => {
  const metadata = notification?.metadata || {}
  if (metadata.entity_type === 'purchase_order' && (metadata.po_id || metadata.entity_id)) return `purchase_order:${metadata.po_id || metadata.entity_id}`
  if (metadata.entity_type === 'purchase_recommendation' && (metadata.pr_id || metadata.entity_id)) return `purchase_recommendation:${metadata.pr_id || metadata.entity_id}`
  if (metadata.po_id) return `purchase_order:${metadata.po_id}`
  if (metadata.pr_id) return `purchase_recommendation:${metadata.pr_id}`
  if (metadata.offboarding_id) return `offboarding:${metadata.offboarding_id}`
  if (metadata.payroll_run_id) return `payroll:${metadata.payroll_run_id}`
  if (metadata.entity_type && metadata.entity_id) return `${metadata.entity_type}:${metadata.entity_id}`
  const target = resolveNotificationTarget(notification)
  if (!target || target.isExternal) return null
  const parsed = new URL(target.href, 'http://localhost')
  const preview = parsed.searchParams.get('preview')
  const id = parsed.searchParams.get('id')
  if (id && ['po', 'pr'].includes(preview)) return `${preview === 'po' ? 'purchase_order' : 'purchase_recommendation'}:${id}`
  return null
}

export const notificationDateGroup = (value, now = new Date()) => {
  const date = new Date(value)
  if (!value || Number.isNaN(date.getTime())) return 'Date unavailable'
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  if (date >= tomorrow) return 'Upcoming'
  if (date >= today) return 'Today'
  if (date >= weekStart) return 'Earlier this week'
  return 'Older'
}

export const notificationTimeLabel = (notification) => {
  const date = new Date(notification.created_at)
  if (!notification.created_at || Number.isNaN(date.getTime())) return 'Date unavailable'
  if (notification.time_ago) {
    const label = String(notification.time_ago).trim()
    return /\b(ago|now|today|yesterday)\b/i.test(label) ? label : `${label} ago`
  }
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000))
  if (minutes < 1) return 'Just now'
  const units = minutes >= 10080 ? [Math.floor(minutes / 10080), 'week']
    : minutes >= 1440 ? [Math.floor(minutes / 1440), 'day']
      : minutes >= 60 ? [Math.floor(minutes / 60), 'hour'] : [minutes, 'minute']
  return `${units[0]} ${units[1]}${units[0] === 1 ? '' : 's'} ago`
}
