export const DOCUMENT_FIELDS = [
  ['project', 'Project'], ['client', 'Client'], ['documentNo', 'Document No.'],
  ['revision', 'Revision'], ['date', 'Date'], ['preparedChecked', 'Prepared / Checked'],
  ['quantity', 'Quantity'], ['designCode', 'Design code'], ['sizingBasis', 'Process sizing basis'],
  ['inletDevice', 'Inlet device'], ['mistEliminator', 'Mist eliminator'],
  ['liquidOutlets', 'Liquid outlets'], ['otherInternals', 'Other internals'],
]
export const DOCUMENT_DEFAULTS = {
  project: '', client: '', documentNo: '', revision: '', date: '', preparedChecked: '',
  quantity: '1', designCode: 'ASME Sec. VIII Div. 1',
  sizingBasis: 'API 12J / GPSA Sec. 7 / Arnold & Stewart',
  inletDevice: '', mistEliminator: '', liquidOutlets: '', otherInternals: '',
}

export function separatorDatasheet(metadata, result, inputCases = []) {
  const d = { ...DOCUMENT_DEFAULTS, ...metadata.document }
  const c = result?.criteria || {}
  const mechanical = result?.preliminary || {}
  const governing = result?.cases.find((item) => item.id === result.governing_case_id)
  const cases = result?.cases || inputCases
  const caseNames = cases.length ? cases.map((item) => item.name) : ['Max Oil', 'Max Water', 'Max Gas']
  const single = (label, unit, value) => ({ label, unit, values: [value ?? 'Not calculated'] })
  const input = (label, value) => ({ label, unit: '-', values: [value || 'Not configured'] })
  const envelope = (label, unit, getter, designGetter = getter) => ({
    label, unit, values: [...(cases.length ? cases.map((item) => getter(item) ?? (result ? null : 'Not calculated')) : caseNames.map(() => 'Not calculated')), governing ? designGetter(governing) : 'Not calculated'],
  })
  const levels = result?.levels_mm || {}
  const nil = governing?.nil_mm
  const level = (offset) => nil === null || nil === undefined || !Number.isFinite(offset) ? null : Math.max(nil + offset, 0)
  const nils = cases.map((item) => item.nil_mm).filter((value) => typeof value === 'number')
  const gasUtilizations = cases.map((item) => item.gas_utilization).filter((value) => typeof value === 'number')
  const percentage = (value) => typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : 'Not calculated'
  return {
    header: [
      input('Project', d.project), input('Client', d.client), input('Equipment Tag', metadata.tag),
      input('Service', metadata.service), input('Document No.', d.documentNo),
      input('Revision', d.revision), input('Date', d.date), input('Prepared / Checked', d.preparedChecked),
    ],
    sections: [
      { title: '1. GENERAL', rows: [
        input('Equipment tag', metadata.tag), input('Service', metadata.service),
        input('Type / orientation', 'Three-phase separator / Horizontal'), input('Quantity', d.quantity),
        input('Design code', d.designCode), input('Process sizing basis', d.sizingBasis),
        single('Governing (design) case', '-', result?.governing_case),
        single('Controlling parameter', '-', governing?.control),
      ] },
      { title: '2. OPERATING CONDITIONS', columns: [...caseNames, 'DESIGN'], rows: [
        envelope('Operating pressure', 'barg', (item) => item.inputs?.pressure),
        envelope('Operating temperature', 'C', (item) => item.inputs?.temperature),
        envelope('Gas flow - normal', 'MMSCFD', (item) => item.inputs?.gas_flow),
        envelope('Gas flow - design (incl. margin)', 'MMSCFD', (item) => item.gas_design),
        envelope('Gas flow - design, actual', 'm3/h', (item) => typeof item.gas_actual === 'number' ? item.gas_actual * 3600 : null),
        envelope('Gas density - calculated', 'kg/m3', (item) => item.gas_density),
        ...['oil', 'water'].flatMap((phase) => [
          envelope(`${phase} flow - normal`, 'm3/h', (item) => item.inputs?.[`${phase}_flow`]),
          envelope(`${phase} flow - design (incl. margin)`, 'm3/h', (item) => item[`${phase}_design`]),
          envelope(`${phase} density`, 'kg/m3', (item) => item.inputs?.[`${phase}_density`]),
          envelope(`${phase} viscosity`, 'cP', (item) => item.inputs?.[`${phase}_viscosity`]),
        ]),
      ] },
      { title: '3. DESIGN CONDITIONS - PRELIMINARY', rows: [
        single('Design pressure', 'barg', mechanical.design_pressure_barg),
        single('Design temperature (max)', 'C', mechanical.design_temperature_c),
        single('Minimum design metal temperature', 'C', mechanical.mdmt_c),
        single('Hydrotest pressure', 'barg', mechanical.hydrotest_barg),
        single('Corrosion allowance', 'mm', c.corrosion),
        input('Shell / head material', mechanical.material_assumption),
        input('Design margin on flows (gas / oil / water)', result ? [c.gas_margin, c.oil_margin, c.water_margin].map(percentage).join(' / ') : ''),
      ] },
      { title: '4. VESSEL DIMENSIONS', rows: [
        single('Inside diameter (ID)', 'mm', result ? result.diameter_m * 1000 : null),
        single('Length tangent-to-tangent', 'mm', result ? result.length_m * 1000 : null),
        single('L/D ratio', '-', result ? result.length_m / result.diameter_m : null),
        input('Head type', '2:1 Semi-ellipsoidal'),
        single('Shell thickness (incl. CA) - preliminary', 'mm', mechanical.shell_mm),
        single('Head thickness (incl. CA) - preliminary', 'mm', mechanical.head_mm),
        single('Total internal volume', 'm3', mechanical.internal_volume_m3),
      ] },
      { title: '5. LIQUID LEVELS (FROM BOTTOM OF VESSEL)', rows: [
        ...['hhll', 'hll', 'nll', 'lll', 'llll'].map((key) => single(`${key.toUpperCase()} - total liquid`, 'mm', levels[key])),
        single('HHIL - interface', 'mm', result ? level(c.interface_trip) : null),
        single('HIL - interface', 'mm', result ? level(c.interface_alarm) : null),
        single('NIL - interface (design case)', 'mm', nil),
        single('LIL - interface', 'mm', result ? level(-c.interface_alarm) : null),
        single('LLIL - interface', 'mm', result ? level(-c.interface_trip) : null),
        single('NIL range over submitted cases', 'mm', nils.length ? `${Math.min(...nils)} - ${Math.max(...nils)}` : null),
      ] },
      { title: '6. PERFORMANCE', columns: [...caseNames, 'DESIGN'], rows: [
        envelope('Oil retention time (actual)', 'min', (item) => item.oil_retention),
        envelope('Water retention time (actual)', 'min', (item) => item.water_retention),
        envelope('Gas velocity / allowable (Souders-Brown)', '%', (item) => percentage(item.gas_utilization),
          () => gasUtilizations.length ? percentage(Math.max(...gasUtilizations)) : 'Not applicable'),
        envelope('Water-in-oil settling time', 'min', (item) => item.settling?.water_time),
        envelope('Oil-in-water rise time', 'min', (item) => item.settling?.oil_time),
        envelope('Overall check', '-', (item) => item.status, () => result?.status),
        single('Required oil / water retention', 'min', result ? `${c.oil_retention} / ${c.water_retention}` : null),
        single('Droplet removal: water from oil / oil from water', 'micrometre', result ? `${c.water_drop} / ${c.oil_drop}` : null),
      ] },
      { title: '7. INTERNALS - ENGINEER CONFIGURATION', rows: [
        input('Inlet device', d.inletDevice), input('Mist eliminator', d.mistEliminator),
        input('Liquid outlets', d.liquidOutlets), input('Other', d.otherInternals),
      ] },
      { title: '8. NOZZLE SCHEDULE', columns: ['Mark', 'Service', 'Qty', 'Size (NPS)', 'Req. ID (mm)', 'Rating (indicative)', 'Remarks'], schedule: [
        ...[['N1', 'Process inlet', 'inlet'], ['N2', 'Gas outlet', 'gas'], ['N3', 'Oil outlet', 'oil'], ['N4', 'Water outlet', 'water']].map(([mark, service, key]) => {
          const nozzle = result?.nozzles?.[key]
          return [mark, service, '1', nozzle?.nps ?? 'Not selected', nozzle?.required_mm ?? 'Not calculated',
            mechanical.ambient_flange_class || 'Not configured', nozzle?.status || 'Not calculated']
        }),
        ...[['N5', 'PSV connection'], ['N6', 'Drain'], ['N7', 'Vent'], ['N8', 'Level instruments (LT/LG)'],
          ['N9', 'Pressure / temperature instruments'], ['M1', 'Manway']].map(([mark, service]) =>
          [mark, service, 'Not configured', 'Not configured', 'Not configured', 'Not configured', mark === 'N5' ? 'Confirm by relief study' : 'Engineer/vendor configuration required']),
      ] },
      { title: '9. WEIGHTS (ESTIMATED)', rows: [
        single('Empty weight', 'kg', mechanical.empty_kg), single('Operating weight', 'kg', mechanical.operating_kg),
        single('Hydrotest weight', 'kg', mechanical.hydrotest_kg),
      ] },
      { title: '10. NOTES', rows: [
        input('1', 'Engineering aid only; no design approval or code-compliance certification.'),
        input('2', 'Checks cover submitted comparison columns, not every imported operating case.'),
        input('3', 'Interface settings are case-adjustable; review level compatibility.'),
        input('4', 'Weights and mechanical thicknesses are preliminary; confirm with the vessel vendor.'),
        input('5', 'Flange rating is indicative at ambient; verify material and design-temperature rating.'),
        input('6', 'Relief sizing and unconfigured connections require separate engineering review.'),
        ...(result?.cases || []).flatMap((item) => item.warnings.map((warning) => input(item.name, warning))),
      ] },
    ],
  }
}
