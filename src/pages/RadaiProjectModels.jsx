import { useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { Cpu, Loader2, RotateCcw, Save } from 'lucide-react'
import { listAIModelCatalog, updateAIProject } from '../services/radaiIntelligence.service'

// Project > Models: the owner picks which of the latest OpenAI, Gemini and Claude models members
// may chat with, and the default. Members see the list; with none chosen, the organization's models apply.
const PROVIDERS = [['anthropic', 'Claude'], ['openai', 'OpenAI'], ['gemini', 'Gemini']]
const key = row => `${row.provider}:${row.model_id}`

export default function RadaiProjectModels({ project, isOwner, busy, run, onProjectUpdated, card, muted }) {
  const saved = useMemo(() => project.chat_models || [], [project.chat_models])
  const [catalog, setCatalog] = useState(null)
  const [catalogError, setCatalogError] = useState('')
  const [chosen, setChosen] = useState(() => new Set(saved.map(key)))
  const [defaultId, setDefaultId] = useState(project.default_chat_model || '')

  useEffect(() => { setChosen(new Set(saved.map(key))); setDefaultId(project.default_chat_model || '') }, [saved, project.default_chat_model])
  useEffect(() => {
    if (!isOwner) return undefined
    let active = true
    listAIModelCatalog()
      .then(result => { if (active) setCatalog(result.models || []) })
      .catch(() => { if (active) { setCatalog([]); setCatalogError('The latest model lists could not be loaded. Try again in a moment.') } })
    return () => { active = false }
  }, [isOwner])

  // Catalog plus any saved model a provider no longer lists, so it can still be removed.
  const rows = useMemo(() => {
    const list = [...(catalog || [])]
    for (const row of saved) if (!list.some(item => key(item) === key(row))) list.push({ ...row, label: row.model_id, retired: true })
    return list
  }, [catalog, saved])
  const picked = rows.filter(row => chosen.has(key(row)))
  const effectiveDefault = picked.some(row => row.model_id === defaultId) ? defaultId : picked[0]?.model_id || ''
  const dirty = picked.length !== saved.length || picked.some(row => !saved.some(item => key(item) === key(row)))
    || (picked.length > 0 && effectiveDefault !== (project.default_chat_model || ''))
  const toggle = row => setChosen(previous => {
    const next = new Set(previous)
    if (next.has(key(row))) next.delete(key(row)); else next.add(key(row))
    return next
  })
  const save = list => run(async () => {
    await updateAIProject(project.id, { chat_models: list.map(row => ({ provider: row.provider, model_id: row.model_id })),
      default_chat_model: list.length ? effectiveDefault : '' })
    await onProjectUpdated()
  }, list.length ? 'Project models saved. Members now choose from this list.' : "Project now uses the organization's models.")

  if (!isOwner) {
    return <div className={card}>
      <div className="flex items-center gap-2 text-sm font-semibold"><Cpu size={16} />Models in this project</div>
      {saved.length ? <ul className="mt-3 space-y-1.5 text-sm">{saved.map(row => <li key={key(row)} className="flex items-center gap-2">
        <span className="rounded-full bg-[var(--rd-surface-subtle)] px-2 py-0.5 text-xs">{PROVIDERS.find(([id]) => id === row.provider)?.[1]}</span>{row.model_id}
        {row.model_id === project.default_chat_model && <span className="text-xs text-[var(--rd-primary)]">Default</span>}</li>)}</ul>
        : <p className={`mt-2 text-sm ${muted}`}>This project uses your organization&apos;s chat models. The project owner can choose specific ones.</p>}
    </div>
  }

  return <div className={card}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold"><Cpu size={16} />Models members can use</div>
        <p className={`mt-1 max-w-2xl text-sm ${muted}`}>Tick the models allowed in this project and pick the default. The lists show the newest models your organization&apos;s OpenAI, Gemini and Claude keys can use. With none ticked, the organization&apos;s models apply. If a model fails, RADAI switches to another model on this list.</p>
      </div>
      <div className="flex gap-2">
        {saved.length > 0 && <button type="button" className="rd-btn" disabled={busy} onClick={() => save([])}><RotateCcw size={15} />Use organization models</button>}
        <button type="button" className="rd-btn rd-btn-primary" disabled={busy || !dirty || catalog === null} onClick={() => save(picked)}><Save size={15} />Save models</button>
      </div>
    </div>
    {catalog === null ? <p className={`mt-4 flex items-center gap-2 text-sm ${muted}`} role="status"><Loader2 size={15} className="animate-spin" />Loading the latest models…</p> : <>
      {catalogError && <p className={`mt-3 text-sm ${muted}`}>{catalogError}</p>}
      {!rows.length && !catalogError && <p className={`mt-3 text-sm ${muted}`}>No OpenAI, Gemini or Claude key is configured. An administrator can add one in AI API keys.</p>}
      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-3">
        {PROVIDERS.map(([provider, name]) => {
          const list = rows.filter(row => row.provider === provider)
          if (!list.length) return null
          return <fieldset key={provider} className="rounded-xl border border-[var(--rd-border-soft)] p-3">
            <legend className="px-1 text-sm font-semibold">{name}</legend>
            <ul className="space-y-1">{list.map(row => {
              const on = chosen.has(key(row))
              return <li key={key(row)} className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-[var(--rd-surface-subtle)]">
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4" checked={on} onChange={() => toggle(row)} disabled={busy} />
                  <span className="truncate font-mono text-[13px]" title={row.model_id}>{row.model_id}</span>
                  {row.configured && <span className="shrink-0 rounded-full bg-[var(--rd-surface-subtle)] px-1.5 text-[10px]" title="The model your administrator configured for this provider">Org default</span>}
                  {row.retired && <span className="shrink-0 text-[10px] text-[var(--rd-warning)]">No longer listed</span>}
                </label>
                {on && <label className={`flex shrink-0 cursor-pointer items-center gap-1 text-xs ${row.model_id === effectiveDefault ? 'font-semibold text-[var(--rd-primary)]' : muted}`}>
                  <input type="radio" name="project-default-model" className="h-3.5 w-3.5" checked={row.model_id === effectiveDefault} onChange={() => setDefaultId(row.model_id)} disabled={busy} />Default
                </label>}
              </li>
            })}</ul>
          </fieldset>
        })}
      </div>
      <p className={`mt-3 text-xs ${muted}`}>{picked.length ? `${picked.length} model${picked.length === 1 ? '' : 's'} selected · default ${effectiveDefault}` : 'No models selected: members use the organization’s models.'}</p>
    </>}
  </div>
}

RadaiProjectModels.propTypes = {
  project: PropTypes.object.isRequired, isOwner: PropTypes.bool, busy: PropTypes.bool, run: PropTypes.func.isRequired,
  onProjectUpdated: PropTypes.func.isRequired, card: PropTypes.string, muted: PropTypes.string,
}
