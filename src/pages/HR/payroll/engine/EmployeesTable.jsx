import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import * as HeroIcons from '@heroicons/react/24/outline'
import payrollEngineService, { downloadBlob } from '../../../../services/payrollEngine.service'
import rbacService from '../../../../services/rbac.service'
import { formatCurrency, canEditPayrollEmployee } from '../../../../config/payrollEngine.config'
import EmployeeEditModal from './EmployeeEditModal'

const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'EP'
const money = (value) => formatCurrency(Number(value || 0))
const listFrom = (data) => Array.isArray(data) ? data : (data?.results ?? [])
const userListFrom = (response) => response?.data?.data?.results ?? response?.data?.results ?? response?.data?.data ?? response?.data ?? response?.results ?? []

function EmployeeAvatar({ name, src, className = 'h-10 w-10', textClassName = 'text-xs' }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => { setFailed(false) }, [src])
  return <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 font-bold text-white ${textClassName} ${className}`}>
    {src && !failed ? <img src={src} alt={`${name || 'Employee'} profile`} className="h-full w-full object-cover" loading="lazy" onError={() => setFailed(true)} /> : initials(name)}
  </span>
}

function AccountLinkModal({ employee, linkedEmployeesByUser, onClose, onLinked }) {
  const [query, setQuery] = useState(employee.employee_no || '')
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(false)
  const [savingId, setSavingId] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const term = query.trim()
    if (!term) { setCandidates([]); return undefined }
    let cancelled = false
    const timer = window.setTimeout(() => {
      setLoading(true); setError('')
      rbacService.getUsers({ search: term, status: 'active', page_size: 20 })
        .then((response) => { if (!cancelled) setCandidates(userListFrom(response)) })
        .catch((requestError) => { if (!cancelled) setError(requestError?.response?.data?.detail || requestError?.message || 'RADAI accounts could not be searched.') })
        .finally(() => { if (!cancelled) setLoading(false) })
    }, 300)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [query])

  const linkAccount = async (profile, knownOwner = null) => {
    const userId = profile.user?.id
    if (!userId) return
    let transfer = Boolean(knownOwner)
    if (knownOwner && !window.confirm(`This RADAI account is linked to payroll employee #${knownOwner.employee_no} (${knownOwner.full_name}). Move the account link to #${employee.employee_no} (${employee.full_name})? Salary and payslip records remain on their existing payroll rows.`)) return
    setSavingId(userId); setError('')
    try {
      let result
      try {
        result = await payrollEngineService.linkRadaiAccount(employee.id, userId, { transfer })
      } catch (requestError) {
        const conflict = requestError?.response?.data?.linked_employee
        if (requestError?.response?.status !== 409 || !conflict) throw requestError
        const confirmed = window.confirm(`This account is currently linked to #${conflict.employee_no} (${conflict.full_name}). Move the link to #${employee.employee_no} (${employee.full_name})?`)
        if (!confirmed) { setError(`Account remains linked to #${conflict.employee_no} (${conflict.full_name}).`); return }
        transfer = true
        result = await payrollEngineService.linkRadaiAccount(employee.id, userId, { transfer: true })
      }
      onLinked(result)
    } catch (requestError) {
      setError(requestError?.response?.data?.user?.[0] || requestError?.response?.data?.detail || requestError?.response?.data?.error || requestError?.message || 'The account could not be linked.')
    } finally { setSavingId(null) }
  }

  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
    <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
      <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4"><div><h3 className="text-base font-bold text-slate-950">Link RADAI account</h3><p className="mt-1 text-xs text-slate-500">Payroll employee #{employee.employee_no} · {employee.full_name}</p></div><button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><HeroIcons.XMarkIcon className="h-5 w-5" /></button></div>
      <div className="p-5">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"><strong>Verify carefully:</strong> linking connects payroll, salary and payslip history to the selected employee account. Search by employee number or company email for the safest match.</div>
        <div className="relative mt-4"><HeroIcons.MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Employee number, name or email" className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></div>
        {error && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>}
        <div className="mt-4 max-h-80 overflow-y-auto rounded-xl border border-slate-200">
          {loading ? <div className="p-8 text-center text-sm text-slate-500"><HeroIcons.ArrowPathIcon className="mx-auto mb-2 h-5 w-5 animate-spin text-blue-600" />Searching employee accounts…</div> : candidates.length === 0 ? <div className="p-8 text-center text-sm text-slate-500">No active RADAI account matches this search.</div> : <div className="divide-y divide-slate-100">{candidates.map((profile) => {
            const userId = profile.user?.id
            const linkedOwner = linkedEmployeesByUser.get(String(userId))
            const candidateName = profile.full_name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email
            return <div key={profile.id} className="flex items-center gap-3 px-4 py-3"><EmployeeAvatar name={candidateName} src={profile.profile_photo} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-900">{candidateName}</p><p className="truncate text-xs text-slate-500">#{profile.employee_id || 'No employee ID'} · {profile.email}</p><p className="truncate text-[11px] text-slate-400">{profile.job_title || 'No job title'} · {profile.department || 'No department'}</p>{linkedOwner && <p className="mt-1 text-[11px] font-semibold text-amber-700">Currently linked to payroll #{linkedOwner.employee_no} · {linkedOwner.full_name}</p>}</div><button type="button" onClick={() => linkAccount(profile, linkedOwner)} disabled={!userId || savingId === userId} className={`rounded-lg px-3 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 ${linkedOwner ? 'border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>{savingId === userId ? 'Saving…' : linkedOwner ? 'Move link here' : 'Link account'}</button></div>
          })}</div>}
        </div>
      </div>
    </div>
  </div>
}

