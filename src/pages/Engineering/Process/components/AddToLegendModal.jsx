import { useState, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import { toast } from 'react-toastify'

import { addLegendLookupEntry, editLegendLookupEntry, listLookupSections, LEGEND_SECTIONS } from '../../../../services/pidCheckerV2API'

/**
 * Shared by P&ID Verification V1 and V2 (both talk to the same
 * pid_checker_v2 legend backend) — two entry points:
 *   - "+ Add to Legend" quick-add on an unrecognised Legend Check
 *     finding (section/value pre-filled and locked, just needs a
 *     description).
 *   - Manage Legends' own lookup-table row editor (Add Row / Edit),
 *     nothing pre-filled/locked for a new row, section+value locked
 *     for an edit of an existing one.
 * add/edit are the same backend write (upsert) — `mode` only changes
 * the modal's title/button copy and which field(s) start locked.
 */
const AddToLegendModal = ({
  isOpen, onClose, onSaved,
  initialSection = '', initialCode = '', initialDescription = '',
  mode = 'add', lockSection = false, lockCode = false,
}) => {
  const [section, setSection] = useState(initialSection)
  const [code, setCode] = useState(initialCode)
  const [description, setDescription] = useState(initialDescription)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // BUG FIX: some legend sections are format/regex-only and have no
  // lookup field at all. Offering them in this dropdown let a user pick
  // one and then fail on save with "no lookup table to add to" no matter
  // what they typed. Fetch which of the user's active legends actually
  // have a lookup table and restrict the dropdown to just those,
  // defaulting to the first one when nothing was explicitly locked in.
  const [lookupSections, setLookupSections] = useState(null) // null = still loading

  // BUG FIX (the real one — the fix above only ever changed what VALUE
  // gets passed as initialSection; this fixes the modal actually USING
  // it). This component never unmounts between opens — Manage Legends
  // keeps ONE instance alive and toggles it via `isOpen`/`return null` —
  // so `useState(initialSection)` above only runs on the very FIRST open
  // this page load ever sees, then never again. Confirmed live: click
  // "+ Add Row" once on ANY tab (locks in whatever that tab's section
  // was), then click it again on a DIFFERENT tab — the modal kept
  // showing the FIRST tab's section every time, because section only
  // ever re-synced when `!lockSection` (line below) — and the Manage
  // Legends "+ Add Row" flow always passes lockSection=true. Re-sync
  // every field fresh on every open, unconditionally.
  useEffect(() => {
    if (!isOpen) return
    setSection(initialSection)
    setCode(initialCode)
    setDescription(initialDescription)
    setError('')
  }, [isOpen, initialSection, initialCode, initialDescription])

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    listLookupSections().then((secs) => {
      if (cancelled) return
      setLookupSections(secs)
      if (!lockSection) {
        setSection((prev) => (prev && secs.includes(prev)) ? prev : (secs[0] || ''))
      }
    }).catch(() => { if (!cancelled) setLookupSections([]) })
    return () => { cancelled = true }
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null

  const availableSections = (lookupSections === null || lockSection)
    ? LEGEND_SECTIONS
    : LEGEND_SECTIONS.filter((s) => lookupSections.includes(s.id))

  const handleSave = async (e) => {
    e.preventDefault()
    if (!section || !code.trim() || !description.trim()) {
      setError('Section, value, and description are all required.')
      return
    }
    setSaving(true); setError('')
    try {
      const call = mode === 'edit' ? editLegendLookupEntry : addLegendLookupEntry
      const payload = { section, code: code.trim(), description: description.trim() }
      const result = await call(payload)
      toast.success(`"${payload.code}" saved to the legend.`)
      onSaved?.(result, payload)
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">
            {mode === 'edit' ? 'Edit Legend Entry' : 'Add to Legend'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSave} className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Section</label>
            <select
              value={section}
              onChange={(e) => setSection(e.target.value)}
              disabled={lockSection || lookupSections === null}
              required
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white disabled:bg-slate-50 disabled:text-slate-500 outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
            >
              <option value="">
                {lookupSections === null ? 'Loading tabs…' : 'Select a tab…'}
              </option>
              {availableSections.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
            {lookupSections !== null && lookupSections.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                No legend tab has a lookup table to add codes to yet.
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Value</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={lockCode}
              required
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 disabled:bg-slate-50 disabled:text-slate-500 outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. DIGITAL INPUT"
              required
              autoFocus
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="text-sm px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="text-sm px-4 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddToLegendModal
