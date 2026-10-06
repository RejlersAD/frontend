/**
 * RadAIChatWidget.jsx — global floating RADAI Chat assistant.
 *
 * A soft-coded, floating chat bubble + panel available app-wide. It grounds
 * answers in whatever data the current page published to the chat context
 * store (extracted rows, uploaded document, active project) and talks to the
 * backend /pid-checker-v2/chat/ endpoint using BYOK (server-managed key when
 * configured, else the user's Claude/OpenAI key entered once per session).
 *
 * Mount once near the app root (Layout). Pure UI + service wiring — no page
 * logic changes required to adopt it beyond a page publishing its context.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'react-toastify'
import {
  MessageSquare, X, Send, Sparkles, Trash2, Minimize2, Loader2,
  KeyRound, FileText, Database, Bot, User as UserIcon,
} from 'lucide-react'
import { askRadAIChat, archiveRadAIChat } from '../../services/radaiChat.service'
import apiClient from '../../services/api.service'
import {
  getChatContext, subscribeChatContext, getChatContextVersion,
} from '../../services/chatContext.store'
import useAIProviderStatus from '../../hooks/useAIProviderStatus'

// ─── Soft-coded configuration ─────────────────────────────────────────
const CHAT_CFG = {
  enabled: true,
  title: 'RADAI Assistant',
  subtitle: 'Ask about the data on this page',
  placeholder: 'Ask about the extracted data or the uploaded document…',
  accentFrom: '#3b82f6',
  accentTo: '#6366f1',
  // BYOK session keys (tab-scoped; cleared when the tab closes). The managed
  // server key is preferred — these are only a fallback for unmanaged setups.
  ssProvider: 'radai_chat_byok_provider',
  ssApiKey: 'radai_chat_byok_apikey',
  ssUseOwnKey: 'radai_chat_byok_use_own',   // '1' = user opted to override the managed key
  providers: [
    { id: 'claude', label: 'Claude' },
    { id: 'openai', label: 'OpenAI' },
  ],
  maxHistory: 20,           // turns kept in the panel + sent for continuity
  // Conversation archiving to the project's S3 data lake (backend:
  // pid_checker_v2 RadAIChatArchiveView → designiq s3_utils archive layout).
  // Fire-and-forget after each completed exchange; never blocks the UI.
  archiveEnabled: true,
  ssSessionId: 'radai_chat_session_id',
  welcomeMessage:
    "Hi! I'm the RADAI assistant. Ask me anything about the data on this page — counts, specific tags, summaries, or what's in the uploaded document.",
}

const readSS = (k) => { try { return sessionStorage.getItem(k) || '' } catch { return '' } }
const writeSS = (k, v) => { try { v ? sessionStorage.setItem(k, v) : sessionStorage.removeItem(k) } catch { /* storage may be disabled */ } }

