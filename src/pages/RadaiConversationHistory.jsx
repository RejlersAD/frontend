import { useState } from 'react'
import PropTypes from 'prop-types'
import { History } from 'lucide-react'

export default function RadaiConversationHistory({ project, search, query, onQueryChange, conversations, loading, error, onOpen, onRename, onArchive }) {
  const [renameId, setRenameId] = useState(null)
  const [renameDraft, setRenameDraft] = useState('')
  return <div className="mx-auto max-w-2xl">
    <h1 className="text-xl font-semibold">{search ? 'Search conversations' : 'Conversation history'}</h1>
    <p className="mt-1 text-sm text-[var(--rd-text-muted)]">{project ? `Saved conversations in ${project.name}` : 'Your general conversations.'}</p>
    {search && <><label htmlFor="intelligence-history-search" className="mt-6 block text-sm font-medium">Search messages and titles</label><input id="intelligence-history-search" value={query} onChange={event => onQueryChange(event.target.value)} className="rd-input mt-2 w-full" placeholder="Search conversations" /></>}
    {error && <p role="alert" className="mt-5 text-sm text-[var(--rd-danger)]">{error}</p>}
    {loading ? <p role="status" className="mt-6 text-sm">Loading conversations...</p> : conversations.length ? <ul className="mt-6 divide-y divide-[var(--rd-border-soft)] border-y border-[var(--rd-border-soft)]">{conversations.map(conversation => <li key={conversation.id} className="flex min-w-0 items-center gap-2 py-2">
      {renameId === conversation.id ? <form className="flex min-w-0 flex-1 gap-2" onSubmit={event => { event.preventDefault(); onRename(conversation, renameDraft); setRenameId(null) }}><label className="sr-only" htmlFor={`rename-${conversation.id}`}>Conversation title</label><input id={`rename-${conversation.id}`} className="rd-input min-w-0 flex-1" maxLength={160} value={renameDraft} onChange={event => setRenameDraft(event.target.value)} /><button type="submit" className="rd-btn">Save</button><button type="button" onClick={() => setRenameId(null)} className="rd-btn">Cancel</button></form> : <><button type="button" onClick={() => onOpen(conversation.id)} className="min-w-0 flex-1 rounded-lg px-2 py-2 text-left hover:bg-[var(--rd-surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--rd-accent)]"><span className="block truncate text-sm font-medium">{conversation.title}</span><span className="text-xs text-[var(--rd-text-muted)]">{new Date(conversation.updated_at).toLocaleString()}</span></button><button type="button" onClick={() => { setRenameId(conversation.id); setRenameDraft(conversation.title) }} className="rounded-md px-2 py-2 text-xs hover:bg-[var(--rd-surface)]">Rename</button><button type="button" onClick={() => onArchive(conversation)} className="rounded-md px-2 py-2 text-xs hover:bg-[var(--rd-surface)]">Archive</button></>}
    </li>)}</ul> : <div className="py-14 text-center"><History size={24} className="mx-auto text-[var(--rd-text-faint)]" /><p className="mt-3 text-sm text-[var(--rd-text-muted)]">No saved conversations match.</p></div>}
  </div>
}

RadaiConversationHistory.propTypes = {
  project: PropTypes.object, search: PropTypes.bool, query: PropTypes.string,
  onQueryChange: PropTypes.func, conversations: PropTypes.array, loading: PropTypes.bool,
  error: PropTypes.string, onOpen: PropTypes.func, onRename: PropTypes.func, onArchive: PropTypes.func,
}
