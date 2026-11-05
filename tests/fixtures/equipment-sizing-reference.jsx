import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import SeparatorSizingPanel from '../../src/pages/Engineering/Process/HMBStreamTableConsolidator/SeparatorSizingPanel'
import '../../src/index.css'

const inputSpecs = {
  pressure: ['Operating pressure', 'barg'], temperature: ['Operating temperature', 'C'],
  gas_flow: ['Standard gas flow', 'MMSCFD'], gas_mw: ['Gas molecular weight', 'kg/kmol'], gas_z: ['Gas Z', '-'], gas_viscosity: ['Gas viscosity', 'cP'],
  oil_flow: ['Actual oil flow', 'm3/h'], oil_density: ['Oil density', 'kg/m3'], oil_viscosity: ['Oil viscosity', 'cP'],
  water_flow: ['Actual water flow', 'm3/h'], water_density: ['Water density', 'kg/m3'], water_viscosity: ['Water viscosity', 'cP'],
}
const keys = Object.keys(inputSpecs)
const exampleCases = [
  ['Max Oil', [20, 60, 30, 20, .92, .012, 200, 820, 3, 50, 1030, .5], 16.49],
  ['Max Water', [20, 65, 25, 20.5, .92, .012, 120, 825, 3.5, 220, 1035, .48], 16.65],
  ['Max Gas', [20, 55, 60, 19.5, .91, .012, 150, 815, 2.8, 80, 1030, .52], 16.5],
]
const sources = exampleCases.map(([name, values, density], index) => ({
  id: `example-${index}`, name, fileName: `HYSYS – Case 0${index + 1}.xlsx`, sheetName: 'Streams', streamName: '101',
  gasDensity: { value: density, source: null },
  mapping: Object.fromEntries(keys.map((key, position) => [key, { value: values[position], source: {
    property: inputSpecs[key][0], section: '', unit: inputSpecs[key][1], value: values[position], edited: false,
  } }])),
}))
const example = {
  metadata: { tag: 'V-1001', service: 'HP Production Separator', stream: '101' },
  streamLabel: 'Feed / Stream 101', selectedCaseId: 'example-1', sources,
  schema: { version: 'reference-example', inputs: Object.fromEntries(Object.entries(inputSpecs).map(([key, [label, unit]]) => [key, { label, unit }])),
    criteria: { oil_retention: { label: 'Oil retention time', unit: 'min', default: 5 }, water_retention: { label: 'Water retention time', unit: 'min', default: 5 } }, nozzle_table: [] },
  result: { version: 'reference-example', status: 'OK', diameter_m: 2.8, length_m: 11.2, governing_case_id: 'example-1', governing_case: 'Max Water',
    cases: sources.map((item) => ({ id: item.id, name: item.name, status: 'OK', control: 'Liquid retention', warnings: [] })),
    preliminary: { design_pressure_barg: 22, design_temperature_c: 90, warnings: [] }, levels_mm: {}, nozzles: {} },
}
function Reference() {
  const [host, setHost] = useState(null)
  return <main className="reference-workspace">
    <header><h1>HMB Workspace</h1></header>
    <nav aria-label="Reference workspace tabs"><span>Review</span><span>Compare</span><strong>Equipment Sizing</strong><span>Saved</span><div ref={setHost} /></nav>
    <div className="reference-content"><SeparatorSizingPanel cases={[]} active referenceExample={example} actionHost={host} /></div>
    <style>{`
      .reference-workspace { position:absolute; top:48px; left:208px; right:0; bottom:0; display:flex; flex-direction:column; color:#102449; }
      .reference-workspace > header { display:flex; justify-content:space-between; align-items:center; height:38px; flex-shrink:0; padding:4px 20px; }
      .reference-workspace h1 { font-size:24px; font-weight:650; }
      .reference-workspace > nav { display:flex; align-items:center; gap:28px; height:38px; padding:0 28px; font-size:13px; border-bottom:1px solid #d8e2ef; }
      .reference-workspace > nav strong { color:#075bff; height:38px; padding:10px 0; border-bottom:2px solid #075bff; }
      .reference-workspace > nav > div { margin-left:auto; transform:translateY(-6px); }
      .reference-content { flex:1; min-height:0; }
      @media(max-width:650px) { .reference-workspace { top:0; left:0; } }
    `}</style>
  </main>
}
createRoot(document.getElementById('root')).render(<Reference />)
