// Organization positions describe employment; access roles are managed separately.
export const normalizeOrganizationCatalog = (payload) => {
  if (!payload || !Array.isArray(payload.departments) || !Array.isArray(payload.organizational_roles)) {
    throw new Error('The organization structure could not be loaded.')
  }
  return {
    source: payload.source || {},
    departments: payload.departments.filter(item => item?.code && item?.label),
    organizational_roles: payload.organizational_roles.filter(item => item?.code && item?.label),
  }
}

export const organizationDepartmentOptions = (catalog, currentValue = '') => {
  const departments = catalog?.departments || []
  const labels = [...new Set(departments.map(item => item.label))]
  const options = labels.map(label => ({ value: label, label }))
  // Existing slugs and legacy names remain selectable without rewriting a profile.
  if (currentValue && !labels.includes(currentValue)) {
    const recorded = departments.find(item => item.code === currentValue)
    options.unshift({ value: currentValue, label: recorded?.label || currentValue })
  }
  return options
}

export const organizationRoleLabels = (catalog) => (
  [...new Set((catalog?.organizational_roles || []).flatMap(item => [item.label, ...(item.additional_titles || [])]))]
)

export const organizationDepartmentGroups = (catalog, query = '') => {
  const departments = catalog?.departments || []
  const roles = catalog?.organizational_roles || []
  const departmentNames = new Map(departments.map(item => [item.code, item.label]))
  const roleNames = new Map(roles.map(item => [item.code, item.label]))
  const needle = query.trim().toLowerCase()
  return departments.map(department => ({
    ...department,
    parentLabel: departmentNames.get(department.parent_code) || '',
    headLabel: roleNames.get(department.head_role_code) || '',
    roles: roles.filter(role => role.department_code === department.code).map(role => ({
      ...role,
      reportsToLabel: roleNames.get(role.reports_to_role_code) || '',
    })),
  })).filter(department => !needle || [department.label, department.parentLabel,
    ...(department.functions || []),
    ...department.roles.flatMap(role => [role.label, ...(role.additional_titles || []), role.holder_name, role.reportsToLabel]),
  ].some(value => String(value || '').toLowerCase().includes(needle)))
}
