/* eslint-disable react/prop-types */
import React, { useEffect, useRef, useState } from 'react'
import { ArrowDownTrayIcon, ArrowPathIcon, CheckCircleIcon, ExclamationTriangleIcon, XCircleIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { APPROVAL_ACTIONS, APPROVAL_TYPES } from '../../config/approvalsSystem.config'
import apiClient from '../../services/api.service'
import LeaveApprovalReview from './LeaveApprovalReview'
import ProcurementApprovalPreviewModal from './ProcurementApprovalPreviewModal'

const errorText = value => {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(errorText).filter(Boolean).join(' ')
  if (value && typeof value === 'object') return Object.values(value).map(errorText).filter(Boolean).join(' ')
  return ''
}

async function reviewError(error, fallback) {
  let data = error?.response?.data
  if (data instanceof Blob) {
    try { data = JSON.parse(await data.text()) } catch { data = null }
  }
  return errorText(data) || fallback
}

function ProfileDocumentReview({ item, onClose, onDecision, initialAction }) {
  const [actionId, setActionId] = useState(['approve', 'reject'].includes(initialAction) ? initialAction : null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const config = APPROVAL_TYPES.PROFILE_DOCUMENT
  const canDecide = item._canDecide === true && item.verification_status === 'pending'

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const escape = event => {
      if (event.key === 'Escape' && !submitting) onClose()
    }
    window.addEventListener('keydown', escape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', escape)
    }
  }, [onClose, submitting])

  const decide = async comment => {
    if (submitting || !canDecide || !['approve', 'reject'].includes(actionId)) return
    if (actionId === 'reject' && !comment.trim()) {
      setError('Please provide a reason for rejection.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const endpoint = `/rbac/profile-documents/${item.id}/${actionId === 'approve' ? 'verify' : 'reject'}/`
      await apiClient.post(endpoint, actionId === 'reject' ? { reason: comment.trim() } : { note: comment.trim(), signature: '' }, { suppressErrorToast: true })
    } catch (requestError) {
      setError(await reviewError(requestError, `Unable to ${actionId} this document.`))
      setSubmitting(false)
      return
    }
    setSubmitting(false)
    onDecision?.(item)
    onClose()
  }

  return <ApprovalActionModal isOpen item={item} config={config} canDecide={canDecide}
    mode={canDecide && actionId ? 'action' : 'view'} actionId={canDecide ? actionId : null}
    submitting={submitting} error={error} onClose={() => { if (!submitting) onClose() }}
    onConfirm={decide} onSelectAction={action => { if (canDecide) { setActionId(action); setError('') } }} />
}

/** Preserve each source's existing authenticated review and decision workflow. */
export default function ApprovalReviewDialog({ item, onClose, onDecision, initialAction = 'view' }) {
  const host = useRef(null)
  const previousFocus = useRef(typeof document === 'undefined' ? null : document.activeElement)
  const type = item?._approvalConfig?.id || item?._approvalType
  const identity = item ? `${type}:${item.approval_queue_id || item.id}:${initialAction}` : null

  useEffect(() => {
    if (!identity) return undefined
    let removeTrap = () => {}
    const frame = requestAnimationFrame(() => {
      const dialog = host.current?.querySelector('[role="dialog"], dialog')
      if (!dialog) return
      const previousTabIndex = dialog.getAttribute('tabindex')
      dialog.setAttribute('tabindex', '-1')
      const controls = () => [...dialog.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])')]
        .filter(element => element.getAttribute('aria-hidden') !== 'true' && element.getClientRects().length > 0)
      const focusStart = () => {
        const close = dialog.querySelector('button[aria-label^="Close"]:not([disabled])')
        ;(close || controls()[0] || dialog).focus({ preventScroll: true })
      }
      const handleTab = event => {
        if (event.key !== 'Tab') return
        const available = controls()
        const first = available[0], last = available[available.length - 1]
        if (!available.length) { event.preventDefault(); dialog.focus(); return }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
          event.preventDefault(); last.focus()
        } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) {
          event.preventDefault(); first.focus()
        }
      }
      const containFocus = event => {
        if (dialog.isConnected && !dialog.contains(event.target)) focusStart()
      }
      dialog.addEventListener('keydown', handleTab)
      document.addEventListener('focusin', containFocus)
      focusStart()
      removeTrap = () => {
        dialog.removeEventListener('keydown', handleTab)
        document.removeEventListener('focusin', containFocus)
        if (previousTabIndex === null) dialog.removeAttribute('tabindex')
        else dialog.setAttribute('tabindex', previousTabIndex)
      }
    })
    const restoreTarget = previousFocus.current
    return () => {
      cancelAnimationFrame(frame)
      removeTrap()
      if (restoreTarget?.isConnected) restoreTarget.focus({ preventScroll: true })
    }
  }, [identity])

  if (!item) return null
  let content = null
  if (type === 'leave') {
    content = <LeaveApprovalReview key={identity} requestId={item.id} onClose={onClose}
      onUpdated={() => onDecision?.(item)} />
  } else if (['procurement', 'purchase_order'].includes(type)) {
    content = <ProcurementApprovalPreviewModal key={identity} isOpen
      type={type === 'purchase_order' ? 'po' : 'pr'} recordId={item.id}
      approvalStage={item.approval_stage} canDecide={item._canDecide === true}
      initialAction={initialAction} onClose={onClose} onDecision={() => onDecision?.(item)} />
  } else if (type === 'profile_document') {
    content = <ProfileDocumentReview key={identity} item={item} onClose={onClose}
      onDecision={onDecision} initialAction={initialAction} />
  }
  return content ? <div ref={host} style={{ display: 'contents' }}>{content}</div> : null
}

