import React, { useCallback, useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import planningIntelligenceService from '../../services/planningIntelligence.service'

const errorMessage = (error, fallback) => (
  error?.response?.data?.error || error?.response?.data?.detail || error?.message || fallback
)

const locatorText = reference => {
  const locator = reference?.locator || {}
  const parts = []
  if (locator.page) parts.push(`page ${locator.page}`)
  if (locator.sheet) parts.push(`sheet ${locator.sheet}`)
  if (locator.line) parts.push(`line ${locator.line}`)
  return parts.join(', ') || 'source location recorded'
}

export default function ScheduleBasisPanel({ projectId, intelligenceRunId }) {
  const [basis, setBasis] = useState(null)
  const [conflicts, setConflicts] = useState([])
  const [authority, setAuthority] = useState([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [showAuthority, setShowAuthority] = useState(false)
  const [draft, setDraft] = useState({})

  const load = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    setError('')
    try {
      const [bases, rules] = await Promise.all([
        planningIntelligenceService.listScheduleBases(projectId),
        planningIntelligenceService.listDocumentAuthorityRules(),
      ])
      const latest = bases[0] || null
      setBasis(latest)
      setDraft(latest ? {
        project_name: latest.project_name || '', client: latest.client || '',
        location: latest.location || '', effective_date: latest.effective_date || '',
        contractual_finish: latest.contractual_finish || '', duration_months: latest.duration_months || '',
      } : {})
      setAuthority(rules)
      if (latest?.source_run_id) {
        setConflicts(await planningIntelligenceService.listIntelligenceConflicts(latest.source_run_id, { status: 'open' }))
      } else {
        setConflicts([])
      }
    } catch (err) {
      setError(errorMessage(err, 'Could not load the Schedule Basis.'))
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { load() }, [load, intelligenceRunId])

  const run = async (operation, fallback) => {
    setWorking(true)
    setError('')
    try {
      await operation()
      await load()
      window.dispatchEvent(new CustomEvent('planning-basis-changed'))
    } catch (err) {
      setError(errorMessage(err, fallback))
    } finally {
      setWorking(false)
    }
  }

  const authorityGroups = useMemo(() => authority.reduce((groups, rule) => {
    const rows = groups[rule.information_type_label] || []
    rows.push(rule)
    return { ...groups, [rule.information_type_label]: rows }
  }, {}), [authority])

  if (loading) return <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Loading controlled Schedule Basis…</div>

  if (!basis) return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <h3 className="font-semibold text-amber-900">Schedule Basis required</h3>
      <p className="mt-1 text-sm text-amber-800">Compile the reviewed document evidence before schedule generation.</p>
      {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}
      <button type="button" disabled={working || !intelligenceRunId}
        onClick={() => run(() => planningIntelligenceService.buildScheduleBasis(intelligenceRunId), 'Could not build the Schedule Basis.')}
        className="mt-3 rounded-lg bg-amber-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">
        {working ? 'Compiling…' : 'Compile Schedule Basis'}
      </button>
    </div>
  )

  const immutable = ['approved', 'superseded'].includes(basis.status)
  const readiness = basis.readiness || {}

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-900">Controlled Schedule Basis</h3>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-600">v{basis.version}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${basis.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : readiness.ready ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
              {basis.status.replaceAll('_', ' ')}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">Only an approved basis can feed schedule generation.</p>
        </div>
        <button type="button" onClick={() => setShowAuthority(value => !value)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
          {showAuthority ? 'Hide' : 'View'} document authority
        </button>
      </div>

      {error && <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      {showAuthority && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {Object.entries(authorityGroups).map(([name, rules]) => (
            <div key={name} className="rounded-xl border border-slate-200 p-3">
              <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">{name}</h4>
              <ol className="mt-2 space-y-1 text-xs text-slate-700">
                {rules.map(rule => <li key={rule.id}><b>{rule.priority}</b> · {rule.document_category.replaceAll('_', ' ')} — {rule.rationale}</li>)}
              </ol>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ['project_name', 'Project name', 'text'], ['client', 'Client', 'text'], ['location', 'Location', 'text'],
          ['effective_date', 'Effective date', 'date'], ['contractual_finish', 'Contract finish', 'date'],
          ['duration_months', 'Duration (months)', 'number'],
        ].map(([key, label, type]) => (
          <label key={key} className="text-xs font-semibold text-slate-600">{label}
            <input type={type} value={draft[key] ?? ''} disabled={immutable || working}
              onChange={event => setDraft(previous => ({ ...previous, [key]: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 disabled:bg-slate-50" />
          </label>
        ))}
      </div>
      {!immutable && (
        <button type="button" disabled={working} onClick={() => run(
          () => planningIntelligenceService.updateScheduleBasis(basis.id, draft), 'Could not save Schedule Basis fields.',
        )} className="mt-3 rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Save basis fields</button>
      )}

      {conflicts.length > 0 && (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h4 className="text-sm font-semibold text-amber-900">Evidence conflicts requiring a decision</h4>
          <div className="mt-3 space-y-3">
            {conflicts.map(conflict => (
              <div key={conflict.id} className="rounded-lg border border-amber-200 bg-white p-3">
                <p className="text-sm font-medium text-slate-800">{conflict.description}</p>
                <div className="mt-2 space-y-2">
                  {(conflict.facts || []).map(fact => (
                    <div key={fact.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs">
                      <div><b>{typeof fact.value === 'object' ? JSON.stringify(fact.value) : String(fact.value)}</b><div className="text-slate-500">{fact.source_filename || fact.extraction_method} · {locatorText({ locator: fact.source_locator })}</div></div>
                      <button type="button" disabled={working} onClick={() => run(
                        () => planningIntelligenceService.resolveIntelligenceConflict(conflict.id, { action: 'select_fact', selected_fact_id: fact.id }),
                        'Could not resolve the evidence conflict.',
                      )} className="rounded-md bg-amber-700 px-2.5 py-1.5 font-semibold text-white">Use this value</button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-800">Canonical deliverable register</h4>
          <p className="text-xs text-slate-500">{readiness.confirmed_deliverables || 0} confirmed · {readiness.deliverables_needing_review || 0} awaiting review · {readiness.excluded_deliverables || 0} excluded</p>
        </div>
        {!immutable && basis.deliverables?.some(item => item.status === 'needs_review') && (
          <button type="button" disabled={working} onClick={() => run(
            () => planningIntelligenceService.reviewBasisDeliverables(
              basis.id, 'confirmed', basis.deliverables.filter(item => item.status === 'needs_review').map(item => item.id),
            ), 'Could not confirm the deliverables.',
          )} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Confirm all listed deliverables</button>
        )}
      </div>

      <div className="mt-3 max-h-[28rem] overflow-auto rounded-xl border border-slate-200">
        <table className="min-w-full text-left text-xs">
          <thead className="sticky top-0 bg-slate-50 text-slate-500"><tr>
            <th className="px-3 py-2">Discipline</th><th className="px-3 py-2">Canonical deliverable</th>
            <th className="px-3 py-2">Document identity</th><th className="px-3 py-2">Evidence</th><th className="px-3 py-2">Decision</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {(basis.deliverables || []).map(item => (
              <tr key={item.id} className={item.status === 'excluded' ? 'bg-slate-50 text-slate-400' : ''}>
                <td className="px-3 py-2 font-medium">{item.discipline || 'general'}</td>
                <td className="px-3 py-2"><div className="font-semibold text-slate-800">{item.canonical_name}</div>{item.original_title !== item.canonical_name && <div className="text-slate-500">Original: {item.original_title}</div>}</td>
                <td className="px-3 py-2">{item.document_number || '—'}{item.document_revision && <div>Rev {item.document_revision}</div>}</td>
                <td className="px-3 py-2">{(item.source_references || []).slice(0, 2).map((ref, index) => <div key={`${ref.fact_id}-${index}`} title={ref.excerpt}>{ref.filename} · {locatorText(ref)}</div>)}</td>
                <td className="px-3 py-2">
                  {immutable ? <span className="font-semibold capitalize">{item.status.replaceAll('_', ' ')}</span> : (
                    <div className="flex gap-1">
                      <button type="button" disabled={working} onClick={() => run(() => planningIntelligenceService.reviewBasisDeliverable(item.id, 'confirmed'), 'Could not confirm the deliverable.')} className={`rounded px-2 py-1 font-semibold ${item.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' : 'border border-emerald-200 text-emerald-700'}`}>Include</button>
                      <button type="button" disabled={working} onClick={() => run(() => planningIntelligenceService.reviewBasisDeliverable(item.id, 'excluded'), 'Could not exclude the deliverable.')} className={`rounded px-2 py-1 font-semibold ${item.status === 'excluded' ? 'bg-slate-200 text-slate-700' : 'border border-slate-200 text-slate-600'}`}>Exclude</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={`mt-4 rounded-xl border p-4 ${readiness.ready ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h4 className={`text-sm font-semibold ${readiness.ready ? 'text-emerald-900' : 'text-amber-900'}`}>{readiness.ready ? 'Schedule Basis is ready' : 'Schedule Basis is not ready'}</h4>
            {(readiness.blockers || []).map(message => <p key={message} className="mt-1 text-xs text-amber-800">• {message}</p>)}
          </div>
          {!immutable && <button type="button" disabled={working || !readiness.ready} onClick={() => run(() => planningIntelligenceService.approveScheduleBasis(basis.id), 'Could not approve the Schedule Basis.')} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Approve Schedule Basis</button>}
        </div>
      </div>
    </section>
  )
}

ScheduleBasisPanel.propTypes = {
  projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  intelligenceRunId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
}
