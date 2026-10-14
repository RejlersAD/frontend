const timingCodes = new Set(['negative_float', 'contract_finish_overrun', 'contractual_finish_overrun'])

export const isTimingWarning = issue => timingCodes.has(issue?.code)

// Group repeated input gaps for presentation only. Keep the underlying checks
// so each affected activity can still be inspected and repaired independently.
const groupedInputCodes = new Set(['duration_required', 'zero_duration_tasks'])
export function scheduleIssueGroups(issues = []) {
  const groups = []
  const byCode = new Map()
  for (const issue of issues) {
    if (!groupedInputCodes.has(issue.code)) {
      groups.push(issue)
      continue
    }
    const key = `${issue.code}:${issue.field || ''}`
    const existing = byCode.get(key)
    if (existing) existing.grouped_issues.push(issue)
    else {
      const group = { ...issue, grouped_issues: [issue] }
      byCode.set(key, group)
      groups.push(group)
    }
  }
  return groups
}

const normalize = issue => typeof issue === 'string' ? { message: issue } : issue
const unique = issues => [...new Map(issues.map(normalize).filter(Boolean).map(issue => [
  `${issue.code || issue.message}:${issue.task_id ?? ''}`, issue,
])).values()]

// Old saved versions and submit responses may still classify deadline pressure
// as blocking. Only these known timing checks are advisory; authorization and
// structural/source-integrity checks remain authoritative.
export function scheduleChecks(plan = {}, recentBlockers = []) {
  const findings = unique([...(plan.blockers || []), ...recentBlockers])
  const warnings = unique([...findings.filter(isTimingWarning), ...(plan.warnings || [])])
    .map(issue => isTimingWarning(issue) ? { ...issue, severity: 'warning' } : issue)
  return {
    blockers: findings.filter(issue => !isTimingWarning(issue)),
    warnings,
    timingWarnings: warnings.filter(isTimingWarning),
    otherWarnings: warnings.filter(issue => !isTimingWarning(issue)),
  }
}
