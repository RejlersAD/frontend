import apiClient from './api.service'
import { STORAGE_KEYS } from '../config/app.config'
import { normalizeOrganizationCatalog } from '../utils/organizationCatalog'

// Share concurrent reads only. No persisted catalog or cross-session result cache.
const pendingRequests = new Map()

export const getOrganizationCatalog = () => {
  const session = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) || ''
  if (pendingRequests.has(session)) return pendingRequests.get(session)
  const request = apiClient.get('/rbac/users/organization-catalog/', {
    timeout: 10000,
    silentTimeout: true,
  }).then(response => normalizeOrganizationCatalog(response.data))
    .finally(() => {
      if (pendingRequests.get(session) === request) pendingRequests.delete(session)
    })
  pendingRequests.set(session, request)
  return request
}
