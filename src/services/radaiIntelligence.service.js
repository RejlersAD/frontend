import apiClient, { apiClientLongTimeout } from './api.service'

const base = projectId => `/projects/${encodeURIComponent(projectId)}/`
const unwrap = request => request.then(response => response.data)

export const getProjectInstructions = projectId => unwrap(apiClient.get(`${base(projectId)}ai-instructions/`))
export const saveProjectInstructions = (projectId, payload) => unwrap(apiClient.put(`${base(projectId)}ai-instructions/`, payload))
export const getProjectActivity = projectId => unwrap(apiClient.get(`${base(projectId)}ai-activity/`))
export const listProjectKnowledge = (projectId, q = '', page = 1) => unwrap(apiClient.get(`${base(projectId)}ai-knowledge/`, { params: { ...(q ? { q } : {}), page } }))
export const linkProjectDocument = (projectId, documentId) => unwrap(apiClient.post(`${base(projectId)}ai-knowledge/`, { project_document_id: documentId }))
export const linkCrsRevision = (projectId, revisionId) => unwrap(apiClient.post(`${base(projectId)}ai-knowledge/`, { crs_revision_id: revisionId }))
export const getKnowledgeSource = (projectId, sourceId) => unwrap(apiClient.get(`${base(projectId)}ai-knowledge/${sourceId}/`))
export const unlinkKnowledgeSource = (projectId, sourceId) => unwrap(apiClient.delete(`${base(projectId)}ai-knowledge/${sourceId}/`))
export const retryKnowledgeSource = (projectId, sourceId) => unwrap(apiClient.post(`${base(projectId)}ai-knowledge/${sourceId}/process/`, {}))

const conversations = projectId => `${base(projectId)}ai-conversations/`
export const listConversations = (projectId, params = {}) => unwrap(apiClient.get(conversations(projectId), { params }))
export const createConversation = projectId => unwrap(apiClient.post(conversations(projectId), {}))
export const getConversation = (projectId, id) => unwrap(apiClient.get(`${conversations(projectId)}${id}/`))
export const renameConversation = (projectId, id, title) => unwrap(apiClient.patch(`${conversations(projectId)}${id}/`, { title }))
export const archiveConversation = (projectId, id) => unwrap(apiClient.delete(`${conversations(projectId)}${id}/`))
export const sendConversationMessage = (projectId, id, question, requestId) => unwrap(apiClient.post(`${conversations(projectId)}${id}/send/`, { question, request_id: requestId }, { timeout: 90000 }))
export const listEngineeringEvidence = projectId => unwrap(apiClient.get('/pid-checker-v2/engineering-evidence/', { params: { project_id: projectId } }))
export const getEngineeringReview = extractionId => unwrap(apiClient.get(`/pid-checker-v2/engineering-evidence/${encodeURIComponent(extractionId)}/review/`))
export const validateEngineeringEvidence = (extractionId, lineListId) => unwrap(apiClient.post(`/pid-checker-v2/engineering-evidence/${encodeURIComponent(extractionId)}/validate/`, { line_list_id: lineListId }))
export const submitEngineeringReview = extractionId => unwrap(apiClient.post(`/pid-checker-v2/engineering-evidence/${encodeURIComponent(extractionId)}/submit/`, {}))
export const listLineLists = () => unwrap(apiClient.get('/pid-checker-v2/line-lists/'))
export const compareKnowledgeRevisions = (projectId, leftId, rightId) => unwrap(apiClient.post(`${base(projectId)}ai-compare/`, { left_source_id: leftId, right_source_id: rightId }))
export const listEPCWorkItems = projectId => unwrap(apiClient.get('/project-control/epc-work-items/', { params: { project: projectId } }))

