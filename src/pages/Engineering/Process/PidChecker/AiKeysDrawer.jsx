/**
 * §2.2 — AI & keys drawer.
 *
 * Source cards (Organisation key / My own key (BYOK) / No AI) with status
 * pills. BYOK block: provider select + password key field, Test connection
 * (user-level endpoint via sldService), Save key enabled only after a pass,
 * saved keys shown as "Provider · prefix…last4" with Test/Remove against the
 * v2 project api-keys endpoints. AI step table for pidchk.ocr / pidchk.suggest
 * whose model selects list ONLY eligible models from the 9.8 hub; the on-prem
 * switch filters to provider_group === 'self'. "Last run — AI use" shows the
 * honest empty state until a run exists.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import * as Hub from '../../../../services/aiModelHub.service'
import * as svc from './pidChecker.service'
import { Drawer, Pill } from './shared'

const AI_STEPS = [
  { taskId: 'pidchk.ocr', step: 'OCR reading', needs: 'Reads scans and outlined text on sheets' },
  { taskId: 'pidchk.suggest', step: 'Finding suggestions', needs: 'Suggests values and queries for findings' },
]

const PROVIDERS = [
  { id: 'openai', label: 'OpenAI' },
  { id: 'claude', label: 'Claude (Anthropic)' },
]

const modelKey = m => `${m.provider_id}:${m.model_id}`

const mask = k => (k && k.length > 8 ? `${k.slice(0, 4)}…${k.slice(-4)}` : null)

export default function AiKeysDrawer({ open, onClose, projectId, onSourceChange }) {
  const [source, setSource] = useState('org') // org | byok | off
  const [onPrem, setOnPrem] = useState(false)
  const [providerStatus, setProviderStatus] = useState(null)
  const [projectKeys, setProjectKeys] = useState(null)

  // BYOK form
  const [provider, setProvider] = useState('openai')
  const [apiKey, setApiKey] = useState('')
  const [testing, setTesting] = useState(false)
  const [testPassed, setTestPassed] = useState(false)
  const [testMessage, setTestMessage] = useState(null)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState(null) // { provider, masked }
  const [error, setError] = useState(null)

  // model hub
  const [models, setModels] = useState(null)
  const [routes, setRoutes] = useState(null)

  const load = useCallback(async () => {
    setError(null)
    const settled = await Promise.allSettled([
      svc.getAiProviderStatus(),
      projectId ? svc.getProjectApiKeys(projectId) : Promise.resolve(null),
      Hub.listModels(),
      Hub.listRoutes(),
    ])
    if (settled[0].status === 'fulfilled') setProviderStatus(settled[0].value)
    if (settled[1].status === 'fulfilled') setProjectKeys(settled[1].value)
    if (settled[2].status === 'fulfilled') {
      const d = settled[2].value
      setModels(Array.isArray(d) ? d : (d?.models ?? []))
    } else {
      setModels([])
    }
    if (settled[3].status === 'fulfilled') {
      const d = settled[3].value
      setRoutes(Array.isArray(d) ? d : (d?.routes ?? d?.tasks ?? []))
    } else {
      setRoutes([])
    }
  }, [projectId])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  const orgReady = useMemo(() => {
    if (!providerStatus) return null
    return providerStatus.some(p => !p.managed || p.ready)
  }, [providerStatus])

  const eligibleModels = useMemo(() => {
    const list = (models || []).filter(m => m?.enabled !== false)
    return onPrem ? list.filter(m => m.provider_group === 'self') : list
  }, [models, onPrem])

  const deprecatedRouted = useMemo(() => {
    const byKey = Object.fromEntries((models || []).map(m => [modelKey(m), m]))
    for (const route of routes || []) {
      for (const slot of route.chain || []) {
        const m = slot && byKey[typeof slot === 'string' ? slot : modelKey(slot)]
        if (m?.status === 'deprecated') return route.task_id
      }
    }
    return null
  }, [models, routes])

  const resetTest = () => { setTestPassed(false); setTestMessage(null) }

  const runTest = async () => {
    if (!apiKey.trim() || testing) return
    setTesting(true)
    resetTest()
    try {
      await svc.testUserKey(provider, apiKey.trim())
      setTestPassed(true)
      setTestMessage('Connection passed. You can save the key now.')
    } catch (err) {
      setTestPassed(false)
      setTestMessage(err?.response?.data?.error || 'Connection failed. Check the key and provider, then retry.')
    } finally {
      setTesting(false)
    }
  }

  const saveKey = async () => {
    if (!testPassed || saving) return
    setSaving(true)
    setError(null)
    try {
      if (projectId) await svc.saveProjectApiKey(projectId, provider, apiKey.trim())
      await svc.saveUserKey(provider, apiKey.trim())
      setLastSaved({ provider, masked: mask(apiKey.trim()) })
      setApiKey('')
      resetTest()
      load()
    } catch (err) {
      setError(err?.response?.data?.error || 'The key could not be saved. Please retry.')
    } finally {
      setSaving(false)
    }
  }

  const removeKey = async prov => {
    setError(null)
    try {
      if (projectId) await svc.deleteProjectApiKey(projectId, prov)
      await svc.removeUserKey()
      setLastSaved(null)
      load()
    } catch (err) {
      setError(err?.response?.data?.error || 'The key could not be removed. Please retry.')
    }
  }

  const changeSource = next => {
    setSource(next)
    onSourceChange?.(next, onPrem)
  }

  const aiDisabled = source === 'off'

  const savedKeyRows = useMemo(() => {
    const rows = []
    const pk = projectKeys
    if (pk && typeof pk === 'object' && !Array.isArray(pk)) {
      for (const prov of PROVIDERS) {
        const rec = pk[prov.id] || pk[`${prov.id}_key`]
        if (rec) rows.push({ provider: prov.id, label: prov.label, masked: typeof rec === 'string' ? mask(rec) : (rec.masked ?? '••••') })
      }
    }
    if (lastSaved && !rows.some(r => r.provider === lastSaved.provider)) {
      const label = PROVIDERS.find(p => p.id === lastSaved.provider)?.label ?? lastSaved.provider
      rows.push({ provider: lastSaved.provider, label, masked: lastSaved.masked ?? '••••' })
    }
    return rows
  }, [projectKeys, lastSaved])

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="AI & keys"
      wide
      footer={(
        <>
          <Link className="rd-btn rd-btn-secondary" to="/admin/ai-api-keys">Open 9.8 AI API Keys</Link>
          <button type="button" className="rd-btn rd-btn-primary" onClick={onClose}>Done</button>
        </>
      )}
    >
      <div className="pc-field">
        <span className="pc-label">AI source</span>
        <div className="pc-choice-grid">
          {[
            { id: 'org', name: 'Organisation key', status: orgReady == null ? 'Not checked' : (orgReady ? 'Active' : 'Not set') },
            { id: 'byok', name: 'My own key (BYOK)', status: savedKeyRows.length > 0 ? 'Personal (BYOK)' : 'Not set' },
            { id: 'off', name: 'No AI', status: source === 'off' ? 'Off' : 'N/A' },
          ].map(card => (
            <button
              key={card.id}
              type="button"
              className={`pc-choice-card${source === card.id ? ' pc-choice-card-active' : ''}`}
              aria-pressed={source === card.id}
              onClick={() => changeSource(card.id)}
            >
              <span className="pc-choice-name">{card.name}</span>
              <Pill label={card.status} />
            </button>
          ))}
        </div>
      </div>

      {source === 'byok' && (
        <div className="pc-card pc-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <h3 className="pc-card-title">Your key</h3>
          <div className="pc-field">
            <label className="pc-label" htmlFor="pc-byok-provider">Provider</label>
            <select
              id="pc-byok-provider"
              className="pc-select"
              value={provider}
              onChange={e => { setProvider(e.target.value); resetTest() }}
            >
              {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
          <div className="pc-field">
            <label className="pc-label" htmlFor="pc-byok-key">API key</label>
            <input
              id="pc-byok-key"
              type="password"
              className="pc-input pc-mono"
              autoComplete="off"
              value={apiKey}
              onChange={e => { setApiKey(e.target.value); resetTest() }}
            />
            <p className="pc-help">The key is sent only to the key endpoints, stored encrypted server-side, and never echoed back or cached in the browser.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="rd-btn rd-btn-secondary" disabled={!apiKey.trim() || testing} onClick={runTest}>
              {testing ? 'Testing…' : 'Test connection'}
            </button>
            <button type="button" className="rd-btn rd-btn-primary" disabled={!testPassed || saving} onClick={saveKey}>
              {saving ? 'Saving…' : 'Save key'}
            </button>
          </div>
          {testMessage && (
            <p className={`pc-note ${testPassed ? 'pc-note-ai' : 'pc-note-warning'}`} style={{ margin: 0 }} role="status">
              {testMessage}
            </p>
          )}
          {savedKeyRows.length > 0 && (
            <div className="pc-table-wrap">
              <table className="pc-table">
                <thead><tr><th>Saved key</th><th /></tr></thead>
                <tbody>
                  {savedKeyRows.map(row => (
                    <tr key={row.provider}>
                      <td>{row.label} · <span className="pc-mono">{row.masked}</span></td>
                      <td style={{ textAlign: 'right' }}>
                        <button type="button" className="rd-btn rd-btn-ghost rd-btn-sm" onClick={() => removeKey(row.provider)}>Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <label className="pc-switch">
        <input
          type="checkbox"
          checked={onPrem}
          onChange={e => { setOnPrem(e.target.checked); onSourceChange?.(source, e.target.checked) }}
        />
        Client drawings stay on-premises (self-hosted models only)
      </label>

      <div className="pc-field">
        <span className="pc-label">AI steps</span>
        <div className="pc-table-wrap pc-card">
          <table className="pc-table">
            <thead>
              <tr><th>Step</th><th>Task</th><th>Needs</th><th>Model</th></tr>
            </thead>
            <tbody>
              {AI_STEPS.map(step => {
                const route = (routes || []).find(r => r.task_id === step.taskId)
                const current = route?.chain?.[0] ?? null
                return (
                  <tr key={step.taskId}>
                    <td>{step.step}</td>
                    <td className="pc-mono">{step.taskId}</td>
                    <td><Pill label={step.needs} tone="neutral" /></td>
                    <td>
                      <select
                        className="pc-select"
                        disabled={aiDisabled}
                        value={current ? (typeof current === 'string' ? current : `${current.provider_id}:${current.model_id}`) : ''}
                        onChange={e => {
                          const [providerId, modelId] = e.target.value.split(':')
                          const chain = providerId ? [{ provider_id: providerId, model_id: modelId }] : [null]
                          Hub.saveRoute(step.taskId, chain).then(load).catch(err => setError(Hub.hubError(err)))
                        }}
                        aria-label={`Model for ${step.step}`}
                      >
                        <option value="">Not routed</option>
                        {eligibleModels.map(m => (
                          <option key={modelKey(m)} value={modelKey(m)}>
                            {m.model_id} — {m.provider_name}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {aiDisabled && <p className="pc-help">Model selection is disabled while the source is “No AI”.</p>}
      </div>

      <p className="pc-note pc-note-ai" style={{ margin: 0 }}>
        <span className="pc-ai-mark">AI</span> values always show the model and confidence and stay a query until an engineer confirms them.
      </p>
      {deprecatedRouted && (
        <p className="pc-note pc-note-warning" style={{ margin: 0 }}>
          A routed model was deprecated during the last hub sync. Re-route task <span className="pc-mono">{deprecatedRouted}</span> before the next run.
        </p>
      )}

      <div className="pc-field">
        <span className="pc-label">Last run — AI use</span>
        <div className="pc-card pc-card-pad">
          <p className="pc-empty-text">Available after the first AI run.</p>
        </div>
      </div>

      {error && <p className="pc-error" role="alert">{error}</p>}
    </Drawer>
  )
}
