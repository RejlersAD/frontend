import { useEffect, useMemo, useState } from 'react'
import api from '../../services/api.service'
import { getEnabledApprovalTypes, getApprovalFilters } from '../../config/approvalsSystem.config'
import { normalizeApproval, sortApprovals, UNCONNECTED_QUEUES } from '../approvals/approvalQueue'
import { readBundle } from './workHubPresentation'

const pending = { data: null, loading: true, error: '' }
const readList = data => {
  const rows = Array.isArray(data) ? data : data?.results
  if (!Array.isArray(rows) || rows.some(row => !row || row.id === undefined || row.id === null)) throw new Error('The source returned an incomplete response.')
  return rows
}
function useSource(loader, key, enabled = true, refreshRevision = 0) {
  const [result, setResult] = useState({ ...pending, key, loader, enabled })
  useEffect(() => {
    const controller = new AbortController()
    setResult(current => current.key === key && current.loader === loader && current.enabled === enabled && current.data
      ? { ...current, error: '' } : { ...pending, key, loader, enabled })
    if (enabled) loader(controller.signal).then(data => {
      if (!controller.signal.aborted) setResult({ data, key, loader, enabled, loading: false, error: '' })
    }).catch(error => {
      if (!controller.signal.aborted) setResult({ data: null, key, loader, enabled, loading: false, error: error?.response?.status === 403 ? 'This source is not available for your account.' : 'This source could not be loaded. Please retry.' })
    })
    else setResult({ data: null, key, loader, enabled, loading: false, error: '' })
    return () => controller.abort()
  }, [loader, key, enabled, refreshRevision])
  return result.key === key && result.loader === loader && result.enabled === enabled ? result : pending
}
export default function useWorkHubData({ user, profile, profileLoading = false, revision, month, today }) {
  const [taskRefresh, setTaskRefresh] = useState(0)
  const identity = `${user?.id || user?.user?.id || 'unknown'}:${JSON.stringify(profile?.module_actions || {})}:${JSON.stringify(profile?.roles || [])}`
  useEffect(() => {
    if (!user) return undefined
    const refreshTasks = () => { if (document.visibilityState === 'visible') setTaskRefresh(value => value + 1) }
    const interval = window.setInterval(refreshTasks, 30000)
    window.addEventListener('focus', refreshTasks)
    document.addEventListener('visibilitychange', refreshTasks)
    return () => { window.clearInterval(interval); window.removeEventListener('focus', refreshTasks); document.removeEventListener('visibilitychange', refreshTasks) }
  }, [identity, user])
  const types = useMemo(() => user && profile ? getEnabledApprovalTypes(user, profile) : [], [user, profile])
  const period = `${today.getFullYear()}-${today.getMonth() + 1}`
  const calendarPeriod = `${month.getFullYear()}-${month.getMonth() + 1}`
  const baseKey = `${identity}:${revision}`
  const bundleLoader = useMemo(() => async signal => readBundle((await api.get('/dashboard/work-hub/', { params: { year: today.getFullYear(), month: today.getMonth() + 1 }, signal, suppressErrorToast: true })).data), [period]) // eslint-disable-line react-hooks/exhaustive-deps
  const calendarLoader = useMemo(() => async signal => readBundle((await api.get('/dashboard/work-hub/', { params: { year: month.getFullYear(), month: month.getMonth() + 1 }, signal, suppressErrorToast: true })).data), [calendarPeriod]) // eslint-disable-line react-hooks/exhaustive-deps
  const featureLoader = useMemo(() => async signal => {
    const { data } = await api.get('/features/', { params: { status: 'active' }, signal, suppressErrorToast: true })
    if (!Array.isArray(data?.features) || data.error || data.success === false) throw new Error('Workspaces unavailable')
    return data.features
  }, [])
  const noticeLoader = useMemo(() => async signal => {
    const { data } = await api.get('/notifications/', { params: { limit: 100, page_size: 100, exclude_expired: true }, signal, suppressErrorToast: true })
    const items = readList(data)
    return { items, count: data.count ?? items.length, truncated: !!data.next || data.count > items.length }
  }, [])
  const approvalLoader = useMemo(() => async signal => {
    const connected = types.filter(type => !UNCONNECTED_QUEUES[type.id])
    const results = await Promise.allSettled(connected.map(async type => {
      const params = { ...getApprovalFilters(type.filterLogic, user, profile), limit: 200, page_size: 200 }
      if (['leave', 'profile_document'].includes(type.id)) params[`${type.statusField}__in`] = type.pendingStatuses.join(',')
      const { data } = await api.get(type.apiEndpoint, { params, signal, suppressErrorToast: true })
      const rows = readList(data).map(row => normalizeApproval(row, type)).filter(row => row._canDecide)
      return { rows, truncated: !!data.next || data.count > (Array.isArray(data) ? data.length : data.results.length) }
    }))
    return { rows: sortApprovals(results.flatMap(result => result.status === 'fulfilled' ? result.value.rows : [])), partial: results.some(result => result.status === 'rejected' || result.value.truncated), available: !connected.length || results.some(result => result.status === 'fulfilled'), unconnected: types.filter(type => UNCONNECTED_QUEUES[type.id]).map(type => type.id) }
  }, [types, user, profile])
  const bundle = useSource(bundleLoader, `${baseKey}:${period}`, !!user, taskRefresh)
  const alternateCalendar = useSource(calendarLoader, `${baseKey}:${calendarPeriod}`, !!user && calendarPeriod !== period)
  const features = useSource(featureLoader, baseKey, !!user)
  const notices = useSource(noticeLoader, baseKey, !!user)
  const approvals = useSource(approvalLoader, baseKey, !!user && !!profile)
  return { bundle, features, notices, approvals: profile ? approvals : profileLoading ? pending : { data: null, loading: false, error: 'Approval access could not be loaded. Please retry.' }, calendar: calendarPeriod === period ? bundle : alternateCalendar }
}
