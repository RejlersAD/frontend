/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { toast } from 'react-toastify'
import {
  AlertTriangle, CheckCircle2, ChevronRight, Info, KeyRound, Loader2, Lock,
  Plus, RefreshCw, ShieldCheck, X,
} from 'lucide-react'
import * as Hub from '../../services/aiModelHub.service'
import { canManageAIKeys } from '../../services/aiAPIKeys.service'
import './AIAPIKeys.css'

const GROUPS = [
  { id: 'paid', label: 'Paid APIs' },
  { id: 'cloud', label: 'Cloud platforms' },
  { id: 'open', label: 'Open-weight APIs' },
  { id: 'gateway', label: 'Gateways' },
  { id: 'self', label: 'Self-hosted' },
]
const CAPABILITIES = [
  ['text', 'Text'], ['vision', 'Vision'], ['reasoning', 'Reasoning'], ['code', 'Code'],
  ['tools', 'Tools / JSON'], ['embedding', 'Embedding'], ['image_gen', 'Image gen'],
]
const MODEL_STATUS = {
  ga: ['GA', 'rd-pill-success'],
  new: ['New', 'rd-pill-info'],
  preview: ['Preview', 'rd-pill-warning'],
  deprecated: ['Deprecated', 'rd-pill-warning'],
  shut_down: ['Shut down', 'rd-pill-danger'],
}
const PROVIDER_STATUS = {
  connected: ['Connected', 'rd-pill-success'],
  server_config: ['Server configuration', 'rd-pill-info'],
  not_connected: ['Not connected', 'rd-pill-neutral'],
}
const SCOPE_PILL = {
  org: ['Organisation', 'rd-pill-info'],
  module: ['Module', 'rd-pill-neutral'],
  personal: ['Personal (BYOK)', 'rd-pill-ai'],
}
const AUTH_LABEL = {
  key: 'API key', azure: 'Endpoint + key', bedrock: 'AWS role or access keys',
  vertex: 'Service account', base: 'Base URL + key', local: 'Local endpoint',
}
const CHANGE_PILL = {
  new: ['New', 'rd-pill-info'], ga: ['GA', 'rd-pill-success'],
  deprecated: ['Deprecated', 'rd-pill-warning'], shut_down: ['Shut down', 'rd-pill-danger'],
}
const NEEDS_LABEL = {
  text: 'Text', vision: 'Vision', reasoning: 'Reasoning', code: 'Code',
  tools: 'Tools / JSON', embedding: 'Embedding', image_gen: 'Image gen',
}
const LAST_RUN_KEY = 'radai.aiHub.lastSyncRunId'

const modelKey = (providerId, modelId) => `${providerId}:${modelId}`
const initials = name => (name || '?').split(/[\s-]+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase()
const fmtDate = value => value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Never'
const fmtPrice = value => value == null ? null : `$${Number(value).toFixed(2)}`
const isDone = run => Boolean(run?.finished_at) || ['finished', 'completed', 'failed', 'error'].includes(run?.status)

function Pill({ map, value }) {
  const [label, tone] = map[value] || [value || 'Unknown', 'rd-pill-neutral']
  return <span className={`rd-pill ${tone}`}>{label}</span>
}

function Switch({ checked, disabled, onChange, label }) {
  return <label className="aim-switch">
    <input type="checkbox" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} aria-label={label} />
    <span aria-hidden="true" />
  </label>
}

