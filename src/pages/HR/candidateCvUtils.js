export const skillSuggestions = ['Project Management', 'FEED', 'Detailed Design', 'EPC', 'EPCM', 'Quality Management', 'Design Reviews', 'HAZOP', 'AutoCAD', 'Procurement', 'Construction Management', 'Oil & Gas', 'Refinery', 'Petrochemicals']
export const tags = value => String(value || '').split(/[\n,;]+/).map(item => item.trim()).filter(Boolean)
export function formatPhone(value) {
  let phone = String(value || '').trim().replace(/^00/, '+')
  const plus = phone.startsWith('+') ? '+' : ''
  const digits = phone.replace(/\D/g, '')
  if (digits.length > 15) return phone
  if (plus && digits.startsWith('971')) return `+971 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`.trim()
  if (plus && digits.startsWith('91')) return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`.trim()
  if (plus && digits.startsWith('358')) return `+358 ${digits.slice(3, 5)} ${digits.slice(5)}`.trim()
  return plus + (digits.match(/.{1,3}/g) || []).join(' ')
}
export function cvSections(schema) {
  const output = []
  let contact = [], acknowledgement
  for (const section of schema.sections) {
    if (section.key === 'candidate') {
      contact = section.fields.filter(field => ['email', 'phone'].includes(field.key))
      output.push({ ...section, fields: section.fields.filter(field => !['email', 'phone'].includes(field.key)) })
    } else if (section.key === 'achievements') {
      for (const [key, title] of [['achievements', 'Key Achievements'], ['certifications', 'Certifications (If Any)']]) {
        output.push({ ...section, title, viewKey: key, fields: section.fields.filter(field => field.key === key) })
      }
    } else if (section.key === 'acknowledgement') acknowledgement = section
    else output.push(section)
  }
  if (contact.length) output.push({ key: 'candidate', viewKey: 'application_contact', title: 'Application contact details', repeatable: false, fields: contact })
  if (acknowledgement) output.push(acknowledgement)
  return output
}
export function mergeExtracted(current, extracted) {
  const result = { ...current }
  for (const [section, value] of Object.entries(extracted)) {
    if (section === 'acknowledgement') continue
    if (Array.isArray(value)) {
      const existing = current[section] || []
      result[section] = existing.some(row => Object.entries(row).some(([key, value]) => key !== "_uid" && Boolean(value))) ? existing : value.length ? value : existing
    } else {
      result[section] = { ...value, ...Object.fromEntries(Object.entries(current[section] || {}).filter(([, item]) => item !== '' && item != null)) }
    }
  }
  result.acknowledgement = { ...current.acknowledgement, accurate: false }
  return result
}
export function completion(schema, data, hasPhoto) {
  let count = 1, filled = hasPhoto ? 1 : 0
  for (const section of schema.sections) {
    const rows = section.repeatable ? (data[section.key] || []).filter(row => Object.entries(row).some(([key, value]) => key !== "_uid" && Boolean(value))) : [data[section.key] || {}]
    for (const row of rows) for (const field of section.fields.filter(field => field.required)) {
      count += 1
      if (typeof row[field.key] === 'string' ? row[field.key].trim() : row[field.key]) filled += 1
    }
  }
  return Math.round(filled / count * 100)
}
