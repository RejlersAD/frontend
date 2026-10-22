import apiClient from './api.service'

const base = '/hr/recruitment-'
async function listAll(resource) {
  const rows = []
  for (let page = 1; page <= 200; page += 1) {
    const { data } = await apiClient.get(`${base}${resource}/`, { params: { page } })
    rows.push(...(Array.isArray(data) ? data : data.results || []))
    if (Array.isArray(data) || !data.next) return rows
  }
  throw new Error('The recruitment register is too large to load. Please contact support.')
}

export const talentAcquisitionService = {
  syncStatus: () => apiClient.get('/hr/recruitment-position-sync/').then(({ data }) => {
    if (!data || typeof data !== 'object' || !data.status) throw new Error('Position synchronization status is unavailable.')
    return data
  }),
  syncPositions: () => apiClient.post('/hr/recruitment-position-sync/').then(response => response.data),
  publicLinks: link => apiClient.get('/hr/recruitment-application-links/', { params: link ? { link } : {} }).then(({ data }) => {
    if (!link && !Array.isArray(data)) throw new Error('Application links could not be loaded. Please retry.')
    return data
  }),
  createPublicLink: data => apiClient.post('/hr/recruitment-application-links/', data).then(response => response.data),
  revokePublicLink: id => apiClient.post(`/hr/recruitment-application-links/${id}/revoke/`).then(response => response.data),
  formSchema: kind => apiClient.get(`/hr/recruitment-forms/schema/${kind}/`).then(({ data }) => {
    if (!Array.isArray(data?.sections)) throw new Error('The online form service returned an invalid schema. Please retry.')
    return data
  }),
  invitations: candidate => apiClient.get('/hr/recruitment-forms/', { params: { candidate } }).then(({ data }) => {
    if (!Array.isArray(data)) throw new Error('The online form service is unavailable. Please retry.')
    return data
  }),
  invite: data => apiClient.post('/hr/recruitment-forms/', data).then(response => response.data),
  invitationCommand: (id, data) => apiClient.post(`/hr/recruitment-forms/${id}/command/`, data).then(response => response.data),
  formReview: id => apiClient.get(`/hr/recruitment-forms/${id}/review/`).then(response => response.data),
  reviewForm: (id, data) => apiClient.post(`/hr/recruitment-forms/${id}/review/`, data).then(response => response.data),
  exportForm: (id, version) => apiClient.get(`/hr/recruitment-forms/${id}/export/${version}/`, { responseType: 'blob' }).then(response => response.data),
  formAttachment: (id, attachment) => apiClient.get(`/hr/recruitment-forms/${id}/attachments/${attachment}/`, { responseType: 'blob' }).then(response => response.data),
  candidatePhoto: id => apiClient.get(`/hr/recruitment-candidates/${id}/photo/`, { responseType: 'blob' }).then(response => response.data),
  candidates: () => listAll('candidates'),
  openings: () => listAll('openings'),
  saveCandidate: (data, id) => id
    ? apiClient.patch(`${base}candidates/${id}/`, data).then(response => response.data)
    : apiClient.post(`${base}candidates/`, data).then(response => response.data),
  saveOpening: (data, id) => id
    ? apiClient.patch(`${base}openings/${id}/`, data).then(response => response.data)
    : apiClient.post(`${base}openings/`, data).then(response => response.data),
}
