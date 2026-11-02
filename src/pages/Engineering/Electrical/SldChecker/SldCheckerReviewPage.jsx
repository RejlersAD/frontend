/**
 * SLD Checker — All SLDs scope (combined project review). Mirrors the
 * P&ID checker ProjectReviewPage: worst-of checklist per item across the
 * project and an all-findings table with a family filter. Data comes from
 * the checker review endpoint — where it is not connected, the honest
 * empty state is rendered and nothing is invented.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import * as svc from './sldChecker.service'
import { PageHeader, KpiTile, Pill, EmptyState } from '../../Process/PidChecker/shared'
import { SldScopeSwitch } from './SldCheckerWorkspacePage'
import '../../Process/PidChecker/pidchecker.css'
import './sldchecker.css'

const BASE = '/engineering/electrical/sld'
const CL_RESULT_TONES = { OK: 'success', 'Non-Conformance': 'danger', Query: 'warning', 'Not Verifiable': 'neutral' }
const CL_SEV_TONES = { Critical: 'danger', Major: 'warning', Minor: 'neutral' }
const FAMILY_CHIPS = ['All', 'Engineering', 'Load List', 'Drafting', 'Equipment', 'Critical']

const normFinding = (raw = {}, i = 0) => {
  const label = raw.label ?? raw.display_id ?? raw.number ?? `F${i + 1}`
  return {
    id: raw.id ?? raw.finding_id ?? `f-${i}`,
    label,
    title: raw.title ?? raw.issue ?? 'Finding',
    family: raw.family ?? 'Engineering',
    severity: raw.severity ?? 'minor',
    status: raw.status ?? 'open',
    sheet: raw.sheet_label ?? raw.sheet ?? null,
    fileId: raw.file_id ?? raw.file ?? null,
  }
}

export default function SldCheckerReviewPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [review, setReview] = useState(null)
  const [available, setAvailable] = useState(true)
  const [error, setError] = useState(null)
  const [familyFilter, setFamilyFilter] = useState('All')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const st = await svc.getState(projectId)
      setProject({ id: projectId, name: st.project_name ?? st.name ?? `Project ${projectId}` })
    } catch (err) {
      setError(err?.response?.data?.error || 'The project could not be loaded.')
    }
    try {
      setReview(await svc.review(projectId))
      setAvailable(true)
    } catch (err) {
      if (err?.response?.status === 404) setAvailable(false)
      else setError(err?.response?.data?.error || 'The project review could not be loaded.')
      setReview(null)
    }
  }, [projectId])

  useEffect(() => { load() }, [load])

  const reRunChecks = async () => {
    if (busy) return
    setBusy(true)
    try {
      const { analysisId } = await svc.analyse(projectId)
      try { await svc.run(analysisId) } catch { /* checker backend not connected yet */ }
      await load()
    } catch (err) {
      setError(err?.response?.data?.error || 'The re-run could not be started.')
    } finally {
      setBusy(false)
    }
  }

  // ── derived (worst-of checklist + all findings, spec mirror) ──────────
  const checklistItems = useMemo(() => review?.checklist?.items ?? review?.checklist_items ?? [], [review])
  const findings = useMemo(() => (review?.findings || []).map(normFinding), [review])
  const sheets = review?.sheets || []
  const stats = review?.stats || {}

  const filteredFindings = useMemo(() => findings.filter(f => {
    if (familyFilter === 'All') return true
    if (familyFilter === 'Critical') return ['critical', 'major'].includes(String(f.severity).toLowerCase())
    return f.family === familyFilter
  }), [findings, familyFilter])

  const familyCounts = useMemo(() => {
    const counts = { All: findings.length, Critical: 0 }
    for (const f of findings) {
      counts[f.family] = (counts[f.family] ?? 0) + 1
      if (['critical', 'major'].includes(String(f.severity).toLowerCase())) counts.Critical += 1
    }
    return counts
  }, [findings])

  const openFindings = findings.filter(f => !['reviewed', 'resolved', 'confirmed', 'rejected'].includes(String(f.status).toLowerCase()))

  const header = (
    <PageHeader
      breadcrumb={[
        { label: 'SLD Checker', to: BASE },
        { label: project?.name ?? '…', to: `${BASE}/projects/${projectId}` },
        { label: 'All SLDs' },
      ]}
      title="All SLDs"
      subtitle={project ? `${project.name} · combined review across every SLD sheet` : null}
      actions={(
        <>
          <SldScopeSwitch projectId={projectId} sheetCount={sheets.length || null} active="all" />
          <button type="button" className="rd-btn rd-btn-secondary" onClick={reRunChecks} disabled={busy}>
            {busy ? 'Re-running…' : 'Re-run checks'}
          </button>
          <button
            type="button"
            className="rd-btn rd-btn-primary"
            disabled={!review?.analysis_id}
            title={review?.analysis_id ? undefined : 'Available after the first analysis'}
            onClick={async () => {
              try { await svc.downloadChecklistReport(review.analysis_id) } catch { setError('The checklist report could not be generated yet.') }
            }}
          >
            Export checklist report (.xlsx)
          </button>
        </>
      )}
    />
  )

  if (error && !review) {
    return <div className="pc-page">{header}<p className="pc-error" role="alert">{error}</p></div>
  }
  if (!review) {
    return (
      <div className="pc-page">
        {header}
        {available ? (
          <>
            <div className="pc-card pc-card-pad" style={{ marginBottom: '1rem' }}><div className="pc-skeleton" style={{ height: 96 }} /></div>
            <div className="pc-card pc-card-pad"><div className="pc-skeleton" style={{ height: 320 }} /></div>
          </>
        ) : (
          <div className="pc-card">
            <EmptyState title="The combined review is not available yet.">
              Available after the checker backend is connected and a check run has finished for this project.
            </EmptyState>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="pc-page">
      {header}
      {error && <p className="pc-error" role="alert">{error}</p>}

      <div className="pc-kpi-grid" aria-label="Project summary">
        <KpiTile label="SLD sheets" value={sheets.length} />
        <KpiTile label="Findings" value={findings.length} meta={`${openFindings.length} still open`} danger={openFindings.length > 0} />
        <KpiTile label="Critical" value={familyCounts.Critical} danger={familyCounts.Critical > 0} />
        <KpiTile
          label="Checklist points"
          value={checklistItems.length || '—'}
          meta="AI-SLD-01 · worst result over all sheets"
        />
      </div>

      {/* worst-of checklist per item across the project */}
      <section className="pc-section" aria-label="Checklist across SLDs">
        <h2 className="pc-section-title">Checklist across SLDs</h2>
        <div className="pc-card pc-table-wrap">
          {checklistItems.length === 0 ? (
            <EmptyState title="No checklist results yet.">
              The worst result per check point over all SLD sheets appears here after the check run.
            </EmptyState>
          ) : (
            <table className="pc-table">
              <thead>
                <tr><th>No.</th><th>Check point</th><th>Mode</th><th>Severity</th><th>Worst AI result</th><th>Engineer</th><th>Sheets</th></tr>
              </thead>
              <tbody>
                {checklistItems.map(it => (
                  <tr key={it.no}>
                    <td className="pc-mono">{it.no}</td>
                    <td>{it.check_point}</td>
                    <td><Pill label={it.mode ?? 'Automated'} tone={it.mode === 'Engineer-Led' ? 'neutral' : 'info'} /></td>
                    <td><Pill label={it.severity ?? 'Minor'} tone={CL_SEV_TONES[it.severity] ?? 'neutral'} /></td>
                    <td>{it.ai_result ? <Pill label={it.ai_result} tone={CL_RESULT_TONES[it.ai_result] ?? 'neutral'} /> : '—'}</td>
                    <td>{it.engineer_verification ?? '—'}</td>
                    <td className="pc-muted">{Array.isArray(it.sheets) ? it.sheets.join(', ') : (it.sheets ?? '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* all findings with family filter */}
      <section className="pc-section" aria-label="All findings">
        <h2 className="pc-section-title">All findings</h2>
        <div className="pc-chips" role="group" aria-label="Filter findings by family">
          {FAMILY_CHIPS.map(name => (
            <button
              key={name}
              type="button"
              className={`pc-chip${familyFilter === name ? ' pc-chip-active' : ''}`}
              style={{ minHeight: 30 }}
              aria-pressed={familyFilter === name}
              onClick={() => setFamilyFilter(name)}
            >
              {name}<span className="pc-chip-count">{familyCounts[name] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="pc-card pc-table-wrap">
          {filteredFindings.length === 0 ? (
            <EmptyState title={findings.length === 0 ? 'No findings were raised on this project.' : `No ${familyFilter} findings.`}>
              {findings.length === 0 ? 'Findings appear here after the check run finishes.' : 'Change the filter to see the other findings.'}
            </EmptyState>
          ) : (
            <table className="pc-table">
              <thead>
                <tr><th>Finding</th><th>Title</th><th>Family</th><th>Severity</th><th>Sheet</th><th>Status</th><th>Open</th></tr>
              </thead>
              <tbody>
                {filteredFindings.map(f => (
                  <tr key={f.id}>
                    <td className="pc-mono">{f.label}</td>
                    <td>{f.title}</td>
                    <td>{f.family}</td>
                    <td><Pill label={f.severity} tone={CL_SEV_TONES[f.severity] ?? 'neutral'} /></td>
                    <td className="pc-mono">{f.sheet ?? '—'}</td>
                    <td><Pill label={f.status ?? 'Open'} /></td>
                    <td>
                      {f.fileId != null && (
                        <button
                          type="button"
                          className="rd-btn rd-btn-ghost rd-btn-sm"
                          onClick={() => navigate(`${BASE}/projects/${projectId}/drawings/${f.fileId}?step=5&finding=${encodeURIComponent(f.label)}`)}
                        >
                          Open
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  )
}
