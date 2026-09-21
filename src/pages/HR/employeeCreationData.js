export const DEFAULT_COMPANY = 'Rejlers International Engineering Solutions AB'
export const EMPLOYEE_STEPS = ['Personal details', 'Organisation', 'Employment', 'Review & create']

export function employeeDefaults() {
  return {
    first_name: '', surname: '', preferred_given_name: '', country: 'United Arab Emirates',
    mobile_phone: '', manager_id: '', email: '', company: DEFAULT_COMPANY,
    business_unit: '', division: '', business_area: '', office: '', job_title_uae: '',
    job_title_finland: '', joining_date: '', branch: 'RAD', notes: '',
  }
}

const fieldsByStep = [
  { first_name: 'First name', surname: 'Surname', country: 'Country', mobile_phone: 'Personal mobile number', manager_id: 'Reporting manager' },
  { business_unit: 'Business unit', division: 'Division', business_area: 'Business area', office: 'Office', job_title_uae: 'Job title (UAE)' },
  { joining_date: 'Joining date', branch: 'Branch' },
]

export function validateEmployeeStep(data, step) {
  const errors = {}
  const fields = step === 3 ? Object.assign({}, ...fieldsByStep) : fieldsByStep[step]
  Object.entries(fields || {}).forEach(([key, label]) => {
    if (!String(data[key] || '').trim()) errors[key] = `${label} is required`
  })
  if ((step === 0 || step === 3) && data.mobile_phone && !/^\+9715\d{8}$/.test(data.mobile_phone)) {
    errors.mobile_phone = 'Enter a UAE mobile number: +971 followed by 9 digits starting with 5'
  }
  if ((step === 2 || step === 3) && data.joining_date) {
    const date = new Date(`${data.joining_date}T00:00:00Z`)
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== data.joining_date) errors.joining_date = 'Enter a valid joining date'
  }
  if ((step === 2 || step === 3) && !['RAD', 'RIN'].includes(data.branch)) errors.branch = 'Select a valid branch'
  return errors
}

export function employeeReadiness(data) {
  const has = key => Boolean(String(data[key] || '').trim())
  return [
    { label: 'Personal identity', checks: ['first_name', 'surname', 'country'].map(has) },
    { label: 'Contact information', checks: [/^\+9715\d{8}$/.test(data.mobile_phone), has('manager_id')] },
    { label: 'Organisation', checks: ['company', 'business_unit', 'division', 'business_area', 'office'].map(has) },
    { label: 'Employment details', checks: [has('joining_date'), has('branch'), has('job_title_uae'), true] },
  ].map(row => ({ label: row.label, done: row.checks.filter(Boolean).length, total: row.checks.length }))
}

export function readEmployeeDraft(raw) {
  try {
    const draft = JSON.parse(raw)
    if (draft.version !== 1 || !draft.data || typeof draft.data !== 'object') return null
    const data = employeeDefaults()
    Object.keys(data).forEach(key => {
      if (typeof draft.data[key] === 'string') data[key] = draft.data[key]
    })
    data.company = DEFAULT_COMPANY
    return { data, step: Number.isInteger(draft.step) ? Math.max(0, Math.min(3, draft.step)) : 0, savedAt: draft.savedAt, hadPhoto: Boolean(draft.hadPhoto) }
  } catch { return null }
}

export function serializeEmployeeDraft(data, step, hadPhoto) {
  const allowed = employeeDefaults()
  Object.keys(allowed).forEach(key => { allowed[key] = String(data[key] ?? '') })
  return JSON.stringify({ version: 1, data: allowed, step, hadPhoto, savedAt: new Date().toISOString() })
}

const regions = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ')
const displayNames = new Intl.DisplayNames(['en'], { type: 'region' })
export const EMPLOYEE_COUNTRIES = regions.map(code => displayNames.of(code)).filter(Boolean).sort((a, b) => a.localeCompare(b))
