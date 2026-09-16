import useOrganizationCatalog from '../../hooks/useOrganizationCatalog'
import { organizationDepartmentOptions, organizationRoleLabels } from '../../utils/organizationCatalog'

export default function OrganizationSuggestions({ id }) {
  const { catalog } = useOrganizationCatalog()
  return <>
    <datalist id={`${id}-departments`}>
      {organizationDepartmentOptions(catalog).map(option => <option key={option.value} value={option.value} />)}
    </datalist>
    <datalist id={`${id}-roles`}>
      {organizationRoleLabels(catalog).map(label => <option key={label} value={label} />)}
    </datalist>
  </>
}
