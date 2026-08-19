/**
 * Workflow Action Buttons — Smart action buttons for payroll workflow
 * 
 * Shows appropriate actions based on:
 *   - Current workflow stage
 *   - User's email (matches backend WORKFLOW_STAKEHOLDERS)
 *   - User's computed permissions from backend
 * 
 * Actions:
 *   - Submit for Review (Michelle - payroll_admin)
 *   - Approve HR (Sanglin - hr_manager)
 *   - Approve Accounting (Aneef - accounting)
 *   - Approve Finance (Aleksi - finance)
 *   - Reject (any reviewer at their stage)
 * 
 * Props:
 *   - workflow: PayrollWorkflow object with computed permission fields
 *   - onAction: (action, data) => Promise<void>
 *   - disabled: boolean
 */
import { useState } from 'react'
import {
  CheckCircleIcon,
  XCircleIcon,
  PaperAirplaneIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'

// ─── Soft-coded action configuration ─────────────────────────────────────────
const WORKFLOW_ACTIONS = {
  submit: {
    key: 'submit',
    label: 'Submit for HR Review',
    icon: PaperAirplaneIcon,
    color: 'blue',
    requiresNote: false,
    confirmMessage: 'Submit this payroll for HR Manager review?',
    successMessage: 'Payroll submitted successfully! Notification sent to HR Manager.',
  },
  approve_hr: {
    key: 'approve_hr',
    label: 'Approve (HR)',
    icon: CheckCircleIcon,
    color: 'emerald',
    requiresNote: false,
    confirmMessage: 'Approve and forward to Accounting?',
    successMessage: 'HR approval complete! Notification sent to Accounting.',
  },
  approve_accounting: {
    key: 'approve_accounting',
    label: 'Approve (Accounting)',
    icon: CheckCircleIcon,
    color: 'emerald',
    requiresNote: false,
    confirmMessage: 'Approve and forward to Finance?',
    successMessage: 'Accounting approval complete! Notification sent to Finance.',
  },
  approve_finance: {
    key: 'approve_finance',
    label: 'Approve (Finance)',
    icon: CheckCircleIcon,
    color: 'emerald',
    requiresNote: false,
    confirmMessage: 'Give final approval and mark as ready for release?',
    successMessage: 'Finance approval complete! Payroll is now approved.',
  },
  reject: {
    key: 'reject',
    label: 'Reject',
    icon: XCircleIcon,
    color: 'red',
    requiresNote: true,
    confirmMessage: 'Reject this payroll? This will require revision.',
    successMessage: 'Payroll rejected. Notification sent to submitter.',
  },
}

const COLOR_THEMES = {
  blue: {
    bg: 'bg-blue-600 hover:bg-blue-700',
    text: 'text-blue-700',
    border: 'border-blue-600',
    light: 'bg-blue-50'
  },
  emerald: {
    bg: 'bg-emerald-600 hover:bg-emerald-700',
    text: 'text-emerald-700',
    border: 'border-emerald-600',
    light: 'bg-emerald-50'
  },
  red: {
    bg: 'bg-red-600 hover:bg-red-700',
    text: 'text-red-700',
    border: 'border-red-600',
    light: 'bg-red-50'
  },
}

function WorkflowActionButtons({ workflow, onAction, disabled = false }) {
  const [showConfirm, setShowConfirm] = useState(null)
  const [actionNote, setActionNote] = useState('')
  const [processing, setProcessing] = useState(false)

  if (!workflow) return null

  // Determine which actions are available based on computed permissions from backend
  const availableActions = []

  if (workflow.can_submit) {
    availableActions.push(WORKFLOW_ACTIONS.submit)
  }
  if (workflow.can_approve_hr) {
    availableActions.push(WORKFLOW_ACTIONS.approve_hr)
  }
  if (workflow.can_approve_accounting) {
    availableActions.push(WORKFLOW_ACTIONS.approve_accounting)
  }
  if (workflow.can_approve_finance) {
    availableActions.push(WORKFLOW_ACTIONS.approve_finance)
  }
  if (workflow.can_reject) {
    availableActions.push(WORKFLOW_ACTIONS.reject)
  }

  // If no actions available, show info message
  if (availableActions.length === 0) {
    return (
      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
        <div className="flex items-center gap-2 text-slate-500">
          <ExclamationTriangleIcon className="w-5 h-5" />
          <p className="text-sm">No actions available at this stage.</p>
        </div>
      </div>
    )
  }

  const handleAction = async (action) => {
    setProcessing(true)
    try {
      await onAction(action.key, { comments: actionNote })
      setShowConfirm(null)
      setActionNote('')
    } catch (error) {
      console.error('Workflow action failed:', error)
      alert(error.message || WORKFLOW_ACTIONS[action.key]?.successMessage || 'Action failed')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        {availableActions.map((action) => {
          const theme = COLOR_THEMES[action.color]
          const Icon = action.icon

          return (
            <button
              key={action.key}
              type="button"
              disabled={disabled || processing}
              onClick={() => setShowConfirm(action)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm text-white ${theme.bg} disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md`}
            >
              <Icon className="w-5 h-5" />
              {action.label}
            </button>
          )
        })}
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${COLOR_THEMES[showConfirm.color].light}`}>
                <showConfirm.icon className={`w-6 h-6 ${COLOR_THEMES[showConfirm.color].text}`} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-800">{showConfirm.label}</h3>
                <p className="text-sm text-slate-600 mt-1">{showConfirm.confirmMessage}</p>
              </div>
            </div>

            {/* Optional Note */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {showConfirm.requiresNote ? 'Reason for rejection (required)' : 'Comments (optional)'}
              </label>
              <textarea
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                placeholder={showConfirm.requiresNote ? 'Please explain why you are rejecting this payroll...' : 'Add optional notes visible in workflow history...'}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                disabled={processing}
                onClick={() => {
                  setShowConfirm(null)
                  setActionNote('')
                }}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={processing || (showConfirm.requiresNote && !actionNote.trim())}
                onClick={() => handleAction(showConfirm)}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg ${COLOR_THEMES[showConfirm.color].bg} disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2`}
              >
                {processing ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Processing...
                  </>
                ) : (
                  <>Confirm</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default WorkflowActionButtons
