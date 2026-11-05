import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import SeparatorSizingPanel from '../../src/pages/Engineering/Process/HMBStreamTableConsolidator/SeparatorSizingPanel'
import '../../src/index.css'

const property = (section, name, unit, value) => ({ section, name, unit, value, edited: false })
const cases = [{ id: 'a', name: 'Case A', fileName: 'a.xlsx', sheetName: 'Streams',
  streams: [{ name: '1032', included: true, properties: [
    property('', 'Pressure', 'psig', 20 / .0689475729318), property('', 'Temperature', 'F', 140),
    property('Vapour', 'Std Gas Flow', 'MMSCFD', 30),
    property('Vapour', 'Molecular Weight', '<none>', 20),
    property('Vapour', 'Compressibility', '<none>', .92),
    property('Light Liquid', 'Actual Volume Flow', 'ft3/hr', 200 / .028316846592),
    property('Light Liquid', 'Mass Density', 'lb/ft3', 820 / 16.01846337396),
    property('Light Liquid', 'Viscosity', 'cP', 3),
    property('Heavy Liquid', 'Actual Volume Flow', 'ft3/hr', 50 / .028316846592),
    property('Heavy Liquid', 'Mass Density', 'lb/ft3', 1030 / 16.01846337396),
    property('Heavy Liquid', 'Viscosity', 'cP', .5),
  ] }],
}]

function Fixture() {
  const [active, setActive] = useState(true)
  const params = new URLSearchParams(window.location.search)
  const displayedCases = params.get('precision') === '1' ? [{
    ...cases[0], streams: [{ ...cases[0].streams[0], properties: cases[0].streams[0].properties.map((item) => {
      if (item.name === 'Pressure') return { ...item, value: 6.205291562362 / .0689475729318 }
      if (item.section === 'Light Liquid' && item.name === 'Actual Volume Flow') return { ...item, value: 1.6874008884 / .028316846592 }
      if (item.section === 'Vapour' && item.name === 'Std Gas Flow') return { ...item, value: 4.145e-9 }
      return item
    }) }],
  }] : params.get('cases') === '12'
    ? Array.from({ length: 12 }, (_, index) => ({ ...cases[0], id: `case-${index + 1}`, name: `Case ${index + 1}` }))
    : cases
  return <main className="equipment-test-fixture"><h1>Separator sizing test</h1>
    <button type="button" onClick={() => setActive((value) => !value)}>Toggle sizing visibility</button>
    <div hidden={!active}><SeparatorSizingPanel cases={displayedCases} active={active} automatic={params.get('automatic') === '1'} projectId="11111111-1111-4111-8111-111111111111" /></div>
    <style>{`.equipment-test-fixture { height:100dvh; display:flex; flex-direction:column; } .equipment-test-fixture > div { flex:1; min-height:0; overflow:auto; }`}</style>
  </main>
}
createRoot(document.getElementById('root')).render(<Fixture />)
