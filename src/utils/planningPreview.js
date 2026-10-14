export const editablePlanningPreview = data => ({
  detected_project_name: data?.detected_project_name || '',
  detected_effective_date_text: data?.detected_effective_date_text || '',
  detected_duration_months: data?.detected_duration_months ?? null,
  disciplines: Object.fromEntries(Object.entries(data?.disciplines || {}).map(([code, info]) => [code, {
    in_scope: info.in_scope !== false,
    deliverables: [...(info.deliverables || [])],
    excluded_deliverables: [...(info.excluded_deliverables || [])],
  }])),
  hse_studies: [...(data?.hse_studies || [])],
})

export const planningPreviewKey = data => {
  const value = editablePlanningPreview(data)
  value.disciplines = Object.fromEntries(Object.entries(value.disciplines).sort(([a], [b]) => a.localeCompare(b)).map(([code, info]) => [code, {
    ...info, deliverables: [...info.deliverables].sort(), excluded_deliverables: [...info.excluded_deliverables].sort(),
  }]))
  value.hse_studies.sort()
  return JSON.stringify(value)
}

export const mergePlanningPreview = (source, edits) => {
  const values = editablePlanningPreview(edits)
  return {
    ...source, ...values,
    disciplines: Object.fromEntries(Object.entries(values.disciplines).map(([code, info]) => [code, {
      ...source?.disciplines?.[code], ...info,
    }])),
  }
}

export const planningPreviewError = error => {
  const data = error.response?.data
  const messages = value => typeof value === 'string' ? [value]
    : value && typeof value === 'object' ? Object.values(value).flatMap(messages) : []
  return data?.error || data?.detail || messages(data?.preview).join(' ')
    || error.message || 'The preview could not be saved. Please retry.'
}
