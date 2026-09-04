import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import apiClient from '../../services/api.service'
import PurchaseOrderLivePreview from '../../pages/Procurement/PurchaseOrderLivePreview'
import PurchaseRequisitionDocumentPreview from '../../pages/Procurement/PurchaseRequisitionDocumentPreview'

const emptyDecision = { loading: false, mode: null, reason: '', message: '', error: '' }

const ProcurementApprovalPreviewModal = ({ isOpen, type, recordId, onClose, onDecision }) => {
  const [record, setRecord] = useState({ loading: false, data: null, error: '' })
  const [decision, setDecision] = useState(emptyDecision)

  useEffect(() => {
    if (!isOpen || !['po', 'pr'].includes(type) || !recordId) {
      setRecord({ loading: false, data: null, error: '' })
      setDecision(emptyDecision)
      return undefined
    }

    let cancelled = false
    setRecord({ loading: true, data: null, error: '' })
    setDecision(emptyDecision)
    const endpoint = type === 'po'
      ? `/procurement/orders/${recordId}/`
      : `/procurement/requisitions/${recordId}/`

    apiClient.get(endpoint)
      .then((response) => {
        if (!cancelled) setRecord({ loading: false, data: response.data, error: '' })
      })
      .catch((requestError) => {
        if (!cancelled) {
          setRecord({
            loading: false,
            data: null,
            error: requestError.response?.data?.detail || `The ${type === 'po' ? 'Purchase Order' : 'Purchase Requisition'} preview could not be loaded.`,
          })
        }
      })

    return () => { cancelled = true }
  }, [isOpen, recordId, type])

  useEffect(() => {
    if (!isOpen) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleEscape = (event) => {
      if (event.key === 'Escape' && !decision.loading) onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleEscape)
    }
  }, [decision.loading, isOpen, onClose])

  const submitDecision = async (action) => {
    if (!record.data || !['approve', 'reject'].includes(action)) return
    const reason = decision.reason.trim()
    if (action === 'reject' && reason.length < 10) {
      setDecision((current) => ({ ...current, error: 'Please provide a rejection reason of at least 10 characters.', message: '' }))
      return
    }

    setDecision((current) => ({ ...current, loading: true, error: '', message: '' }))
    try {
      const isPurchaseOrder = type === 'po'
      const endpoint = isPurchaseOrder
        ? `/procurement/orders/${recordId}/${action}/`
        : `/procurement/requisitions/${recordId}/${action === 'approve' ? 'process_dynamic_approval' : 'process_dynamic_rejection'}/`
      const payload = isPurchaseOrder
        ? {
            approval_stage: record.data.current_approval?.stage || record.data.approval_stage,
            note: reason,
            reason,
          }
        : action === 'approve'
          ? { signature: '' }
          : { reason }

      const response = await apiClient.post(endpoint, payload)
      const updatedRecord = response.data?.purchase_order || response.data?.requisition || response.data
      if (updatedRecord && typeof updatedRecord === 'object') {
        setRecord((current) => ({ ...current, data: { ...current.data, ...updatedRecord } }))
      }
      const message = `${type === 'po' ? 'Purchase Order' : 'Purchase Requisition'} ${action === 'approve' ? 'approved' : 'rejected'} successfully.`
      setDecision({ ...emptyDecision, message })
      window.dispatchEvent(new Event('procurement-approval-updated'))
      onDecision?.({ action, response: response.data })
    } catch (requestError) {
      setDecision((current) => ({
        ...current,
        loading: false,
        error: requestError.response?.data?.detail || requestError.response?.data?.error || `Unable to ${action} this request.`,
        message: '',
      }))
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-2 backdrop-blur-sm sm:p-5" role="presentation" onMouseDown={() => { if (!decision.loading) onClose() }}>
      <section role="dialog" aria-modal="true" aria-labelledby="approval-record-preview-title" className="flex max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/20 bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600">Notification preview</p>
            <h2 id="approval-record-preview-title" className="mt-1 truncate text-lg font-black text-slate-950 sm:text-xl">
              {type === 'po' ? 'Purchase Order' : 'Purchase Recommendation'} · {record.data?.po_number || record.data?.pr_number || recordId}
            </h2>
          </div>
          <button type="button" onClick={onClose} disabled={decision.loading} className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40" aria-label="Close preview">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-100 p-3 sm:p-5">
          {record.loading ? (
            <div className="flex min-h-[420px] items-center justify-center"><div className="text-center"><ArrowPathIcon className="mx-auto h-9 w-9 animate-spin text-indigo-600" /><p className="mt-3 text-sm font-semibold text-slate-600">Loading preview...</p></div></div>
          ) : record.error ? (
            <div className="mx-auto mt-12 max-w-lg rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center"><ExclamationTriangleIcon className="mx-auto h-9 w-9 text-rose-500" /><p className="mt-3 text-sm font-bold text-rose-800">{record.error}</p></div>
          ) : record.data && type === 'po' ? (
            <PurchaseOrderLivePreview
              formData={record.data}
              vendor={{ name: record.data.vendor_name, address: record.data.vendor_address || record.data.seller_address, country: record.data.vendor_country || record.data.country }}
              prReference={{ id: record.data.pr_reference, pr_number: record.data.pr_number }}
              files={(Array.isArray(record.data.attachments) ? record.data.attachments : []).map((file) => (
                typeof file === 'string' ? { name: file.split('/').pop() || file } : { ...file, name: file.name || file.file_name || file.filename || 'Attachment' }
              ))}
            />
          ) : record.data ? (
            <PurchaseRequisitionDocumentPreview requisition={record.data} />
          ) : null}
        </div>

        {record.data && !record.loading && !record.error && (
          <footer className="border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
            {decision.mode === 'reject' && !decision.message && (
              <div className="mb-3">
                <label htmlFor="approval-preview-rejection" className="mb-1.5 block text-xs font-semibold text-slate-700">Rejection reason</label>
                <textarea id="approval-preview-rejection" value={decision.reason} onChange={(event) => setDecision((current) => ({ ...current, reason: event.target.value, error: '' }))} rows={3} maxLength={1000} disabled={decision.loading} placeholder="Explain why this request is being rejected..." className="w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#0f6cbd] focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100" />
                <p className="mt-1 text-[11px] text-slate-500">Minimum 10 characters · {decision.reason.length}/1000</p>
              </div>
            )}

            {decision.error && <div className="mb-3 flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700"><ExclamationTriangleIcon className="h-4 w-4 flex-none" />{decision.error}</div>}
            {decision.message && <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700"><CheckCircleIcon className="h-4 w-4 flex-none" />{decision.message}</div>}

            {!decision.message && (
              <div className="flex flex-wrap items-center justify-end gap-2">
                {decision.mode === 'reject' && <button type="button" onClick={() => setDecision((current) => ({ ...current, mode: null, reason: '', error: '' }))} disabled={decision.loading} className="h-9 rounded-md border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40">Cancel</button>}
                <button type="button" onClick={() => decision.mode === 'reject' ? submitDecision('reject') : setDecision((current) => ({ ...current, mode: 'reject', message: '', error: '' }))} disabled={decision.loading} className="inline-flex h-9 items-center gap-2 rounded-md border border-rose-300 bg-white px-4 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-40">
                  <XCircleIcon className="h-4 w-4" />{decision.loading && decision.mode === 'reject' ? 'Rejecting...' : decision.mode === 'reject' ? 'Confirm rejection' : 'Reject'}
                </button>
                {decision.mode !== 'reject' && <button type="button" onClick={() => submitDecision('approve')} disabled={decision.loading} className="inline-flex h-9 items-center gap-2 rounded-md bg-emerald-600 px-4 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-40"><CheckCircleIcon className="h-4 w-4" />{decision.loading ? 'Approving...' : 'Approve'}</button>}
              </div>
            )}
          </footer>
        )}
      </section>
    </div>
  )
}

ProcurementApprovalPreviewModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  type: PropTypes.oneOf(['po', 'pr']),
  recordId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onClose: PropTypes.func.isRequired,
  onDecision: PropTypes.func,
}

export default ProcurementApprovalPreviewModal
