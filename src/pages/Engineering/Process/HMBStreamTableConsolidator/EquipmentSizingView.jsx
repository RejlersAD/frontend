/* eslint-disable react/prop-types */
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { AlertTriangle, Check, CheckCircle2, ChevronDown, Circle, ExternalLink, Info, Layers, Link2, Play, RotateCcw, Save, FileSpreadsheet, X } from 'lucide-react'
import { formatValue } from './compare.ts'
import { sourceSizingCell } from './separatorMapping.ts'
import SeparatorDatasheet from './SeparatorDatasheet.jsx'

const TABS = [['inputs', 'Inputs'], ['criteria', 'Design Criteria'], ['calculations', 'Calculations'], ['datasheet', 'Datasheet']]
const GROUPS = [
  ['Flow margins and separation', ['gas_margin', 'oil_margin', 'water_margin', 'oil_retention', 'water_retention', 'water_drop', 'oil_drop', 'k']],
  ['Vessel geometry and levels', ['ld', 'effective', 'min_id', 'id_step', 'length_step', 'hhll', 'hll', 'nll', 'lll', 'llll', 'interface_alarm', 'interface_trip']],
  ['Nozzle criteria', ['inlet_momentum', 'gas_momentum', 'oil_velocity', 'water_velocity']],
  ['Gas basis and constants', ['atmosphere', 'standard_pressure', 'standard_temperature', 'standard_z', 'gravity', 'gas_constant', 'scf_m3']],
]
const UNIT_LABELS = { 'm3/h': 'm³/h', 'kg/m3': 'kg/m³', C: '°C' }
const CALCULATED_METRICS = [
  ['Standard design gas flow', 'gas_design', 'MMSCFD'], ['Actual design oil flow', 'oil_design', 'm³/h'], ['Actual design water flow', 'water_design', 'm³/h'],
  ['Calculated gas density', 'gas_density', 'kg/m³'], ['Actual gas flow', 'gas_actual', 'm³/s'], ['Allowable gas velocity', 'gas_allowable', 'm/s'],
  ['Required ID, gas', 'gas_required_id', 'm'], ['Required ID, retention', 'liquid_required_id', 'm'], ['Required vessel ID', 'required_id', 'm'],
  ['Gas utilization', 'gas_utilization', 'fraction'], ['Oil retention', 'oil_retention', 'min'], ['Water retention', 'water_retention', 'min'], ['Interface level', 'nil_mm', 'mm'],
]

function sizingDisplay(value) {
  if (value === '' || value === null || value === undefined) return ''
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return String(value)
  if (numeric !== 0 && Math.abs(numeric) < .0001) return numeric.toExponential(4)
  return numeric.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 4 })
}

function SizingNumberInput({ value, onChange, ...props }) {
  const [editing, setEditing] = useState(false)
  return <input {...props} type="number" value={editing ? value : sizingDisplay(value)}
    onFocus={(event) => { flushSync(() => setEditing(true)); event.currentTarget.select() }}
    onBlur={() => flushSync(() => setEditing(false))} onChange={onChange} />
}

function requiredGaps(selected) {
  return selected.flatMap((item) => {
    const value = (key) => item.inputs[key]
    const keys = ['pressure', 'temperature', 'gas_flow', 'oil_flow', 'water_flow']
    for (const [phase, properties] of [['gas', ['gas_mw', 'gas_z']], ['oil', ['oil_density', 'oil_viscosity']], ['water', ['water_density', 'water_viscosity']]]) {
      if (value(`${phase}_flow`) > 0) keys.push(...properties)
    }
    return keys.filter((key) => value(key) === null || !Number.isFinite(value(key))).map((key) => `${item.name}: ${key}`)
  })
}

function verification(result, demo) {
  if (!result) return ['Not run', 'Not run', 'Not run']
  if (demo) return ['Passed', 'Passed', 'Passed']
  const warnings = result.cases.flatMap((item) => item.warnings)
  return [
    result.cases.every((item) => item.gas_utilization === null) ? 'Not applicable' : warnings.some((value) => /Gas capacity/i.test(value)) ? 'Review' : 'Passed',
    warnings.some((value) => /retention fails/i.test(value)) ? 'Review' : 'Passed',
    warnings.some((value) => /Stokes|settling.*exceeds|Interface/i.test(value)) ? 'Review' : warnings.some((value) => /not applicable/i.test(value)) ? 'Not applicable' : 'Passed',
  ]
}

