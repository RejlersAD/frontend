const humanizeIdentifier = (value = '') => String(value)
  .trim()
  .split('@', 1)[0]
  .replace(/[._-]+/g, ' ')
  .replace(/\b\w/g, character => character.toUpperCase());

export const nameOnly = (value = '') => {
  const cleaned = String(value || '').trim();
  return cleaned.includes('@') ? humanizeIdentifier(cleaned) : cleaned;
};

export const employeeDisplayName = (employee, fallback = 'Active employee') => {
  if (!employee) return fallback;
  const fullName = String(employee.full_name || employee.display_name || employee.employee_name || '').trim();
  if (fullName) return nameOnly(fullName);
  const combinedName = `${employee.first_name || ''} ${employee.last_name || ''}`.trim();
  if (combinedName) return combinedName;
  const username = String(employee.username || '').trim();
  if (username && !username.includes('@') && !['admin', 'administrator', 'user'].includes(username.toLowerCase())) {
    return username;
  }
  return nameOnly(employee.email || username) || fallback;
};

export const isJarmoCeoStage = (stage = {}) => {
  const identity = [stage.user_name, stage.approver, stage.user_email, stage.approver_email]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const role = `${stage.role || ''} ${stage.stage || ''}`.toLowerCase();
  return identity.includes('jarmo suominen')
    || identity.includes('jarmo.suominen@')
    || (Number(stage.level) === 5 && (role.includes('general manager') || role.includes('ceo')));
};

export const displayApprovalWorkflow = (workflow, poReference = '') => (
  (Array.isArray(workflow) ? workflow : []).flatMap((entry) => {
    if (!isJarmoCeoStage(entry)) return [entry];
    if (String(poReference || '').trim()) return [];
    return [{
      ...entry,
      role: 'CEO',
      stage: String(entry.stage || '').replace(/general manager/gi, 'CEO') || 'Level 5 - CEO Approval',
    }];
  })
);
