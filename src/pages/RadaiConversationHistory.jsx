import { useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { Archive, Check, Folder, History, MessageCircle, Paperclip, Pencil, Pin, Plus, Search, X } from 'lucide-react'

// RADAI Intelligence chat history: every chat you own, across general chat and your projects.
// Pins live in this browser only.
const PIN_KEY = 'radai.intelligence.pinnedChats'
export const readPinnedChats = () => { try { const v = JSON.parse(localStorage.getItem(PIN_KEY)); return Array.isArray(v) ? v : [] } catch { return [] } }
export const writePinnedChats = ids => { try { localStorage.setItem(PIN_KEY, JSON.stringify(ids)) } catch { /* storage unavailable: keep in memory */ } }

export const chatTitle = row => (row?.title && row.title !== 'New conversation' ? row.title : 'Untitled chat')

const DAY = 86400000
const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

// Short time for lists: "now", "12m", "3h", "Yesterday", "Mon", "12 Nov", "12 Nov 2025".
export function relativeTime(value, now = new Date()) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const diff = now - date
  if (diff < 60000) return 'now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
  const days = Math.round((startOfDay(now) - startOfDay(date)) / DAY)
  if (days === 0) return `${Math.floor(diff / 3600000)}h`
  if (days === 1) return 'Yesterday'
  if (days < 7) return date.toLocaleDateString(undefined, { weekday: 'short' })
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) })
}

function groupFor(value, now) {
  const days = Math.round((startOfDay(now) - startOfDay(new Date(value))) / DAY)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return 'Previous 7 days'
  if (days < 30) return 'Previous 30 days'
  return 'Older'
}
const GROUPS = ['Pinned', 'Today', 'Yesterday', 'Previous 7 days', 'Previous 30 days', 'Older']

function Highlight({ text, term }) {
  if (!term) return text
  const at = text.toLowerCase().indexOf(term.toLowerCase())
  if (at < 0) return text
  return <>{text.slice(0, at)}<mark className="radai-ai-hl">{text.slice(at, at + term.length)}</mark>{text.slice(at + term.length)}</>
}
Highlight.propTypes = { text: PropTypes.string.isRequired, term: PropTypes.string }

