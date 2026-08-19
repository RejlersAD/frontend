/**
 * Workflow Status Panel — Visual timeline for multi-stage payroll approval
 * 
 * Shows 7-stage progression: Draft → HR Review → Accounting → Finance → Approved → Released
 * with stakeholder names, timestamps, and current active stage highlighted.
 * 
 * Props:
 *   - workflow: PayrollWorkflow object from backend
 *   - compact: boolean (show minimal version)
 */
import { CheckCircleIcon, ClockIcon, XCircleIcon } from '@heroicons/react/24/solid'
import { 
  UserCircleIcon, 
  BanknotesIcon,
  DocumentCheckIcon,
  CurrencyDollarIcon,
  RocketLaunchIcon
} from '@heroicons/react/24/outline'

// ─── Soft-coded constants ────────────────────────────────────────────────────
const WORKFLOW_STAGES = [
  {
    key: 'draft',
    label: 'Draft',
    icon: UserCircleIcon,
    color: 'slate',
    description: 'Payroll being prepared'
  },
  {
    key: 'hr_review',
    label: 'HR Review',
    icon: UserCircleIcon,
    color: 'blue',
    description: 'Awaiting HR Manager approval'
  },
  {
    key: 'accounting_review',
    label: 'Accounting Review',
    icon: DocumentCheckIcon,
    color: 'purple',
    description: 'Accounting verification'
  },
  {
    key: 'finance_review',
    label: 'Finance Review',
    icon: CurrencyDollarIcon,
    color: 'amber',
    description: 'Final finance approval'
  },
  {
    key: 'approved',
    label: 'Approved',
    icon: CheckCircleIcon,
    color: 'emerald',
    description: 'Ready for release'
  },
  {
    key: 'released',
    label: 'Released',
    icon: RocketLaunchIcon,
    color: 'green',
    description: 'Salary disbursed to employees'
  },
]

const REJECTED_STAGE = {
  key: 'rejected',
  label: 'Rejected',
  icon: XCircleIcon,
  color: 'red',
  description: 'Workflow rejected - requires revision'
}

