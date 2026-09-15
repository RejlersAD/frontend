import apiClient from './api.service'

const projectPath = project => `/project-control/epc-projects/${encodeURIComponent(project)}/`
const workPath = id => `/project-control/epc-work-items/${encodeURIComponent(id)}/`
const data = request => request.then(response => response.data)

export const getSetup = (project, signal) => data(apiClient.get(`${projectPath(project)}setup/`, { signal }))
export const saveSetup = (project, payload) => data(apiClient.post(`${projectPath(project)}setup/`, payload))
export const getLinks = (project, signal) => data(apiClient.get(`${projectPath(project)}links/`, { signal }))
export const saveLink = (project, payload) => data(apiClient.post(`${projectPath(project)}links/`, payload))
export const deleteLink = (project, id) => data(apiClient.delete(`${projectPath(project)}links/`, { data: { id } }))
export const getRequisitions = (project, signal) => data(apiClient.get(`${projectPath(project)}requisitions/`, { signal }))
export const associateRequisition = (project, payload) => data(apiClient.post(`${projectPath(project)}requisitions/`, payload))
export const getBaselines = (project, signal) => data(apiClient.get(`${projectPath(project)}baseline/`, { signal }))
export const captureBaseline = (project, payload) => data(apiClient.post(`${projectPath(project)}baseline/`, payload))
export const listWorkItems = (project, signal, page = 1) => data(apiClient.get('/project-control/epc-work-items/', { params: { project, page }, signal }))
export const getExecutionOptions = (project, signal) => data(apiClient.get('/project-control/epc-work-items/options/', { params: { project }, signal }))
export const getWorkItem = (id, signal) => data(apiClient.get(workPath(id), { signal }))
export const createWorkItem = payload => data(apiClient.post('/project-control/epc-work-items/', payload))
export const updateWorkItem = (id, payload) => data(apiClient.patch(workPath(id), payload))
export const submitWorkItem = (id, payload = {}) => data(apiClient.post(`${workPath(id)}submit/`, payload))
export const reviewWorkItem = (id, payload) => data(apiClient.post(`${workPath(id)}review/`, payload))
export const acceptWorkItem = (id, payload = {}) => data(apiClient.post(`${workPath(id)}accept/`, payload))
