/* eslint-disable react/prop-types */
import { useEffect, useRef } from 'react'
import useAIProviderStatus from '../../hooks/useAIProviderStatus'

export function PlatformAIStatusDialog({ onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current, opener = document.activeElement
    dialog.showModal()
    return () => { dialog.close(); if (opener?.isConnected) opener.focus() }
  }, [])
  return <dialog ref={ref} aria-label="AI provider status" className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 text-slate-800 backdrop:bg-slate-900/50" onCancel={event => { event.preventDefault(); onClose() }}>
    <h2 className="mb-3 text-lg font-semibold">AI provider status</h2><p className="mb-4 text-sm">Your administrator manages provider credentials centrally.</p>
    <h3 className="my-2 font-semibold">OpenAI</h3><PlatformAIStatus provider="openai" />
    <h3 className="my-2 font-semibold">Anthropic Claude</h3><PlatformAIStatus provider="anthropic" />
    <button type="button" className="mt-4 rounded border border-slate-300 px-4 py-2" onClick={onClose}>Close</button>
  </dialog>
}

export default function PlatformAIStatus({ provider }) {
  const status = useAIProviderStatus(provider)
  return <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700" role="status">
    {status.loading ? 'Checking server AI configuration…' : status.error ? 'AI configuration could not be checked.' : status.managed
      ? status.ready ? 'AI credentials are managed by your administrator. No personal API key is needed.' : 'This AI provider is unavailable. Ask your administrator to enable a valid credential.'
      : 'AI uses server configuration. No personal API key is required here.'}
    {!status.loading && <button type="button" className="ml-2 underline underline-offset-2" onClick={status.refresh}>Refresh AI status</button>}
  </div>
}