// Color theme maps
const COLOR_THEMES = {
  slate:   { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300', dot: 'bg-slate-400', ring: 'ring-slate-200' },
  blue:    { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300', dot: 'bg-blue-500', ring: 'ring-blue-200' },
  purple:  { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300', dot: 'bg-purple-500', ring: 'ring-purple-200' },
  amber:   { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300', dot: 'bg-amber-500', ring: 'ring-amber-200' },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300', dot: 'bg-emerald-500', ring: 'ring-emerald-200' },
  green:   { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300', dot: 'bg-green-500', ring: 'ring-green-200' },
  red:     { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300', dot: 'bg-red-500', ring: 'ring-red-200' },
}

const formatDate = (dateStr) => {
  if (!dateStr) return null
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const getStageInfo = (workflow, stageKey) => {
  const info = { completed: false, timestamp: null, reviewer: null, comments: null }
  
  switch (stageKey) {
    case 'draft':
      info.completed = workflow.submitted_at !== null
      info.timestamp = workflow.submitted_at
      info.reviewer = workflow.submitted_by
      break
    case 'hr_review':
      info.completed = workflow.hr_reviewed_at !== null
      info.timestamp = workflow.hr_reviewed_at
      info.reviewer = workflow.hr_reviewer
      info.comments = workflow.hr_comments
      break
    case 'accounting_review':
      info.completed = workflow.accounting_reviewed_at !== null
      info.timestamp = workflow.accounting_reviewed_at
      info.reviewer = workflow.accounting_reviewer
      info.comments = workflow.accounting_comments
      break
    case 'finance_review':
      info.completed = workflow.finance_reviewed_at !== null
      info.timestamp = workflow.finance_reviewed_at
      info.reviewer = workflow.finance_reviewer
      info.comments = workflow.finance_comments
      break
    case 'approved':
      info.completed = workflow.current_stage === 'approved' || workflow.current_stage === 'released'
      info.timestamp = workflow.finance_reviewed_at
      break
    case 'released':
      info.completed = workflow.current_stage === 'released'
      info.timestamp = workflow.released_at
      info.reviewer = workflow.released_by
      break
  }
  
  return info
}

function WorkflowStatusPanel({ workflow, compact = false }) {
  if (!workflow) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-2 text-slate-400">
          <ClockIcon className="w-5 h-5" />
          <span className="text-sm font-medium">No workflow active</span>
        </div>
      </div>
    )
  }

  const isRejected = workflow.current_stage === 'rejected'
  const stagesToShow = isRejected 
    ? [...WORKFLOW_STAGES.filter(s => s.key !== 'approved' && s.key !== 'released'), REJECTED_STAGE]
    : WORKFLOW_STAGES

  const currentStageIndex = stagesToShow.findIndex(s => s.key === workflow.current_stage)

  if (compact) {
    // Compact horizontal timeline
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between gap-2 overflow-x-auto">
          {stagesToShow.map((stage, idx) => {
            const info = getStageInfo(workflow, stage.key)
            const theme = COLOR_THEMES[stage.color]
            const isActive = stage.key === workflow.current_stage
            const isPast = idx < currentStageIndex
            const Icon = stage.icon

            return (
              <div key={stage.key} className="flex items-center gap-2 min-w-0">
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${isActive ? `${theme.bg} ${theme.text} ring-2 ${theme.ring}` : isPast ? `${theme.bg} ${theme.text}` : 'bg-slate-50 text-slate-400'}`}>
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="text-xs font-medium whitespace-nowrap">{stage.label}</span>
                  {info.completed && <CheckCircleIcon className="w-4 h-4 text-emerald-600" />}
                </div>
                {idx < stagesToShow.length - 1 && (
                  <div className={`w-6 h-0.5 ${isPast ? theme.dot : 'bg-slate-200'}`} />
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Full timeline with details
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Approval Workflow</h3>
          <p className="text-xs text-slate-500 mt-0.5">Multi-stage payroll review and approval</p>
        </div>
        {isRejected && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg">
            <XCircleIcon className="w-5 h-5 text-red-600" />
            <div>
              <p className="text-sm font-semibold text-red-700">Rejected</p>
              {workflow.rejection_reason && (
                <p className="text-xs text-red-600">{workflow.rejection_reason}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="space-y-4">
        {stagesToShow.map((stage, idx) => {
          const info = getStageInfo(workflow, stage.key)
          const theme = COLOR_THEMES[stage.color]
          const isActive = stage.key === workflow.current_stage
          const isPast = idx < currentStageIndex || info.completed
          const Icon = stage.icon
          const isLast = idx === stagesToShow.length - 1

          return (
            <div key={stage.key} className="flex gap-4">
              {/* Icon column */}
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isActive ? `${theme.bg} ring-4 ${theme.ring}` : isPast ? theme.bg : 'bg-slate-100'}`}>
                  <Icon className={`w-5 h-5 ${isActive || isPast ? theme.text : 'text-slate-400'}`} />
                </div>
                {!isLast && (
                  <div className={`w-0.5 h-12 ${isPast ? theme.dot : 'bg-slate-200'}`} />
                )}
              </div>

              {/* Content column */}
              <div className="flex-1 pb-4">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className={`font-semibold text-sm ${isActive ? theme.text : isPast ? 'text-slate-700' : 'text-slate-400'}`}>
                      {stage.label}
                    </p>
                    <p className={`text-xs mt-0.5 ${isActive ? 'text-slate-600' : 'text-slate-400'}`}>
                      {stage.description}
                    </p>
                    
                    {info.reviewer && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <UserCircleIcon className="w-4 h-4 text-slate-400" />
                          <span>{info.reviewer.full_name || info.reviewer.email}</span>
                        </div>
                      </div>
                    )}
                    
                    {info.comments && (
                      <div className="mt-2 p-2 bg-slate-50 rounded border border-slate-200">
                        <p className="text-xs text-slate-600 italic">&ldquo;{info.comments}&rdquo;</p>
                      </div>
                    )}
                  </div>

                  {info.timestamp && (
                    <div className="text-right">
                      <p className="text-xs text-slate-500">{formatDate(info.timestamp)}</p>
                      {info.completed && (
                        <div className="mt-1 inline-flex items-center gap-1 text-emerald-600">
                          <CheckCircleIcon className="w-4 h-4" />
                          <span className="text-xs font-medium">Complete</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Super Admin Audit Visibility */}
      {workflow.created_at && (
        <div className="pt-4 border-t border-slate-200">
          <p className="text-xs text-slate-400">
            Workflow created: {formatDate(workflow.created_at)} · 
            Last updated: {formatDate(workflow.updated_at)}
          </p>
        </div>
      )}
    </div>
  )
}

export default WorkflowStatusPanel
