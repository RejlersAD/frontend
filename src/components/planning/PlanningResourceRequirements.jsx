import PropTypes from 'prop-types'
import PlanningFieldProvenance, { factProvenance } from './PlanningFieldProvenance'

const display = value => value == null || value === '' ? 'Not Specified' : typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
export default function PlanningResourceRequirements({ requirements, tasks }) {
  const rows = Array.isArray(requirements) ? requirements : []
  const names = new Map(tasks.map(task => [String(task.id), task.title]))
  return <section className="planning-resource-requirements" aria-label="Planning resource requirements"><h3>Resource requirements</h3><p className="sc-muted">Reviewed requirements and workflow roles are separate from employee assignments.</p><div className="sc-secondary-table"><table><thead><tr><th>Activity / source</th><th>Requirement / role</th><th>Quantity</th><th>Unit</th><th>Planning basis</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row.id || `${row.activity_id}-${index}`}><td>{display(names.get(String(row.activity_id)) || row.source_entity_id || row.activity_id)}</td><td>{display(row.role || row.value)}</td><td>{display(row.quantity)}</td><td>{display(row.unit)}</td><td><PlanningFieldProvenance provenance={row.provenance || (row.lineage ? { ...row.lineage, type: factProvenance({ provenance_type: row.lineage.type || row.lineage.provenance_type }).type } : null)} /></td></tr>)}{!rows.length && <tr><td colSpan={5}>No resource requirements recorded. Missing quantities remain Not Specified.</td></tr>}</tbody></table></div></section>
}
PlanningResourceRequirements.propTypes = { requirements: PropTypes.array, tasks: PropTypes.array.isRequired }