function PayrollEmployeeDrawer({ employee, canEdit, onClose, onEdit, onLink }) {
  const detail = employee
  const [payslips, setPayslips] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError('')
    payrollEngineService.listPayslips({ employee: employee.id, page_size: 36 }).then((data) => {
      if (cancelled) return
      setPayslips(listFrom(data).sort((a, b) => String(b.run_cycle || '').localeCompare(String(a.run_cycle || ''))))
    }).catch((requestError) => {
      if (!cancelled) setError(requestError?.response?.data?.detail || requestError?.message || 'Payslip history could not be loaded.')
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [employee.id])

  const latest = payslips[0]
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35 backdrop-blur-[1px]" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <aside className="flex h-full w-full max-w-2xl flex-col bg-slate-50 shadow-2xl">
        <header className="bg-gradient-to-r from-slate-950 via-blue-950 to-blue-800 px-6 py-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <EmployeeAvatar name={detail.full_name} src={detail.profile_photo} className="h-14 w-14 rounded-2xl ring-1 ring-white/20" textClassName="text-lg" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-xl font-bold">{detail.full_name}</h2><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${detail.is_active ? 'bg-emerald-400/20 text-emerald-200' : 'bg-slate-400/20 text-slate-200'}`}>{detail.is_active ? 'Active' : 'Inactive'}</span></div>
                <p className="mt-1 text-sm text-blue-100">#{detail.employee_no} · {detail.designation || 'Designation not set'}</p>
                <p className="mt-0.5 text-xs text-blue-200">{detail.department || 'Department not set'}</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-blue-100 hover:bg-white/10 hover:text-white" aria-label="Close employee payroll"><HeroIcons.XMarkIcon className="h-5 w-5" /></button>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {detail.user ? <Link to={`/hr/employees?employee=${encodeURIComponent(detail.employee_no)}&tab=compensation`} className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-bold text-blue-800 hover:bg-blue-50"><HeroIcons.UserCircleIcon className="h-4 w-4" /> Open employee profile</Link> : <span className="inline-flex items-center gap-2 rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs font-semibold text-amber-100"><HeroIcons.ExclamationTriangleIcon className="h-4 w-4" /> Payroll-only record</span>}
            {!detail.user && canEdit && <button type="button" onClick={() => onLink(detail)} className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-bold text-blue-800 hover:bg-blue-50"><HeroIcons.LinkIcon className="h-4 w-4" /> Link RADAI account</button>}
            {canEdit && <button type="button" onClick={() => onEdit(detail)} className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20"><HeroIcons.PencilSquareIcon className="h-4 w-4" /> Edit payroll profile</button>}
          </div>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-5 sm:p-6">
          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
          {loading ? <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500"><HeroIcons.ArrowPathIcon className="mx-auto mb-3 h-6 w-6 animate-spin text-blue-600" />Loading employee payroll…</div> : <>
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[['Basic', detail.basic], ['Allowances', Number(detail.housing || 0) + Number(detail.transport || 0) + Number(detail.home_leave || 0)], ['Default gross', detail.default_gross], ['Latest net', latest?.net_payable]].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-base font-bold text-slate-950">{money(value)}</p></div>)}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3"><HeroIcons.IdentificationIcon className="h-5 w-5 text-blue-600" /><h3 className="text-sm font-bold text-slate-900">Payroll identity</h3></div>
              <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
                <div><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Employee number</dt><dd className="mt-1 font-medium text-slate-800">{detail.employee_no}</dd></div>
                <div><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">RADAI account</dt><dd className="mt-1"><span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-bold ${detail.user ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'}`}><span className={`h-1.5 w-1.5 rounded-full ${detail.user ? 'bg-emerald-500' : 'bg-amber-500'}`} />{detail.user ? 'Linked' : 'Not linked'}</span>{detail.user && <span className="ml-2 text-xs font-medium text-slate-600">{detail.employee_email || `User #${detail.user}`}</span>}</dd></div>
                {[['Grade', detail.grade || '—'], ['Discipline', detail.discipline || '—'], ['Joining date', detail.joining_date || '—'], ['Contracted hours', detail.hours || '—'], ['Bank', detail.bank_name || '—'], ['Payment mode', detail.default_payment_mode || '—']].map(([label, value]) => <div key={label}><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</dt><dd className="mt-1 font-medium text-slate-800">{value}</dd></div>)}
              </dl>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h3 className="text-sm font-bold text-slate-900">Payslip history</h3><p className="mt-0.5 text-xs text-slate-500">Exact records from Payroll Engine</p></div><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">{payslips.length}</span></div>
              {payslips.length === 0 ? <div className="px-5 py-10 text-center text-sm text-slate-500">No payroll runs have generated a payslip for this employee yet.</div> : <div className="divide-y divide-slate-100">{payslips.slice(0, 12).map((slip) => <div key={slip.id} className="grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-3 hover:bg-slate-50"><div><p className="text-sm font-bold text-slate-900">{slip.run_cycle}</p><p className="mt-0.5 text-xs text-slate-500">Gross {money(slip.gross_earnings)} · Deductions {money(slip.total_deductions)}</p></div><div className="text-right"><p className="text-sm font-bold text-emerald-700">{money(slip.net_payable)}</p><p className="mt-0.5 text-[10px] font-semibold uppercase text-slate-400">{slip.status}</p></div></div>)}</div>}
            </section>
          </>}
        </div>
      </aside>
    </div>
  )
}

