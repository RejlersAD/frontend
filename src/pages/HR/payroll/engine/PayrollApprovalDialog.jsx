import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckBadgeIcon, XMarkIcon } from '@heroicons/react/24/outline'

export default function PayrollApprovalDialog({ action, cycle, onClose, onConfirm }) {
  const dialogRef = useRef(null)
  const submittingRef = useRef(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const dialog = dialogRef.current
    const previousFocus = document.activeElement
    dialog.showModal()
    return () => {
      dialog.close()
      previousFocus?.focus()
    }
  }, [])

  const submit = async (event) => {
    event.preventDefault()
    if (submittingRef.current) return
    submittingRef.current = true
    setBusy(true)
    setError('')
    try {
      await onConfirm(note.trim())
    } catch (failure) {
      setError(failure?.response?.data?.error || failure.message || 'Approval could not be completed.')
      submittingRef.current = false
      setBusy(false)
    }
  }

  return createPortal(
    <dialog ref={dialogRef} aria-labelledby="payroll-approval-title"
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose() }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/40">
      <form onSubmit={submit} aria-busy={busy}>
        <div className="flex items-center gap-3 border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-white px-5 py-4">
          <span className="rounded-lg bg-indigo-100 p-2 text-indigo-600"><CheckBadgeIcon className="h-5 w-5" /></span>
          <div className="flex-1"><h2 id="payroll-approval-title" className="text-base font-semibold">{action}</h2><p className="mt-0.5 text-xs text-slate-500">Payroll Run {cycle}</p></div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close approval dialog" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-40"><XMarkIcon className="h-5 w-5" /></button>
        </div>
        <div className="p-5">
          <label htmlFor="payroll-approval-note" className="mb-2 block text-sm font-medium">Note <span className="font-normal text-slate-500">(optional)</span></label>
          <textarea autoFocus id="payroll-approval-note" value={note} disabled={busy} onChange={(event) => setNote(event.target.value)} rows={3} className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
          {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-40">Cancel</button>
          <button type="submit" disabled={busy} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">{busy ? 'Confirming...' : 'Confirm'}</button>
        </div>
      </form>
    </dialog>, document.body,
  )
}
