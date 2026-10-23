import { API_BASE_URL } from '../config/api.config'
const api = `${API_BASE_URL.replace(/\/$/, '')}/candidate-forms`
export async function candidateFormRequest(path, payload, session, blob = false) {
  const multipart = payload instanceof FormData
  const response = await fetch(`${api}/${path}/`, {
    method: payload ? 'POST' : 'GET', cache: 'no-store', credentials: 'omit',
    headers: { ...(!multipart && { 'Content-Type': 'application/json' }), ...(session ? { Authorization: `Bearer ${session}` } : {}) },
    ...(payload ? { body: multipart ? payload : JSON.stringify(payload) } : {}),
  })
  if (response.ok && blob) return response.blob()
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.detail || (data.fields ? Object.entries(data.fields).map(([key, value]) => `${key}: ${value}`).join(' · ') : 'The form could not be saved. Please retry.'))
    error.status = response.status
    throw error
  }
  return data
}
