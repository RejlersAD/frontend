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

// ─── Edit-control action handler (soft-coded, per page) ──────────────────
// A page registers ONE handler to let the assistant propose row edits
// (update/delete) that the user applies from the chat UI.  The assistant
// proposes changes as structured `radai_action` blocks; the widget renders
// an Apply/Reject card; Apply calls this handler.  Pages that register
// nothing simply don't offer edit control.
let _actionHandler = null

/**
 * Register the active page's action handler.
 * @param {(action: object) => Promise<{ok: boolean, message?: string}>} fn
 * @returns {() => void} unregister (call on unmount)
 */
export function registerChatActionHandler(fn) {
  _actionHandler = fn
  return () => { if (_actionHandler === fn) _actionHandler = null }
}

/** Current handler or null. */
export function getChatActionHandler() {
  return _actionHandler
}

// ─── Chat file-upload handler (soft-coded, per page) ──────────────────────
// A page registers ONE handler so the assistant's 📎 button can hand an
// uploaded file (e.g. a P&ID PDF) straight into the page's own pipeline.
let _uploadHandler = null

/**
 * Register the active page's chat-upload handler.
 * @param {(file: File) => Promise<{ok: boolean, message?: string}>} fn
 * @returns {() => void} unregister (call on unmount)
 */
export function registerChatUploadHandler(fn) {
  _uploadHandler = fn
  return () => { if (_uploadHandler === fn) _uploadHandler = null }
}

/** Current handler or null. */
export function getChatUploadHandler() {
  return _uploadHandler
}
