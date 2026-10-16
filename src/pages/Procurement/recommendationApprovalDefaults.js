import { isLevelZeroApprover } from './recommendationApprovalEvidence.js';

const DEFAULT_LEVEL_ZERO_EMAIL = 'richa@rejlers.ae';

// The directory supplies active employees. Explicit inactive flags and missing
// canonical IDs can never create a default assignment.
export function resolveLevelZeroApprover(employees = []) {
  const active = (Array.isArray(employees) ? employees : []).filter(employee => (
    employee?.id && employee.is_active !== false
  ));
  return active.find(employee => String(employee.email || '').trim().toLowerCase() === DEFAULT_LEVEL_ZERO_EMAIL)
    || active.find(employee => isLevelZeroApprover({ user_name: employee.full_name
      || [employee.first_name, employee.last_name].filter(Boolean).join(' ')
      || employee.display_name || employee.employee_name || '' }))
    || null;
}