const RadAIChatWidget = () => {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [messages, setMessages] = useState([
    { role: 'assistant', content: CHAT_CFG.welcomeMessage, ts: Date.now() },
  ])

  // BYOK fallback (only used when the platform has no managed key — or when
  // the user explicitly opts to use their own key instead)
  const [provider, setProvider] = useState(() => readSS(CHAT_CFG.ssProvider) || 'claude')
  const [apiKey, setApiKey] = useState(() => readSS(CHAT_CFG.ssApiKey))
  const [useOwnKey, setUseOwnKey] = useState(() => readSS(CHAT_CFG.ssUseOwnKey) === '1')
  const [showKeyForm, setShowKeyForm] = useState(false)
  // Key panel view: 'status' shows the active-key summary, 'entry' shows the
  // input form.  MUST be separate state — keying the view off `apiKey` makes
  // the form unmount on the FIRST typed character (apiKey becomes truthy),
  // which made it impossible to enter a replacement key.
  const [keyView, setKeyView] = useState('status')

  // Auto-select the provider that has a ready managed key (server-side), so
  // the widget never defaults to a provider with no configured credential
  // (e.g. only OpenAI is configured on this deployment → use it).
  // Never override a user's saved BYOK provider choice — their key belongs
  // to the provider THEY picked.
  useEffect(() => {
    let live = true
    if (readSS(CHAT_CFG.ssApiKey)) return undefined  // user has their own key+provider
    apiClient.get('/rbac/ai-provider-status/', { suppressErrorToast: true, timeout: 30000 })
      .then(({ data }) => {
        if (!live) return
        const rows = data?.providers || []
        const ready = rows.find(r => r?.managed && r?.ready)
        if (ready?.provider) {
          const p = ready.provider === 'anthropic' ? 'claude' : ready.provider
          if (CHAT_CFG.providers.some(x => x.id === p)) setProvider(p)
        }
      })
      .catch(() => { /* keep the default */ })
    return () => { live = false }
  }, [])

  // Live page context
  const [ctxVersion, setCtxVersion] = useState(getChatContextVersion())
  const context = useMemo(() => getChatContext(), [ctxVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  // Managed-key readiness (server-side). A user's saved custom key takes
  // precedence only when they explicitly opted in (useOwnKey).
  const providerStatus = useAIProviderStatus(provider)
  const hasManagedKey = Boolean(providerStatus?.managed && providerStatus?.ready)
  const useManagedKey = hasManagedKey && !(useOwnKey && apiKey)
  const needsKey = !useManagedKey && !apiKey

  // Auto-open the BYOK setup when the panel opens and no usable key exists —
  // the header key icon alone was too subtle and users never found it.
  // Waits until the managed-key probe finishes so deployments WITH a managed
  // key never flash the form.
  const providerStatusLoaded = providerStatus?.loading === false
  useEffect(() => {
    if (open && providerStatusLoaded && !useManagedKey && !apiKey) {
      setKeyView('entry')
      setShowKeyForm(true)
    }
  }, [open, providerStatusLoaded, useManagedKey, apiKey])

  // Stable per-tab conversation id for S3 archiving (survives re-renders,
  // resets when the tab closes)
  const sessionIdRef = useRef(null)
  if (!sessionIdRef.current) {
    sessionIdRef.current = readSS(CHAT_CFG.ssSessionId)
      || `chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    writeSS(CHAT_CFG.ssSessionId, sessionIdRef.current)
  }

  const endRef = useRef(null)
  useEffect(() => subscribeChatContext(v => setCtxVersion(v)), [])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, open])

  const send = useCallback(async () => {
    const question = input.trim()
    if (!question || busy) return
    if (needsKey) { setShowKeyForm(true); toast.warn('Add your AI key to chat (or ask an admin to configure one).'); return }

    const userMsg = { role: 'user', content: question, ts: Date.now() }
    setMessages(prev => [...prev, userMsg].slice(-CHAT_CFG.maxHistory))
    setInput('')
    setBusy(true)
    try {
      const history = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: m.content }))
      const res = await askRadAIChat({
        question,
        context: context || {},
        history,
        provider,
        apiKey: useManagedKey ? '' : apiKey,   // managed key resolves server-side unless the user opted into their own
      })
      const assistantMsg = {
        role: 'assistant',
        content: res.answer || '(no answer)',
        ts: Date.now(),
        usage: res.token_usage,
      }
      setMessages(prev => [...prev, assistantMsg].slice(-CHAT_CFG.maxHistory))
      // Archive the conversation to the project's S3 data lake (fire-and-forget)
      if (CHAT_CFG.archiveEnabled) {
        archiveRadAIChat({
          sessionId: sessionIdRef.current,
          messages: [...messages, userMsg, assistantMsg],
          context,
        })
      }
    } catch (err) {
      const msg = err?.response?.data?.error || 'The assistant could not answer. Check your AI key.'
      // Auth failure (401): the credential in use was rejected. If the
      // platform's managed key failed, push the user to their own BYOK key;
      // if their own key failed, say so and reopen the form for replacement.
      const authFailed = /401|authentication|credential/i.test(msg)
      let display = msg
      if (authFailed) {
        display = useManagedKey
          ? "⚠️ The platform's managed AI key was rejected (401). You can chat immediately by adding your own Claude/OpenAI key — opening the key settings."
          : '⚠️ Your AI key was rejected (401 authentication). Please check it and enter a valid key — opening the key settings.'
        setKeyView(apiKey ? 'status' : 'entry')
        setShowKeyForm(true)
      }
      setMessages(prev => [...prev, { role: 'assistant', content: display.startsWith('⚠️') ? display : `⚠️ ${display}`, ts: Date.now(), error: true }])
    } finally {
      setBusy(false)
    }
  }, [input, busy, needsKey, messages, context, provider, apiKey, useManagedKey])

  const saveKey = useCallback(() => {
    writeSS(CHAT_CFG.ssProvider, provider)
    writeSS(CHAT_CFG.ssApiKey, apiKey.trim())
    // Saving a key while a managed key exists means the user wants THEIR key.
    setUseOwnKey(true)
    writeSS(CHAT_CFG.ssUseOwnKey, '1')
    setKeyView('status')
    setShowKeyForm(false)
    toast.success('AI key saved for this session')
  }, [provider, apiKey])

  const clearKey = useCallback(() => {
    writeSS(CHAT_CFG.ssApiKey, '')
    writeSS(CHAT_CFG.ssUseOwnKey, '')
    setApiKey('')
    setUseOwnKey(false)
    toast.info('AI key removed')
  }, [])

  const switchToManaged = useCallback(() => {
    setUseOwnKey(false)
    writeSS(CHAT_CFG.ssUseOwnKey, '')
    setKeyView('status')
    setShowKeyForm(false)
    toast.info("Using the platform's managed key")
  }, [])

  if (!CHAT_CFG.enabled) return null

  // Key panel mode: entry form / managed-key status / custom-key status.
  // Driven by keyView (UI state), NOT by apiKey — otherwise the form unmounts
  // on the first typed character.
  const keyPanelMode = (keyView === 'entry' || (!apiKey && !useManagedKey)) ? 'entry'
    : (useManagedKey && !useOwnKey) ? 'managed'
    : 'active'

  const ctxSummary = context && (context.rows?.length || context.document?.name)
    ? `${context.page || 'This page'} · ${context.row_count ?? context.rows?.length ?? 0} rows${context.document?.name ? ` · ${context.document.name}` : ''}`
    : null

  return createPortal(
    <>
      {/* Floating bubble */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open RADAI assistant"
          title={CHAT_CFG.title}
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 9998,
            width: 56, height: 56, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: `linear-gradient(135deg, ${CHAT_CFG.accentFrom}, ${CHAT_CFG.accentTo})`,
            boxShadow: '0 8px 24px rgba(59,130,246,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
        >
          <MessageSquare size={24} color="#fff" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          role="dialog"
          aria-label={CHAT_CFG.title}
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
            width: 'min(420px, 92vw)', height: 'min(620px, 84vh)',
            background: '#fff', borderRadius: 18, overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            border: '1px solid #e2e8f0',
            boxShadow: '0 20px 60px rgba(0,0,0,0.28)',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '12px 16px', color: '#fff', flexShrink: 0,
            background: `linear-gradient(135deg, ${CHAT_CFG.accentFrom}, ${CHAT_CFG.accentTo})`,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Sparkles size={18} color="#fff" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.1 }}>{CHAT_CFG.title}</div>
              <div style={{ fontSize: 11, opacity: 0.9 }}>{CHAT_CFG.subtitle}</div>
            </div>
            <button onClick={() => {
                if (!showKeyForm) setKeyView((!apiKey && !useManagedKey) ? 'entry' : 'status')
                setShowKeyForm(v => !v)
              }} title="AI key settings" aria-label="AI key settings"
              style={{ background: 'rgba(255,255,255,0.16)', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', color: '#fff' }}>
              <KeyRound size={16} />
            </button>
            <button onClick={() => setMessages([{ role: 'assistant', content: CHAT_CFG.welcomeMessage, ts: Date.now() }])}
              title="Clear chat" aria-label="Clear chat"
              style={{ background: 'rgba(255,255,255,0.16)', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', color: '#fff' }}>
              <Trash2 size={16} />
            </button>
            <button onClick={() => setOpen(false)} aria-label="Close assistant"
              style={{ background: 'rgba(255,255,255,0.16)', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', color: '#fff' }}>
              <Minimize2 size={16} />
            </button>
          </div>

          {/* Context banner */}
          {ctxSummary && (
            <div style={{
              padding: '7px 14px', fontSize: 11, color: '#1d4ed8', flexShrink: 0,
              background: 'rgba(59,130,246,0.06)', borderBottom: '1px solid rgba(59,130,246,0.15)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Database size={12} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Context: {ctxSummary}
              </span>
            </div>
          )}

          {/* Key form (BYOK fallback) */}
          {showKeyForm && (
            <div style={{ padding: '12px 14px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
              {keyPanelMode === 'managed' ? (
                <>
                  <div style={{ fontSize: 12, color: '#15803d', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <KeyRound size={13} /> Using the platform's managed {provider === 'claude' ? 'Claude' : 'OpenAI'} key.
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => { setUseOwnKey(true); setKeyView('entry') }}
                      style={{
                        flex: 1, padding: '7px 0', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        borderRadius: 8, border: `1px solid ${CHAT_CFG.accentFrom}`,
                        background: '#fff', color: CHAT_CFG.accentFrom,
                      }}>
                      Use my own key instead
                    </button>
                    <button onClick={() => setShowKeyForm(false)}
                      style={{ padding: '7px 12px', fontSize: 12, cursor: 'pointer', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b' }}>
                      Close
                    </button>
                  </div>
                </>
              ) : keyPanelMode === 'active' ? (
                // A custom BYOK key is already active — show status + actions
                // instead of the bare entry form (key stays hidden).
                <>
                  <div style={{ fontSize: 12, color: '#15803d', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <KeyRound size={13} /> Using your {provider === 'claude' ? 'Claude' : 'OpenAI'} key — this session only.
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => { setApiKey(''); setKeyView('entry') }}
                      style={{
                        flex: 1, padding: '7px 0', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        borderRadius: 8, border: 'none', color: '#fff',
                        background: `linear-gradient(135deg, ${CHAT_CFG.accentFrom}, ${CHAT_CFG.accentTo})`,
                      }}>
                      Change key
                    </button>
                    <button onClick={clearKey}
                      style={{ padding: '7px 12px', fontSize: 12, cursor: 'pointer', borderRadius: 8, border: '1px solid #fecaca', background: '#fff', color: '#dc2626' }}>
                      Remove
                    </button>
                    {hasManagedKey ? (
                      <button onClick={switchToManaged}
                        style={{ padding: '7px 12px', fontSize: 12, cursor: 'pointer', borderRadius: 8, border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#15803d' }}>
                        Use platform key
                      </button>
                    ) : (
                      <button onClick={() => setShowKeyForm(false)}
                        style={{ padding: '7px 12px', fontSize: 12, cursor: 'pointer', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b' }}>
                        Close
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
                    Bring Your Own Key (this session only)
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                    {CHAT_CFG.providers.map(p => (
                      <button key={p.id} onClick={() => setProvider(p.id)}
                        style={{
                          flex: 1, padding: '6px 0', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          borderRadius: 8, border: `1px solid ${provider === p.id ? CHAT_CFG.accentFrom : '#e2e8f0'}`,
                          background: provider === p.id ? 'rgba(59,130,246,0.08)' : '#fff',
                          color: provider === p.id ? CHAT_CFG.accentFrom : '#64748b',
                        }}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    placeholder={`${provider === 'claude' ? 'Claude' : 'OpenAI'} API key`}
                    style={{
                      width: '100%', padding: '8px 10px', fontSize: 12, borderRadius: 8,
                      border: '1px solid #e2e8f0', outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <button onClick={saveKey} disabled={!apiKey.trim()}
                      style={{
                        flex: 1, padding: '7px 0', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        borderRadius: 8, border: 'none', color: '#fff',
                        background: `linear-gradient(135deg, ${CHAT_CFG.accentFrom}, ${CHAT_CFG.accentTo})`,
                        opacity: apiKey.trim() ? 1 : 0.5,
                      }}>
                      Save key
                    </button>
                    <button onClick={() => { setApiKey(readSS(CHAT_CFG.ssApiKey)); setKeyView('status'); setShowKeyForm(false) }}
                      style={{ padding: '7px 12px', fontSize: 12, cursor: 'pointer', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b' }}>
                      Cancel
                    </button>
                    {hasManagedKey && (
                      <button onClick={switchToManaged}
                        style={{ padding: '7px 12px', fontSize: 12, cursor: 'pointer', borderRadius: 8, border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#15803d' }}>
                        Use platform key
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.map((m, i) => (
              <div key={m.ts + '-' + i} style={{
                display: 'flex', gap: 8, alignItems: 'flex-start',
                flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
              }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: m.role === 'user'
                    ? 'linear-gradient(135deg,#10b981,#059669)'
                    : `linear-gradient(135deg, ${CHAT_CFG.accentFrom}, ${CHAT_CFG.accentTo})`,
                }}>
                  {m.role === 'user' ? <UserIcon size={13} color="#fff" /> : <Bot size={13} color="#fff" />}
                </div>
                <div style={{
                  maxWidth: '80%', padding: '9px 12px', borderRadius: 12, fontSize: 13, lineHeight: 1.5,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  background: m.role === 'user'
                    ? 'linear-gradient(135deg,#10b981,#059669)'
                    : m.error ? '#fef2f2' : '#f1f5f9',
                  color: m.role === 'user' ? '#fff' : m.error ? '#b91c1c' : '#0f172a',
                  border: m.role === 'user' ? 'none' : `1px solid ${m.error ? '#fca5a5' : '#e2e8f0'}`,
                }}>
                  {m.content}
                  {m.usage && (
                    <div style={{ marginTop: 6, fontSize: 10, opacity: 0.6, borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 4 }}>
                      {m.usage.total_tokens != null ? `${m.usage.total_tokens} tokens` : ''}
                      {m.usage.estimated_cost_usd != null ? ` · ~$${m.usage.estimated_cost_usd}` : ''}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {busy && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#64748b', fontSize: 12 }}>
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Thinking…
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '10px 12px', borderTop: '1px solid #e2e8f0', flexShrink: 0, background: '#fff' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                placeholder={CHAT_CFG.placeholder}
                rows={1}
                style={{
                  flex: 1, resize: 'none', padding: '9px 12px', fontSize: 13, borderRadius: 10,
                  border: '1px solid #e2e8f0', outline: 'none', fontFamily: 'inherit',
                  maxHeight: 90, boxSizing: 'border-box',
                }}
              />
              <button onClick={send} disabled={busy || !input.trim()} aria-label="Send message"
                style={{
                  width: 40, height: 40, borderRadius: 10, border: 'none', cursor: 'pointer', flexShrink: 0,
                  background: `linear-gradient(135deg, ${CHAT_CFG.accentFrom}, ${CHAT_CFG.accentTo})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: (busy || !input.trim()) ? 0.5 : 1,
                }}>
                {busy ? <Loader2 size={16} color="#fff" style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} color="#fff" />}
              </button>
            </div>
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 5 }}>
              Enter to send · Shift+Enter for a new line
              {needsKey && <span style={{ color: '#b45309' }}> · add an AI key (⚙ icon) to chat</span>}
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>,
    document.body
  )
}

export default RadAIChatWidget
