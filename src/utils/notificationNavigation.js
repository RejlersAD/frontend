const legacyRouteAliases = (path) => {
  if (/^\/procurement\/purchase-orders(?:\/|$)/i.test(path)) {
    return path.replace(/^\/procurement\/purchase-orders/i, '/procurement/orders')
  }

  if (/^\/profile\/settings(?:\/|$|\?)/i.test(path)) {
    return path.replace(/^\/profile\/settings/i, '/profile')
  }

  return path
}

const metadataTarget = (metadata = {}) => {
  if (metadata.pr_id) return `/notifications?preview=pr&id=${encodeURIComponent(metadata.pr_id)}`
  if (metadata.po_id) return `/notifications?preview=po&id=${encodeURIComponent(metadata.po_id)}`
  if (metadata.payroll_run_id) return `/hr/payroll?run=${metadata.payroll_run_id}`
  if (metadata.offboarding_id) return `/hr/onboarding?tab=offboarding&record_id=${metadata.offboarding_id}`
  return ''
}

/**
 * Resolve a notification action into a route the SPA can open reliably.
 * Same-origin absolute URLs become internal routes; external URLs remain full URLs.
 */
export const resolveNotificationTarget = (notification) => {
  const recordTarget = metadataTarget(notification?.metadata)
  const rawTarget = String(
    recordTarget
    || notification?.action_url
    || notification?.metadata?.action_url
    || notification?.metadata?.route
    || ''
  ).trim()

  if (!rawTarget) return null

  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost'

  try {
    const parsed = new URL(rawTarget, origin)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { href: parsed.href, isExternal: true, isRecordPreview: Boolean(recordTarget) }
    }

    if (parsed.origin !== origin) {
      return { href: parsed.href, isExternal: true, isRecordPreview: Boolean(recordTarget) }
    }

    const internalPath = legacyRouteAliases(`${parsed.pathname}${parsed.search}${parsed.hash}`)
    return {
      href: internalPath.startsWith('/') ? internalPath : `/${internalPath}`,
      isExternal: false,
      isRecordPreview: Boolean(recordTarget),
    }
  } catch {
    const internalPath = legacyRouteAliases(rawTarget.startsWith('/') ? rawTarget : `/${rawTarget}`)
    return { href: internalPath, isExternal: false, isRecordPreview: Boolean(recordTarget) }
  }
}