export default function RadaiConversationHistory({
  rows, loading, error, query, onQueryChange, focusSearch, initialFilter, activeId, pinned, onTogglePin,
  onOpen, onRename, onArchive, onNewChat,
}) {
  const [filter, setFilter] = useState(initialFilter || 'all')
  const [renameId, setRenameId] = useState(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [confirmId, setConfirmId] = useState(null)
  const [rowError, setRowError] = useState('')
  const searchRef = useRef(null)
  useEffect(() => { if (focusSearch) searchRef.current?.focus() }, [focusSearch])
  useEffect(() => { setFilter(initialFilter || 'all') }, [initialFilter])

  // Filter chips: All, General and each project that has chats.
  const chips = useMemo(() => {
    const projects = new Map()
    rows.forEach(r => { if (r.project) projects.set(String(r.project.id), r.project.name) })
    return [['all', 'All', rows.length], ['general', 'General', rows.filter(r => !r.project).length],
      ...[...projects].sort((a, b) => a[1].localeCompare(b[1])).map(([id, name]) => [id, name, rows.filter(r => String(r.project?.id) === id).length])]
  }, [rows])

  const groups = useMemo(() => {
    const now = new Date()
    const shown = rows.filter(r => filter === 'all' || (filter === 'general' ? !r.project : String(r.project?.id) === filter))
    const map = new Map(GROUPS.map(g => [g, []]))
    shown.forEach(r => map.get(pinned.includes(r.id) ? 'Pinned' : groupFor(r.updated_at, now)).push(r))
    return [...map].filter(([, list]) => list.length)
  }, [rows, filter, pinned])

  const act = async (fn) => {
    setRowError('')
    try { await fn() } catch { setRowError('That change could not be saved. Your access may have changed.') }
  }

  const term = query.trim()
  return <div className="radai-ai-history">
    <header className="radai-ai-history-head">
      <div className="min-w-0">
        <h1>Chats</h1>
        <p>Every chat you started, in general chat and in your projects. Newest first.</p>
      </div>
      <button type="button" onClick={onNewChat} className="radai-ai-history-new"><Plus size={15} aria-hidden="true" />New chat</button>
    </header>

    <div className="radai-ai-history-search">
      <Search size={16} aria-hidden="true" />
      <label htmlFor="intelligence-history-search" className="sr-only">Search chat titles and messages</label>
      <input id="intelligence-history-search" ref={searchRef} value={query} onChange={e => onQueryChange(e.target.value)}
        placeholder="Search titles and messages" autoComplete="off"
        onKeyDown={e => { if (e.key === 'Escape' && query) { e.preventDefault(); onQueryChange('') } }} />
      {query && <button type="button" onClick={() => onQueryChange('')} aria-label="Clear search"><X size={15} /></button>}
    </div>

    {chips.length > 2 || rows.length ? <div className="radai-ai-history-chips" role="group" aria-label="Filter chats">
      {chips.map(([id, label, count]) => (id === 'general' && !count ? null :
        <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)} className={filter === id ? 'is-active' : ''}>
          {id !== 'all' && id !== 'general' && <Folder size={12} aria-hidden="true" />}{label}<span>{count}</span>
        </button>))}
    </div> : null}

    {(error || rowError) && <p role="alert" className="radai-ai-history-error">{error || rowError}</p>}

    {loading && !rows.length ? <p role="status" className="radai-ai-history-empty">Loading chats…</p> : groups.length ? groups.map(([group, list]) => (
      <section key={group} className="radai-ai-history-group" aria-label={group}>
        <h2>{group === 'Pinned' && <Pin size={12} aria-hidden="true" />}{group}</h2>
        <ul>
          {list.map(row => {
            const isPinned = pinned.includes(row.id)
            return <li key={row.id} className={`radai-ai-history-row ${row.id === activeId ? 'is-active' : ''}`}>
              {renameId === row.id ? (
                <form className="radai-ai-history-rename" onSubmit={e => { e.preventDefault(); const t = renameDraft.trim(); if (t) act(async () => { await onRename(row, t); setRenameId(null) }) }}>
                  <label className="sr-only" htmlFor={`rename-${row.id}`}>Chat title</label>
                  <input id={`rename-${row.id}`} autoFocus maxLength={160} value={renameDraft} onChange={e => setRenameDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Escape') setRenameId(null) }} />
                  <button type="submit" aria-label="Save title"><Check size={15} /></button>
                  <button type="button" onClick={() => setRenameId(null)} aria-label="Cancel rename"><X size={15} /></button>
                </form>
              ) : <>
                <button type="button" onClick={() => onOpen(row)} className="radai-ai-history-main">
                  <span className="radai-ai-history-icon" aria-hidden="true"><MessageCircle size={15} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="radai-ai-history-title"><Highlight text={chatTitle(row)} term={term} /></span>
                    {row.preview && <span className="radai-ai-history-preview">{row.preview_role === 'assistant' ? 'RADAI: ' : 'You: '}<Highlight text={row.preview} term={term} /></span>}
                    <span className="radai-ai-history-meta">
                      <span className={`radai-ai-history-tag ${row.project ? '' : 'is-general'}`}>{row.project ? <><Folder size={11} aria-hidden="true" />{row.project.name}</> : 'General'}</span>
                      <span>{row.message_count} message{row.message_count === 1 ? '' : 's'}</span>
                      {row.attachment_count > 0 && <span className="inline-flex items-center gap-1"><Paperclip size={11} aria-hidden="true" />{row.attachment_count}</span>}
                    </span>
                  </span>
                  <time dateTime={row.updated_at} title={new Date(row.updated_at).toLocaleString()} className="radai-ai-history-time">{relativeTime(row.updated_at)}</time>
                </button>
                {confirmId === row.id ? <span className="radai-ai-history-confirm" role="group" aria-label="Confirm archive">
                  <span>Archive?</span>
                  <button type="button" onClick={() => act(async () => { await onArchive(row); setConfirmId(null) })}>Archive</button>
                  <button type="button" onClick={() => setConfirmId(null)}>Keep</button>
                </span> : <span className="radai-ai-history-actions">
                  <button type="button" onClick={() => onTogglePin(row.id)} aria-pressed={isPinned} className={isPinned ? 'is-on' : ''}
                    aria-label={isPinned ? `Unpin ${chatTitle(row)}` : `Pin ${chatTitle(row)}`} title={isPinned ? 'Unpin' : 'Pin to top'}><Pin size={14} /></button>
                  <button type="button" onClick={() => { setRenameId(row.id); setRenameDraft(row.title === 'New conversation' ? '' : row.title) }}
                    aria-label={`Rename ${chatTitle(row)}`} title="Rename"><Pencil size={14} /></button>
                  <button type="button" onClick={() => setConfirmId(row.id)} aria-label={`Archive ${chatTitle(row)}`} title="Archive"><Archive size={14} /></button>
                </span>}
              </>}
            </li>
          })}
        </ul>
      </section>
    )) : <div className="radai-ai-history-empty">
      <History size={24} aria-hidden="true" />
      <p>{term ? `No chats match "${term}".` : filter !== 'all' ? 'No chats here yet.' : 'No chats yet. Ask a question to start one.'}</p>
    </div>}
  </div>
}

RadaiConversationHistory.propTypes = {
  rows: PropTypes.arrayOf(PropTypes.object).isRequired, loading: PropTypes.bool, error: PropTypes.string,
  query: PropTypes.string.isRequired, onQueryChange: PropTypes.func.isRequired, focusSearch: PropTypes.bool,
  initialFilter: PropTypes.string, activeId: PropTypes.number, pinned: PropTypes.arrayOf(PropTypes.number).isRequired,
  onTogglePin: PropTypes.func.isRequired, onOpen: PropTypes.func.isRequired, onRename: PropTypes.func.isRequired,
  onArchive: PropTypes.func.isRequired, onNewChat: PropTypes.func.isRequired,
}
