import PropTypes from 'prop-types'
import { controlsList as list, controlsValue as value, controlsLabel as label } from './planningControlsPresentation'

export default function PlanningDelayPaths({ paths, title }) {
  const nodes = list(paths.nodes), edges = list(paths.edges), witnesses = list(paths.witnesses)
  const name = id => { const node = nodes.find(row => typeof row === 'object' && String(row.activity_id) === String(id)); return node ? `${node.external_id || id} · ${node.name || ''}` : String(id) }
  const flag = (item, yes, no) => item === true ? yes : item === false ? no : 'Not Specified'
  return <details><summary>Dependency paths and timing evidence</summary><p>Potential downstream connections are distinct from calculated date changes. A driving relationship is technical scheduling evidence, not a determination of contractual responsibility.</p>
    <dl className="poc-metrics"><div><dt>Potentially affected activities</dt><dd>{value(paths.reachable_activity_count)}</dd></div><div><dt>Activities with calculated date changes</dt><dd>{Array.isArray(paths.timing_changed_activity_ids) ? paths.timing_changed_activity_ids.length : 'Not Specified'}</dd></div><div><dt>Related dependency links</dt><dd>{value(paths.edge_count)}</dd></div></dl>
    <div className="poc-table" role="region" aria-label={`${title} dependency paths`} tabIndex={0}><table><thead><tr><th>Predecessor</th><th>Successor</th><th>Type</th><th>Lag (working d)</th><th>Reference / scenario</th><th>Scenario driving link</th></tr></thead><tbody>{edges.map((row, index) => <tr key={index}><td>{name(row.predecessor_id)}</td><td>{name(row.successor_id)}</td><td>{label(row.type)}</td><td>{value(row.lag_days)}</td><td>{flag(row.in_reference, 'Present', 'Absent')} / {flag(row.in_scenario, 'Present', 'Absent')}</td><td>{flag(row.driving_in_scenario, 'Driving', 'Not driving')}</td></tr>)}{!edges.length && <tr><td colSpan={6}>No related path links reported.</td></tr>}</tbody></table></div>
    {witnesses.length > 0 && <ul>{witnesses.map((row, index) => <li key={index}>{list(row.activity_ids).map(name).join(' → ')}<small className="pda-path-basis">{row.basis === 'scenario_driving_edges' ? 'Path follows calculated driving relationships' : row.basis === 'potential_reachability_only' ? 'Potential connection only; a driving chain was not established' : label(row.basis)}{row.truncated && ' · Partial path shown'}</small></li>)}</ul>}
    {Object.values(paths.truncated || {}).some(count => Number(count) > 0) && <p className="poc-message is-warning">The calculation returned a bounded path extract. Some nodes, links or paths are omitted; this view does not claim complete path coverage.</p>}
  </details>
}
PlanningDelayPaths.propTypes = { paths: PropTypes.object.isRequired, title: PropTypes.string.isRequired }
