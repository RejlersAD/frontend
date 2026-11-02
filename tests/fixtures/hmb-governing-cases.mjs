// Stream 1032 criterion regression values; other properties are synthetic markers.
const rates = [
  ['A1b', 12070, 4.959, 308200, 5874, 1137000, 1458000],
  ['A2a', 8473, 3.183, 167900, 3254, 1385000, 1562000],
  ['A2a - Rev 1', 8473, 3.183, 167900, 3254, 1385000, 1562000],
  ['A2b', 6796, 2.784, 169200, 3228, 1386000, 1562000],
  ['B1a', 14900, 5.632, 305800, 5923, 1137000, 1458000],
  ['B1b', 12070, 4.959, 308200, 5874, 1137000, 1458000],
  ['B2a', 8473, 3.183, 167900, 3254, 1385000, 1562000],
  ['B2b', 6796, 2.784, 169200, 3228, 1386000, 1562000],
]

export function make1032Cases() {
  return rates.map(([name, gasMass, gasFlow, liquidMass, liquidFlow, waterMass, totalMass], index) => {
    const p = (name, unit, value, section = '') => ({ name, unit, value, edited: false,
      ...(section ? { section, phase: { Vapour: 'Vapour Phase', 'Light Liquid': 'Liquid Phase', 'Heavy Liquid': 'Aqueous Phase' }[section] } : {}) })
    const phase = (section, mass, flow, offset) => [
      p('Mass Flow', 'lb/hr', mass, section),
      // Each phase has a gas-equivalent flow. Only the Vapour value governs gas.
      p('Std. Gas Flow', 'MMSCFD', section === 'Vapour' ? gasFlow : 700 + index, section),
      p('Std Ideal Liq Vol Flow', 'barrel/day', 10000 + offset, section),
      p('Act. Liq. Flow', 'ft3/hr', flow, section),
      p('Act. Volume Flow', 'barrel/day', flow * 24 / 5.614583333333333, section),
      p('Molecular Weight', '', 20 + offset, section),
      p('Mass Density', 'lb/ft3', 0.5 + offset, section),
      p('Viscosity', 'cP', 0.01 + offset, section),
      p('Thermal Conductivity', 'Btu/hr-ft-F', 0.02 + offset, section),
      p('Mass Heat Capacity', 'Btu/lb-F', 0.4 + offset, section),
      p('Z Factor', '', 0.95 + index / 1000, section),
      p('Cp/Cv Ent. Method', '', 1.2 + index / 100, section),
      ...(section === 'Vapour' ? [p('Actual Volume Flow', 'ft3/hr', 12000 + index, section)] : []),
    ]
    return {
      id: name, name, fileName: `${name}.xlsx`, sheetName: 'Streams', color: '#005bff',
      streams: [{ name: '1032', included: true, properties: [
        p('Temperature', 'F', 100 + index), p('Pressure', 'psig', 150),
        p('Molecular Weight', '', 19 + index), p('Mass Flow', 'lb/hr', totalMass),
        p('Vapour / Phase Fraction', '', 0.004 + index / 1000),
        p('Std. Gas Flow', 'MMSCFD', totalMass / 1000),
        p('Act. Liq. Flow', 'ft3/hr', totalMass / 10),
        ...phase('Vapour', gasMass, 100 + index, index),
        ...phase('Light Liquid', liquidMass, liquidFlow, 10 + index),
        ...phase('Heavy Liquid', waterMass, 20000 + index, 20 + index),
        p('H2O', 'mol frac.', 0.9 + index / 100, 'Composition'),
        p('Methane', 'mol frac.', 0.01 + index / 1000, 'Composition'),
      ] }],
    }
  })
}

export const templateRows = [
  { section: '', name: 'Temperature', unit: 'F' },
  { section: '', name: 'Mass Flow', unit: 'lb/hr' },
  { section: '', name: 'Vapour Fraction', unit: '<none>' },
  ...['Vapour', 'Light Liquid', 'Heavy Liquid'].flatMap(section => [
    { section, name: 'Mass Flow', unit: 'lb/hr' },
    { section, name: 'Molecular Weight', unit: '<none>' },
    { section, name: 'Viscosity', unit: 'cP' },
    { section, name: 'Actual Volume Flow', unit: 'ft3/hr' },
    { section, name: 'Actual Volume Flow', unit: 'barrel/day' },
    { section, name: 'Compressibility', unit: '<none>' },
    { section, name: 'Cp/Cv (Gamma)', unit: '<none>' },
  ]),
  { section: 'Vapour', name: 'Std Gas Flow', unit: 'MMSCFD' },
  { section: 'Composition', name: 'H2O', unit: 'mol frac.' },
  { section: 'Composition', name: 'Methane', unit: 'mol frac.' },
]
