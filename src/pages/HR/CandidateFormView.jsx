import PropTypes from 'prop-types'
import { cvSections } from './candidateCvUtils'

export default function CandidateFormView({ schema, data }) {
  const sections = schema.kind === 'cv' || schema.sections.some(section => section.key === 'competence') ? cvSections(schema) : schema.sections
  return <div className="cf-review">{sections.map(section => {
    if (section.key === 'relatives' && !data.relatives_question?.has_relatives) return null
    const values = section.repeatable ? data[section.key] || [] : [data[section.key] || {}]
    return <section key={section.viewKey || section.key}><h3>{section.title}</h3>{values.length ? values.map((row, index) => <div className="cf-review-row" key={index}>{section.repeatable && <h4>Entry {index + 1}</h4>}<dl>{section.fields.map(field => <div key={field.key}><dt>{field.label}</dt><dd>{typeof row[field.key] === 'boolean' ? row[field.key] ? 'Yes' : 'No' : row[field.key] || 'Not provided'}</dd></div>)}</dl></div>) : <p>No entries</p>}</section>
  })}{schema.declaration && <section><h3>Company-template declaration</h3><p>{schema.declaration.replace(/\{([^}]+)\}/g, (_, key) => data.beneficiary?.[key] || '________')}</p><p>{schema.signature_note}</p></section>}</div>
}
CandidateFormView.propTypes = { schema: PropTypes.object.isRequired, data: PropTypes.object.isRequired }