const ApprovalActionModal = ({ isOpen, mode, item, actionId, config, canDecide, submitting, error, onClose, onConfirm, onSelectAction }) => {
  const [comment, setComment] = useState('')
  const [commentError, setCommentError] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewMimeType, setPreviewMimeType] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setComment('')
      setCommentError('')
    }
  }, [isOpen, item, actionId])

  useEffect(() => {
    if (!isOpen || !item || !config?.previewEndpoint) {
      setPreviewUrl('')
      setPreviewMimeType('')
      setPreviewError('')
      return undefined
    }

    const controller = new AbortController()
    let objectUrl = ''
    setPreviewLoading(true)
    setPreviewError('')

    const loadPreview = async () => {
      try {
        const endpoint = typeof config.previewEndpoint === 'function'
          ? config.previewEndpoint(item)
          : config.previewEndpoint
        const response = await apiClient.get(endpoint, {
          responseType: 'blob', signal: controller.signal, suppressErrorToast: true,
        })
        if (controller.signal.aborted) return
        const blob = response.data
        objectUrl = URL.createObjectURL(blob)
        setPreviewMimeType(blob.type)
        setPreviewUrl(objectUrl)
      } catch (error) {
        if (!controller.signal.aborted) setPreviewError(await reviewError(error, 'Document preview could not be loaded.'))
      } finally {
        if (!controller.signal.aborted) setPreviewLoading(false)
      }
    }

    loadPreview()
    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [isOpen, item, config])

  if (!isOpen || !item || !config) return null

  const action = actionId ? APPROVAL_ACTIONS[actionId] : null
  const isViewMode = mode === 'view'
  const requiresComment = !!action?.requiresComment

  // Soft-coded per-field-type renderer — reused for every approval category
  const renderFieldValue = (field) => {
    const raw = item[field.key]
    if (raw === null || raw === undefined || raw === '') {
      return <span className="text-slate-400 italic">N/A</span>
    }

    switch (field.type) {
      case 'currency': {
        const num = Number(raw)
        return (
          <span className="font-semibold text-slate-900">
            {Number.isFinite(num) ? num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(raw)}
          </span>
        )
      }
      case 'date': {
        const d = new Date(raw)
        return (
          <span className="text-slate-900">
            {Number.isNaN(d.getTime()) ? String(raw) : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
          </span>
        )
      }
      case 'badge':
        return (
          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 capitalize">
            {String(raw).replace(/_/g, ' ')}
          </span>
        )
      case 'progress': {
        const pct = Math.max(0, Math.min(100, Number(raw) || 0))
        return (
          <div className="flex items-center gap-2 w-full">
            <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-semibold text-slate-600">{pct}%</span>
          </div>
        )
      }
      case 'number':
        return <span className="font-medium text-slate-900">{Number.isFinite(Number(raw)) ? Number(raw).toLocaleString() : String(raw)}</span>
      default:
        return <span className="text-slate-900">{String(raw)}</span>
    }
  }

  const headerStyle = config.gradientFrom && config.gradientTo
    ? { backgroundImage: `linear-gradient(135deg, ${config.gradientFrom}, ${config.gradientTo})` }
    : { backgroundColor: '#4338ca' }

  const handleConfirmClick = () => {
    if (requiresComment && !comment.trim()) {
      setCommentError(
        actionId === 'reject' ? 'Please provide a reason for rejection.' : 'Please provide a comment.'
      )
      return
    }
    if (canDecide && !submitting) onConfirm(comment.trim())
  }

  const confirmButtonClasses = actionId === 'reject'
    ? 'bg-red-600 hover:bg-red-700'
    : actionId === 'comment'
    ? 'bg-slate-600 hover:bg-slate-700'
    : 'bg-green-600 hover:bg-green-700'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />

      <div role="dialog" aria-modal="true" aria-labelledby="profile-review-title" className={`relative bg-white w-full ${config.previewEndpoint ? 'max-w-5xl' : 'max-w-lg'} rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-[fadeIn_0.15s_ease-out]`}>
        {/* Header */}
        <div className="px-6 py-5 text-white flex-shrink-0" style={headerStyle}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/80">{config.label}</p>
              <h3 id="profile-review-title" className="text-xl font-bold mt-0.5">
                {isViewMode ? 'Request Details' : `${action?.label || 'Action'} Request`}
              </h3>
            </div>
            <button
              onClick={onClose}
              aria-label="Close document review"
              disabled={submitting}
              className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>
        </div>

        {error && <p role="alert" className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {config.previewEndpoint && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
              <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">Document Preview</p>
                  <p className="text-xs text-slate-500">Review the uploaded file before taking action.</p>
                </div>
                {previewUrl && (
                  <a
                    href={previewUrl}
                    download={item.document_file_name || 'profile-document'}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <ArrowDownTrayIcon className="h-4 w-4" /> Download
                  </a>
                )}
              </div>
              <div className="flex h-[420px] items-center justify-center p-3">
                {previewLoading ? (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <ArrowPathIcon className="h-5 w-5 animate-spin" /> Loading secure preview…
                  </div>
                ) : previewError ? (
                  <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700">
                    {previewError}
                  </div>
                ) : previewUrl && previewMimeType.startsWith('image/') ? (
                  <img
                    src={previewUrl}
                    alt={item.document_name || item.document_type_label || 'Profile document'}
                    className="max-h-full max-w-full rounded-lg bg-white object-contain shadow-sm"
                  />
                ) : previewUrl ? (
                  <iframe
                    src={previewUrl}
                    title={item.document_file_name || 'Profile document preview'}
                    className="h-full w-full rounded-lg border-0 bg-white"
                  />
                ) : null}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
            {config.displayFields.map(field => (
              <div key={field.key} className={field.type === 'progress' ? 'sm:col-span-2' : ''}>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{field.label}</p>
                {renderFieldValue(field)}
              </div>
            ))}
          </div>

          {item[config.statusField] && (
            <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Current Status</span>
              <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200 capitalize">
                {String(item[config.statusField]).replace(/_/g, ' ')}
              </span>
            </div>
          )}

          {!isViewMode && (
            <div className="pt-2">
              <label htmlFor="profile-review-comment" className="block text-sm font-semibold text-slate-700 mb-1.5">
                {actionId === 'reject' ? 'Reason for Rejection' : actionId === 'comment' ? 'Your Comment' : 'Comment (optional)'}
                {requiresComment && <span className="text-red-500"> *</span>}
              </label>
              <textarea
                id="profile-review-comment"
                value={comment}
                onChange={(e) => { setComment(e.target.value); setCommentError('') }}
                rows={3}
                disabled={submitting}
                placeholder={actionId === 'reject' ? 'Explain why this request is being rejected...' : 'Add a note (optional)...'}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-colors disabled:opacity-50 disabled:bg-slate-50 ${
                  commentError ? 'border-red-400 focus:ring-red-200' : 'border-slate-300 focus:ring-indigo-200 focus:border-indigo-400'
                }`}
              />
              {commentError && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                  {commentError}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
          >
            {isViewMode ? 'Close' : 'Cancel'}
          </button>
          {isViewMode && canDecide && config.actions?.includes('reject') && (
            <button
              onClick={() => onSelectAction('reject', item)}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              <XCircleIcon className="h-4 w-4" />
              Reject
            </button>
          )}
          {isViewMode && canDecide && config.actions?.includes('approve') && (
            <button
              onClick={() => onSelectAction('approve', item)}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
            >
              <CheckCircleIcon className="h-4 w-4" />
              Approve
            </button>
          )}
          {!isViewMode && canDecide && (
            <button
              onClick={handleConfirmClick}
              disabled={submitting}
              className={`px-5 py-2 text-sm font-semibold text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 ${confirmButtonClasses}`}
            >
              {submitting && <ArrowPathIcon className="w-4 h-4 animate-spin" />}
              {submitting ? 'Processing...' : `Confirm ${action?.label || ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
