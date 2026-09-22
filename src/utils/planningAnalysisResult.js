// Older saved drafts can contain completed document findings without activities.
// Keep that outcome distinct from an untouched workspace or a populated schedule.
export function emptyScheduleAnalysis(plan) {
  if (!plan || plan.canonical_version || plan.viewing_history || plan.legacy_read_only || plan.tasks?.length) return null
  if (plan.analysis_result?.status === 'no_activities') return plan.analysis_result
  if (!plan.intelligence_run_id) return null

  const ai = plan.processing_coverage?.ai_processing || {}
  const providerMissing = ai.chunks?.some(chunk => chunk.reason === 'provider_not_configured')
    || /no .*provider.*configured/i.test(ai.reason || '')
  return {
    status: 'no_activities',
    next_action: providerMissing ? 'ai_settings' : 'review_sources',
    message: providerMissing
      ? 'Document analysis completed, but no schedule activities were created. AI extraction did not run because no AI provider is configured. Open AI settings and analyze again, or upload a deliverable register or activity schedule.'
      : 'Document analysis completed, but no schedule activities were extracted. Review the findings, upload a deliverable register or activity schedule, or add activities manually.',
  }
}
