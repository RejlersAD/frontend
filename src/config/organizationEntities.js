/**
 * The two RADAI organizations, defined once (mirrors backend
 * apps/rbac/organization_entities.py). Stored values stay the codes RAD / RIN;
 * every label, dropdown and badge reads its name from here.
 */
export const ORGANIZATION_ENTITIES = [
  { code: 'RAD', name: 'Rejlers Abu Dhabi', country: 'United Arab Emirates' },
  { code: 'RIN', name: 'Rejlers India (RIN)', country: 'India' },
]

export const ORGANIZATION_NAMES = Object.fromEntries(ORGANIZATION_ENTITIES.map(e => [e.code, e.name]))
export const ORGANIZATION_NAME_LIST = ORGANIZATION_ENTITIES.map(e => e.name)
export const DEFAULT_ORGANIZATION_CODE = 'RAD'

/**
 * The organization id of a user/employee record. The API returns
 * ``organization`` as a plain id on detail records, an object elsewhere, or
 * ``organization_id``; read all three so forms never show it blank.
 */
export const organizationIdOf = record => {
  const org = record?.organization
  if (org && typeof org === 'object') return org.id ?? ''
  return org || record?.organization_id || ''
}

/** Display name for a code ('RAD' -> 'Rejlers Abu Dhabi'); unknown values are returned as-is. */
export const organizationName = code => ORGANIZATION_NAMES[String(code || '').toUpperCase()] || code || ''
