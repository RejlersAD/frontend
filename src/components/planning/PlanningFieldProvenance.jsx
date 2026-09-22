import PropTypes from 'prop-types'
import './PlanningFieldProvenance.css'

const aliases = { source: 'document', document_evidence: 'document', source_document: 'document', approved_planning_rule: 'approved_rule', approved_planning_input: 'planner', planner_input: 'planner', planning_input: 'planner', deterministic_derivation: 'derived', ai_proposal: 'proposal' }
const labels = { document: 'Source document', approved_rule: 'Approved rule', derived: 'Derived from accepted inputs', proposal: 'Proposal', calculated: 'Calculated', planner: 'Planner input', unknown: 'Provenance not recorded' }
const readable = value => String(value || '').replaceAll('_', ' ')
export const factProvenance = fact => {
  const origin = fact.provenance || { type: fact.provenance_type, status: fact.status }
  return { ...origin, type: aliases[origin.type] || origin.type }
}
export function ProvenanceBadge({ provenance }) {
  const reported = aliases[provenance?.type] || provenance?.type
  const type = Object.hasOwn(labels, reported) ? reported : 'unknown'
  return <span className={`planning-provenance-badge is-${type}`} title={provenance?.label || labels[type]}>{labels[type]}{provenance?.status && <small> · {readable(provenance.status)}</small>}</span>
}
ProvenanceBadge.propTypes = { provenance: PropTypes.object }

export default function PlanningFieldProvenance({ provenance }) {
  const lineage = provenance?.lineage || {}
  const sources = provenance?.source_references?.length ? provenance.source_references : lineage.source_references || []
  const facts = [...new Set([...(provenance?.fact_ids || []), ...(lineage.fact_ids || [])])]
  const profileName = provenance?.profile_name || lineage.profile_name
  const profileId = provenance?.profile_id || lineage.profile_id
  const profileVersion = provenance?.profile_version ?? lineage.profile_version
  const ruleId = provenance?.rule_id || lineage.rule_id
  return <div className="planning-field-provenance"><ProvenanceBadge provenance={provenance} />
    {(profileName || profileId || profileVersion != null || ruleId) && <small>{profileName || (profileId ? `Planning profile ${profileId}` : 'Planning profile')}{profileVersion != null && ` · Version ${profileVersion}`}{ruleId && ` · Rule ${ruleId}`}</small>}
    {facts.length > 0 && <details><summary>Input references</summary>{facts.map(id => <small key={id}>Fact {id}</small>)}</details>}
    {sources.map((source, index) => <details key={index}><summary>{source.filename || source.file_name || source.source_filename || 'Source document'}{source.document_version != null && ` · v${source.document_version}`}</summary><p>{readable(source.locator?.sheet)}{source.locator?.page != null && ` Page ${source.locator.page}`}{source.locator?.row != null && ` Row ${source.locator.row}`}{source.locator?.cell && ` ${source.locator.cell}`}</p>{(source.excerpt || source.source_excerpt) && <blockquote>{source.excerpt || source.source_excerpt}</blockquote>}</details>)}
  </div>
}
PlanningFieldProvenance.propTypes = { provenance: PropTypes.object }
