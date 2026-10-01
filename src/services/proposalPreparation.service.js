import apiClient from './api.service'

const path = (kind, id, action) => `/sales/${kind}/${encodeURIComponent(id)}/${action}/`
const options = signal => ({ signal, suppressErrorToast: true })
const read = (kind, id, action, signal, params) => apiClient.get(path(kind, id, action), { ...options(signal), params }).then(result => result.data)
const command = (kind, id, action, payload, signal) => apiClient.post(path(kind, id, action), payload, options(signal)).then(result => result.data)

export const getBidPreparation = (id, signal) => read('deals', id, 'bid-preparation', signal)
export const connectBidPreparation = (id, payload) => command('deals', id, 'bid-preparation', payload)
export const listBidWorkspaces = (id, params, signal) => read('deals', id, 'bid-preparation-candidates', signal, params)
export const getProposalPreparation = (id, signal) => read('quotes', id, 'preparation', signal)
export const listPreparationSources = (id, params, signal) => read('quotes', id, 'preparation-sources', signal, params)
export const previewProposalPreparation = (id, technicalProposalId, signal) => command('quotes', id, 'preparation-preview', { technical_proposal_id: technicalProposalId }, signal)
export const prepareProposal = (id, payload) => command('quotes', id, 'prepare', payload)

export function preparationError(error, fallback) {
  const collect = value => typeof value === 'string' ? [value] : Array.isArray(value) ? value.flatMap(collect) : value && typeof value === 'object' ? Object.entries(value).filter(([key]) => key !== 'code').flatMap(([, item]) => collect(item)) : []
  const messages = collect(error?.response?.data).filter(value => value.length < 1500 && !/<[^>]+>/.test(value))
  return messages.slice(0, 5).join(' ') || fallback
}
