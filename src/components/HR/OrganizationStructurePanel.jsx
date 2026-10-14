import { useMemo, useState } from 'react'
import useOrganizationCatalog from '../../hooks/useOrganizationCatalog'
import { organizationDepartmentGroups } from '../../utils/organizationCatalog'

export default function OrganizationStructurePanel() {
  const { catalog, loading, error, reload } = useOrganizationCatalog()
  const [query, setQuery] = useState('')
  const groups = useMemo(() => organizationDepartmentGroups(catalog, query), [catalog, query])
  const source = catalog?.source || {}

  return <section className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-4 sm:p-6" aria-label="Organization structure" aria-busy={loading}>
    <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-2">
        <h2>Organization structure</h2>
        <p className="text-sm text-slate-600">Departments, organizational roles and reporting lines from the approved organization chart.</p>
        <p className="text-xs text-slate-500">Position holders are recorded as of the source document. Application access is managed in the Roles tab.</p>
        {catalog && <p className="text-xs font-medium text-slate-600">{[source.title, source.document_id, source.revision !== undefined && `Revision ${source.revision}`, source.date].filter(Boolean).join(' · ')}</p>}
      </div>
      <button type="button" onClick={reload} disabled={loading} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700">Refresh structure</button>
    </div>
    <label className="mb-5 block max-w-lg text-sm font-medium text-slate-700">
      Search departments, roles or people
      <input type="search" value={query} onChange={event => setQuery(event.target.value)} className="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2" />
    </label>
    {error && <div role="alert" className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{error} <button type="button" onClick={reload} className="font-semibold underline">Retry</button></div>}
    {loading && !catalog && <p role="status" className="py-8 text-center text-sm text-slate-600">Loading organization structure…</p>}
    {!loading && !error && groups.length === 0 && <p className="py-8 text-center text-sm text-slate-600">No departments match this view.</p>}
    <div className="space-y-4">
      {groups.map(department => <article key={department.code} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <header className="space-y-2 border-b border-slate-200 bg-slate-100 px-4 py-3">
          <h3>{department.label}</h3>
          {department.parentLabel && <p className="text-xs text-slate-600">Parent department: {department.parentLabel}</p>}
          {department.headLabel && <p className="text-xs text-slate-600">Department head: {department.headLabel}</p>}
          {department.functions?.length > 0 && <p className="text-xs text-slate-600">Functions: {department.functions.join(' · ')}</p>}
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm">
            <caption className="sr-only">Organizational roles in {department.label}</caption>
            <thead className="border-b border-slate-200 text-xs text-slate-600"><tr><th scope="col" className="px-4 py-3">Organizational role</th><th scope="col" className="px-4 py-3">Position holder in source</th><th scope="col" className="px-4 py-3">Reports to</th></tr></thead>
            <tbody>{department.roles.map(role => <tr key={role.code} className="border-b border-slate-100 last:border-0">
              <th scope="row" className="px-4 py-3 font-medium text-slate-900">{role.label}{role.additional_titles?.length > 0 && <div className="mt-1 text-xs font-normal text-slate-600">{role.additional_titles.join(' · ')}</div>}</th>
              <td className="px-4 py-3">{role.holder_name || 'Not specified'}{role.acting && <> <span className="ml-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">Acting</span></>}</td>
              <td className="px-4 py-3 text-slate-600">{role.reportsToLabel || 'Not specified'}</td>
            </tr>)}</tbody>
          </table>
          {department.roles.length === 0 && <p className="px-4 py-3 text-sm text-slate-500">No positions specified in the source document.</p>}
        </div>
      </article>)}
    </div>
  </section>
}
