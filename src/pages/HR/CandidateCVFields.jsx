import { useId, useState } from 'react'
import PropTypes from 'prop-types'
import { formatPhone, skillSuggestions, tags } from './candidateCvUtils'

const choices = {
  current_department: ['Engineering', 'Project Delivery', 'Procurement', 'HR & Administration', 'Finance & IT', 'Business Development & Sales', 'Management', 'AI', 'QHSE'],
  current_position: ['Engineer', 'Senior Engineer', 'Lead Engineer', 'Project Manager', 'Project Coordinator', 'QA/QC Engineer', 'Procurement Officer', 'Accountant', 'HR Officer'],
  qualification: ['Bachelor of Engineering', 'Bachelor of Science', 'Master of Engineering', 'Master of Science', 'MBA', 'PhD', 'Diploma'],
  language: ['English', 'Arabic', 'Hindi', 'Urdu', 'Malayalam', 'Tamil', 'Telugu', 'Finnish', 'Amharic', 'French'],
  proficiency: ['Native / Bilingual', 'Fluent', 'Professional working proficiency', 'Intermediate', 'Basic'],
}
const examples = {
  name: 'e.g. Aisha Ahmed', current_position: 'e.g. Senior Mechanical Engineer', current_department: 'e.g. Engineering',
  email: 'e.g. aisha@example.com', phone: '+971 50 123 4567', qualification: 'e.g. Bachelor of Engineering', institution: 'e.g. Khalifa University',
  language: 'e.g. English', proficiency: 'e.g. Fluent', title: 'e.g. Lead Process Engineer', company: 'e.g. Rejlers',
  projects: 'e.g. FEED study for a gas processing facility', responsibilities: 'e.g. Led design reviews and coordinated multidisciplinary deliverables',
  text: 'e.g. Mechanical engineer with 8 years of experience in oil and gas project delivery…',
  achievements: 'e.g. Reduced engineering review time by 20% across three projects', certifications: 'e.g. PMP, NEBOSH, ISO 9001 Lead Auditor',
}
function TagsInput({ label, value, onChange }) {
  const [draft, setDraft] = useState('')
  const id = useId()
  const values = tags(value)
  const add = text => {
    const unique = [...values]
    for (const tag of tags(text)) if (tag.length <= 100 && !unique.some(item => item.toLowerCase() === tag.toLowerCase()) && unique.length < 40) unique.push(tag)
    onChange(unique.join('\n')); setDraft('')
  }
  return <div className="cf-field cf-field-wide"><label htmlFor={id}>{label}</label><div className="cf-chip-box">{values.map(tag => <span className="cf-chip" key={tag}>{tag}<button type="button" aria-label={`Remove ${tag}`} onClick={() => onChange(values.filter(item => item !== tag).join('\n'))}>×</button></span>)}<input id={id} list={`${id}-suggestions`} value={draft} maxLength={100} placeholder="Type a skill and press Enter" onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); if (draft.trim()) add(draft) } }} onBlur={() => { if (draft.trim()) add(draft) }} /><datalist id={`${id}-suggestions`}>{skillSuggestions.map(skill => <option key={skill} value={skill} />)}</datalist></div><div className="cf-suggestions"><span>Suggestions:</span>{skillSuggestions.filter(skill => !values.some(value => value.toLowerCase() === skill.toLowerCase())).slice(0, 5).map(skill => <button key={skill} type="button" onClick={() => add(skill)}>+ {skill}</button>)}</div></div>
}
TagsInput.propTypes = { label: PropTypes.string.isRequired, value: PropTypes.string, onChange: PropTypes.func.isRequired }

function PeriodInput({ value, onChange, label }) {
  const months = value.match(/\b\d{4}-\d{2}\b/g) || []
  const current = /present|current/i.test(value)
  const update = (start, end) => onChange(`${start}${start || end ? ' – ' : ''}${end}`)
  return <fieldset className="cf-field cf-period"><legend>{label}</legend>{value && <span className="cf-period-value">{value}</span>}<div><label>Start month<input type="month" value={months[0] || ''} onChange={event => update(event.target.value, current ? 'Present' : months[1] || '')} /></label><label>End month<input type="month" disabled={current} min={months[0] || undefined} value={months[1] || ''} onChange={event => update(months[0] || '', event.target.value)} /></label></div><label className="cf-check"><input type="checkbox" checked={current} onChange={event => update(months[0] || '', event.target.checked ? 'Present' : '')} />Present / ongoing</label></fieldset>
}
PeriodInput.propTypes = { label: PropTypes.string, value: PropTypes.string.isRequired, onChange: PropTypes.func.isRequired }

export default function CandidateCVFields({ section, row, onChange }) {
  const [customFields, setCustomFields] = useState({})
  return section.fields.map(field => {
    const value = row[field.key] || ''
    const label = `${field.label}${field.required ? ' *' : ''}`
    if (section.key === 'competence') return <TagsInput key={field.key} label={label} value={value} onChange={value => onChange(field.key, value)} />
    if (field.key === 'period') return <PeriodInput key={field.key} label={label} value={value} onChange={value => onChange(field.key, value)} />
    if (field.type === 'checkbox') return <label className="cf-field cf-field-wide" key={field.key}><span className="cf-check"><input type="checkbox" checked={Boolean(row[field.key])} onChange={event => onChange(field.key, event.target.checked)} />{label}</span></label>
    if (field.type === 'year') return <label className="cf-field" key={field.key}><span>{label}</span><select aria-label={label} value={value} onChange={event => onChange(field.key, event.target.value)}><option value="">Select year</option>{Array.from({ length: new Date().getFullYear() - 1899 }, (_, index) => String(new Date().getFullYear() - index)).map(year => <option value={year} key={year}>{year}</option>)}</select></label>
    const options = choices[field.key]
    return <label className={`cf-field${field.type === 'textarea' ? ' cf-field-wide' : ''}`} key={field.key}><span>{label}</span>{options ? <><select aria-label={label} value={customFields[field.key] ? '__other__' : value} onChange={event => { const custom = event.target.value === '__other__'; setCustomFields(previous => ({ ...previous, [field.key]: custom })); if (!custom) onChange(field.key, event.target.value) }}><option value="">{examples[field.key] || `Select ${field.label.toLowerCase()}`}</option>{value && !options.includes(value) && <option value={value}>{value}</option>}{options.map(option => <option key={option} value={option}>{option}</option>)}<option value="__other__">Other — type your own</option></select>{customFields[field.key] && <input aria-label={`Other ${field.label}`} maxLength={500} value={value} placeholder={examples[field.key]} onChange={event => onChange(field.key, event.target.value)} />}</> : field.type === 'textarea' ? <textarea rows={4} maxLength={10000} value={value} placeholder={examples[field.key] || `Enter ${field.label.toLowerCase()}`} onChange={event => onChange(field.key, event.target.value)} /> : <input type={field.key === 'phone' ? 'tel' : field.type} autoComplete={field.key === 'email' ? 'email' : field.key === 'phone' ? 'tel' : undefined} maxLength={500} value={value} placeholder={examples[field.key] || 'e.g. Your full name'} onBlur={field.key === 'phone' ? () => onChange(field.key, formatPhone(value)) : undefined} onChange={event => onChange(field.key, event.target.value)} />}</label>
  })
}
CandidateCVFields.propTypes = { section: PropTypes.object.isRequired, row: PropTypes.object.isRequired, onChange: PropTypes.func.isRequired }
