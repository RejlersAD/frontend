import { useEffect, useRef, useState } from 'react'
import { ArrowPathIcon, ArrowUpTrayIcon, CheckBadgeIcon, TrashIcon } from '@heroicons/react/24/outline'
import apiClient, { apiClientLongTimeout } from '../../services/api.service'
import { radaiConfirm } from '../../services/radaiDialog'

const ENDPOINT = '/users/employees/my-digital-stamp/'
const MAX_BYTES = 10 * 1024 * 1024
const ACCEPTED_TYPES = ['image/png', 'image/jpeg']

function errorMessage(error, fallback) {
  const data = error?.response?.data
  const message = data?.error || data?.detail || data?.message || data?.stamp
  if (Array.isArray(message)) return message.join(' ')
  if (typeof message === 'string') return message
  return error?.code === 'ECONNABORTED' ? 'The digital stamp request timed out. Please try again.' : fallback
}

export default function MyDigitalStampPanel() {
  const input = useRef(null)
  const mutation = useRef(null)
  const mounted = useRef(false)
  const [record, setRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [retry, setRetry] = useState(0)
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      mutation.current?.abort()
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setLoadError('')
    apiClient.get(ENDPOINT, { signal: controller.signal, suppressErrorToast: true })
      .then(({ data }) => { if (!controller.signal.aborted) setRecord(data) })
      .catch(error => {
        if (!controller.signal.aborted) setLoadError(errorMessage(error, 'Your profile artwork settings could not be loaded.'))
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [retry])

  const save = async file => {
    if (!file || !record?.can_manage || loading || mutation.current) return
    setNotice(null)
    if (!ACCEPTED_TYPES.includes(file.type) || file.size > MAX_BYTES) {
      setNotice({ error: true, text: !ACCEPTED_TYPES.includes(file.type) ? 'Choose a PNG or JPEG image.' : 'The digital stamp image must be 10 MB or smaller.' })
      if (input.current) input.current.value = ''
      return
    }
    const controller = new AbortController()
    mutation.current = controller
    setBusy('saving')
    const body = new FormData()
    // Send the original File: no cropping, background removal or client resizing.
    body.append('stamp', file)
    try {
      const { data } = await apiClientLongTimeout.post(ENDPOINT, body, { signal: controller.signal, suppressErrorToast: true })
      if (controller.signal.aborted) return
      setRecord(data)
      setNotice({ text: 'Your digital stamp is saved. Generated completed PO documents will use it where your approval is verified.' })
    } catch (error) {
      if (!controller.signal.aborted) setNotice({ error: true, text: errorMessage(error, 'The digital stamp could not be saved. Please try again.') })
    } finally {
      mutation.current = null
      if (mounted.current) {
        setBusy('')
        if (input.current) input.current.value = ''
      }
    }
  }

  const remove = async () => {
    if (busy || loading || !record?.can_manage) return
    if (!(await radaiConfirm('Remove your uploaded digital stamp? Generated completed PO documents will use the standard company stamp.'))) return
    if (!mounted.current || mutation.current) return
    const controller = new AbortController()
    mutation.current = controller
    setBusy('removing')
    setNotice(null)
    try {
      const { data } = await apiClient.delete(ENDPOINT, { signal: controller.signal, suppressErrorToast: true })
      if (controller.signal.aborted) return
      setRecord(data)
      setNotice({ text: 'Your uploaded stamp was removed. Generated completed PO documents will use the standard company stamp.' })
    } catch (error) {
      if (!controller.signal.aborted) setNotice({ error: true, text: errorMessage(error, 'The digital stamp could not be removed. Please try again.') })
    } finally {
      mutation.current = null
      if (mounted.current) setBusy('')
    }
  }

  // The authenticated endpoint alone decides who can manage this artwork.
  if (record?.can_manage !== true) return loadError ? <div className="mx-auto max-w-4xl rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="alert">
    <p>Your profile artwork settings could not be loaded.</p>
    <button type="button" className="mt-2 font-semibold underline" onClick={() => setRetry(value => value + 1)}>Retry profile artwork</button>
  </div> : null

  const disabled = Boolean(busy) || loading
  return <section aria-label="My digital stamp" className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <header className="border-b border-slate-100 px-5 py-4">
      <h2 className="font-semibold text-slate-900">My Digital Stamp</h2>
      <p className="mt-1 text-xs text-slate-500">Use a high-resolution stamp image. A transparent PNG is recommended; JPEG is also supported, up to 10 MB.</p>
    </header>
    <div className="space-y-5 p-5">
      {loadError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{loadError} <button type="button" className="font-semibold underline" disabled={disabled} onClick={() => setRetry(value => value + 1)}>Retry digital stamp</button></div>}
      {notice && <p role={notice.error ? 'alert' : 'status'} className={`rounded-xl border p-3 text-sm ${notice.error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{notice.text}</p>}
      <div className="grid gap-5 lg:grid-cols-2">
        <button type="button" disabled={disabled} onClick={() => input.current?.click()}
          onDragOver={event => event.preventDefault()}
          onDrop={event => { event.preventDefault(); save(event.dataTransfer.files?.[0]) }}
          className="flex min-h-52 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center hover:border-blue-400 disabled:cursor-wait disabled:opacity-60">
          {busy ? <ArrowPathIcon aria-hidden="true" className="h-9 w-9 animate-spin text-blue-600" /> : <ArrowUpTrayIcon aria-hidden="true" className="h-9 w-9 text-blue-600" />}
          <span className="mt-3 text-sm font-semibold text-slate-800">{busy === 'saving' ? 'Saving digital stamp…' : busy === 'removing' ? 'Removing digital stamp…' : record.stamp ? 'Replace digital stamp' : 'Upload digital stamp'}</span>
          <span className="mt-1 text-xs text-slate-500">Choose a file or drag it here. No browser resizing or background removal.</span>
        </button>
        <input ref={input} type="file" aria-label="Digital stamp image" accept="image/png,image/jpeg" className="hidden" disabled={disabled} onChange={event => save(event.target.files?.[0])} />
        <div className="flex min-h-52 flex-col rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="mb-3 flex items-center justify-between text-xs font-semibold text-slate-500"><span>Saved stamp preview</span>{record.stamp && <CheckBadgeIcon aria-hidden="true" className="h-5 w-5 text-emerald-600" />}</div>
          <div className="flex flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white p-4">
            {loading ? <p role="status" className="text-sm text-slate-500">Loading digital stamp…</p> : record.stamp ? <img src={record.stamp} alt="Your saved digital stamp" className="max-h-48 max-w-full object-contain opacity-100" /> : <p className="text-center text-sm text-slate-500">No uploaded stamp. The standard company stamp is used for eligible completed POs.</p>}
          </div>
          {record.updated_at && <p className="mt-2 text-right text-xs text-slate-500">Updated {new Date(record.updated_at).toLocaleString()}</p>}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="max-w-xl text-xs leading-5 text-slate-600">Generated completed PO previews and downloads use this stamp with your verified approval. Original uploaded PDFs and recorded approval decisions are retained. Removing it restores the standard company stamp.</p>
        {record.stamp && <button type="button" disabled={disabled} onClick={remove} className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-50"><TrashIcon aria-hidden="true" className="h-4 w-4" />Remove digital stamp</button>}
      </div>
    </div>
  </section>
}