/* ------------------------------------------------------------------ */
/* Add credential drawer                                               */
/* ------------------------------------------------------------------ */
function CredentialDrawer({ providers, modules, storageConfigured, initialProviderId, onClose, onSaved }) {
  const [providerId, setProviderId] = useState(initialProviderId || providers[0]?.id || '')
  const provider = providers.find(row => row.id === providerId)
  const [fields, setFields] = useState({})
  const [name, setName] = useState('')
  const [scope, setScope] = useState('org')
  const [moduleIds, setModuleIds] = useState([])
  const [cap, setCap] = useState('')
  const [rotate, setRotate] = useState('90')
  const [tested, setTested] = useState(null)
  const [ticked, setTicked] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inFlight = useRef(false)

  useEffect(() => {
    setFields(provider?.default_base_url ? { base_url: provider.default_base_url } : {})
    setTested(null); setTicked(null); setError('')
  }, [providerId]) // eslint-disable-line react-hooks/exhaustive-deps

  const setField = (key, value) => { setFields(previous => ({ ...previous, [key]: value })); setTested(null) }
  const authFields = () => Object.fromEntries(Object.entries(fields).filter(([, value]) => String(value ?? '').trim() !== '')
    .map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]))

  const run = async action => {
    if (inFlight.current) return
    inFlight.current = true; setBusy(true); setError('')
    try { await action() }
    catch (reason) { setError(Hub.hubError(reason)) }
    finally { inFlight.current = false; setBusy(false) }
  }

  const test = () => run(async () => {
    const result = await Hub.testCredentialPayload({ provider_id: providerId, ...authFields() })
    setTested(result)
    if (result?.ok) {
      const listed = result.models || []
      setTicked(new Set(listed.filter(model => !['deprecated', 'shut_down'].includes(model.status)).map(model => model.model_id)))
      if (!listed.length) setError('The connection worked, but the provider listed no models.')
    }
  })

  const save = () => run(async () => {
    await Hub.createCredential({
      provider_id: providerId,
      name: name.trim(),
      scope,
      ...(scope === 'module' ? { module_ids: moduleIds } : {}),
      monthly_cap_usd: cap === '' ? null : Number(cap),
      rotate_days: rotate === 'never' ? null : Number(rotate),
      ...(ticked ? { models_allowed: [...ticked] } : {}),
      ...authFields(),
    })
    toast.success(`Credential saved for ${name.trim() || provider?.name || 'provider'}. Only the last 4 characters will be shown.`)
    onSaved()
  })

  const kind = provider?.auth_kind || 'key'
  const canSave = Boolean(tested?.ok) && storageConfigured && name.trim() !== '' && !busy
  const listed = tested?.models || []

  return <>
    <div className="rd-drawer-backdrop" onClick={busy ? undefined : onClose} aria-hidden="true" />
    <aside className="rd-drawer aim-drawer" role="dialog" aria-label="Add credential">
      <header className="rd-drawer-header">Add credential
        <button type="button" className="rd-btn rd-btn-ghost rd-btn-sm" aria-label="Close" disabled={busy} onClick={onClose}><X size={18} /></button>
      </header>
      <div className="rd-drawer-body">
        {error && <p role="alert" className="rd-banner rd-banner-danger">{error}</p>}
        {!storageConfigured && <p role="alert" className="rd-banner rd-banner-warning"><AlertTriangle size={16} />Secure credential storage is not configured. You can test a connection, but saving is disabled.</p>}

        <label className="aim-field">Provider
          <select className="rd-select" value={providerId} disabled={busy} onChange={event => setProviderId(event.target.value)}>
            {providers.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
          </select>
        </label>

        {/* Auth fields driven by provider.auth_kind */}
        {(kind === 'key' || kind === 'base' || kind === 'local') && <>
          {(kind === 'base' || kind === 'local') && <label className="aim-field">Base URL
            <input className="rd-input" value={fields.base_url || ''} autoComplete="off" spellCheck={false}
              placeholder={provider?.default_base_url || 'https://'} onChange={event => setField('base_url', event.target.value)} />
          </label>}
          <label className="aim-field">{kind === 'local' ? 'API key (optional)' : 'API key'}
            <input className="rd-input" type="password" required={kind !== 'local'} autoComplete="off" spellCheck={false} autoCapitalize="none"
              value={fields.secret || ''} onChange={event => setField('secret', event.target.value)} />
          </label>
          {kind === 'key' && <label className="aim-field">Base URL override (optional)
            <input className="rd-input" value={fields.base_url || ''} autoComplete="off" spellCheck={false}
              placeholder={provider?.default_base_url || 'Provider default'} onChange={event => setField('base_url', event.target.value)} />
          </label>}
          {kind === 'key' && provider?.protocol?.startsWith('openai') && <>
            <label className="aim-field">Organisation ID (optional)
              <input className="rd-input" value={fields.org_id || ''} autoComplete="off" onChange={event => setField('org_id', event.target.value)} />
            </label>
            <label className="aim-field">Project ID (optional)
              <input className="rd-input" value={fields.project_id || ''} autoComplete="off" onChange={event => setField('project_id', event.target.value)} />
            </label>
          </>}
          {kind === 'local' && <p className="rd-banner rd-banner-info"><Info size={16} />The server, not the browser, calls this address.</p>}
        </>}
        {kind === 'azure' && <>
          <label className="aim-field">Endpoint
            <input className="rd-input" value={fields.endpoint || fields.base_url || ''} autoComplete="off" spellCheck={false} placeholder="https://…openai.azure.com"
              onChange={event => { setField('endpoint', event.target.value); setField('base_url', event.target.value) }} />
          </label>
          <label className="aim-field">API key
            <input className="rd-input" type="password" autoComplete="off" spellCheck={false} value={fields.secret || ''} onChange={event => setField('secret', event.target.value)} />
          </label>
          <label className="aim-field">API version
            <input className="rd-input" value={fields.api_version || ''} autoComplete="off" placeholder="2024-10-21" onChange={event => setField('api_version', event.target.value)} />
          </label>
        </>}
        {kind === 'bedrock' && <>
          <label className="aim-field">AWS region
            <input className="rd-input" value={fields.region || ''} autoComplete="off" placeholder="eu-west-1" onChange={event => setField('region', event.target.value)} />
          </label>
          <label className="aim-field">Role ARN (recommended)
            <input className="rd-input" value={fields.role_arn || ''} autoComplete="off" placeholder="arn:aws:iam::…:role/…" onChange={event => setField('role_arn', event.target.value)} />
            <small>Or provide an access key pair below.</small>
          </label>
          <label className="aim-field">Access key ID
            <input className="rd-input" value={fields.access_key || ''} autoComplete="off" onChange={event => setField('access_key', event.target.value)} />
          </label>
          <label className="aim-field">Secret access key
            <input className="rd-input" type="password" autoComplete="off" spellCheck={false} value={fields.secret || ''} onChange={event => setField('secret', event.target.value)} />
          </label>
        </>}
        {kind === 'vertex' && <>
          <label className="aim-field">Project
            <input className="rd-input" value={fields.project || ''} autoComplete="off" onChange={event => setField('project', event.target.value)} />
          </label>
          <label className="aim-field">Region
            <input className="rd-input" value={fields.region || ''} autoComplete="off" placeholder="europe-west1" onChange={event => setField('region', event.target.value)} />
          </label>
          <label className="aim-field">Service-account JSON
            <textarea className="rd-input" rows={6} style={{ minHeight: 120, padding: '0.5rem 0.75rem' }} spellCheck={false}
              value={fields.service_account_json || ''} onChange={event => setField('service_account_json', event.target.value)} />
          </label>
        </>}

        <div className="aim-field">Scope
          <div className="aim-segment" role="radiogroup" aria-label="Credential scope">
            {[['org', 'Organisation'], ['module', 'Module'], ['personal', 'Personal (BYOK)']].map(([value, label]) =>
              <button key={value} type="button" role="radio" aria-checked={scope === value} className={scope === value ? 'aim-segment-active' : ''}
                onClick={() => setScope(value)}>{label}</button>)}
          </div>
          <small>{scope === 'org' ? 'Available to every module in the organisation.'
            : scope === 'module' ? 'Restricted to the selected modules.'
            : 'Only you can use this key. It follows your account, not the organisation.'}</small>
        </div>
        {scope === 'module' && <div className="aim-field">Modules
          {modules.length ? modules.map(module =>
            <label key={module} className="aim-check">
              <input type="checkbox" checked={moduleIds.includes(module)}
                onChange={event => setModuleIds(previous => event.target.checked ? [...previous, module] : previous.filter(id => id !== module))} />
              {module}
            </label>) : <small>No routable modules were returned by the server yet.</small>}
        </div>}

        <label className="aim-field">Credential name
          <input className="rd-input" required maxLength={120} value={name} autoComplete="off" placeholder="e.g. Engineering primary"
            onChange={event => setName(event.target.value)} />
        </label>
        <label className="aim-field">Monthly spend cap (USD, optional)
          <input className="rd-input" type="number" min="0" step="0.01" value={cap} onChange={event => setCap(event.target.value)} />
        </label>
        <label className="aim-field">Rotation
          <select className="rd-select" value={rotate} onChange={event => setRotate(event.target.value)}>
            <option value="90">Every 90 days</option>
            <option value="180">Every 180 days</option>
            <option value="never">Never</option>
          </select>
        </label>

        {tested?.ok && <>
          <p className="rd-banner rd-banner-info" style={{ borderColor: 'var(--rd-success)', color: 'var(--rd-success)', background: 'var(--rd-success-soft)' }}>
            <CheckCircle2 size={16} />Connection OK. {listed.length} {listed.length === 1 ? 'model' : 'models'} listed by {provider?.name || 'the provider'}.
          </p>
          {listed.length > 0 && <div className="aim-field">Models this credential may use
            <div className="aim-models-check">
              {listed.map(model => {
                const inactive = ['deprecated', 'shut_down'].includes(model.status)
                return <label key={model.model_id} className="aim-check">
                  <input type="checkbox" checked={ticked?.has(model.model_id) ?? false}
                    onChange={event => setTicked(previous => {
                      const next = new Set(previous)
                      if (event.target.checked) next.add(model.model_id); else next.delete(model.model_id)
                      return next
                    })} />
                  <span className="rd-mono">{model.model_id}</span>
                  {inactive && <Pill map={MODEL_STATUS} value={model.status} />}
                </label>
              })}
            </div>
            <small>Deprecated and shut-down models start unticked.</small>
          </div>}
        </>}
        {tested && !tested.ok && <p role="alert" className="rd-banner rd-banner-danger"><AlertTriangle size={16} />{tested.error || 'The connection test failed. Check the fields and retry.'}</p>}
      </div>
      <footer className="rd-drawer-footer">
        <button type="button" className="rd-btn rd-btn-secondary" disabled={busy} onClick={test}>
          {busy && <Loader2 size={16} className="aim-spin" />}Test connection
        </button>
        <button type="button" className="rd-btn rd-btn-primary" disabled={!canSave} onClick={save}
          title={!storageConfigured ? 'Secure credential storage is not configured' : !tested?.ok ? 'Run a successful connection test first' : undefined}>
          Save credential
        </button>
      </footer>
    </aside>
  </>
}

