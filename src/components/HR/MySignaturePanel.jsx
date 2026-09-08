import { useEffect, useRef, useState } from 'react'
import * as HeroIcons from '@heroicons/react/24/outline'
import apiClient, { apiClientLongTimeout } from '../../services/api.service'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 8 * 1024 * 1024

const requestErrorMessage = (error, fallback) => {
  const payload = error?.response?.data
  const isHtmlErrorPage = typeof payload === 'string' && /<(?:!doctype|html|head|body)\b/i.test(payload)
  if (typeof payload === 'string' && payload.trim() && !isHtmlErrorPage) return payload
  return payload?.error || payload?.detail || payload?.message
    || (error?.response?.status === 404 ? 'The signature service is unavailable. Refresh the page and try again.' : null)
    || (error?.code === 'ECONNABORTED' ? 'The signature upload timed out. Please try again.' : fallback)
}

export default function MySignaturePanel() {
  const inputRef = useRef(null)
  const [signature, setSignature] = useState(null)
  const [updatedAt, setUpdatedAt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    let active = true
    apiClient.get('/users/employees/my-signature/', { suppressErrorToast: true })
      .then(({ data }) => {
        if (!active) return
        setSignature(data?.signature || null)
        setUpdatedAt(data?.updated_at || null)
      })
      .catch((error) => {
        if (active) setNotice({ type: 'error', text: requestErrorMessage(error, 'Your signature could not be loaded.') })
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const upload = async (file) => {
    setNotice(null)
    if (!file || !ACCEPTED_TYPES.includes(file.type)) {
      setNotice({ type: 'error', text: 'Choose a JPEG, PNG, or WebP image.' })
      return
    }
    if (file.size > MAX_BYTES) {
      setNotice({ type: 'error', text: 'The image must be 8 MB or smaller.' })
      return
    }

    const body = new FormData()
    body.append('signature', file)
    setSaving(true)
    try {
      const { data } = await apiClientLongTimeout.post('/users/employees/my-signature/', body)
      setSignature(data.signature)
      setUpdatedAt(data.updated_at)
      setNotice({ type: 'success', text: 'Your cropped signature has been saved and will be used for approvals.' })
    } catch (error) {
      setNotice({ type: 'error', text: requestErrorMessage(error, 'The signature could not be saved.') })
    } finally {
      setSaving(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const remove = async () => {
    if (!window.confirm('Remove your saved signature? You will not be able to approve documents until you add another one.')) return
    setSaving(true)
    setNotice(null)
    try {
      await apiClient.delete('/users/employees/my-signature/')
      setSignature(null)
      setUpdatedAt(null)
      setNotice({ type: 'success', text: 'Your saved signature was removed. Existing signed records are unchanged.' })
    } catch (error) {
      setNotice({ type: 'error', text: requestErrorMessage(error, 'The signature could not be removed.') })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-[#1877F2]">
              <HeroIcons.PencilSquareIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">My Signature</h2>
              <p className="text-xs text-slate-500">Upload a clear scan or photo. White space and paper background are removed automatically.</p>
            </div>
          </div>
        </header>

        <div className="space-y-5 p-5">
          {notice && (
            <div className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${notice.type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
              {notice.type === 'error' ? <HeroIcons.ExclamationTriangleIcon className="mt-0.5 h-5 w-5 flex-none" /> : <HeroIcons.CheckCircleIcon className="mt-0.5 h-5 w-5 flex-none" />}
              {notice.text}
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => inputRef.current?.click()}
              onDragEnter={(event) => { event.preventDefault(); setDragging(true) }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => { event.preventDefault(); setDragging(false); upload(event.dataTransfer.files?.[0]) }}
              className={`flex min-h-52 flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition ${dragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/50'} disabled:cursor-wait disabled:opacity-60`}
            >
              {saving ? <HeroIcons.ArrowPathIcon className="h-9 w-9 animate-spin text-blue-600" /> : <HeroIcons.ArrowUpTrayIcon className="h-9 w-9 text-blue-600" />}
              <span className="mt-3 text-sm font-semibold text-slate-800">{saving ? 'Cropping and saving…' : signature ? 'Replace signature image' : 'Upload signature image'}</span>
              <span className="mt-1 text-xs text-slate-500">Drag and drop or click to browse · JPEG, PNG, WebP · max 8 MB</span>
            </button>
            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => upload(event.target.files?.[0])} />

            <div className="flex min-h-52 flex-col rounded-2xl border border-slate-200 bg-[linear-gradient(45deg,#f8fafc_25%,transparent_25%),linear-gradient(-45deg,#f8fafc_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f8fafc_75%),linear-gradient(-45deg,transparent_75%,#f8fafc_75%)] bg-[length:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0px] p-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Saved preview</span>
                {signature && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700"><HeroIcons.CheckBadgeIcon className="h-3.5 w-3.5" /> Ready</span>}
              </div>
              <div className="flex flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white/90 p-5">
                {loading ? <HeroIcons.ArrowPathIcon className="h-7 w-7 animate-spin text-blue-600" /> : signature ? <img src={signature} alt="Your saved signature" className="max-h-28 max-w-full object-contain" /> : <div className="text-center text-slate-400"><HeroIcons.PencilIcon className="mx-auto h-8 w-8" /><p className="mt-2 text-sm">No signature saved</p></div>}
              </div>
              {updatedAt && <p className="mt-2 text-right text-[11px] text-slate-400">Updated {new Date(updatedAt).toLocaleString()}</p>}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="max-w-2xl text-xs leading-5 text-amber-800"><strong>Important:</strong> Your saved signature is automatically copied into documents you approve. Each approval keeps its own snapshot, so replacing this image will not change older records.</p>
            {signature && <button type="button" disabled={saving} onClick={remove} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"><HeroIcons.TrashIcon className="h-4 w-4" /> Remove</button>}
          </div>
        </div>
      </section>
    </div>
  )
}