export default function EquipmentSizingView(p) {
  const id = useId()
  const tabsRef = useRef([])
  const dialogRef = useRef(null)
  const [mappingOpen, setMappingOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const dialogOpen = mappingOpen || historyOpen || !!p.pendingOpen
  useEffect(() => {
    if (!dialogOpen) return undefined
    const previous = document.activeElement
    dialogRef.current?.focus()
    return () => previous?.focus()
  }, [dialogOpen])
  const result = p.demo ? p.referenceExample.result : p.result
  const source = p.activeSource
  const legacyBasis = p.detached && p.sources.some((item) => !item.comparisonColumn)
  const provenanceName = source ? /^case(?:\b|_)/i.test(source.name) ? source.name : `Case ${source.name}` : 'Missing'
  const gaps = [...requiredGaps(p.normalizedCases.filter((item) => p.selected.some((selected) => selected.id === item.id))),
    ...p.selected.filter((item) => item.comparisonColumn && !item.sourceCaseId).map((item) => `${item.name}: no governing comparison case`)]
  const complete = p.selected.length > 0 && !gaps.length && !p.unitErrors.length
  const runBlockers = [
    ...(p.demo ? ['Reference example only; production sizing is disabled.'] : []),
    ...(legacyBasis ? ['Relink this revision to Cross-case comparison.'] : []),
    ...(!p.schema ? ['Load calculator criteria.'] : []),
    ...(!p.selected.length ? ['Select a comparison stream.'] : !complete ? ['Resolve missing inputs or source-unit errors.'] : []),
    ...(!p.metadata.tag.trim() ? ['Enter an equipment tag, for example V-1001.'] : []),
    ...(!p.confirmed ? ['Review mapping and confirm the engineering basis.'] : []),
    ...(p.busy ? ['Sizing is in progress.'] : []),
    ...(p.archiveBusy ? ['Wait for the revision operation to finish.'] : []),
  ]
  const archiveUnavailable = p.archiveError.includes('endpoint is unavailable')
  const saveReason = p.demo ? 'Reference example cannot be saved.' : !p.metadata.tag.trim() ? 'Enter an equipment tag before saving a revision.' : p.unitErrors.length ? 'Resolve source-unit mapping first.' : !p.projectId ? 'Select a project in Project Organizer.' : archiveUnavailable ? p.archiveError : !p.result ? 'A current sizing result is required before saving a revision.' : ''
  const exportReason = p.demo ? 'Reference example cannot be exported.' : p.unitErrors.length ? 'Resolve source-unit mapping first.' : !p.result ? 'Run sizing successfully before exporting.' : ''
  const checks = verification(result, p.demo)
  const allPass = result && result.status === 'OK'
  const driver = result?.cases.find((item) => item.id === result.governing_case_id)?.control
  const displayedCases = p.sources.length <= 3 ? p.sources : [...p.sources.slice(0, 3), ...(source && !p.sources.slice(0, 3).includes(source) ? [source] : [])]
  const units = (key) => {
    const unit = source ? sourceSizingCell(source, key)?.unit : null
    return p.demo && unit === '-' ? '' : UNIT_LABELS[unit] || unit || 'Unit unavailable'
  }
  const value = (key) => {
    if (!source) return ''
    const override = p.overrides[`${source.id}:${key}`]
    const original = sourceSizingCell(source, key)?.value
    return override === undefined ? typeof original === 'number' && Number.isFinite(original) ? original : '' : override
  }
  function field(key, compact = false) {
    const edited = source && Object.hasOwn(p.overrides, `${source.id}:${key}`)
    return <div className={`eq-value${compact ? ' is-compact' : ''}${edited ? ' is-override' : ''}`}>
      <div className="eq-value-line">
        <SizingNumberInput id={`${id}-${key}`} step="any" value={value(key)} placeholder={p.automatic && !p.demo ? 'NA' : 'Missing'} disabled={!source || !sourceSizingCell(source, key)} readOnly={p.demo}
          title={value(key) === '' ? 'Missing source value' : `Full precision: ${value(key)} ${units(key)}`}
          style={compact ? { width: `${(value(key) === '' ? 7 : sizingDisplay(value(key)).length) + .25}ch`, flex: '0 1 auto', maxWidth: '60%' } : undefined}
          aria-label={`${source?.name || 'Case'} ${p.schema?.inputs[key]?.label || key}`}
          onChange={(event) => p.onOverride(key, event.target.value)} />
        {units(key) && <span className="eq-unit" title={`Comparison/source unit: ${source ? sourceSizingCell(source, key)?.unit || 'unavailable' : 'unavailable'}. Calculation unit: ${p.schema?.inputs[key]?.unit || 'unavailable'}. ${key === 'pressure' ? 'Gauge pressure.' : key === 'gas_flow' ? 'Standard gas flow, not actual gas volume.' : key.endsWith('_flow') ? 'Actual liquid volume.' : ''}`}>{units(key)}{!compact && <ChevronDown aria-hidden="true" />}</span>}
      </div>
      {edited && <span className="eq-override-label">Override <button type="button" aria-label={`Restore ${source.name} ${p.schema.inputs[key].label}`} onClick={() => p.onReset(key)}><RotateCcw /></button></span>}
    </div>
  }
  const gasDensityCell = source?.comparisonGasDensity || source?.gasDensity?.source
  const gasDensity = p.demo ? source?.gasDensity?.value : gasDensityCell?.value
  const gasDensityUnit = p.demo ? 'kg/m³' : gasDensityCell?.unit || 'Unit unavailable'
  const actions = <div className="eq-top-actions" data-reference-example={p.demo}>
    <button type="button" disabled={!!saveReason || !!p.archiveBusy || p.busy} title={saveReason || 'Save immutable project revision'} onClick={p.onSave}><Save />{p.archiveBusy === 'saving' ? 'Saving…' : 'Save revision'}</button>
    <button className="eq-primary" type="button" disabled={!!exportReason || p.exporting} title={exportReason || 'Export the four-sheet calculation workbook'} onClick={p.onExport}><FileSpreadsheet />{p.exporting ? 'Exporting…' : 'Export Excel'}</button>
  </div>
  function tabKey(event, index) {
    let next = index
    if (event.key === 'ArrowRight') next = (index + 1) % TABS.length
    else if (event.key === 'ArrowLeft') next = (index + TABS.length - 1) % TABS.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = TABS.length - 1
    else return
    event.preventDefault(); p.setTab(TABS[next][0]); tabsRef.current[next].focus()
  }
  const selectedStatus = p.stale ? 'Recalculation required' : result ? allPass ? `All ${result.cases.length} cases pass` : 'Review required' : 'Not calculated'
  const groups = p.schema ? [...GROUPS.map(([title, keys]) => [title, Object.entries(p.schema.criteria).filter(([key]) => keys.includes(key))]),
    ['Additional and preliminary mechanical criteria', Object.entries(p.schema.criteria).filter(([key]) => !GROUPS.some(([, keys]) => keys.includes(key)))]] : []
  return <section className="equipment-sizing" aria-label="Three-phase separator sizing" data-reference-example={p.demo}>
    {p.actionHost ? createPortal(actions, p.actionHost) : actions}
    <div className="eq-pane eq-equipment">
      <h2>Equipment</h2>
      <label className="eq-label">Equipment<select aria-label="Equipment type" value="separator" onChange={() => p.setTab('inputs')}><option value="separator">Three-Phase Separator</option></select></label>
      {!p.demo && <label className="eq-field-label" htmlFor={`${id}-equipment-tag`}>Equipment tag <span className="eq-required">Required</span></label>}
      <input id={`${id}-equipment-tag`} className="eq-tag" aria-label="Equipment tag" placeholder={p.demo ? 'Equipment tag' : 'e.g. V-1001'} value={p.metadata.tag} readOnly={p.demo} aria-required={!p.demo} onChange={(event) => p.onTag(event.target.value)} />
      <label className="eq-label">Service<input value={p.metadata.service} readOnly={p.demo} onChange={(event) => p.onService(event.target.value)} /></label>
      <label className="eq-label">Source stream<select aria-label="Feed stream" value={p.metadata.stream} onChange={(event) => p.onStream(event.target.value)} disabled={p.demo}>
        <option value="">Select HMB stream</option>
        {p.demo ? <option value={p.metadata.stream}>{p.referenceExample.streamLabel}</option> : <>
          {p.detached && !p.streams.includes(p.metadata.stream) && <option value={p.metadata.stream}>Saved / Stream {p.metadata.stream}</option>}
          {p.streams.map((stream) => <option key={stream} value={stream}>Feed / Stream {stream}</option>)}
        </>}
      </select></label>
      <hr /><h3>{p.demo ? 'Operating cases' : legacyBasis ? 'Historical cases' : 'Comparison columns'}</h3>
      <div className="eq-case-list" role="radiogroup" aria-label="Operating cases">
        {p.sources.map((item) => <label className={`eq-case${source?.id === item.id ? ' is-selected' : ''}`} key={item.id}>
          <span className={`eq-link-icon${item.comparisonColumn && !item.sourceCaseId ? ' is-missing' : ''}`}>{item.comparisonColumn && !item.sourceCaseId ? <Info /> : <Link2 />}</span><span className="eq-case-text"><strong>{item.name}</strong><small title={item.sourceCaseName || item.fileName}>Source: {item.sourceCaseName || item.fileName.replace(/\.xlsx$/i, '')}</small></span>
          <input type="radio" name={`${id}-case`} checked={source?.id === item.id} aria-label={item.name} onChange={() => p.onCase(item.id)} />
        </label>)}
        {!p.sources.length && <p className="eq-empty">Select a stream from Cross-case comparison or reopen a saved revision.</p>}
      </div>
      <div className={`eq-source-status${complete ? '' : ' is-incomplete'}`}><CheckCircle2 /><div><strong>{complete ? 'Sources linked' : p.automatic && !p.demo ? 'NA: source data pending' : 'Sources incomplete'}</strong><small>{p.selected.length} of {p.sources.length} {p.demo || legacyBasis ? 'cases' : 'comparison columns'}</small></div></div>
      {!p.demo && <button className="eq-history-link" type="button" onClick={() => setHistoryOpen(true)}>Saved snapshots ({p.archives.length})</button>}
    </div>
    <div className="eq-pane eq-process">
      <header><h2>Process sizing</h2><p>{p.demo ? 'HMB-linked inputs and editable design criteria.' : 'HMB source units · Workbook units for calculation.'}</p></header>
      <div className="eq-tabs" role="tablist" aria-label="Process sizing tabs">
        {TABS.map(([key, label], index) => <button type="button" key={key} role="tab" id={`${id}-tab-${key}`} aria-controls={`${id}-panel-${key}`} aria-selected={p.tab === key} tabIndex={p.tab === key ? 0 : -1}
          ref={(element) => { tabsRef.current[index] = element }} onKeyDown={(event) => tabKey(event, index)} onClick={() => p.setTab(key)}>{label}</button>)}
      </div>
      <div className="eq-process-scroll">
        {p.error && <p className="eq-error" role="alert">{p.error}</p>}
        {p.unitErrors.length > 0 && <p className="eq-error" role="alert">Unit cross-check incomplete: {p.unitErrors.join(' ')} Relink to the current comparison if this revision lacks unit evidence.</p>}
        {p.archiveError && <p className="eq-error" role="alert">{p.archiveError}</p>}
        {p.savedMessage && <p className="eq-notice" role="status">{p.savedMessage}</p>}
        {p.stale && <p className="eq-warning" role="status">Inputs or criteria changed. Previous results require recalculation.</p>}
        {p.historical && <div className="eq-warning"><h3>Historical snapshot - confirmation and recalculation required</h3><p>Saved {p.historical.snapshot.saved_at} · {p.historical.snapshot.calculator_version}. Sources restored; not linked to current HMB imports.</p></div>}
        {legacyBasis && <div className="eq-warning"><p>This revision used the previous per-case basis. Import its HMB workbooks and relink to the current Cross-case comparison before sizing.</p><button type="button" disabled={!p.streams.includes(p.metadata.stream)} onClick={() => p.onStream(p.metadata.stream)}>Relink to Cross-case comparison</button></div>}
        {!p.schema ? <div className="eq-empty"><h3>{p.error ? 'Sizing integration unavailable' : 'Loading sizing workspace…'}</h3><button type="button" onClick={p.onRetry}>Load / retry calculator criteria</button></div> : <>
          <section role="tabpanel" id={`${id}-panel-inputs`} aria-labelledby={`${id}-tab-inputs`} hidden={p.tab !== 'inputs'}>
            <div className="eq-mapping-banner"><Info /><strong>{p.demo ? 'Linked to HMB snapshot · Rev 03' : p.historical ? legacyBasis ? 'Historical per-case snapshot' : 'Linked to saved comparison snapshot' : source ? 'Linked to Cross-case comparison' : 'No comparison stream linked'}</strong><button type="button" onClick={() => setMappingOpen(true)}>Review mapping <ExternalLink /></button></div>
            <div className="eq-segment-row"><strong>Case</strong><div className="eq-segments" role="group" aria-label="Select operating case">{displayedCases.map((item) => <button key={item.id} type="button" aria-pressed={item.id === source?.id} onClick={() => p.onCase(item.id)}>{item.name}</button>)}</div></div>
            <div className="eq-card">
              <h3>Operating conditions</h3>
              <div className="eq-two-fields">
                <div><label className="eq-field-label" htmlFor={`${id}-pressure`}>Operating pressure</label>{field('pressure')}<small className="eq-source-label">Source: {source?.fileName.replace(/\.xlsx$/i, '') || 'Missing'}</small></div>
                <div><label className="eq-field-label" htmlFor={`${id}-temperature`}>Temperature</label>{field('temperature')}<small className="eq-source-label">Source: {source?.fileName.replace(/\.xlsx$/i, '') || 'Missing'}</small></div>
              </div>
            </div>
            <div className="eq-card">
              <h3>Phase properties</h3>
              <div className="eq-table-scroll"><table className="eq-phase-table"><thead><tr><th>Property</th><th>Gas</th><th>Oil</th><th>Water</th></tr></thead>
                <tbody>
                  <tr><th scope="row">Flow rate</th><td>{field('gas_flow', true)}</td><td>{field('oil_flow', true)}</td><td>{field('water_flow', true)}</td></tr>
                  <tr><th scope="row">Density</th><td title="HMB source density only. Workbook gas density is computed in Calculations from pressure, temperature, MW and Z.">{typeof gasDensity !== 'number' || !Number.isFinite(gasDensity) ? <span className="eq-missing">{p.automatic && !p.demo ? 'NA' : 'Missing'}</span> : formatValue(gasDensity)} <small>{gasDensityUnit}</small></td><td>{field('oil_density', true)}</td><td>{field('water_density', true)}</td></tr>
                  <tr><th scope="row">Viscosity</th><td>{field('gas_viscosity', true)}</td><td>{field('oil_viscosity', true)}</td><td>{field('water_viscosity', true)}</td></tr>
                </tbody>
              </table></div>
              <div className="eq-two-fields"><div><label className="eq-field-label" htmlFor={`${id}-gas_mw`}>Gas molecular weight</label>{field('gas_mw')}</div><div><label className="eq-field-label" htmlFor={`${id}-gas_z`}>Z factor</label>{field('gas_z')}</div></div>
            </div>
            <div className="eq-provenance"><Info /><span>Source: {source?.comparisonColumn || provenanceName} · {source?.sourceCaseName || ''} · Stream {p.metadata.stream || 'not selected'} · {p.demo ? 'Units normalized.' : 'Source units retained; converted for calculation.'}</span></div>
          </section>
          <section role="tabpanel" id={`${id}-panel-criteria`} aria-labelledby={`${id}-tab-criteria`} hidden={p.tab !== 'criteria'}>
            <h3>Design criteria</h3><p className="eq-subtle">Editable workbook criteria. Margins are fractions (0.1 = 10%). Confirm standard gas conditions and project specifications.</p>
            {groups.filter(([, entries]) => entries.length).map(([title, entries]) => <details className="eq-card" key={title} open><summary>{title}</summary><div className="eq-criteria-grid">{entries.map(([key, spec]) => <label className="eq-label" key={key}>{spec.label} ({UNIT_LABELS[spec.unit] || spec.unit})<input type="number" step="any" value={p.criteria[key] ?? (p.demo ? spec.default : '')} readOnly={p.demo} onChange={(event) => p.onCriterion(key, event.target.value)} /></label>)}</div></details>)}
          </section>
          <section role="tabpanel" id={`${id}-panel-calculations`} aria-labelledby={`${id}-tab-calculations`} hidden={p.tab !== 'calculations'}>
            <h3>{p.result ? `Result: ${p.result.status}` : p.demo ? 'Example calculations' : 'No current calculation'}</h3>
            {!result ? <p>Review mapping and criteria, confirm the basis, then run sizing.</p> : result.cases.map((item) => <div className="eq-card" key={item.id}><h3>{item.name}</h3><span className="eq-calculated">Calculated values / not editable</span>
              <dl>{CALCULATED_METRICS.map(([label, key, unit]) => <div key={key}><dt>{label}</dt><dd>{item[key] === undefined ? 'Not reported' : item[key] === null ? 'Not applicable' : `${formatValue(item[key])} ${unit}`}</dd></div>)}
                {Object.entries(item.settling || {}).map(([key, val]) => <div key={key}><dt>Settling: {key}</dt><dd>{val === null ? 'Not applicable' : `${formatValue(val)} ${key.endsWith('_re') ? '(dimensionless Re)' : 'min'}`}</dd></div>)}
              </dl>
              <ul>{item.warnings.map((warning) => <li key={warning} className="eq-subtle">{warning}</li>)}</ul>
            </div>)}
          </section>
          <section role="tabpanel" id={`${id}-panel-datasheet`} aria-labelledby={`${id}-tab-datasheet`} hidden={p.tab !== 'datasheet'}>
            <SeparatorDatasheet metadata={p.metadata} result={result} inputCases={p.normalizedCases.filter((item) => p.selected.some((selected) => selected.id === item.id))} onDocument={p.onDocument} onTag={p.onTag} onService={p.onService} demo={p.demo} automatic={p.automatic} />
          </section>
        </>}
      </div>
      <footer className="eq-action-bar">
        {p.automatic && !p.demo ? <>
          <span className={complete && !legacyBasis ? 'eq-complete' : 'eq-incomplete'}>{p.busy ? 'Calculating preview…' : p.error ? 'Preview failed; review the error above.' : result ? 'Automatic preview updated' : 'NA: waiting for required source data / valid units'}</span>
          <button type="button" disabled={!p.metadata.stream} onClick={() => p.onStream(p.metadata.stream)}>Rematch source stream</button>
        </> : <>
        <span className={complete && !legacyBasis ? 'eq-complete' : 'eq-incomplete'}>{complete && !legacyBasis ? <CheckCircle2 /> : <AlertTriangle />} {legacyBasis ? 'Relink required' : complete ? 'Mapping complete' : 'Mapping incomplete'}</span>
        <div className="eq-run-controls">
          <div className="eq-run-buttons">
            {!p.demo && p.schema && !p.confirmed && <button type="button" onClick={() => setMappingOpen(true)}>Review &amp; confirm</button>}
            <button className="eq-primary" type="button" disabled={runBlockers.length > 0} aria-describedby={!p.demo && runBlockers.length ? `${id}-run-blockers` : undefined} title={runBlockers.join(' ')} onClick={p.onRun}><Play />{p.busy ? 'Sizing…' : 'Run sizing'}</button>
          </div>
          {!p.demo && runBlockers.length > 0 && <ul id={`${id}-run-blockers`} className="eq-run-blockers">{runBlockers.map((reason) => <li key={reason}>{reason}</li>)}</ul>}
        </div>
        </>}
      </footer>
    </div>
    <aside className="eq-pane eq-analysis" aria-label="Sizing analysis">
      <div className="eq-analysis-title"><h2>Sizing analysis</h2>{p.demo && <small>Example results</small>}</div>
      {!p.demo && <p className="eq-analysis-empty">{p.automatic ? 'Unapproved automatic engineering preview using current criteria. Required missing data leaves dependent results NA.' : !result ? 'Results appear after Run sizing succeeds. Mapping complete does not mean sizing has been run.' : ''}</p>}
      <span className={`eq-pass-badge${allPass && !p.stale ? '' : ' is-review'}`}>{allPass && !p.stale ? <Check /> : <Info />}{selectedStatus}</span>
      <div className="eq-selected-vessel"><h3>Selected vessel</h3>
        <div className="eq-vessel-dimensions"><div><strong>{result && !p.stale ? `${formatValue(result.diameter_m * 1000)} mm` : p.automatic && !p.demo ? 'NA' : '—'}</strong><span>Inside diameter</span></div><div><strong>{result && !p.stale ? `${formatValue(result.length_m * 1000)} mm` : p.automatic && !p.demo ? 'NA' : '—'}</strong><span>T-T length</span></div></div>
        <hr /><div className="eq-vessel-driver"><div><span>Governing case</span><strong>{result && !p.stale ? result.governing_case : p.automatic && !p.demo ? 'NA' : 'Awaiting calculation'}</strong></div><div><span>Driver</span><strong>{result && !p.stale ? driver || 'See calculations' : p.automatic && !p.demo ? 'NA' : 'Awaiting calculation'}</strong></div></div>
      </div>
      <dl className="eq-design-summary"><div><dt>Design pressure</dt><dd>{result?.preliminary?.design_pressure_barg !== undefined && !p.stale ? `${formatValue(result.preliminary.design_pressure_barg)} barg` : 'Not calculated'}</dd></div><div><dt>Design temperature</dt><dd>{result?.preliminary?.design_temperature_c !== undefined && !p.stale ? `${formatValue(result.preliminary.design_temperature_c)} °C` : 'Not calculated'}</dd></div></dl>
      <h3>Verification</h3><div className="eq-verification">{['Gas capacity', 'Liquid retention', 'Phase separation'].map((label, index) => {
        const status = p.automatic && !p.demo && (!result || p.stale) ? 'NA' : p.stale ? 'Recalculate' : checks[index]
        return <div key={label} className={status === 'Passed' ? 'is-passed' : ''}>{status === 'Passed' ? <Check /> : status === 'Not run' ? <Circle /> : <Info />}<strong>{label}</strong><span>{status}</span></div>
      })}</div>
      <div className="eq-warning"><AlertTriangle /><strong>Preliminary mechanical sizing.</strong></div>
      <div className="eq-next-action"><Layers /><strong>Review design criteria then save revision.</strong><button type="button" onClick={() => p.setTab('criteria')}>Open design criteria</button></div>
      {!p.demo && <p className="eq-qualification">Engineering aid only. No code-compliance claim. {saveReason || 'Unsaved changes are session-only.'}</p>}
      {p.demo && <p className="eq-qualification">Isolated reference example. Saving, export and sizing are disabled.</p>}
    </aside>
    {dialogOpen && <div className="eq-dialog-backdrop"><section ref={dialogRef} className="eq-dialog" role="dialog" aria-modal="true" aria-label={p.pendingOpen ? 'Replace separator sizing inputs' : historyOpen ? 'Saved separator snapshots' : 'Review mapping'} tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === 'Escape') { setMappingOpen(false); setHistoryOpen(false); p.onPendingOpen(null) }
        if (event.key !== 'Tab') return
        const controls = [...dialogRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]')]
        const first = controls[0], last = controls[controls.length - 1]
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) { event.preventDefault(); first?.focus() }
      }}>
      <button className="eq-dialog-close" aria-label="Close panel" type="button" onClick={() => { setMappingOpen(false); setHistoryOpen(false); p.onPendingOpen(null) }}><X /></button>
      {p.pendingOpen ? <><h2>Replace separator sizing inputs</h2><p>Replace unsaved sizing edits with historical inputs? Imported HMB cases remain unchanged.</p><button type="button" onClick={() => { p.onOpenSnapshot(p.pendingOpen); setHistoryOpen(false) }}>Replace sizing inputs</button><button type="button" onClick={() => p.onPendingOpen(null)}>Cancel reopening</button></> : historyOpen ? <>
        <h2>Saved separator snapshots</h2><p>{p.projectId ? `Selected project: ${p.projectId}` : 'Select a project in Project Organizer.'}</p>
        {p.onRefreshProject && <button type="button" onClick={p.onRefreshProject}>Refresh selected project</button>}<button type="button" disabled={!p.projectId || !!p.archiveBusy} onClick={p.onRefreshHistory}>Refresh separator history</button>
        {!p.archives.length && <p>No separator snapshots listed for this project.</p>}<ul>{p.archives.map((item) => <li key={item.id}>{item.tag} · {item.created_at} · {item.calculator_version} <button type="button" disabled={!p.schema || !!p.archiveBusy || p.busy} onClick={() => p.onPendingOpen(item)}>Reopen {item.tag}</button></li>)}</ul>
      </> : <><h2>Review mapping</h2><p>Max Liquid is labelled Max Oil. Each column retains its full governing case. Editable values and units come from Cross-case comparison; Run sizing converts them to the Input-sheet units of the attached workbook.</p>
        <div className="eq-card"><h3>How the Excel workbook maps to this workspace</h3><p>Input → Inputs · Design Criteria → Design Criteria · Calculation → Calculations · Data Sheet → Datasheet.</p><p>The workbook is the engineering template, not an embedded spreadsheet. Export Excel generates a four-sheet calculation snapshot with source-unit provenance; it does not execute or reproduce every original Excel formula/layout.</p><p>Workbook flow margins are percentage-formatted: 0.1 means 10%. Gas density in the Inputs table is HMB reference data; the workbook calculates its own gas density from MW, Z, pressure and temperature.</p></div>
        <label className="eq-confirm"><input type="checkbox" checked={p.confirmed} disabled={p.demo} onChange={(event) => p.onConfirm(event.target.checked)} />I confirm the selected cases, phase identities, gas reference conditions, source-to-workbook unit conversions (including HYSYS MW convention), overrides and criteria. Results are not approved design.</label>
        <button type="button" onClick={() => setMappingOpen(false)}>Done reviewing mapping</button>
        {p.detached && <button type="button" disabled={!p.streams.includes(p.metadata.stream)} onClick={() => { p.onStream(p.metadata.stream); setMappingOpen(false) }}>Use current comparison units</button>}
        {gaps.length > 0 && <p className="eq-warning">Missing required properties: {gaps.join(', ')}</p>}
        {p.sources.map((item) => <div className="eq-card" key={item.id}><strong>{item.name}</strong><p>{item.comparisonColumn ? `${item.comparisonColumn} / ${item.sourceCaseName || 'Missing governing case'} / ` : ''}{item.fileName} / {item.sheetName}</p><label><input type="checkbox" checked={!p.excluded.includes(item.id)} disabled={p.demo} onChange={(event) => p.onExclude(item.id, event.target.checked)} />Include {item.name} in sizing envelope</label>
          <div className="eq-table-scroll"><table className="eq-unit-table"><thead><tr><th>Property</th><th>Comparison/source unit</th><th>Workbook unit</th><th>Cross-check</th></tr></thead><tbody>
            {p.unitMappings.filter((entry) => entry.caseId === item.id).map((entry) => <tr key={entry.key}><th>{p.schema?.inputs[entry.key]?.label || entry.key}</th><td>{entry.sourceUnit}</td><td>{entry.calculationUnit}</td><td>{!entry.supported ? 'Unsupported / missing unit' : entry.note && !p.confirmed ? 'Confirm convention / basis' : 'Verified conversion'}{entry.note && <small className="eq-unit-note">{entry.note}</small>}</td></tr>)}
          </tbody></table></div>
          <dl>{Object.entries(item.mapping).map(([key, mapped]) => {
            const normalized = p.normalizedCases.find((entry) => entry.id === item.id)?.inputs[key]
            return <div key={key}><dt>{p.schema?.inputs[key]?.label || key}</dt><dd>{normalized === null || normalized === undefined ? 'Missing' : formatValue(normalized)} {p.schema?.inputs[key]?.unit} ({p.excluded.includes(item.id) ? 'not submitted' : 'calculation input'}) · {mapped.source ? `${mapped.source.property} (${mapped.source.unit})${mapped.source.edited ? ' / HMB override' : ''}` : 'No source'}</dd></div>
          })}</dl>
        </div>)}
      </>}
    </section></div>}
  </section>
}
