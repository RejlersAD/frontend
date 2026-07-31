import React, { useEffect, useState, useMemo } from 'react'
import { useSelector } from 'react-redux'
import * as HeroIcons from '@heroicons/react/24/outline'
import payrollEngineService, { downloadBlob } from '../../../../services/payrollEngine.service'
import {
  formatCurrency,
  formatNumber,
  EMPLOYEE_COLUMNS,
  canEditPayrollEmployee,
} from '../../../../config/payrollEngine.config'
import EmployeeEditModal from './EmployeeEditModal'

export default function EmployeesTable() {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const fileInputRef = React.useRef(null)
  const [uploading, setUploading] = useState(false)
  const [uploadSummary, setUploadSummary] = useState(null)
  const [editing, setEditing] = useState(null)

  // ── RBAC gate — mirrors backend `PayrollEmployeeWritePermission` ──────────
  const authUser = useSelector((s) => s.auth?.user)
  const rbacUser = useSelector((s) => s.rbac?.currentUser)
  const canEdit = useMemo(
    () => canEditPayrollEmployee(authUser, rbacUser),
    [authUser, rbacUser],
  )

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await payrollEngineService.listEmployees({
        is_active: showInactive ? undefined : 'true',
        search: search || undefined,
        page_size:500
      })
      setEmployees(Array.isArray(data) ? data : (data?.results ?? []))
    } catch (e) {
      setError(e?.response?.data?.error || e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() /* eslint-disable-next-line */ }, [showInactive])

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setError(null); setUploadSummary(null)
    try {
      const summary = await payrollEngineService.importEmployeesXlsx(file)
      setUploadSummary(summary)
      await load()
    } catch (err) { setError(err?.response?.data?.error || err.message) }
    finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDownload = async () => {
    try {
      const blob = await payrollEngineService.exportEmployeesXlsx()
      downloadBlob(blob, 'payroll_employees.xlsx')
    } catch (e) { setError(e?.response?.data?.error || e.message) }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return employees
    const q = search.toLowerCase()
    return employees.filter((e) =>
      (e.full_name || '').toLowerCase().includes(q) ||
      (e.employee_no || '').toLowerCase().includes(q) ||
      (e.department || '').toLowerCase().includes(q) ||
      (e.designation || '').toLowerCase().includes(q)
    )
  }, [employees, search])

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center flex-wrap gap-3">
        <div className="relative">
          <HeroIcons.MagnifyingGlassIcon className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, #, dept, designation"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-7 pr-2 py-1.5 text-sm border border-slate-300 rounded-md w-80"
          />
        </div>
        <label className="inline-flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Show inactive
        </label>
        <div className="ml-auto flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={handleUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
          >
            <HeroIcons.ArrowUpTrayIcon className="w-4 h-4" />
            {uploading ? 'Uploading…' : 'Import XLSX'}
          </button>
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 hover:bg-slate-50"
          >
            <HeroIcons.ArrowDownTrayIcon className="w-4 h-4" />
            Export XLSX
          </button>
        </div>
      </div>

      {uploadSummary && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2 text-xs text-emerald-800">
          Import complete: {uploadSummary.employees_created} created, {uploadSummary.employees_updated} updated.
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2 text-xs text-red-700">{error}</div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">
            Employees ({filtered.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-400">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">No employees.</div>
          ) : (
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase">
                <tr>
                  {EMPLOYEE_COLUMNS.map((c) => (
                    <th
                      key={c.key}
                      style={{ width: c.width }}
                      className={`px-3 py-2 font-medium ${c.align === 'right' ? 'text-right' : 'text-left'}`}
                    >
                      {c.label}
                    </th>
                  ))}
                  {canEdit && (
                    <th className="px-3 py-2 font-medium text-right" style={{ width: 90 }}>
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50">
                    {EMPLOYEE_COLUMNS.map((c) => {
                      const v = emp[c.key]
                      return (
                        <td
                          key={c.key}
                          className={`px-3 py-2 ${c.align === 'right' ? 'text-right tabular-nums' : ''}`}
                        >
                          {c.key === 'is_active'
                            ? (v
                                ? <span className="inline-block px-1.5 py-0.5 text-[10px] rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Active</span>
                                : <span className="inline-block px-1.5 py-0.5 text-[10px] rounded-full bg-slate-100 text-slate-500 border border-slate-300">Inactive</span>
                              )
                            : c.format === 'currency'
                              ? formatCurrency(v, { withSymbol: false })
                              : c.format === 'number'
                                ? formatNumber(v)
                                : (v ?? '—')}
                        </td>
                      )
                    })}
                    {canEdit && (
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => setEditing(emp)}
                          title="Edit employee — Super Admin only"
                          className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 hover:underline"
                        >
                          <HeroIcons.PencilSquareIcon className="w-3.5 h-3.5" />
                          Edit
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {editing && (
        <EmployeeEditModal
          employee={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setEmployees((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}
