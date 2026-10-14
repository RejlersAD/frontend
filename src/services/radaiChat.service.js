/**
 * radaiChat.service.js — client for the RADAI Chat backend.
 *
 * Thin wrapper around POST /pid-checker-v2/chat/. Sends the user's question
 * plus a soft-coded page-context payload (extracted rows, uploaded document,
 * active project) and the BYOK provider/key. The key is forwarded per-request
 * only — never stored here (it lives in the BYOK sessionStorage pattern).
 */
import apiClient from './api.service'

const CHAT_ENDPOINT = '/pid-checker-v2/chat/'

// Soft-coded request timeout — chat answers can take a few seconds on
// long contexts, but should never hang the UI.
const CHAT_TIMEOUT_MS = 90000

/**
 * Ask the assistant a question grounded in the current page context.
 * @param {object} args
 * @param {string} args.question   the user's message
 * @param {object} args.context    page context payload (see backend)
 * @param {Array}  args.history    prior turns [{role, content}]
 * @param {string} args.provider   'claude' | 'openai'
 * @param {string} args.apiKey     BYOK key
 * @param {string} args.model      optional model override
 */
export async function askRadAIChat({ question, context = {}, history = [], provider, apiKey, model }) {
  const body = { question, context, history }
  if (provider) body.provider = provider
  if (apiKey)   body.api_key = apiKey
  if (model)    body.model = model
  const res = await apiClient.post(CHAT_ENDPOINT, body, { timeout: CHAT_TIMEOUT_MS })
  return res.data
}

// Soft-coded: conversation archive endpoint (project S3 data lake)
const CHAT_ARCHIVE_ENDPOINT = '/pid-checker-v2/chat/archive/'
const ARCHIVE_TIMEOUT_MS = 15000

/**
 * Archive the conversation transcript to the project's S3 archive.
 * Fire-and-forget: resolves to {archived: bool} but never throws — archiving
 * must never break the chat UX.
 * @param {object} args
 * @param {string} args.sessionId  stable per-tab conversation id
 * @param {Array}  args.messages   [{role, content, ts}]
 * @param {object} args.context    page context (project/page/document used)
 */
export async function archiveRadAIChat({ sessionId, messages = [], context = {} }) {
  try {
    const ctx = context || {}
    const project = ctx.project?.code || ctx.project?.name || ctx.project?.id || ''
    const res = await apiClient.post(CHAT_ARCHIVE_ENDPOINT, {
      session_id: sessionId,
      messages: messages.map(m => ({
        role: m.role, content: String(m.content ?? ''), ts: m.ts,
      })),
      project: String(project || ''),
      page: ctx.page || '',
      document: ctx.document || null,
    }, { timeout: ARCHIVE_TIMEOUT_MS, suppressErrorToast: true })
    return res.data || { archived: false }
  } catch {
    return { archived: false }
  }
}

export default { askRadAIChat, archiveRadAIChat }