const aiBase = '/ai-workspaces/'
export const listAIChatModels = () => unwrap(apiClient.get(`${aiBase}models/`))
const aiProject = id => `${aiBase}${encodeURIComponent(id)}/`
const aiConversations = id => id ? `${aiProject(id)}conversations/` : `${aiBase}general/conversations/`
export const listAIProjects = () => unwrap(apiClient.get(aiBase))
export const createAIProject = payload => unwrap(apiClient.post(aiBase, payload))
export const getAIProject = id => unwrap(apiClient.get(aiProject(id)))
export const updateAIProject = (id, payload) => unwrap(apiClient.patch(aiProject(id), payload))
export const archiveAIProject = id => unwrap(apiClient.delete(aiProject(id)))
export const listAIMembers = id => unwrap(apiClient.get(`${aiProject(id)}members/`))
export const addAIMember = (id, payload) => unwrap(apiClient.post(`${aiProject(id)}members/`, payload))
export const removeAIMember = (id, userId) => unwrap(apiClient.delete(`${aiProject(id)}members/${encodeURIComponent(userId)}/`))
export const getAIInstructions = id => unwrap(apiClient.get(`${aiProject(id)}instructions/`))
export const saveAIInstructions = (id, payload) => unwrap(apiClient.put(`${aiProject(id)}instructions/`, payload))
export const getAIActivity = id => unwrap(apiClient.get(`${aiProject(id)}activity/`))
export const listAIKnowledge = (id, q = '') => unwrap(apiClient.get(`${aiProject(id)}knowledge/`, { params: q ? { q } : {} }))
export const uploadAIKnowledge = (id, file) => { const body = new FormData(); body.append('file', file); return unwrap(apiClient.post(`${aiProject(id)}knowledge/`, body)) }
export const getAIKnowledge = (id, documentId) => unwrap(apiClient.get(`${aiProject(id)}knowledge/${documentId}/`))
export const downloadAIKnowledge = (id, documentId) => apiClient.get(`${aiProject(id)}knowledge/${documentId}/download/`, { responseType: 'blob' })
export const archiveAIKnowledge = (id, documentId) => unwrap(apiClient.delete(`${aiProject(id)}knowledge/${documentId}/`))
export const listAIConversations = (id, q = '') => unwrap(apiClient.get(aiConversations(id), { params: q ? { q } : {} }))
export const createAIConversation = id => unwrap(apiClient.post(aiConversations(id), {}))
export const getAIConversation = (id, conversationId) => unwrap(apiClient.get(`${aiConversations(id)}${conversationId}/`))
export const updateAIConversation = (id, conversationId, title) => unwrap(apiClient.patch(`${aiConversations(id)}${conversationId}/`, { title }))
export const archiveAIConversation = (id, conversationId) => unwrap(apiClient.delete(`${aiConversations(id)}${conversationId}/`))
export const shareAIConversation = (id, conversationId, userId) => unwrap(apiClient.post(`${aiProject(id)}conversations/${conversationId}/share/`, { user_id: userId }))
export const sendAIMessage = (id, conversationId, question, requestId, model, attachmentIds = []) => unwrap(apiClient.post(`${aiConversations(id)}${conversationId}/send/`, { question, request_id: requestId, provider: 'ollama', model, attachment_ids: attachmentIds }, { timeout: 240000 }))

export const uploadAIAttachment = (projectId, conversationId, file) => {
  const body = new FormData()
  body.append('file', file)
  return unwrap(apiClientLongTimeout.post(`${aiConversations(projectId)}${conversationId}/attachments/`, body))
}

export const downloadAIAttachment = (projectId, conversationId, attachmentId) => apiClient.get(
  `${aiConversations(projectId)}${conversationId}/attachments/${attachmentId}/download/`,
  { responseType: 'blob' },
)

export const generateAIDocument = (conversationId, payload) => unwrap(apiClient.post(`${aiConversations(null)}${conversationId}/documents/`, payload, { timeout: 120000 }))

export const downloadAIGeneratedDocument = (conversationId, docId) => apiClient.get(
  `${aiConversations(null)}${conversationId}/documents/${docId}/download/`,
  { responseType: 'blob' },
)