export default function EmployeesTable() {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadSummary, setUploadSummary] = useState(null)
  const [editing, setEditing] = useState(null)
  const [selected, setSelected] = useState(null)
  const [linking, setLinking] = useState(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(24)
  const fileInputRef = useRef(null)
  const authUser = useSelector((state) => state.auth?.user)
  const rbacUser = useSelector((state) => state.rbac?.currentUser)
  const canEdit = useMemo(() => canEditPayrollEmployee(authUser, rbacUser), [authUser, rbacUser])

  const load = async () => {
    setLoading(true); setError('')
    try {
      const data = await payrollEngineService.listEmployees({ is_active: showInactive ? undefined : 'true', page_size: 500 })
      setEmployees(listFrom(data))
    } catch (requestError) {
      setError(requestError?.response?.data?.error || requestError?.message || 'Payroll employees could not be loaded.')
    } finally { setLoading(false) }
  }
  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [showInactive])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return employees
    return employees.filter((employee) => [employee.full_name, employee.employee_no, employee.department, employee.designation, employee.employee_email].some((value) => String(value || '').toLowerCase().includes(query)))
  }, [employees, search])
  const stats = useMemo(() => ({ active: employees.filter((e) => e.is_active).length, linked: employees.filter((e) => e.user).length, gross: employees.reduce((sum, e) => sum + Number(e.default_gross || 0), 0) }), [employees])
  const linkedEmployeesByUser = useMemo(() => new Map(employees.filter((employee) => employee.user).map((employee) => [String(employee.user), employee])), [employees])
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pageRows = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize])
  useEffect(() => { setPage(1) }, [search, showInactive, pageSize])
  useEffect(() => { setPage((current) => Math.min(current, totalPages)) }, [totalPages])

  const handleUpload = async (event) => {
    const file = event.target.files?.[0]; if (!file) return
    setUploading(true); setError(''); setUploadSummary(null)
    try { setUploadSummary(await payrollEngineService.importEmployeesXlsx(file)); await load() }
    catch (requestError) { setError(requestError?.response?.data?.error || requestError?.message) }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = '' }
  }
  const handleDownload = async () => {
    try { downloadBlob(await payrollEngineService.exportEmployeesXlsx(), 'payroll_employees.xlsx') }
    catch (requestError) { setError(requestError?.response?.data?.error || requestError?.message) }
  }

  return <div className="space-y-4">
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-600">Employee salary directory</p><h2 className="mt-1 text-xl font-bold text-slate-950">Payroll employees</h2><p className="mt-1 text-sm text-slate-500">Select any employee to view salary structure, account linkage and payslip history.</p></div>
        <div className="flex flex-wrap gap-2"><input ref={fileInputRef} type="file" accept=".xlsx" className="hidden" onChange={handleUpload} /><button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><HeroIcons.ArrowUpTrayIcon className="h-4 w-4" />{uploading ? 'Importing…' : 'Import XLSX'}</button><button type="button" onClick={handleDownload} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700"><HeroIcons.ArrowDownTrayIcon className="h-4 w-4" />Export roster</button></div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Employees', employees.length, HeroIcons.UsersIcon, 'text-blue-700 bg-blue-50'], ['Active', stats.active, HeroIcons.CheckBadgeIcon, 'text-emerald-700 bg-emerald-50'], ['RADAI linked', stats.linked, HeroIcons.LinkIcon, 'text-violet-700 bg-violet-50'], ['Default gross', money(stats.gross), HeroIcons.BanknotesIcon, 'text-amber-700 bg-amber-50']].map(([label, value, Icon, tone]) => <div key={label} className="rounded-xl border border-slate-200 p-3"><div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg ${tone}`}><Icon className="h-4 w-4" /></div><p className="text-lg font-bold text-slate-950">{value}</p><p className="text-[11px] font-semibold text-slate-500">{label}</p></div>)}</div>
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4"><div className="relative min-w-[240px] flex-1"><HeroIcons.MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search employee, number, department, designation or email" className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></div><label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-600"><input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} className="rounded border-slate-300 text-blue-600" />Include inactive</label><label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500">Rows<select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-slate-700"><option value={12}>12</option><option value={24}>24</option><option value={48}>48</option></select></label><span className="text-xs font-semibold text-slate-500">{filtered.length} records</span></div>
      {uploadSummary && <div className="m-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">Import complete: {uploadSummary.employees_created} created, {uploadSummary.employees_updated} updated.</div>}
      {error && <div className="m-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</div>}
      {loading ? <div className="p-14 text-center text-sm text-slate-500"><HeroIcons.ArrowPathIcon className="mx-auto mb-3 h-6 w-6 animate-spin text-blue-600" />Loading payroll employees…</div> : filtered.length === 0 ? <div className="p-14 text-center text-sm text-slate-500">No payroll employees match this search.</div> : <div className="divide-y divide-slate-100">{pageRows.map((employee) => <button key={employee.id} type="button" onClick={() => setSelected(employee)} className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-blue-50/50 sm:px-5 lg:grid-cols-[auto_minmax(220px,1.4fr)_minmax(160px,1fr)_130px_130px_auto]">
        <EmployeeAvatar name={employee.full_name} src={employee.profile_photo} />
        <span className="min-w-0"><span className="flex items-center gap-2"><span className="truncate text-sm font-bold text-slate-900">{employee.full_name}</span>{employee.user ? <HeroIcons.LinkIcon className="h-3.5 w-3.5 shrink-0 text-violet-500" title="Linked to RADAI employee" /> : null}</span><span className="mt-0.5 block text-xs text-slate-500">#{employee.employee_no} · {employee.designation || 'No designation'}</span></span>
        <span className="hidden min-w-0 lg:block"><span className="block truncate text-sm font-medium text-slate-700">{employee.department || 'No department'}</span><span className="mt-0.5 block truncate text-xs text-slate-400">{employee.grade || employee.discipline || '—'}</span></span>
        <span className="hidden text-right lg:block"><span className="block text-[10px] font-bold uppercase text-slate-400">Basic</span><span className="text-sm font-semibold text-slate-700">{money(employee.basic)}</span></span>
        <span className="hidden text-right lg:block"><span className="block text-[10px] font-bold uppercase text-slate-400">Gross</span><span className="text-sm font-bold text-emerald-700">{money(employee.default_gross)}</span></span>
        <span className="flex items-center gap-2">{employee.is_active ? <span className="hidden rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 sm:inline">Active</span> : <span className="hidden rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500 sm:inline">Inactive</span>}<HeroIcons.ChevronRightIcon className="h-4 w-4 text-slate-400" /></span>
      </button>)}</div>}
      {!loading && filtered.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 sm:px-5"><p className="text-xs text-slate-500">Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}</p><div className="flex items-center gap-1"><button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Previous employee page"><HeroIcons.ChevronLeftIcon className="h-4 w-4" /></button><span className="min-w-24 px-2 text-center text-xs font-bold text-slate-700">Page {page} of {totalPages}</span><button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Next employee page"><HeroIcons.ChevronRightIcon className="h-4 w-4" /></button></div></div>}
    </section>

    {selected && <PayrollEmployeeDrawer key={`${selected.id}:${selected.user || 'unlinked'}`} employee={selected} canEdit={canEdit} onClose={() => setSelected(null)} onEdit={(employee) => { setSelected(null); setEditing(employee) }} onLink={setLinking} />}
    {linking && <AccountLinkModal employee={linking} linkedEmployeesByUser={linkedEmployeesByUser} onClose={() => setLinking(null)} onLinked={(result) => { const replacements = new Map([result.employee, ...(result.unlinked_employees || [])].map((item) => [item.id, item])); setEmployees((previous) => previous.map((employee) => replacements.get(employee.id) || employee)); setSelected(result.employee); setLinking(null) }} />}
    {editing && <EmployeeEditModal employee={editing} onClose={() => setEditing(null)} onSaved={(updated) => { setEmployees((previous) => previous.map((employee) => employee.id === updated.id ? updated : employee)); setEditing(null) }} />}
  </div>
}
