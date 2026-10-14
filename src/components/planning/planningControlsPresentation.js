export const controlsList = value => Array.isArray(value) ? value : []
export const controlsNumber = value => value !== null && value !== undefined && value !== '' && typeof value !== 'boolean' && Number.isFinite(Number(value)) ? Number(value) : null
export const controlsValue = (value, unit = '') => {
  const number = controlsNumber(value)
  return number === null ? 'Not Specified' : `${new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(number)}${unit}`
}
export const controlsLabel = value => value === null || value === undefined || value === '' ? 'Not Specified' : String(value).replaceAll('_', ' ')
export const controlsInput = value => value ?? ''
export const controlsError = error => {
  const messages = (value, prefix = '') => typeof value === 'string' ? [`${prefix ? `${controlsLabel(prefix)}: ` : ''}${value}`] : Array.isArray(value) ? value.flatMap(item => messages(item, prefix)) : value && typeof value === 'object' ? Object.entries(value).filter(([key]) => key !== 'code').flatMap(([key, item]) => messages(item, ['detail', 'error', 'message', 'non_field_errors'].includes(key) ? prefix : key)) : []
  return messages(error.response?.data).slice(0, 10).join(' ') || error.message || 'Operational controls could not be updated.'
}
export const earningMethods = [['manual_percent', 'Reported percent'], ['zero_hundred', '0 / 100'], ['fifty_fifty', '50 / 50'], ['quantity', 'Installed quantity']]
export const observationFields = ['actual_start', 'actual_finish', 'physical_progress_pct', 'installed_quantity', 'remaining_duration_days']
export const hasObservation = row => observationFields.some(field => row[field] !== null && row[field] !== undefined && row[field] !== '')