/* ------------------------------------------------------------------ */
/* Tabs                                                                */
/* ------------------------------------------------------------------ */
function ProvidersTab({ providers, filter, setFilter, onConnect, onManage }) {
  const visible = filter === 'all' ? GROUPS : GROUPS.filter(group => group.id === filter)
  return <>
    <div className="aim-chips" role="group" aria-label="Provider group filter">
      <button type="button" className={`aim-chip ${filter === 'all' ? 'aim-chip-active' : ''}`} onClick={() => setFilter('all')}>All</button>
      {GROUPS.map(group => <button key={group.id} type="button" className={`aim-chip ${filter === group.id ? 'aim-chip-active' : ''}`}
        onClick={() => setFilter(group.id)}>{group.label}</button>)}
    </div>
    {visible.map(group => {
      const rows = providers.filter(provider => provider.group === group.id)
      if (!rows.length) return null
      return <section key={group.id} className="aim-group" aria-label={group.label}>
        <h2 className="aim-group-title">{group.label}</h2>
        <div className="aim-provider-grid">
          {rows.map(provider => {
            const action = provider.status === 'connected' ? 'Manage' : provider.status === 'server_config' ? 'Add own key' : 'Connect'
            return <article key={provider.id} className="rd-card aim-provider-card">
              <div className="aim-provider-head">
                <span className="aim-mark" aria-hidden="true">{initials(provider.name)}</span>
                <div style={{ minWidth: 0 }}>
                  <h3 className="aim-provider-name">{provider.name}</h3>
                  <p className="aim-provider-meta">{provider.protocol} · {AUTH_LABEL[provider.auth_kind] || provider.auth_kind}</p>
                </div>
              </div>
              <div className="aim-provider-row"><Pill map={PROVIDER_STATUS} value={provider.status} /></div>
              {provider.list_endpoint && <span className="aim-endpoint">{provider.list_endpoint}</span>}
              <div className="aim-provider-row">
                <span className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)' }}>{provider.models_count ?? 0} in catalogue</span>
                <button type="button" className="rd-btn rd-btn-secondary rd-btn-sm"
                  onClick={() => action === 'Manage' ? onManage(provider) : onConnect(provider)}>{action}</button>
              </div>
            </article>
          })}
        </div>
      </section>
    })}
    {!providers.length && <div className="aim-empty"><KeyRound size={28} /><h3>No providers registered</h3><p>The provider registry is empty. Run a catalogue sync or check the server seed.</p></div>}
  </>
}

function ModelsTab({ data, filters, setFilters, onToggle }) {
  const { search, caps, weights, status } = filters
  const counts = data?.counts || {}
  const models = data?.models || []
  const toggleCap = cap => setFilters(previous => ({
    ...previous, caps: previous.caps.includes(cap) ? previous.caps.filter(item => item !== cap) : [...previous.caps, cap],
  }))
  return <>
    <div className="aim-toolbar">
      <input className="rd-input aim-search" type="search" placeholder="Search models, makers, families…" aria-label="Search models"
        value={search} onChange={event => setFilters(previous => ({ ...previous, search: event.target.value }))} />
      <div className="aim-segment" role="group" aria-label="Weights filter">
        {[['all', 'All'], ['closed', 'Closed'], ['open', 'Open weights']].map(([value, label]) =>
          <button key={value} type="button" className={weights === value ? 'aim-segment-active' : ''}
            onClick={() => setFilters(previous => ({ ...previous, weights: value }))}>{label}</button>)}
      </div>
    </div>
    <div className="aim-chips" role="group" aria-label="Capability filter">
      {CAPABILITIES.map(([cap, label]) => <button key={cap} type="button"
        className={`aim-chip ${caps.includes(cap) ? 'aim-chip-active' : ''}`} onClick={() => toggleCap(cap)}>
        {label}<span className="rd-mono">{counts.per_capability?.[cap] ?? 0}</span>
      </button>)}
      <button type="button" className={`aim-chip ${status === 'deprecated' ? 'aim-chip-active' : ''}`}
        onClick={() => setFilters(previous => ({ ...previous, status: previous.status === 'deprecated' ? '' : 'deprecated' }))}>
        Retiring<span className="rd-mono">{counts.per_status?.deprecated ?? 0}</span>
      </button>
    </div>
    <div className="aim-table-box" role="region" aria-label="Model catalogue" tabIndex={0}>
      <table className="rd-table">
        <thead><tr>
          <th>Use in RADAI</th><th>Model ID</th><th>Maker</th><th>Family</th><th>Variant</th><th>Served by</th>
          <th>Capabilities</th><th>Weights</th><th>Licence</th><th>Status</th><th>Context</th><th>Price / 1M</th>
        </tr></thead>
        <tbody>
          {models.map(model => {
            const key = modelKey(model.provider_id, model.model_id)
            const shutDown = model.status === 'shut_down'
            const priceIn = fmtPrice(model.price_in_per_m); const priceOut = fmtPrice(model.price_out_per_m)
            return <tr key={key}>
              <td><Switch checked={Boolean(model.enabled)} disabled={shutDown} label={`Use ${model.model_id} in RADAI`} onChange={value => onToggle(model, value)} /></td>
              <td className="rd-mono">{model.model_id}</td>
              <td>{model.maker || '—'}</td>
              <td>{model.family || '—'}</td>
              <td>{model.variant ? <span className="rd-pill rd-pill-neutral">{model.variant}</span> : '—'}</td>
              <td>{model.provider_name}</td>
              <td>{(model.capabilities || []).map(cap => <span key={cap} className="rd-pill rd-pill-neutral" style={{ marginRight: 4 }}>{NEEDS_LABEL[cap] || cap}</span>)}</td>
              <td>{model.weights === 'open' ? 'Open' : model.weights === 'closed' ? 'Closed' : model.weights || '—'}</td>
              <td>{model.licence || '—'}</td>
              <td><Pill map={MODEL_STATUS} value={model.status} />{model.status_note && <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)' }}>{model.status_note}</div>}</td>
              <td className="rd-mono">{model.context_tokens ? model.context_tokens.toLocaleString('en-GB') : '—'}</td>
              <td className="rd-mono">{priceIn || priceOut ? `${priceIn || '—'} / ${priceOut || '—'}` : '—'}</td>
            </tr>
          })}
          {!models.length && <tr><td colSpan="12"><div className="aim-empty"><h3>No model matches these filters.</h3><p>Adjust the search, weights or capability filters, or run a catalogue sync.</p></div></td></tr>}
        </tbody>
      </table>
    </div>
  </>
}

