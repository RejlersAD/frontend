/* eslint-disable react/prop-types */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { CheckCircle2, ChevronRight, KeyRound, Loader2, Plus, RefreshCw, Settings2, ShieldCheck, X } from 'lucide-react'
import * as API from '../../services/aiAPIKeys.service'
import './AIAPIKeys.css'

const providerName = provider => API.AI_PROVIDERS[provider] || provider
const when = value => value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not tested'
const testLabel = value => value === 'passed' ? 'Passed' : value === 'failed' ? 'Failed' : 'Not tested'

function SettingsDialog({ title, children, busy, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    const node = ref.current, opener = document.activeElement
    node.showModal()
    return () => { node.close(); if (opener?.isConnected) opener.focus() }
  }, [])
  return <dialog ref={ref} className="aik-dialog" aria-label={title} onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
    <header><h2>{title}</h2><button type="button" className="aik-icon" aria-label="Close settings" disabled={busy} onClick={onClose}><X size={20} /></button></header>
    {children}
  </dialog>
}

function KeyForm({ credential, overview, onSaved, onClose, onDenied }) {
  const [form, setForm] = useState({ provider: credential?.provider || 'anthropic', label: credential?.label || '', api_key: '', enabled: credential?.enabled ?? true, model: '' })
  const [basis, setBasis] = useState(overview)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [stale, setStale] = useState(false)
  const inFlight = useRef(false)
  const current = basis.credentials.find(row => row.id === credential?.id)
  const provider = basis.providers.find(row => row.provider === form.provider)
  const set = (name, value) => setForm(previous => ({ ...previous, [name]: value }))
  const reload = async () => {
    if (inFlight.current) return
    inFlight.current = true; setBusy(true)
    try {
      const next = await API.listAIKeys()
      setBasis(next); setStale(false)
      setError(credential && !next.credentials.some(row => row.id === credential.id) ? 'This credential was removed. Close this dialog and refresh the list.' : 'Latest settings loaded. Your entries are retained; review them before saving.')
    } catch (reason) { setError(API.aiKeyError(reason)); if ([401, 403].includes(reason?.response?.status)) onDenied() }
    finally { inFlight.current = false; setBusy(false) }
  }
  const submit = async event => {
    event.preventDefault()
    if (inFlight.current || stale) return
    inFlight.current = true; setBusy(true); setError('')
    try {
      const body = { label: form.label.trim(), enabled: form.enabled, expected_provider_revision: provider?.revision ?? 0, ...(form.api_key.trim() ? { api_key: form.api_key.trim() } : {}) }
      const next = credential
        ? await API.updateAIKey(credential.id, { ...body, expected_revision: current.revision })
        : await API.createAIKey({ ...body, provider: form.provider, ...(form.model.trim() ? { model: form.model.trim() } : {}) })
      setForm(previous => ({ ...previous, api_key: '' }))
      onSaved(next, credential ? 'Credential updated.' : 'Credential added.')
    } catch (reason) { setError(API.aiKeyError(reason)); setStale(reason?.response?.status === 409); if ([401, 403].includes(reason?.response?.status)) onDenied() }
    finally { inFlight.current = false; setBusy(false) }
  }
  return <SettingsDialog title={credential ? 'Edit AI API key' : 'Add AI API key'} busy={busy} onClose={onClose}>
    <form onSubmit={submit}>
      <p>Keys are stored encrypted on the server and are never shown again.</p>
      {error && <p role="alert" className="aik-message aik-warning">{error}</p>}
      {stale && <button type="button" className="aik-button" disabled={busy} onClick={reload}>Reload latest settings</button>}
      {!basis.encryption_ready && <p role="alert" className="aik-message aik-warning">Secure credential storage is not configured.</p>}
      <fieldset disabled={busy || !basis.encryption_ready}>
        <label>Provider<select value={form.provider} disabled={Boolean(credential)} onChange={event => set('provider', event.target.value)}>{Object.entries(API.AI_PROVIDERS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Key name<input required maxLength={120} value={form.label} onChange={event => set('label', event.target.value)} placeholder="e.g. Engineering primary" autoComplete="off" /></label>
        <label>{credential ? 'Replacement API key (optional)' : 'API key'}<input type="password" required={!credential} value={form.api_key} onChange={event => set('api_key', event.target.value)} autoComplete="new-password" spellCheck={false} autoCapitalize="none" placeholder={credential ? 'Leave blank to keep the saved key' : 'Enter the provider API key'} /></label>
        {!credential && !provider?.managed && <label>Default model (optional)<input maxLength={160} value={form.model} onChange={event => set('model', event.target.value)} autoComplete="off" /><small>Leave blank to retain each module’s supported model.</small></label>}
        <label className="aik-check"><input type="checkbox" checked={form.enabled} onChange={event => set('enabled', event.target.checked)} /> Enable this credential</label>
        {!credential && <small>{provider?.managed ? 'Select this key from the list when you are ready to make it the provider default.' : 'The first key becomes the provider default. This provider will use central settings.'}</small>}
      </fieldset>
      <footer><button type="button" className="aik-button" disabled={busy} onClick={onClose}>Cancel</button><button type="submit" className="aik-button aik-primary" disabled={busy || stale || !basis.encryption_ready || Boolean(credential && !current)}>{busy && <Loader2 size={16} className="aik-spin" />}Save key</button></footer>
    </form>
  </SettingsDialog>
}

function ProviderForm({ provider, onSaved, onClose, onDenied }) {
  const [enabled, setEnabled] = useState(provider.enabled), [model, setModel] = useState(provider.model || '')
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const inFlight = useRef(false)
  const submit = async event => {
    event.preventDefault()
    if (inFlight.current) return
    inFlight.current = true; setBusy(true); setError('')
    try { onSaved(await API.updateAIProvider(provider.provider, { expected_revision: provider.revision, enabled, model: model.trim() }), 'Provider settings updated.') }
    catch (reason) { setError(API.aiKeyError(reason)); if ([401, 403].includes(reason?.response?.status)) onDenied() }
    finally { inFlight.current = false; setBusy(false) }
  }
  return <SettingsDialog title={`${providerName(provider.provider)} settings`} busy={busy} onClose={onClose}><form onSubmit={submit}>
    <p>Disabling a managed provider stops central AI use for that provider. Legacy credentials will not be activated instead.</p>
    {error && <p role="alert" className="aik-message aik-warning">{error}</p>}
    <fieldset disabled={busy}><label className="aik-check"><input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} /> Enable provider</label><label>Default model (optional)<input value={model} maxLength={160} onChange={event => setModel(event.target.value)} autoComplete="off" /><small>Leave blank to retain each module’s supported model. A model must be supported by the consuming module.</small></label></fieldset>
    <footer><button type="button" className="aik-button" disabled={busy} onClick={onClose}>Cancel</button><button className="aik-button aik-primary" disabled={busy}>Save provider</button></footer>
  </form></SettingsDialog>
}

function TestForm({ credential, provider, onSaved, onClose, onDenied }) {
  const [model, setModel] = useState(provider.model || credential.last_test_model || '')
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const inFlight = useRef(false)
  const submit = async event => {
    event.preventDefault()
    if (inFlight.current) return
    inFlight.current = true; setBusy(true); setError('')
    try { const next = await API.testAIKey(credential.id, { expected_revision: credential.revision, model: model.trim() }); onSaved(next, API.aiTestMessage(next.test), next.test?.success ? 'success' : 'warning') }
    catch (reason) { setError(API.aiKeyError(reason)); if ([401, 403].includes(reason?.response?.status)) onDenied() }
    finally { inFlight.current = false; setBusy(false) }
  }
  return <SettingsDialog title={`Test ${credential.label}`} busy={busy} onClose={onClose}><form onSubmit={submit}>
    <p>This sends a small synthetic request to {providerName(credential.provider)}. No emails or documents are included. Provider usage charges may apply.</p>
    {error && <p role="alert" className="aik-message aik-warning">{error}</p>}
    <label>Model to test<input required maxLength={160} value={model} onChange={event => setModel(event.target.value)} disabled={busy} autoComplete="off" placeholder="Enter a model available to this key" /></label>
    <footer><button type="button" className="aik-button" disabled={busy} onClick={onClose}>Cancel</button><button className="aik-button aik-primary" disabled={busy}>{busy && <Loader2 size={16} className="aik-spin" />}Test connection</button></footer>
  </form></SettingsDialog>
}

function AIKeysConsole() {
  const [overview, setOverview] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState('')
  const [denied, setDenied] = useState(false), [dialog, setDialog] = useState(null), [notice, setNotice] = useState(null), [busy, setBusy] = useState(false)
  const inFlight = useRef(false), requestId = useRef(0)
  const deny = () => { setDenied(true); setOverview(null); setDialog(null); setNotice(null) }
  const refresh = useCallback(async signal => {
    const id = ++requestId.current
    setLoading(true); setError(''); setNotice(null)
    try { const data = await API.listAIKeys(signal); if (id === requestId.current && !signal?.aborted) setOverview(data) }
    catch (reason) { if (id === requestId.current && !signal?.aborted) { setError(API.aiKeyError(reason)); if ([401, 403].includes(reason?.response?.status)) { setDenied(true); setOverview(null); setDialog(null) } } }
    finally { if (id === requestId.current && !signal?.aborted) setLoading(false) }
  }, [])
  useEffect(() => { const controller = new AbortController(); refresh(controller.signal); return () => { controller.abort(); requestId.current += 1 } }, [refresh])
  const saved = (data, message, tone = 'success') => { requestId.current += 1; setOverview(data); setDialog(null); setNotice({ message, tone }); setError('') }
  const mutate = async (action, message) => {
    if (inFlight.current) return
    inFlight.current = true; setBusy(true); setError(''); setNotice(null)
    try { saved(await action(), message) }
    catch (reason) { setError(API.aiKeyError(reason)); if ([401, 403].includes(reason?.response?.status)) deny() }
    finally { inFlight.current = false; setBusy(false) }
  }
  if (denied) return <Denied />
  const blocked = loading || busy || !overview?.encryption_ready
  const revisions = credential => ({ expected_revision: credential.revision, expected_provider_revision: overview.providers.find(provider => provider.provider === credential.provider)?.revision ?? 0 })
  return <section className="aik-page" aria-labelledby="ai-api-keys-title">
    <header className="aik-header"><div><div className="aik-breadcrumb">Administration <ChevronRight size={13} /> AI configuration</div><h1 id="ai-api-keys-title"><KeyRound size={24} />AI API keys</h1><p>Manage the provider credentials used by RADAI extraction modules.</p></div><div className="aik-actions"><button className="aik-button" disabled={loading || busy} onClick={() => refresh()}><RefreshCw size={16} className={loading ? 'aik-spin' : ''} />Refresh</button><button className="aik-button aik-primary" disabled={blocked} onClick={() => setDialog({ type: 'add' })}><Plus size={16} />Add API key</button></div></header>
    {loading && <p role="status" className="aik-message">Loading AI credentials…</p>}
    {error && <p role="alert" className="aik-message aik-warning">{error}</p>}
    {notice && <p role="status" className={`aik-message aik-${notice.tone}`}>{notice.message}</p>}
    {overview && <>
      {!overview.encryption_ready && <p role="alert" className="aik-message aik-warning"><ShieldCheck size={18} />Secure credential storage is not configured on this server. Ask the server administrator to configure its encryption key, then refresh.</p>}
      <div className="aik-providers" aria-label="Provider configuration">{overview.providers.map(provider => <article className="aik-provider" key={provider.provider}><div><h2>{providerName(provider.provider)}</h2><span className={`aik-badge ${provider.ready ? 'aik-ready' : ''}`}>{!provider.managed ? 'Server configuration' : !provider.enabled ? 'Disabled' : provider.ready ? 'Configured' : 'Needs configuration'}</span></div><p>{provider.model || 'Module-specific model'}</p><small>{provider.managed ? 'Uses the selected central credential.' : 'No central credential selected. Existing server configuration applies.'}</small><button className="aik-button" disabled={blocked || !provider.managed} onClick={() => setDialog({ type: 'provider', provider })}><Settings2 size={15} />Provider settings</button></article>)}</div>
      <div className="aik-card"><header><h2>Saved credentials</h2><span>{overview.credentials.length} {overview.credentials.length === 1 ? 'key' : 'keys'}</span></header>
        {!overview.credentials.length ? <div className="aik-empty"><KeyRound size={28} /><h3>No central API keys yet</h3><p>Add a provider key to make it available to supported RADAI modules.</p></div> : <div className="aik-table-scroll" role="region" aria-label="Saved API keys" tabIndex={0}><table><thead><tr><th>Key name</th><th>Provider</th><th>API key</th><th>Status</th><th>Last connection test</th><th>Actions</th></tr></thead><tbody>{overview.credentials.map(credential => <tr key={credential.id}><th scope="row">{credential.label}{credential.is_selected && <span className="aik-default"><CheckCircle2 size={13} />Default</span>}</th><td>{providerName(credential.provider)}</td><td><span aria-label="API key stored securely">••••••••</span></td><td><span className={`aik-badge ${credential.enabled ? 'aik-ready' : ''}`}>{credential.enabled ? 'Enabled' : 'Disabled'}</span></td><td><span>{testLabel(credential.last_test_status)}</span><small>{when(credential.last_tested_at)}</small>{credential.last_test_model && <small>{credential.last_test_model}</small>}</td><td><div className="aik-row-actions"><button disabled={blocked} onClick={() => setDialog({ type: 'edit', credential })}>Edit<span className="aik-sr"> {credential.label}</span></button><button disabled={blocked} onClick={() => setDialog({ type: 'test', credential, provider: overview.providers.find(provider => provider.provider === credential.provider) })}>Test<span className="aik-sr"> {credential.label}</span></button>{!credential.is_selected && <button disabled={blocked || !credential.enabled} onClick={() => mutate(() => API.selectAIKey(credential.id, revisions(credential)), 'Default credential selected.')}>Set default<span className="aik-sr"> {credential.label}</span></button>}<button disabled={blocked} onClick={() => mutate(() => API.updateAIKey(credential.id, { ...revisions(credential), enabled: !credential.enabled }), credential.enabled ? 'Credential disabled.' : 'Credential enabled.')}>{credential.enabled ? 'Disable' : 'Enable'}<span className="aik-sr"> {credential.label}</span></button><button disabled={blocked} onClick={() => setDialog({ type: 'delete', credential })}>Remove<span className="aik-sr"> {credential.label}</span></button></div></td></tr>)}</tbody></table></div>}
      </div><p className="aik-footnote"><ShieldCheck size={16} />Keys remain on the server. Connection tests verify only the named model at the recorded time; extraction results still need review.</p>
    </>}
    {dialog?.type === 'add' || dialog?.type === 'edit' ? <KeyForm credential={dialog.credential} overview={overview} onSaved={saved} onClose={() => setDialog(null)} onDenied={deny} /> : null}
    {dialog?.type === 'provider' && <ProviderForm provider={dialog.provider} onSaved={saved} onClose={() => setDialog(null)} onDenied={deny} />}
    {dialog?.type === 'test' && <TestForm credential={dialog.credential} provider={dialog.provider} onSaved={saved} onClose={() => setDialog(null)} onDenied={deny} />}
    {dialog?.type === 'delete' && <SettingsDialog title="Remove AI API key" busy={busy} onClose={() => setDialog(null)}><div className="aik-dialog-body"><p>Remove <strong>{dialog.credential.label}</strong>? {dialog.credential.is_selected ? 'This is the default key. A replacement will not be selected automatically.' : 'The selected default key will remain unchanged.'}</p>{error && <p role="alert" className="aik-message aik-warning">{error}</p>}<footer><button className="aik-button" disabled={busy} onClick={() => setDialog(null)}>Cancel</button><button className="aik-button aik-danger" disabled={busy} onClick={() => mutate(() => API.deleteAIKey(dialog.credential.id, revisions(dialog.credential)), 'Credential removed.')}>Remove key</button></footer></div></SettingsDialog>}
  </section>
}

function Denied() { return <section className="aik-page aik-denied"><ShieldCheck size={28} /><h1>Administrator access required</h1><p>Your account cannot manage AI provider credentials.</p></section> }

export default function AIAPIKeys() {
  const user = useSelector(state => state.auth?.user)
  if (!API.canManageAIKeys(user)) return <Denied />
  return <AIKeysConsole key={user?.user?.id || user?.id} />
}
