/* eslint-disable react/prop-types */
import React, { useEffect, useState } from 'react'
import usePlanningJob from '../../hooks/usePlanningJob'
import service from '../../services/planningIntelligence.service'
import { listPlanningRows } from '../../services/planningScheduleSelection'
import { PLANNING_ENDPOINTS } from '../../config/planningIntelligence.config'

/** Entry recovery must not mount the files/settings/evidence editing page. */
export default function PlanningBackgroundMonitor({ enterpriseProjectId, onState, onReady }) {
  const [projectId, setProjectId] = useState(null)
  const [latest, setLatest] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const { activeJob, monitoringError, checkingStatus, retryMonitoring } = usePlanningJob({ projectId, recoverActiveAnalysis: true })
  useEffect(() => {
    const controller = new AbortController()
    setProjectId(null); setLatest(null); setLoadError('')
    listPlanningRows(PLANNING_ENDPOINTS.projects, { enterprise_project: enterpriseProjectId }, { signal: controller.signal })
      .then(rows => {
        if (controller.signal.aborted) return
        const project = rows.filter(row => String(row.enterprise_project?.id ?? row.enterprise_project) === String(enterpriseProjectId) && row.is_deleted !== true)
          .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')) || Number(b.id) - Number(a.id))[0]
        setProjectId(project?.id ?? null)
      }).catch(error => { if (!controller.signal.aborted) setLoadError(error.message || 'Background analysis status could not be checked.') })
    return () => controller.abort()
  }, [enterpriseProjectId, attempt])
  useEffect(() => {
    if (!projectId) return undefined
    const controller = new AbortController()
    service.getLatestIntelligenceRun(projectId, controller.signal).then(run => {
      if (!controller.signal.aborted && (!run || String(run.project?.id ?? run.project) === String(projectId))) setLatest(run)
    }).catch(() => { /* A latest-run summary does not replace explicit job recovery errors. */ })
    return () => controller.abort()
  }, [projectId])
  useEffect(() => {
    onState?.({ projectId, pending: ['queued', 'running'].includes(activeJob?.status) || Boolean(monitoringError && !monitoringError.jobUnavailable), savedRunId: latest?.id || null,
      message: monitoringError ? 'Document analysis status needs checking. Reconnect to the saved job.' : activeJob?.message || '' })
  }, [activeJob, latest, monitoringError, onState, projectId])
  useEffect(() => {
    if (activeJob && ['succeeded', 'failed', 'cancelled'].includes(activeJob.status)) onReady(activeJob)
  }, [activeJob, onReady])
  if (!loadError && !monitoringError) return null
  return <div className="pln-section" role="alert"><p>{loadError || (monitoringError?.jobUnavailable ? 'This saved job is unavailable or this account no longer has access. Its local progress link was cleared.' : 'Background analysis status could not be checked. Your saved job has been retained.')}</p>
    <button type="button" className="pln-button" disabled={checkingStatus || monitoringError?.jobUnavailable} onClick={() => loadError ? setAttempt(value => value + 1) : retryMonitoring()}>
      {checkingStatus ? 'Checking analysis status…' : 'Retry analysis status'}
    </button></div>
}
