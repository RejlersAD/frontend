/**
 * chatContext.store.js — a tiny global registry that lets any page publish the
 * data currently on screen (extracted rows, uploaded document, active project)
 * so the RADAI Chat widget can ground its answers in it.
 *
 * Pattern: pages call `publishChatContext({...})` whenever their data changes;
 * the widget reads `getChatContext()` at send time. A version counter lets the
 * widget show "context updated" without tight coupling. No routing through
 * Redux — this is ephemeral UI state, not app state.
 *
 * SOFT-CODED: field caps live in radaiChat.config (imported by the widget).
 */

// In-memory store — one active context at a time (the page in focus).
let _context = null
let _version = 0
const _listeners = new Set()

/**
 * Publish the current page's data context for the chat assistant.
 * @param {object|null} ctx
 * @param {string} ctx.page       page/tool label (e.g. 'Line List')
 * @param {object} ctx.project    { id, name, code }
 * @param {object} ctx.document   { name, type, sizeLabel } — uploaded file
 * @param {Array}  ctx.columns    column keys/labels of the extracted table
 * @param {Array}  ctx.rows       extracted rows (array of objects)
 * @param {number} ctx.row_count  total rows (may exceed rows.length if capped)
 * @param {object} ctx.summary    optional KPI/summary figures
 * @param {string} ctx.notes      optional free-text notes about the data
 */
export function publishChatContext(ctx) {
  _context = ctx || null
  _version += 1
  _listeners.forEach(fn => { try { fn(_version) } catch { /* ignore */ } })
}

/** Read the current context (null if none published). */
export function getChatContext() {
  return _context
}

/** Monotonic version — bumps on every publish. */
export function getChatContextVersion() {
  return _version
}

/** Subscribe to context changes. Returns an unsubscribe function. */
export function subscribeChatContext(fn) {
  _listeners.add(fn)
  return () => _listeners.delete(fn)
}

/** Clear the context (e.g. on page unmount / logout). */
export function clearChatContext() {
  publishChatContext(null)
}
