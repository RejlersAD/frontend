import { useEffect, useId, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { CheckCircle2, KeyRound, Loader2 } from 'lucide-react'
import { projectSetupService } from '../../services/projectSetup.service'
import './PlanningAIConnection.css'

const errorMessage = error => {
  const flatten = value => typeof value === 'string' ? value : Array.isArray(value) ? value.map(flatten).join(' ') : value && typeof value === 'object' ? Object.values(value).map(flatten).join(' ') : ''
  return flatten(error.response?.data) || 'The AI connection could not be saved. Check the key and model, then retry.'
}

export default function PlanningAIConnection({ disabled = false, onConnected, onBusyChange }) {
  const id = useId(), alive = useRef(true), pending = useRef(false), busyCallback = useRef(onBusyChange)
  busyCallback.current = onBusyChange
  const [settings, setSettings] = useState(null), [loading, setLoading] = useState(true), [reload, setReload] = useState(0)
  const [apiKey, setApiKey] = useState(''), [model, setModel] = useState('')
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  useEffect(() => {
    alive.current = true
    const controller = new AbortController()
    setLoading(true); setError('')
    projectSetupService.aiSettings(controller.signal).then(data => {
      if (!controller.signal.aborted) { setSettings(data); setModel(data.ai_settings?.model || 'gpt-4o') }
    }).catch(reason => { if (!controller.signal.aborted) setError(errorMessage(reason)) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => { alive.current = false; controller.abort(); busyCallback.current?.(false) }
  }, [reload])
  const save = async event => {
    event.preventDefault()
    if (pending.current || disabled || !settings || !model.trim() || (!apiKey.trim() && !settings.ai_settings?.key_configured)) return
    const enteredKey = apiKey.trim()
    pending.current = true; setBusy(true); busyCallback.current?.(true); setError(''); setNotice('')
    try {
      const saved = await projectSetupService.saveAISettings({ model: model.trim(), ...(enteredKey ? { api_key: enteredKey } : {}) })
      if (alive.current) { setSettings(saved); setModel(saved.ai_settings?.model || model.trim()); setApiKey(''); setNotice('Connection tested and saved. Generate the sequence when ready.'); onConnected?.(saved) }
    } catch (reason) {
      if (alive.current) { const message = errorMessage(reason); setError(enteredKey ? message.replaceAll(enteredKey, '[hidden]') : message) }
    } finally { pending.current = false; busyCallback.current?.(false); if (alive.current) setBusy(false) }
  }
  const blocked = disabled || busy || loading || settings?.ai_settings?.storage_available === false
  return <section className="pac-connection" aria-labelledby={`${id}-heading`}>
    <header><h3 id={`${id}-heading`}><KeyRound size={17} />AI connection</h3><span>{settings?.ai_settings?.key_configured && settings.ai_available ? 'Personal key connected' : 'OpenAI · Bring your own key'}</span></header>
    {loading && <p role="status"><Loader2 size={16} className="animate-spin" />Loading AI connection...</p>}
    {!loading && !settings && <button type="button" className="psq-button" onClick={() => setReload(value => value + 1)}>Retry connection settings</button>}
    {settings && <form onSubmit={save}>
      <label htmlFor={`${id}-key`}>OpenAI API key<input id={`${id}-key`} type="password" autoComplete="new-password" autoCapitalize="off" spellCheck={false} value={apiKey} onChange={event => { setApiKey(event.target.value); setError(''); setNotice('') }} disabled={blocked} placeholder={settings.ai_settings?.key_configured ? 'Saved securely; enter a key to replace it' : 'Enter your OpenAI API key'} /></label>
      <label htmlFor={`${id}-model`}>AI model<input id={`${id}-model`} value={model} onChange={event => { setModel(event.target.value); setNotice('') }} disabled={blocked} maxLength={100} autoComplete="off" spellCheck={false} /></label>
      <button type="submit" className="psq-button" disabled={blocked || !model.trim() || (!apiKey.trim() && !settings.ai_settings?.key_configured)}>{busy ? <><Loader2 size={16} className="animate-spin" />Testing connection...</> : 'Test & save API key'}</button>
    </form>}
    <p className="pac-help">Your personal key is stored encrypted. Testing makes a small request to your AI provider.</p>
    {settings?.ai_settings?.storage_available === false && <p role="status">Secure key storage must be configured by an administrator before saving a key.</p>}
    {error && <p className="pac-error" role="alert">{error}</p>}
    {notice && <p className="pac-success" role="status"><CheckCircle2 size={16} />{notice}</p>}
  </section>
}

PlanningAIConnection.propTypes = { disabled: PropTypes.bool, onConnected: PropTypes.func, onBusyChange: PropTypes.func }
