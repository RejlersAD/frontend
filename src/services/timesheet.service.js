/**
 * Time Sheet Analytics — API service layer
 * -----------------------------------------
 * Thin axios wrappers around the backend's /api/v1/timesheet/* endpoints.
 * Every URL is read from `timesheet.config.js` — no hard-coded paths.
 */
import apiClient from './api.service'
import { TIMESHEET_ENDPOINTS } from '../config/timesheet.config'

const unwrap = (p) => p.then((r) => r.data)

// Health + Setup wizard --------------------------------------------------------
export const fetchHealth     = ()                  => unwrap(apiClient.get(TIMESHEET_ENDPOINTS.health))
export const listDatabases   = ()                  => unwrap(apiClient.get(TIMESHEET_ENDPOINTS.databases))
export const listTables      = (database)          => unwrap(apiClient.get(TIMESHEET_ENDPOINTS.tables,  { params: { database } }))
export const listColumns     = (database, table)   => unwrap(apiClient.get(TIMESHEET_ENDPOINTS.columns, { params: { database, table } }))
export const previewTable    = (database, table, limit = 5) =>
  unwrap(apiClient.get(TIMESHEET_ENDPOINTS.preview, { params: { database, table, limit } }))

// Reports ----------------------------------------------------------------------
// Soft-coded: fetchLive accepts optional cacheBuster to force bypass cache
export const fetchLive       = (cacheBuster)       => unwrap(apiClient.get(TIMESHEET_ENDPOINTS.live, cacheBuster ? { params: { _t: cacheBuster } } : {}))
export const fetchDaily      = (date)              => unwrap(apiClient.get(TIMESHEET_ENDPOINTS.daily,   { params: date ? { date } : {} }))
export const fetchMonthly    = (year, month)       => unwrap(apiClient.get(TIMESHEET_ENDPOINTS.monthly, { params: { year, month } }))
export const fetchUserHistory = (params)           => unwrap(apiClient.get(TIMESHEET_ENDPOINTS.user,    { params }))
export const lookupByCode     = (code)             => unwrap(apiClient.get(TIMESHEET_ENDPOINTS.lookupByCode, { params: { code } }))

// Self-Service (role-based, auto-scoped to current user) ----------------------
export const fetchMyLiveAttendance    = ()             => unwrap(apiClient.get(TIMESHEET_ENDPOINTS.myLiveAttendance))
export const fetchMyMonthlyAttendance = (year, month) => unwrap(apiClient.get(TIMESHEET_ENDPOINTS.myMonthlyAttendance, { params: { year, month } }))
export const fetchMyDailyAttendance   = (date)        => unwrap(apiClient.get(TIMESHEET_ENDPOINTS.myDailyAttendance,   { params: date ? { date } : {} }))

// Exports — return blob; callers handle download --------------------------------
const downloadBlob = (url, params, filename) =>
  apiClient.get(url, { params, responseType: 'blob' }).then((resp) => {
    const blob = new Blob([resp.data], { type: resp.headers['content-type'] })
    const href = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = href
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(href)
  })

export const downloadDailyExcel    = (date)        => downloadBlob(TIMESHEET_ENDPOINTS.exportDaily,       date ? { date } : {},   `timesheet_daily_${date || 'today'}.xlsx`)
export const downloadMonthlyExcel  = (year, month) => downloadBlob(TIMESHEET_ENDPOINTS.exportMonthly,     { year, month },        `timesheet_monthly_${year}_${String(month).padStart(2,'0')}.xlsx`)
export const downloadMonthlyPdf    = (year, month) => downloadBlob(TIMESHEET_ENDPOINTS.exportMonthlyPdf,  { year, month },        `timesheet_monthly_${year}_${String(month).padStart(2,'0')}.pdf`)
export const downloadSummaryExcel  = (year, month) => downloadBlob(TIMESHEET_ENDPOINTS.exportSummary,     { year, month },        `timesheet_summary_${year}_${String(month).padStart(2,'0')}.xlsx`)
export const downloadSummaryPdf    = (year, month) => downloadBlob(TIMESHEET_ENDPOINTS.exportSummaryPdf,  { year, month },        `timesheet_summary_${year}_${String(month).padStart(2,'0')}.pdf`)
export const downloadYearlyExcel   = (year)        => downloadBlob(TIMESHEET_ENDPOINTS.exportYearly,      { year },               `timesheet_yearly_${year}.xlsx`)
export const downloadYearlyPdf     = (year)        => downloadBlob(TIMESHEET_ENDPOINTS.exportYearlyPdf,   { year },               `timesheet_yearly_${year}.pdf`)

export default {
  fetchHealth, listDatabases, listTables, listColumns, previewTable,
  fetchLive, fetchDaily, fetchMonthly, fetchUserHistory, lookupByCode,
  fetchMyLiveAttendance, fetchMyMonthlyAttendance, fetchMyDailyAttendance,
  downloadDailyExcel, downloadMonthlyExcel, downloadMonthlyPdf,
  downloadSummaryExcel, downloadSummaryPdf,
  downloadYearlyExcel, downloadYearlyPdf,
}