function CredentialsTab({ data, storageConfigured, onTest, onRotate, onRevoke, onDelete }) {
  const credentials = data?.credentials || []
  const testLabel = row => row.last_test_ok === true ? ['Passed', 'rd-pill-success'] : row.last_test_ok === false ? ['Failed', 'rd-pill-danger'] : ['Not tested', 'rd-pill-neutral']
  return <div className="aim-stack">
    <div className="aim-table-box" role="region" aria-label="Saved credentials" tabIndex={0}>
      <table className="rd-table">
        <thead><tr>
          <th>Name</th><th>Provider</th><th>Scope</th><th>Key</th><th>Models allowed</th><th>Spend cap</th><th>Last test</th><th>Rotation</th><th>Actions</th>
        </tr></thead>
        <tbody>
          {credentials.map(row => {
            const [label, tone] = testLabel(row)
            return <tr key={row.id}>
              <td><strong>{row.name}</strong>{row.created_by && <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)' }}>Added by {row.owner_display || row.created_by}</div>}</td>
              <td>{row.provider_name}</td>
              <td><Pill map={SCOPE_PILL} value={row.scope} /></td>
              <td className="rd-mono">{row.key_display || '••••'}</td>
              <td>{row.models_allowed?.length ? `${row.models_allowed.length} ${row.models_allowed.length === 1 ? 'model' : 'models'}` : 'All'}</td>
              <td className="rd-mono">{row.monthly_cap_usd != null ? `$${row.monthly_cap_usd}/mo` : 'No cap'}</td>
              <td><span className={`rd-pill ${tone}`}>{label}</span>{row.last_test_model && <div className="rd-mono rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)' }}>{row.last_test_model}</div>}</td>
              <td>{row.rotate_days ? `Every ${row.rotate_days} days` : 'Never'}</td>
              <td><div className="aim-row-actions">
                <button type="button" className="rd-btn rd-btn-ghost rd-btn-sm" disabled={!storageConfigured} onClick={() => onTest(row)}>Test<span className="aim-sr"> {row.name}</span></button>
                <button type="button" className="rd-btn rd-btn-ghost rd-btn-sm" disabled={!storageConfigured} onClick={() => onRotate(row)}>Rotate<span className="aim-sr"> {row.name}</span></button>
                <button type="button" className="rd-btn rd-btn-ghost rd-btn-sm" disabled={!storageConfigured} onClick={() => onRevoke(row)}>Revoke<span className="aim-sr"> {row.name}</span></button>
                <button type="button" className="rd-btn rd-btn-ghost rd-btn-sm aim-danger" onClick={() => onDelete(row)}>Delete<span className="aim-sr"> {row.name}</span></button>
              </div></td>
            </tr>
          })}
        </tbody>
      </table>
      {!credentials.length && <div className="aim-empty">
        <Lock size={28} />
        <h3>No saved credentials</h3>
        <p>{storageConfigured
          ? 'OpenAI / Anthropic / Gemini run on the server configuration until you add a credential here.'
          : 'Secure credential storage is not configured on this server. Ask the server administrator to configure its encryption key.'}</p>
        <p>No central credential selected. Existing server configuration applies.</p>
      </div>}
    </div>
    <p className="aim-note"><Info size={16} />Key resolution order: Personal key → module key → organisation key → server configuration. Keys remain on the server and are never shown again.</p>
  </div>
}

function RoutingTab({ tasks, byKey, models, onSaved }) {
  const [edits, setEdits] = useState({})
  const [slotErrors, setSlotErrors] = useState({})
  const [saving, setSaving] = useState('')
  const eligible = useCallback((task, model) => Boolean(model?.enabled)
    && model.status !== 'shut_down'
    && (task.needs || []).every(need => (model.capabilities || []).includes(need))
    && (task.data_policy !== 'onprem' || model.provider_group === 'self'), [])
  const chainOf = task => edits[task.task_id] ?? task.chain ?? [null, null, null]
  const checkOf = task => {
    const chain = chainOf(task)
    if (!chain[0]) return ['Server default', 'rd-pill-neutral']
    const model = byKey[chain[0]]
    if (!model || !eligible(task, model)) return ['Not eligible', 'rd-pill-danger']
    if (model.status === 'deprecated') return ['Replace model', 'rd-pill-warning']
    if (!chain[1] && !chain[2]) return ['No fallback', 'rd-pill-warning']
    return ['Ready', 'rd-pill-success']
  }
  const save = async task => {
    setSaving(task.task_id); setSlotErrors(previous => ({ ...previous, [task.task_id]: null }))
    try {
      const chain = [0, 1, 2].map(index => chainOf(task)[index] || null)
      const next = await Hub.saveRoute(task.task_id, chain)
      setEdits(previous => { const copy = { ...previous }; delete copy[task.task_id]; return copy })
      onSaved(task.task_id, next)
      toast.success(`Routing saved for ${task.label}.`)
    } catch (reason) {
      setSlotErrors(previous => ({ ...previous, [task.task_id]: Hub.routeErrors(reason) || [Hub.hubError(reason), null, null] }))
    } finally { setSaving('') }
  }
  const slotLabels = ['Primary', 'Fallback 1', 'Fallback 2']
  return <div className="aim-table-box" role="region" aria-label="Module routing" tabIndex={0}>
    <table className="rd-table">
      <thead><tr><th>Module · task</th><th>Needs</th><th>Data policy</th><th>Primary</th><th>Fallback 1</th><th>Fallback 2</th><th>Check</th><th></th></tr></thead>
      <tbody>
        {tasks.map(task => {
          const chain = chainOf(task)
          const [checkLabel, checkTone] = checkOf(task)
          const dirty = Boolean(edits[task.task_id])
          const errors = slotErrors[task.task_id]
          return <tr key={task.task_id}>
            <td><strong>{task.module}</strong><div>{task.label}</div>{task.path && <div className="rd-mono rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)' }}>{task.path}</div>}</td>
            <td>{(task.needs || []).map(need => <span key={need} className="rd-pill rd-pill-neutral" style={{ marginRight: 4 }}>{NEEDS_LABEL[need] || need}</span>)}</td>
            <td><span className={`rd-pill ${task.data_policy === 'onprem' ? 'rd-pill-success' : 'rd-pill-neutral'}`}>{task.data_policy === 'onprem' ? 'On-premises only' : 'Cloud allowed'}</span></td>
            {[0, 1, 2].map(index => {
              const value = chain[index] || ''
              const options = models.filter(model => eligible(task, model))
              const current = value ? byKey[value] : null
              const currentIneligible = value && (!current || !eligible(task, current))
              return <td key={slotLabels[index]}>
                <select className={`rd-select ${errors?.[index] ? 'rd-input-error' : ''}`} value={value} aria-label={`${slotLabels[index]} for ${task.label}`}
                  disabled={saving === task.task_id}
                  onChange={event => setEdits(previous => {
                    const next = [...(previous[task.task_id] ?? task.chain ?? [null, null, null])]
                    next[index] = event.target.value || null
                    return { ...previous, [task.task_id]: next }
                  })}>
                  <option value="">{index === 0 ? 'Server configuration' : 'None'}</option>
                  {options.map(model => <option key={modelKey(model.provider_id, model.model_id)} value={modelKey(model.provider_id, model.model_id)}>
                    {model.model_id} — {model.provider_name}
                  </option>)}
                  {currentIneligible && <option value={value}>{current ? `${current.model_id} — ${current.provider_name}` : value} (not eligible)</option>}
                </select>
                {errors?.[index] && <span className="aim-inline-error" role="alert">{errors[index]}</span>}
              </td>
            })}
            <td><span className={`rd-pill ${checkTone}`}>{checkLabel}</span></td>
            <td><button type="button" className="rd-btn rd-btn-secondary rd-btn-sm" disabled={!dirty || saving === task.task_id} onClick={() => save(task)}>
              {saving === task.task_id && <Loader2 size={14} className="aim-spin" />}Save
            </button></td>
          </tr>
        })}
        {!tasks.length && <tr><td colSpan="8"><div className="aim-empty"><h3>No routable tasks returned yet.</h3><p>The server has not published any module routing entries.</p></div></td></tr>}
      </tbody>
    </table>
  </div>
}

function SyncTab({ schedule, lastRun, onSaveSchedule, savingSchedule }) {
  const [form, setForm] = useState(schedule)
  useEffect(() => { setForm(schedule) }, [schedule])
  const set = (key, value) => setForm(previous => ({ ...previous, [key]: value }))
  const sources = lastRun?.per_source || []
  const changes = lastRun?.changes || []
  return <div className="aim-stack">
    <section className="rd-card">
      <header className="rd-card-header">Catalogue sync schedule</header>
      <div className="rd-card-body">
        {!form ? <p className="rd-text-muted">Schedule unavailable.</p> : <>
          <div className="aim-toolbar">
            <label className="aim-field" style={{ minWidth: 180 }}>Frequency
              <select className="rd-select" value={form.frequency || 'manual'} onChange={event => set('frequency', event.target.value)}>
                <option value="6h">Every 6 hours</option><option value="daily">Daily</option>
                <option value="weekly">Weekly</option><option value="manual">Manual</option>
              </select>
            </label>
            <label className="aim-field" style={{ minWidth: 140 }}>Time
              <input className="rd-input" type="time" value={form.time || '02:00'} disabled={form.frequency === 'manual'}
                onChange={event => set('time', event.target.value)} />
            </label>
          </div>
          <label className="aim-check"><input type="checkbox" checked={Boolean(form.enrich_openrouter)} onChange={event => set('enrich_openrouter', event.target.checked)} />OpenRouter metadata enrichment</label>
          <label className="aim-check"><input type="checkbox" checked={Boolean(form.new_models_disabled)} onChange={event => set('new_models_disabled', event.target.checked)} />New models arrive switched off</label>
          <label className="aim-check"><input type="checkbox" checked={Boolean(form.email_on_deprecation)} onChange={event => set('email_on_deprecation', event.target.checked)} />Email administrators when a routed model is deprecated</label>
          <div className="aim-toolbar" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
            <button type="button" className="rd-btn rd-btn-primary" disabled={savingSchedule} onClick={() => onSaveSchedule(form)}>
              {savingSchedule && <Loader2 size={16} className="aim-spin" />}Save schedule
            </button>
          </div>
          <p className="aim-note"><Info size={16} />{lastRun
            ? `Last sync ${fmtDate(lastRun.finished_at || lastRun.started_at)}: ${lastRun.status || 'unknown'}, ${changes.length} ${changes.length === 1 ? 'change' : 'changes'} found across ${sources.length} ${sources.length === 1 ? 'source' : 'sources'}.`
            : 'No sync run recorded from this browser yet. Use Sync catalogue above.'}</p>
        </>}
      </div>
    </section>

    <section className="rd-card">
      <header className="rd-card-header">Changes found <span className="rd-pill rd-pill-neutral">{changes.length}</span></header>
      <div className="aim-table-box" role="region" aria-label="Catalogue changes" tabIndex={0}>
        <table className="rd-table">
          <thead><tr><th>Change</th><th>Date</th><th>Model</th><th>Provider</th><th>Effect on routing</th></tr></thead>
          <tbody>
            {changes.map((change, index) => <tr key={`${change.model_id}-${index}`}>
              <td><Pill map={CHANGE_PILL} value={change.kind} /></td>
              <td>{fmtDate(change.at || lastRun?.finished_at || lastRun?.started_at)}</td>
              <td className="rd-mono">{change.model_id}</td>
              <td>{change.provider}</td>
              <td>{change.effect_on_routing?.length ? change.effect_on_routing.join(', ') : 'No routing impact'}</td>
            </tr>)}
            {!changes.length && <tr><td colSpan="5"><div className="aim-empty"><h3>No changes recorded</h3><p>The latest sync run reported no catalogue changes.</p></div></td></tr>}
          </tbody>
        </table>
      </div>
    </section>

    <section className="rd-card">
      <header className="rd-card-header">Sources</header>
      <div className="aim-table-box" role="region" aria-label="Sync sources" tabIndex={0}>
        <table className="rd-table">
          <thead><tr><th>Provider</th><th>List endpoint</th><th>Credential used</th><th>Models listed</th><th>Result</th></tr></thead>
          <tbody>
            {sources.map((source, index) => {
              const result = source.result || source.status || ''
              const tone = result === 'ok' ? 'rd-pill-success' : result === 'skipped' ? 'rd-pill-neutral' : 'rd-pill-danger'
              return <tr key={`${source.provider || source.provider_id || index}`}>
                <td>{source.provider || source.provider_name || source.provider_id || '—'}</td>
                <td className="rd-mono">{source.list_endpoint || source.endpoint || '—'}</td>
                <td>{source.credential ?? source.credential_used ?? '—'}</td>
                <td className="rd-mono">{source.models_listed ?? source.models ?? '—'}</td>
                <td><span className={`rd-pill ${tone}`}>{result === 'ok' ? 'OK' : result === 'skipped' ? 'Skipped' : result === 'failed' ? 'Failed' : result || 'Unknown'}</span>
                  {source.error && <div className="aim-inline-error">{source.error}</div>}</td>
              </tr>
            })}
            {!sources.length && <tr><td colSpan="5"><div className="aim-empty"><h3>No sources polled</h3><p>The latest sync run has no per-source details.</p></div></td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  </div>
}

function ConfirmDialog({ title, children, confirmLabel, busy, onConfirm, onClose, danger }) {
  return <>
    <div className="rd-modal-backdrop" onClick={busy ? undefined : onClose} aria-hidden="true" />
    <div className="rd-modal" role="dialog" aria-label={title}>
      <div className="rd-drawer-header">{title}
        <button type="button" className="rd-btn rd-btn-ghost rd-btn-sm" aria-label="Close" disabled={busy} onClick={onClose}><X size={18} /></button>
      </div>
      <div className="rd-drawer-body">{children}</div>
      <footer className="rd-drawer-footer">
        <button type="button" className="rd-btn rd-btn-secondary" disabled={busy} onClick={onClose}>Cancel</button>
        <button type="button" className={`rd-btn ${danger ? 'rd-btn-primary' : 'rd-btn-primary'}`} style={danger ? { background: 'var(--rd-danger)', borderColor: 'var(--rd-danger)' } : undefined}
          disabled={busy} onClick={onConfirm}>{busy && <Loader2 size={16} className="aim-spin" />}{confirmLabel}</button>
      </footer>
    </div>
  </>
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
function ModelHub() {
  const [providers, setProviders] = useState([])
  const [modelsData, setModelsData] = useState(null)
  const [creds, setCreds] = useState(null)
  const [tasks, setTasks] = useState([])
  const [schedule, setSchedule] = useState(null)
  const [storage, setStorage] = useState(null)
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('providers')
  const [groupFilter, setGroupFilter] = useState('all')
  const [modelFilters, setModelFilters] = useState({ search: '', caps: [], weights: 'all', status: '' })
  const [drawerProvider, setDrawerProvider] = useState(null)
  const [dialog, setDialog] = useState(null) // { type: 'rotate' | 'revoke', credential }
  const [rotateSecret, setRotateSecret] = useState('')
  const [dialogBusy, setDialogBusy] = useState(false)
  const [syncBusy, setSyncBusy] = useState(false)
  const [lastRun, setLastRun] = useState(null)
  const [savingSchedule, setSavingSchedule] = useState(false)
  const pollTimer = useRef(null)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; clearInterval(pollTimer.current) } }, [])

  const storageConfigured = storage?.configured ?? creds?.storage_configured ?? true

  const loadCore = useCallback(async signal => {
    const settled = await Promise.allSettled([
      Hub.listProviders(signal), Hub.listCredentials(signal), Hub.listRoutes(signal),
      Hub.getSyncSchedule(signal), Hub.getStorageStatus(signal), Hub.getOverview(signal),
    ])
    if (signal?.aborted || !mounted.current) return
    const [providerRes, credRes, routeRes, scheduleRes, storageRes, overviewRes] = settled
    if (providerRes.status === 'fulfilled') setProviders(providerRes.value.providers || [])
    if (credRes.status === 'fulfilled') setCreds(credRes.value)
    if (routeRes.status === 'fulfilled') setTasks(routeRes.value.tasks || [])
    if (scheduleRes.status === 'fulfilled') setSchedule(scheduleRes.value)
    if (storageRes.status === 'fulfilled') setStorage(storageRes.value)
    if (overviewRes.status === 'fulfilled') setOverview(overviewRes.value)
    const failed = settled.find(result => result.status === 'rejected')
    setError(failed ? Hub.hubError(failed.reason) : '')
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    loadCore(controller.signal).finally(() => { if (mounted.current && !controller.signal.aborted) setLoading(false) })
    const storedRun = window.localStorage.getItem(LAST_RUN_KEY)
    if (storedRun) Hub.getSyncRun(storedRun).then(run => { if (mounted.current && isDone(run)) setLastRun(run) }).catch(() => {})
    return () => controller.abort()
  }, [loadCore])

  // Debounced model catalogue query
  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => {
      const params = {}
      if (modelFilters.search.trim()) params.search = modelFilters.search.trim()
      if (modelFilters.caps.length) params.caps = modelFilters.caps.join(',')
      if (modelFilters.weights !== 'all') params.weights = modelFilters.weights
      if (modelFilters.status) params.status = modelFilters.status
      Hub.listModels(params, controller.signal)
        .then(data => { if (mounted.current && !controller.signal.aborted) setModelsData(data) })
        .catch(reason => { if (mounted.current && !controller.signal.aborted) setError(Hub.hubError(reason)) })
    }, 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [modelFilters])

  const models = useMemo(() => modelsData?.models || [], [modelsData])
  const byKey = useMemo(() => Object.fromEntries(models.map(model => [modelKey(model.provider_id, model.model_id), model])), [models])
  const modules = useMemo(() => [...new Set(tasks.map(task => task.module).filter(Boolean))], [tasks])

  const refreshAfterChange = useCallback(() => { loadCore(); setModelFilters(previous => ({ ...previous })) }, [loadCore])

  const pollRun = useCallback(runId => {
    clearInterval(pollTimer.current)
    pollTimer.current = setInterval(async () => {
      try {
        const run = await Hub.getSyncRun(runId)
        if (!mounted.current) return
        setLastRun(run)
        if (isDone(run)) {
          clearInterval(pollTimer.current); setSyncBusy(false)
          if (run.status === 'failed' || run.status === 'error') toast.error('Catalogue sync finished with errors. Review the sources table.')
          else toast.success(`Catalogue sync finished. ${(run.changes || []).length} ${(run.changes || []).length === 1 ? 'change' : 'changes'} found.`)
          refreshAfterChange()
        }
      } catch { /* keep polling; transient errors should not cancel a long sync */ }
    }, 2500)
  }, [refreshAfterChange])

  const startSync = async () => {
    if (syncBusy) return
    setSyncBusy(true); setError('')
    try {
      const { run_id: runId } = await Hub.startSync()
      window.localStorage.setItem(LAST_RUN_KEY, String(runId))
      toast.info('Catalogue sync started.')
      pollRun(runId)
    } catch (reason) { setSyncBusy(false); setError(Hub.hubError(reason)) }
  }

  const toggleModel = async (model, enabled) => {
    try {
      await Hub.setModelEnabled(model.provider_id, model.model_id, enabled)
      setModelsData(previous => previous ? {
        ...previous,
        models: previous.models.map(row => row === model ? { ...row, enabled } : row),
      } : previous)
    } catch (reason) { setError(Hub.hubError(reason)) }
  }

  const credentialAction = async action => {
    setDialogBusy(true)
    try { await action() }
    catch (reason) { toast.error(Hub.hubError(reason)) }
    finally { setDialogBusy(false) }
  }
  const testCredential = row => credentialAction(async () => {
    const result = await Hub.testSavedCredential(row.id)
    if (result?.ok) toast.success(`Connection OK${result.latency_ms != null ? ` (${result.latency_ms} ms)` : ''}.`)
    else toast.error(result?.error || 'Connection test failed. The saved credential was retained.')
    refreshAfterChange()
  })
  const rotateCredential = () => credentialAction(async () => {
    await Hub.rotateCredential(dialog.credential.id, rotateSecret.trim())
    toast.success(`Credential rotated for ${dialog.credential.name}. Only the last 4 characters will be shown.`)
    setDialog(null); setRotateSecret(''); refreshAfterChange()
  })
  const revokeCredential = () => credentialAction(async () => {
    await Hub.revokeCredential(dialog.credential.id)
    toast.success(`Credential revoked for ${dialog.credential.name}.`)
    setDialog(null); refreshAfterChange()
  })
  const deleteCredential = () => credentialAction(async () => {
    await Hub.deleteCredential(dialog.credential.id)
    toast.success(`Credential deleted for ${dialog.credential.name}.`)
    setDialog(null); refreshAfterChange()
  })
  const saveSchedule = async form => {
    setSavingSchedule(true)
    try {
      setSchedule(await Hub.saveSyncSchedule(form))
      toast.success('Sync schedule saved.')
    } catch (reason) { toast.error(Hub.hubError(reason)) }
    finally { setSavingSchedule(false) }
  }
  const onRouteSaved = (taskId, next) => {
    const updated = next?.task_id ? next : next?.task
    if (updated?.task_id) setTasks(previous => previous.map(task => task.task_id === taskId ? updated : task))
    else loadCore()
  }

  const kpis = [
    { label: 'Providers available', value: overview?.providers_available ?? providers.length, sub: `${overview?.paid ?? '—'} paid · ${overview?.open_self ?? '—'} open/self-hosted` },
    { label: 'Connected', value: overview?.connected ?? providers.filter(provider => provider.status === 'connected').length, sub: 'Providers with a working credential' },
    { label: 'Models in catalogue', value: overview?.models_total ?? models.length, sub: `${overview?.closed ?? '—'} closed · ${overview?.open_weight ?? '—'} open-weight` },
    { label: 'Enabled for RADAI', value: overview?.enabled_count ?? models.filter(model => model.enabled).length, sub: 'Models modules may select' },
    { label: 'Modules routed', value: overview ? `${overview.modules_routed ?? 0} / ${overview.modules_total ?? tasks.length}` : `${tasks.filter(task => task.chain?.[0]).length} / ${tasks.length}`, sub: 'Primary model chosen / total tasks' },
  ]
  const tabs = [
    ['providers', 'Providers', providers.length],
    ['models', 'Model catalogue', overview?.models_total ?? models.length],
    ['credentials', 'Credentials', creds?.credentials?.length ?? 0],
    ['routing', 'Module routing', tasks.length],
    ['sync', 'Sync & changes', lastRun?.changes?.length ?? 0],
  ]

  return <section className="rd-page aim-page" aria-labelledby="ai-api-keys-title">
    <header className="aim-header">
      <div>
        <nav className="aim-breadcrumb" aria-label="Breadcrumb">Administration <ChevronRight size={13} /> AI configuration <ChevronRight size={13} /> AI API Keys</nav>
        <div className="aim-title-row">
          <h1 id="ai-api-keys-title" className="aim-title">AI API Keys</h1>
          <span className="rd-pill rd-pill-ai">Model hub</span>
        </div>
        <p className="aim-subtitle">Connect providers, sync their model catalogues, store credentials encrypted on the server, and route each RADAI task to a primary model with fallbacks.</p>
      </div>
      <div className="aim-actions">
        <button type="button" className="rd-btn rd-btn-secondary" disabled={syncBusy} onClick={startSync}>
          {syncBusy ? <Loader2 size={16} className="aim-spin" /> : <RefreshCw size={16} />}Sync catalogue
        </button>
        <button type="button" className="rd-btn rd-btn-primary" disabled={!storageConfigured}
          title={!storageConfigured ? 'Secure credential storage is not configured on this server' : undefined}
          onClick={() => setDrawerProvider(providers[0]?.id || '')}>
          <Plus size={16} />Add credential
        </button>
      </div>
    </header>

    {storageConfigured === false && <p role="alert" className="rd-banner rd-banner-warning" style={{ marginBottom: '1rem' }}>
      <AlertTriangle size={16} />
      <span style={{ flex: 1 }}>Secure credential storage is not configured on this server. The catalogue stays browsable, but adding, rotating and saving credentials is disabled until the server administrator configures the encryption key.</span>
      <button type="button" className="rd-btn rd-btn-secondary rd-btn-sm"
        onClick={() => toast.info('Ask the server administrator to set the credential encryption key and restart the server, then refresh this page.')}>
        Setup guide
      </button>
    </p>}
    {error && <p role="alert" className="rd-banner rd-banner-danger" style={{ marginBottom: '1rem' }}>{error}</p>}

    {loading ? <div aria-label="Loading" role="status">
      <div className="aim-kpis">{[...Array(5)].map((_, index) => <div key={index} className="rd-card rd-kpi"><div className="rd-skeleton aim-skeleton-line" style={{ width: '40%' }} /><div className="rd-skeleton aim-skeleton-line" style={{ width: '70%' }} /></div>)}</div>
      <div className="rd-card rd-card-body"><div className="rd-skeleton aim-skeleton-line" /><div className="rd-skeleton aim-skeleton-line" /><div className="rd-skeleton aim-skeleton-line" style={{ width: '60%' }} /></div>
    </div> : <>
      <div className="aim-kpis" aria-label="Model hub overview">
        {kpis.map(kpi => <div key={kpi.label} className="rd-card rd-kpi">
          <div className="rd-kpi-value">{kpi.value}</div>
          <div className="rd-kpi-label">{kpi.label}</div>
          <div className="aim-kpi-sub">{kpi.sub}</div>
        </div>)}
      </div>

      <div className="aim-tabs" role="tablist" aria-label="Model hub sections">
        {tabs.map(([id, label, count]) => <button key={id} type="button" role="tab" aria-selected={tab === id}
          className={`rd-tab ${tab === id ? 'rd-tab-active' : ''}`} onClick={() => setTab(id)}>
          {label}<span className="rd-pill rd-pill-neutral">{count}</span>
        </button>)}
      </div>

      {tab === 'providers' && <ProvidersTab providers={providers} filter={groupFilter} setFilter={setGroupFilter}
        onConnect={provider => setDrawerProvider(provider.id)} onManage={() => setTab('credentials')} />}
      {tab === 'models' && <ModelsTab data={modelsData} filters={modelFilters} setFilters={setModelFilters} onToggle={toggleModel} />}
      {tab === 'credentials' && <CredentialsTab data={creds} storageConfigured={storageConfigured}
        onTest={testCredential}
        onRotate={credential => { setDialog({ type: 'rotate', credential }); setRotateSecret('') }}
        onRevoke={credential => setDialog({ type: 'revoke', credential })}
        onDelete={credential => setDialog({ type: 'delete', credential })} />}
      {tab === 'routing' && <RoutingTab tasks={tasks} byKey={byKey} models={models} onSaved={onRouteSaved} />}
      {tab === 'sync' && <SyncTab schedule={schedule} lastRun={lastRun} onSaveSchedule={saveSchedule} savingSchedule={savingSchedule} />}
    </>}

    <p className="aim-note"><ShieldCheck size={16} />Keys remain on the server. Connection tests verify only the named model at the recorded time; extraction results still need review.</p>

    {drawerProvider !== null && <CredentialDrawer
      providers={providers} modules={modules} storageConfigured={storageConfigured}
      initialProviderId={drawerProvider}
      onClose={() => setDrawerProvider(null)}
      onSaved={() => { setDrawerProvider(null); refreshAfterChange() }} />}

    {dialog?.type === 'rotate' && <ConfirmDialog title={`Rotate ${dialog.credential.name}`} confirmLabel="Rotate credential" busy={dialogBusy}
      onClose={() => setDialog(null)} onConfirm={rotateCredential}>
      <p>Enter the replacement key for <strong>{dialog.credential.name}</strong>. The new key is tested by the provider on next use and is never shown again.</p>
      <label className="aim-field">Replacement key
        <input className="rd-input" type="password" autoComplete="off" spellCheck={false} value={rotateSecret}
          onChange={event => setRotateSecret(event.target.value)} />
      </label>
    </ConfirmDialog>}

    {dialog?.type === 'revoke' && <ConfirmDialog title={`Revoke ${dialog.credential.name}`} confirmLabel="Revoke credential" danger busy={dialogBusy}
      onClose={() => setDialog(null)} onConfirm={revokeCredential}>
      <p>Revoke <strong>{dialog.credential.name}</strong> ({dialog.credential.provider_name})? Tasks that resolve to this credential fall back to the next key in the resolution order. No central credential selected. Existing server configuration applies.</p>
    </ConfirmDialog>}

    {dialog?.type === 'delete' && <ConfirmDialog title={`Delete ${dialog.credential.name}`} confirmLabel="Delete permanently" danger busy={dialogBusy}
      onClose={() => setDialog(null)} onConfirm={deleteCredential}>
      <p>Permanently delete <strong>{dialog.credential.name}</strong> ({dialog.credential.provider_name})? Unlike revoke, this removes the credential and its stored secret completely. This cannot be undone. Tasks that used it fall back to the next key in the resolution order.</p>
    </ConfirmDialog>}
  </section>
}

function Denied() {
  return <section className="rd-page aim-page"><div className="rd-card aim-denied">
    <ShieldCheck size={28} /><h1>Administrator access required</h1>
    <p>Your account cannot manage AI provider credentials.</p>
  </div></section>
}

export default function AIAPIKeys() {
  const user = useSelector(state => state.auth?.user)
  if (!canManageAIKeys(user)) return <Denied />
  return <ModelHub key={user?.user?.id || user?.id} />
}
