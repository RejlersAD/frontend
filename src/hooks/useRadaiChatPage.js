/**
 * useRadaiChatPage.js — publish a page's data + application profile to the
 * global RADAI Assistant context store (soft-coded profiles live in
 * config/radaiChatPages.config.js).
 *
 * Usage in any tool page:
 *   import useRadaiChatPage from '../../hooks/useRadaiChatPage'
 *   useRadaiChatPage('equipment_list', {
 *     project, document, columns, rows, rowCount, summary,
 *   })
 *
 * The hook re-publishes whenever the passed data changes and clears the
 * context on unmount. Rows are capped (CHAT_ROW_CAP) — the backend applies
 * its own smaller cap for the prompt, this cap only keeps the in-memory
 * store lean.
 */
import { useEffect } from 'react'
import { CHAT_PAGE_PROFILES } from '../config/radaiChatPages.config'
import { publishChatContext, clearChatContext } from '../services/chatContext.store'

// Soft-coded: max rows kept in the in-memory chat context store per page.
const CHAT_ROW_CAP = 400

export default function useRadaiChatPage(profileKey, {
  project = null,
  document = null,
  columns = null,
  rows = null,
  rowCount = null,
  summary = null,
  extraNotes = '',
  documentExcerpt = '',
} = {}) {
  const profile = CHAT_PAGE_PROFILES[profileKey] || null

  useEffect(() => {
    if (!profile) return undefined
    const safeRows = Array.isArray(rows) ? rows.slice(0, CHAT_ROW_CAP) : []
    publishChatContext({
      page: profile.page,
      domain_prompt: profile.domainPrompt,   // backend: appended to grounding
      row_name: profile.rowName,
      actions: profile.actions || null,      // edit-control ops (see config)
      quick_actions: profile.quickActions || null,  // one-tap chips in the chat
      upload: profile.upload || null,        // 📎 chat file upload capability
      project,
      document,
      columns,
      rows: safeRows,
      row_count: rowCount ?? safeRows.length,
      summary,
      document_excerpt: documentExcerpt || '',   // source-document text excerpt
      notes: [profile.notes, extraNotes].filter(Boolean).join(' '),
    })
    return () => clearChatContext()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    profileKey,
    JSON.stringify(project || null),
    JSON.stringify(document || null),
    JSON.stringify(summary || null),
    documentExcerpt,
    rows,
  ])
}
