/* eslint-disable react/prop-types */
import { DOCUMENT_FIELDS, DOCUMENT_DEFAULTS, separatorDatasheet } from './separatorDatasheetModel.js'
import { formatValue } from './compare.ts'

export default function SeparatorDatasheet({ metadata, result, inputCases, onDocument, onTag, onService, demo, automatic }) {
  const model = separatorDatasheet(metadata, result, inputCases)
  const document = { ...DOCUMENT_DEFAULTS, ...metadata.document }
  const display = (value) => automatic && !demo && (value === null || value === undefined || value === 'Not calculated' || value === 'Not configured' || value === 'Not selected') ? 'NA' : value === null ? 'Not applicable' : value === undefined ? 'Not reported' : typeof value === 'number' ? formatValue(value) : value
  return <>
    <h3>Document information</h3>
    <div className="eq-criteria-grid eq-document-fields">
      {DOCUMENT_FIELDS.map(([key, label]) => <label className="eq-label" key={key}>{label}
        <input value={document[key]} placeholder={automatic ? 'NA' : ''} readOnly={demo} type={key === 'date' ? 'date' : 'text'} onChange={(event) => onDocument(key, event.target.value)} />
      </label>)}
      <label className="eq-label">Equipment Tag<input value={metadata.tag} readOnly={demo} onChange={(event) => onTag(event.target.value)} /></label>
      <label className="eq-label">Service<input value={metadata.service} readOnly={demo} onChange={(event) => onService(event.target.value)} /></label>
    </div>
    <p className="eq-subtle">Quantity is document information; calculations are per vessel. Design code is an intended basis, not certified compliance.</p>
    {!result && <p className="eq-subtle">Operating input values are shown in workbook units. Calculated/design values require Run sizing.</p>}
    {model.sections.map((section) => <section className="eq-datasheet-section" key={section.title}>
      <h3>{section.title}</h3>
      <div className="eq-table-scroll"><table>
        <thead><tr>{(section.schedule ? section.columns : ['Parameter', 'Unit', ...(section.columns || ['Value'])]).map((label, index) => <th key={`${label}-${index}`}>{label}</th>)}</tr></thead>
        <tbody>{section.schedule ? section.schedule.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td key={index}>{display(cell)}</td>)}</tr>) :
          section.rows.map((row) => <tr key={row.label}><th scope="row">{row.label}</th><td>{row.unit}</td>{row.values.map((value, index) => <td key={index} colSpan={row.values.length === 1 ? Math.max(1, section.columns?.length || 1) : 1}>{display(value)}</td>)}</tr>)}
        </tbody>
      </table></div>
    </section>)}
  </>
}
