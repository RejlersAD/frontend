import React, { useCallback, useEffect, useState } from 'react'
import { Pencil } from 'lucide-react'

import planningIntelligenceService from '../../services/planningIntelligence.service'
import { PROCUREMENT_DOCUMENT_BRANDING } from '../../config/procurementDocumentBranding.config'

const STATUS_LABELS = {
  draft: 'Draft',
  internal_review: 'Internal review',
  approval_review: 'Awaiting approval',
  rejected: 'Rejected',
  approved: 'Approved',
  issued: 'Issued',
  superseded: 'Superseded',
}

const STATUS_STYLES = {
  draft: 'bg-slate-100 text-slate-700',
  internal_review: 'bg-amber-100 text-amber-800',
  approval_review: 'bg-blue-100 text-blue-800',
  rejected: 'bg-rose-100 text-rose-700',
  approved: 'bg-emerald-100 text-emerald-800',
  issued: 'bg-indigo-100 text-indigo-800',
  superseded: 'bg-rose-100 text-rose-700',
}

const WORKFLOW_DIALOGS = {
  submit_review: { title: 'Submit for technical review', action: 'Submit for review', person: 'reviewer', due: true, comments: 'Review instructions (optional)' },
  reassign_reviewer: { title: 'Change technical reviewer', action: 'Reassign reviewer', person: 'reviewer', due: true, comments: 'Reason or instructions (optional)' },
  review_return: { title: 'Return proposal to author', action: 'Return proposal', comments: 'Required review comments', commentsRequired: true },
  review_complete: { title: 'Complete technical review', action: 'Forward for approval', person: 'approver', due: true, comments: 'Technical review comments (optional)' },
  reassign_approver: { title: 'Change proposal approver', action: 'Reassign approver', person: 'approver', due: true, comments: 'Reason or instructions (optional)' },
  approval_return: { title: 'Return for further review', action: 'Return proposal', comments: 'Required approval comments', commentsRequired: true },
  approval_reject: { title: 'Reject proposal', action: 'Reject proposal', comments: 'Required rejection reason', commentsRequired: true },
  approval_approve: { title: 'Approve proposal', action: 'Approve proposal', comments: 'Approval comments (optional)' },
  issue: { title: 'Issue controlled proposal', action: 'Generate and issue', notice: 'This locks the revision and stores controlled PDF and Word files in RADAI.' },
  reopen: { title: 'Reopen rejected proposal', action: 'Reopen as draft', comments: 'Revision note (optional)' },
  supersede: { title: 'Supersede issued proposal', action: 'Supersede proposal', notice: 'The issued revision remains in the register but is marked as superseded.' },
}

const displayValue = value => {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

const errorMessage = (error, fallback) => {
  const data = error?.response?.data
  if (typeof data === 'string') return data
  if (data?.detail) return data.detail
  if (data && typeof data === 'object') {
    const first = Object.values(data)[0]
    if (Array.isArray(first)) return first[0]
    if (first) return String(first)
  }
  return error?.message || fallback
}

const downloadResponse = (response, fallbackName) => {
  const disposition = response.headers?.['content-disposition'] || ''
  const match = disposition.match(/filename="?([^";]+)"?/i)
  const url = URL.createObjectURL(response.data)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = match?.[1] || fallbackName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

const ProposalTable = ({ rows }) => {
  if (!Array.isArray(rows) || !rows.length) return null
  const columns = [...new Set(rows.flatMap(row => Object.keys(row || {})))].slice(0, 7)
  return (
    <div className="mt-[5mm] overflow-hidden border border-slate-400">
      <table className="w-full table-fixed border-collapse font-[Arial] text-[10px] leading-[1.3] text-slate-800">
        <thead className="bg-[#e8eef7]">
          <tr>{columns.map(column => <th key={column} className="border-b border-r border-slate-400 p-[1.5mm] text-left font-bold uppercase">{column.replaceAll('_', ' ')}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="break-inside-avoid">
              {columns.map(column => <td key={column} className="break-words border-b border-r border-slate-300 p-[1.5mm] align-top">{displayValue(row?.[column])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const DocumentHeader = ({ proposal }) => (
  <header className="mb-[11mm] flex min-h-[13mm] items-start justify-between border-b border-slate-300 pb-[3mm] font-[Arial] text-[10.5px] leading-[1.45] text-slate-900">
    <div className="grid grid-cols-[31mm_auto] gap-x-[3mm]">
      <span className="font-bold">Technical Proposal</span><span>{proposal.proposal_number}</span>
      <span>{proposal.branding?.confidentiality || 'Confidential'}</span><span>Rev {proposal.revision} / {STATUS_LABELS[proposal.status]}</span>
    </div>
    <div className="text-[19px] font-semibold tracking-[0.16em] text-[#273b5a]">◢REJLERS</div>
  </header>
)

const DocumentFooter = ({ proposal, pageNumber }) => (
  <footer className="mt-auto pt-[8mm] font-[Arial] text-[7.5px] leading-[1.25] text-[#65748a]">
    <div className="mb-[2mm] border-t border-[#8793a5]" />
    <div className="flex items-end justify-between gap-5">
      <div>
        <div className="font-bold">Rejlers International Engineering Solutions AB</div>
        <div>Millennium Tower, 13th Floor, Hamdan Street, P.O. Box 39317, Abu Dhabi, United Arab Emirates</div>
        <div>Tel: +971 2 639 7449 · www.rejlers.ae</div>
      </div>
      <div className="shrink-0 text-right"><div>{proposal.proposal_number} · Rev {proposal.revision}</div><div>Page {pageNumber}</div></div>
    </div>
  </footer>
)

const ProposalPreview = ({ proposal }) => {
  const included = proposal.sections?.filter(section => section.included) || []
  const contentSections = included.filter(section => section.key !== 'cover')
  const schedule = proposal.snapshot?.schedule || {}
  return (
    <div className="proposal-print-root space-y-5 bg-slate-100 p-4 font-[Arial] print:space-y-0 print:bg-white print:p-0">
      <article className="proposal-page mx-auto flex min-h-[297mm] w-[210mm] max-w-full overflow-hidden bg-white shadow-lg print:m-0 print:min-h-[297mm] print:w-[210mm] print:shadow-none">
        <div className="flex w-[40%] flex-col bg-[#273b5a] p-[14mm] text-white">
          <div className="text-[21px] font-semibold tracking-[0.16em]">◢REJLERS</div>
          <div className="mt-auto text-[10px] leading-[1.45]">
            <div className="mb-[5mm] font-bold uppercase">Submitted by</div>
            <div className="text-[12px] font-bold uppercase">Rejlers International Engineering Solutions AB</div>
            <div className="mt-[6mm]">P.O. Box 39317, Abu Dhabi, United Arab Emirates</div>
            <div>Tel: +971 2 639 7449</div><div>www.rejlers.ae</div>
          </div>
        </div>
        <div className="flex w-[60%] flex-col p-[16mm]">
        <div className="mt-[42mm] text-[10px] font-bold uppercase tracking-[0.18em] text-[#273b5a]">Technical Proposal</div>
        <h1 className="mt-[7mm] text-[24px] font-bold leading-[1.2] text-[#273b5a]">{proposal.tender_title || proposal.title}</h1>
        <p className="mt-[5mm] text-[14px] text-slate-600">Prepared for {proposal.client_name || 'Client'}</p>
        <div className="mt-[16mm] grid grid-cols-2 gap-x-[7mm] gap-y-[4mm] border-y border-slate-300 py-[6mm] text-[10px] leading-[1.4]">
          <div><div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Proposal number</div><div className="mt-1 font-semibold">{proposal.proposal_number}</div></div>
          <div><div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Revision</div><div className="mt-1 font-semibold">{proposal.revision}</div></div>
          <div><div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Tender / RFT reference</div><div className="mt-1 font-semibold">{proposal.opportunity_reference || '—'}</div></div>
          <div><div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Submission date</div><div className="mt-1 font-semibold">{proposal.submission_date || '—'}</div></div>
          <div><div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Client reference</div><div className="mt-1 font-semibold">{proposal.client_reference || '—'}</div></div>
          <div><div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Offer validity</div><div className="mt-1 font-semibold">{proposal.validity_days || 120} days</div></div>
          <div><div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Schedule version</div><div className="mt-1 font-semibold">v{schedule.version || '—'}</div></div>
          <div><div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Classification</div><div className="mt-1 font-semibold">{proposal.branding?.confidentiality || 'CONFIDENTIAL'}</div></div>
        </div>
        <div className="mt-auto text-right text-[10px] text-slate-500">
          <div className="text-[20px] font-semibold tracking-[0.14em] text-[#273b5a]">◢REJLERS</div>
          <div className="mt-[2mm]">{proposal.proposal_number} · Rev {proposal.revision}</div>
        </div>
        </div>
      </article>

      {contentSections.map((section, index) => (
        <article key={section.key} className="proposal-page mx-auto flex min-h-[297mm] w-[210mm] max-w-full flex-col bg-white px-[16mm] pb-[12mm] pt-[11mm] font-[Arial] shadow-lg print:m-0 print:min-h-[297mm] print:w-[210mm] print:break-before-page print:shadow-none">
          <DocumentHeader proposal={proposal} />
          <div className="border-b-[1.5px] border-[#1548d6] pb-[3mm]">
            <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#536783]">{section.group}</div>
            <h2 className="mt-[1mm] text-[21px] font-bold leading-[1.2] text-[#123fd1]">{section.number ? `${section.number} ` : ''}{section.title}</h2>
          </div>
          <div className="mt-[6mm] whitespace-pre-line text-[13.33px] leading-[1.5] text-slate-900">{section.content}</div>
          <ProposalTable rows={section.data} />
          <DocumentFooter proposal={proposal} pageNumber={index + 2} />
        </article>
      ))}
    </div>
  )
}

const FinalProposalStudio = ({ projectId, project, onNotice }) => {
  const [proposals, setProposals] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [activeSection, setActiveSection] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [workflowDialog, setWorkflowDialog] = useState('')
  const [workflowUsers, setWorkflowUsers] = useState({ reviewers: [], approvers: [] })
  const [workflowForm, setWorkflowForm] = useState({ reviewer: '', approver: '', due_date: '', comments: '' })
  const [workflowSearch, setWorkflowSearch] = useState('')

  const notify = useCallback((type, message) => onNotice?.(type, message), [onNotice])
  const load = useCallback(async (preferredId = null) => {
    if (!projectId) return
    setLoading(true)
    try {
      const rows = await planningIntelligenceService.listTechnicalProposals(projectId)
      setProposals(rows)
      const selected = rows.find(row => row.id === (preferredId || selectedId)) || rows[0] || null
      setSelectedId(selected?.id || null)
      setDraft(selected ? JSON.parse(JSON.stringify(selected)) : null)
      setActiveSection(0)
    } catch (error) {
      notify('error', errorMessage(error, 'Failed to load technical proposals.'))
    } finally {
      setLoading(false)
    }
  }, [notify, projectId, selectedId])

  useEffect(() => { load() }, [projectId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const editable = Boolean(draft?.workflow_permissions?.can_edit ?? (draft?.status === 'draft'))
  const section = draft?.sections?.[activeSection]
  const schedule = draft?.snapshot?.schedule || {}
  const permissions = draft?.workflow_permissions || {
    can_edit: draft?.status === 'draft',
    can_submit_review: draft?.status === 'draft',
    can_review: false,
    can_reassign_reviewer: false,
    can_reassign_approver: false,
    can_approve: false,
    can_issue: false,
    can_reopen: false,
    can_supersede: false,
  }
  const workflowDialogConfig = WORKFLOW_DIALOGS[workflowDialog]
  const workflowReady = Boolean(workflowDialogConfig)
    && (!workflowDialogConfig.person || Boolean(workflowForm[workflowDialogConfig.person]))
    && (!workflowDialogConfig.commentsRequired || Boolean(workflowForm.comments.trim()))

  const updateField = (field, value) => setDraft(current => ({ ...current, [field]: value }))
  const updateNestedField = (field, key, value) => setDraft(current => ({
    ...current,
    [field]: { ...(current[field] || {}), [key]: value },
  }))
  const updateSection = patch => setDraft(current => ({
    ...current,
    sections: current.sections.map((item, index) => index === activeSection ? { ...item, ...patch } : item),
  }))

  const createProposal = async () => {
    setBusy('create')
    try {
      const created = await planningIntelligenceService.createTechnicalProposal({
        project: projectId,
        title: `Technical Proposal – ${project?.name || 'Project'}`,
        client_name: project?.client || '',
      })
      notify('success', `Proposal ${created.proposal_number} revision ${created.revision} created from the latest controlled schedule.`)
      await load(created.id)
    } catch (error) {
      notify('error', errorMessage(error, 'Could not create proposal. Generate a relational schedule first.'))
    } finally {
      setBusy('')
    }
  }

  const proposalPayload = () => ({
    title: draft.title,
    client_name: draft.client_name,
    opportunity_reference: draft.opportunity_reference,
    client_reference: draft.client_reference,
    tender_title: draft.tender_title,
    submission_date: draft.submission_date || null,
    validity_days: Number(draft.validity_days) || 120,
    bid_focal_point: draft.bid_focal_point || {},
    submission_address: draft.submission_address || {},
    signatory: draft.signatory || {},
    validity_date: draft.validity_date || null,
    sections: draft.sections,
    branding: draft.branding,
  })

  const save = async () => {
    setBusy('save')
    try {
      const saved = await planningIntelligenceService.updateTechnicalProposal(draft.id, proposalPayload())
      setDraft(saved)
      setProposals(rows => rows.map(row => row.id === saved.id ? saved : row))
      notify('success', 'Proposal changes saved to the controlled revision.')
    } catch (error) {
      notify('error', errorMessage(error, 'Failed to save proposal.'))
    } finally {
      setBusy('')
    }
  }

  const openWorkflow = async action => {
    setWorkflowForm({ reviewer: '', approver: '', due_date: '', comments: '' })
    setWorkflowSearch('')
    if (['submit_review', 'reassign_reviewer', 'review_complete', 'reassign_approver'].includes(action)) {
      setBusy('workflow-users')
      try {
        const users = await planningIntelligenceService.getProposalWorkflowUsers(draft.id)
        setWorkflowUsers(users)
      } catch (error) {
        notify('error', errorMessage(error, 'Could not load project reviewers and approvers.'))
        setBusy('')
        return
      }
      setBusy('')
    }
    setWorkflowDialog(action)
  }

  const applyWorkflowUpdate = (updated, message) => {
    setDraft(updated)
    setProposals(rows => rows.map(row => row.id === updated.id ? updated : row))
    setWorkflowDialog('')
    notify('success', message)
  }

  const runWorkflow = async () => {
    setBusy('workflow')
    try {
      let updated
      if (workflowDialog === 'submit_review') {
        await planningIntelligenceService.updateTechnicalProposal(draft.id, proposalPayload())
        updated = await planningIntelligenceService.submitProposalReview(draft.id, workflowForm)
        applyWorkflowUpdate(updated, 'Proposal submitted to the selected reviewer.')
      } else if (workflowDialog === 'reassign_reviewer') {
        updated = await planningIntelligenceService.reassignProposalReviewer(draft.id, workflowForm)
        applyWorkflowUpdate(updated, 'Technical reviewer reassigned and the previous task cancelled.')
      } else if (workflowDialog === 'review_return') {
        updated = await planningIntelligenceService.decideProposalReview(draft.id, { decision: 'return', comments: workflowForm.comments })
        applyWorkflowUpdate(updated, 'Proposal returned to the author with review comments.')
      } else if (workflowDialog === 'review_complete') {
        updated = await planningIntelligenceService.decideProposalReview(draft.id, { decision: 'complete', approver: workflowForm.approver, due_date: workflowForm.due_date || null, comments: workflowForm.comments })
        applyWorkflowUpdate(updated, 'Technical review completed and proposal forwarded for approval.')
      } else if (workflowDialog === 'reassign_approver') {
        updated = await planningIntelligenceService.reassignProposalApprover(draft.id, workflowForm)
        applyWorkflowUpdate(updated, 'Approver reassigned and the previous approval task cancelled.')
      } else if (workflowDialog.startsWith('approval_')) {
        const decision = workflowDialog.replace('approval_', '')
        updated = await planningIntelligenceService.decideProposalApproval(draft.id, { decision, comments: workflowForm.comments })
        applyWorkflowUpdate(updated, `Approval decision recorded: ${decision}.`)
      } else if (workflowDialog === 'issue') {
        updated = await planningIntelligenceService.issueTechnicalProposal(draft.id)
        applyWorkflowUpdate(updated, 'Proposal issued. Controlled PDF and Word files are stored in the Proposal Register.')
      } else if (workflowDialog === 'reopen') {
        updated = await planningIntelligenceService.reopenTechnicalProposal(draft.id, workflowForm.comments)
        applyWorkflowUpdate(updated, 'Rejected proposal reopened as a draft.')
      } else if (workflowDialog === 'supersede') {
        updated = await planningIntelligenceService.transitionTechnicalProposal(draft.id, 'superseded')
        applyWorkflowUpdate(updated, 'Issued proposal marked as superseded.')
      }
    } catch (error) {
      notify('error', errorMessage(error, 'Proposal workflow action failed.'))
    } finally {
      setBusy('')
    }
  }

  const downloadIssuedFile = async file => {
    setBusy(`issued-${file.id}`)
    try {
      const response = await planningIntelligenceService.downloadIssuedProposalFile(draft.id, file.id)
      downloadResponse(response, file.filename)
    } catch (error) {
      notify('error', errorMessage(error, 'Could not download the controlled issued file.'))
    } finally {
      setBusy('')
    }
  }

  const refreshSnapshot = async () => {
    setBusy('refresh')
    try {
      const updated = await planningIntelligenceService.refreshTechnicalProposal(draft.id)
      setDraft(updated)
      setProposals(rows => rows.map(row => row.id === updated.id ? updated : row))
      notify('success', 'Schedule tables refreshed; your edited narrative was preserved.')
    } catch (error) {
      notify('error', errorMessage(error, 'Failed to refresh source data.'))
    } finally {
      setBusy('')
    }
  }

  const exportProposal = async format => {
    setBusy(format)
    try {
      const response = await planningIntelligenceService.downloadTechnicalProposal(draft.id, format)
      downloadResponse(response, `${draft.proposal_number}-R${draft.revision}.${format}`)
      notify('success', `${format.toUpperCase()} generated and recorded in the audit trail.`)
    } catch (error) {
      notify('error', errorMessage(error, `Failed to export ${format.toUpperCase()}.`))
    } finally {
      setBusy('')
    }
  }

  const openPreview = async () => {
    setPreviewOpen(true)
    setPreviewLoading(true)
    setPreviewError('')
    try {
      const response = await planningIntelligenceService.previewTechnicalProposal(draft.id)
      const nextUrl = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
      setPreviewUrl(nextUrl)
    } catch (error) {
      setPreviewError(errorMessage(error, 'Could not generate the complete A4 preview.'))
    } finally {
      setPreviewLoading(false)
    }
  }

  const printPreview = () => {
    const frame = document.getElementById('technical-proposal-pdf-preview')
    frame?.contentWindow?.focus()
    frame?.contentWindow?.print()
  }

  const selectProposal = id => {
    const selected = proposals.find(item => item.id === Number(id))
    setSelectedId(selected?.id || null)
    setDraft(selected ? JSON.parse(JSON.stringify(selected)) : null)
    setActiveSection(0)
  }

  if (loading) return <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">Loading Proposal Studio…</div>

  if (!draft) return (
    <div className="rounded-2xl border border-slate-200 bg-white px-8 py-16 text-center shadow-sm">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 text-3xl">📑</div>
      <h2 className="mt-5 text-2xl font-bold text-slate-900">Create the final project proposal</h2>
      <p className="mx-auto mt-2 max-w-2xl text-slate-500">Generate a controlled enterprise technical proposal from the latest WBS, schedule, milestones, EDDR, resources, validation, and source-document intelligence.</p>
      <button onClick={createProposal} disabled={busy === 'create'} className="mt-7 rounded-xl bg-violet-600 px-6 py-3 font-semibold text-white shadow hover:bg-violet-700 disabled:opacity-50">
        {busy === 'create' ? 'Creating…' : '+ Create proposal revision'}
      </button>
    </div>
  )

  return (
    <div className="space-y-4">
      <style>{`
        @page { size: A4 portrait; margin: 0; }
        @media print {
          body * { visibility: hidden !important; }
          .proposal-print-root, .proposal-print-root * { visibility: visible !important; }
          .proposal-print-root { position: absolute; inset: 0; width: 100%; }
          .proposal-no-print { display: none !important; }
          .proposal-page { break-after: page; page-break-after: always; }
        }
      `}</style>

      <div className="proposal-no-print grid items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:grid-cols-[minmax(260px,1fr)_auto_minmax(260px,1fr)]">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-violet-600">11 · Sales / Final Project Proposal</div>
          <h2 className="mt-1 text-xl font-bold text-slate-900">Enterprise Technical Proposal Studio</h2>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl border border-violet-100 bg-violet-50/70 px-3 py-2">
          <span className="mr-1 text-[10px] font-black uppercase tracking-widest text-violet-500">Publish and export</span>
          <button onClick={openPreview} disabled={previewLoading} className="rounded-lg bg-violet-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50">{previewLoading ? 'Preparing preview…' : 'A4 preview'}</button>
          <button onClick={() => exportProposal('pdf')} disabled={Boolean(busy)} className="rounded-lg border border-violet-200 bg-white px-3.5 py-2 text-xs font-semibold text-violet-700 disabled:opacity-40">PDF</button>
          <button onClick={() => exportProposal('docx')} disabled={Boolean(busy)} className="rounded-lg border border-violet-200 bg-white px-3.5 py-2 text-xs font-semibold text-violet-700 disabled:opacity-40">Word</button>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <select value={selectedId || ''} onChange={event => selectProposal(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            {proposals.map(item => <option key={item.id} value={item.id}>Rev {item.revision} · {STATUS_LABELS[item.status]}</option>)}
          </select>
          <button onClick={createProposal} disabled={Boolean(busy)} className="rounded-lg border border-violet-200 px-3 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50">+ New revision</button>
          <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${STATUS_STYLES[draft.status]}`}>{STATUS_LABELS[draft.status]}</span>
        </div>
      </div>

      <div className="proposal-no-print grid min-w-0 gap-4 xl:grid-cols-[220px_minmax(0,1fr)_320px] 2xl:grid-cols-[270px_minmax(0,1fr)_400px] min-[1850px]:grid-cols-[280px_minmax(0,1fr)_440px]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="px-2 py-2 text-xs font-bold uppercase tracking-wider text-slate-400">Document outline</div>
          <div className="max-h-[680px] space-y-1 overflow-auto">
            {draft.sections.map((item, index) => (
              <React.Fragment key={item.key}>
                {(index === 0 || draft.sections[index - 1]?.group !== item.group) && <div className="px-2 pb-1 pt-3 text-[10px] font-black uppercase tracking-widest text-slate-400">{item.group || 'Technical Proposal'}</div>}
                <button onClick={() => setActiveSection(index)} className={`flex w-full items-start gap-2 rounded-lg p-2 text-left text-sm ${activeSection === index ? 'bg-violet-100 text-violet-800' : 'text-slate-600 hover:bg-slate-50'}`}>
                  <span className="mt-0.5">{item.included ? '☑' : '☐'}</span><span><span className="mr-1 font-mono text-[10px] text-slate-400">{item.number}</span>{item.title}</span>
                </button>
              </React.Fragment>
            ))}
          </div>
        </aside>

        <main className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {section?.key === 'cover' && <>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-xs font-semibold text-slate-600">Proposal title<input disabled={!editable} value={draft.title} onChange={event => updateField('title', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50" /></label>
            <label className="text-xs font-semibold text-slate-600">Client<input disabled={!editable} value={draft.client_name || ''} onChange={event => updateField('client_name', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50" /></label>
            <label className="text-xs font-semibold text-slate-600">Opportunity reference<input disabled={!editable} value={draft.opportunity_reference || ''} onChange={event => updateField('opportunity_reference', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50" /></label>
            <label className="text-xs font-semibold text-slate-600">Validity date<input type="date" disabled={!editable} value={draft.validity_date || ''} onChange={event => updateField('validity_date', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50" /></label>
            <label className="text-xs font-semibold text-slate-600">Tender title<input disabled={!editable} value={draft.tender_title || ''} onChange={event => updateField('tender_title', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50" /></label>
            <label className="text-xs font-semibold text-slate-600">Client reference<input disabled={!editable} value={draft.client_reference || ''} onChange={event => updateField('client_reference', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50" /></label>
            <label className="text-xs font-semibold text-slate-600">Submission date<input type="date" disabled={!editable} value={draft.submission_date || ''} onChange={event => updateField('submission_date', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50" /></label>
            <label className="text-xs font-semibold text-slate-600">Validity (days)<input type="number" min="1" disabled={!editable} value={draft.validity_days || 120} onChange={event => updateField('validity_days', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50" /></label>
          </div>

          <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-slate-600">Submission contacts and authorization</summary>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="text-xs font-semibold text-slate-600">Bid focal point<input disabled={!editable} value={draft.bid_focal_point?.name || ''} onChange={event => updateNestedField('bid_focal_point', 'name', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100" /></label>
              <label className="text-xs font-semibold text-slate-600">Focal-point email<input type="email" disabled={!editable} value={draft.bid_focal_point?.email || ''} onChange={event => updateNestedField('bid_focal_point', 'email', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100" /></label>
              <label className="text-xs font-semibold text-slate-600">Submitted to / attention<input disabled={!editable} value={draft.submission_address?.attention || ''} onChange={event => updateNestedField('submission_address', 'attention', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100" /></label>
              <label className="text-xs font-semibold text-slate-600">Client organization<input disabled={!editable} value={draft.submission_address?.organization || ''} onChange={event => updateNestedField('submission_address', 'organization', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100" /></label>
              <label className="text-xs font-semibold text-slate-600">Authorized signatory<input disabled={!editable} value={draft.signatory?.name || ''} onChange={event => updateNestedField('signatory', 'name', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100" /></label>
              <label className="text-xs font-semibold text-slate-600">Signatory title<input disabled={!editable} value={draft.signatory?.title || ''} onChange={event => updateNestedField('signatory', 'title', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100" /></label>
            </div>
          </details>

          <div className="my-5 border-t border-slate-200" />
          </>}
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1"><div className="text-[10px] font-bold uppercase tracking-widest text-violet-500">{section?.group} · {section?.number} · {section?.section_type}</div><input disabled={!editable} value={section?.title || ''} onChange={event => updateSection({ title: event.target.value })} className="mt-1 w-full border-0 p-0 text-lg font-bold text-slate-900 outline-none disabled:bg-white" /></div>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" disabled={!editable} checked={Boolean(section?.included)} onChange={event => updateSection({ included: event.target.checked })} /> Include</label>
          </div>
          <textarea disabled={!editable} value={section?.content || ''} onChange={event => updateSection({ content: event.target.value })} rows={14} className="mt-4 w-full resize-y rounded-xl border border-slate-300 p-4 text-sm leading-6 text-slate-700 disabled:bg-slate-50" />
          {section?.data?.length > 0 && <div className="mt-3 rounded-lg bg-blue-50 p-3 text-xs text-blue-700">This section includes {section.data.length} frozen source rows. Use “Refresh source” to update schedule tables while preserving your narrative.</div>}

          <div className="mt-5 flex flex-wrap gap-2">
            {editable && <button onClick={save} disabled={Boolean(busy)} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{busy === 'save' ? 'Saving…' : 'Save draft'}</button>}
            {editable && <button onClick={refreshSnapshot} disabled={Boolean(busy)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40">Refresh source</button>}
            {permissions.can_submit_review && <button onClick={() => openWorkflow('submit_review')} disabled={Boolean(busy)} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Submit for review</button>}
            {permissions.can_reassign_reviewer && <button onClick={() => openWorkflow('reassign_reviewer')} disabled={Boolean(busy)} className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 disabled:opacity-40">Change reviewer</button>}
            {permissions.can_review && <><button onClick={() => openWorkflow('review_return')} disabled={Boolean(busy)} className="rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 disabled:opacity-40">Return with comments</button><button onClick={() => openWorkflow('review_complete')} disabled={Boolean(busy)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Complete review</button></>}
            {permissions.can_reassign_approver && <button onClick={() => openWorkflow('reassign_approver')} disabled={Boolean(busy)} className="rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 disabled:opacity-40">Change approver</button>}
            {permissions.can_approve && <><button onClick={() => openWorkflow('approval_return')} disabled={Boolean(busy)} className="rounded-lg border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-700 disabled:opacity-40">Return</button><button onClick={() => openWorkflow('approval_reject')} disabled={Boolean(busy)} className="rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 disabled:opacity-40">Reject</button><button onClick={() => openWorkflow('approval_approve')} disabled={Boolean(busy)} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Approve</button></>}
            {permissions.can_issue && <button onClick={() => openWorkflow('issue')} disabled={Boolean(busy)} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Issue proposal</button>}
            {permissions.can_reopen && <button onClick={() => openWorkflow('reopen')} disabled={Boolean(busy)} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Reopen draft</button>}
            {permissions.can_supersede && <button onClick={() => openWorkflow('supersede')} disabled={Boolean(busy)} className="rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 disabled:opacity-40">Supersede</button>}
          </div>
        </main>

        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between"><div className="text-xs font-bold uppercase tracking-wider text-slate-400">Live A4 page</div><span className="text-[10px] text-emerald-600">● Live</span></div>
            <button onClick={openPreview} className="mt-3 flex aspect-[210/297] w-full flex-col overflow-hidden border border-slate-400 bg-white p-[6%] text-left font-[Arial] shadow-inner transition hover:border-violet-400 hover:shadow-md">
              <div className="flex justify-between border-b border-slate-300 pb-2 text-[6px] leading-tight text-slate-700">
                <div><b>Technical Proposal</b> &nbsp; {draft.proposal_number}<br />Confidential &nbsp; Rev {draft.revision}</div>
                <div className="text-right"><img src={PROCUREMENT_DOCUMENT_BRANDING.logo.path} alt={PROCUREMENT_DOCUMENT_BRANDING.logo.alt} className="ml-auto h-4 w-auto" /><div className="mt-0.5 text-[3.5px] font-bold text-[#3275b6]">HOME OF THE LEARNING MINDS</div></div>
              </div>
              <div className="mt-[13%] border-b border-blue-600 pb-2">
                <div className="text-[5px] font-bold uppercase tracking-widest text-slate-500">{section?.group}</div>
                <div className="mt-1 text-[11px] font-bold leading-tight text-blue-700">{section?.number} {section?.title}</div>
              </div>
              <div className="mt-3 max-h-[61%] overflow-hidden whitespace-pre-line text-[7px] leading-[1.55] text-slate-800">{section?.content}</div>
              <div className="mt-auto"><div className="flex justify-around bg-[#0870aa] py-1 text-[3.2px] font-bold text-white"><span>REJLERS</span><span>HOME OF THE LEARNING MINDS</span><span>RADAI</span></div><div className="pt-1 text-[3.7px] leading-tight text-[#4e83ad]">Rejlers International Engineering Solutions<br />P.O. Box 39317, Abu Dhabi, UAE · www.rejlers.ae</div></div>
            </button>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-[10px] leading-4 text-slate-500">Updates immediately while you edit.</p>
              <button onClick={openPreview} className="shrink-0 text-xs font-bold text-violet-700 hover:text-violet-900">Open full preview →</button>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between"><div className="text-xs font-bold uppercase tracking-wider text-slate-400">Proposal Register</div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${STATUS_STYLES[draft.status]}`}>{STATUS_LABELS[draft.status]}</span></div>
            <dl className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Controlled revision</dt><dd className="text-right font-semibold">{draft.proposal_number} · Rev {draft.revision}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Author</dt><dd className="text-right font-semibold">{draft.created_by_name || '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Reviewer</dt><dd className="text-right font-semibold">{draft.reviewer_name || 'Not assigned'}{draft.review_due_date ? ` · due ${draft.review_due_date}` : ''}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Checked by</dt><dd className="text-right font-semibold">{draft.checked_by_name || 'Pending'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="flex items-center gap-1.5 text-slate-500">Approver{permissions.can_reassign_approver && <button type="button" onClick={() => openWorkflow('reassign_approver')} disabled={Boolean(busy)} title="Change approver" aria-label="Change approver" className="rounded p-1 text-blue-600 transition hover:bg-blue-50 hover:text-blue-800 disabled:opacity-40"><Pencil className="h-3.5 w-3.5" /></button>}</dt><dd className="text-right font-semibold">{draft.approver_name || 'Not assigned'}{draft.approval_due_date ? ` · due ${draft.approval_due_date}` : ''}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Approved by</dt><dd className="text-right font-semibold">{draft.approved_by_name || 'Pending'}</dd></div>
            </dl>
            {(draft.review_comments || draft.approval_comments) && <div className="mt-3 space-y-2 border-t border-slate-200 pt-3 text-xs"><div className="font-bold text-slate-600">Latest workflow comments</div>{draft.review_comments && <p className="rounded-lg bg-blue-50 p-2 text-blue-800">Review: {draft.review_comments}</p>}{draft.approval_comments && <p className="rounded-lg bg-amber-50 p-2 text-amber-800">Approval: {draft.approval_comments}</p>}</div>}
            {draft.issued_files?.length > 0 && <div className="mt-3 border-t border-slate-200 pt-3"><div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-emerald-700">Controlled issued files</div><div className="space-y-2">{draft.issued_files.map(file => <button key={file.id} onClick={() => downloadIssuedFile(file)} disabled={Boolean(busy)} className="flex w-full items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-left text-xs font-semibold text-emerald-800 disabled:opacity-40"><span>{file.export_format.toUpperCase()} · {file.filename}</span><span>Download</span></button>)}</div></div>}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Controlled source</div>
            <dl className="mt-3 space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Schedule revision</dt><dd className="font-semibold">v{schedule.version}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Activities</dt><dd className="font-semibold">{schedule.activity_count}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">WBS nodes</dt><dd className="font-semibold">{schedule.wbs_count}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Relationships</dt><dd className="font-semibold">{schedule.relationship_count}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Critical activities</dt><dd className="font-semibold">{schedule.critical_count}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Finish</dt><dd className="font-semibold">{schedule.calculated_finish || 'Pending'}</dd></div>
            </dl>
          </div>
        </aside>
      </div>

      {workflowDialogConfig && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4"><div><div className="text-xs font-bold uppercase tracking-widest text-violet-600">Controlled workflow</div><h3 className="mt-1 text-xl font-bold text-slate-900">{workflowDialogConfig.title}</h3><p className="mt-1 text-sm text-slate-500">{draft.proposal_number} · Revision {draft.revision}</p></div><button onClick={() => setWorkflowDialog('')} disabled={busy === 'workflow'} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">Close</button></div>
            {workflowDialogConfig.notice && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{workflowDialogConfig.notice}</div>}
            {workflowDialogConfig.person && <div className="mt-5">
              <label className="block text-sm font-semibold text-slate-700">Search {workflowDialogConfig.person}
                <input type="search" value={workflowSearch} onChange={event => setWorkflowSearch(event.target.value)} placeholder="Type a name, email, or department…" autoFocus className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
              </label>
              <label className="mt-3 block text-sm font-semibold text-slate-700">Select {workflowDialogConfig.person}
                <select value={workflowForm[workflowDialogConfig.person]} onChange={event => setWorkflowForm(current => ({ ...current, [workflowDialogConfig.person]: event.target.value }))} size="6" className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5">
                  <option value="">Choose a user from any department…</option>
                  {(workflowUsers[`${workflowDialogConfig.person}s`] || []).filter(user => {
                    const query = workflowSearch.trim().toLowerCase()
                    return !query || `${user.name} ${user.email} ${user.department || ''}`.toLowerCase().includes(query)
                  }).map(user => <option key={user.id} value={user.id}>{user.name} · {user.department || 'Department not specified'} · {user.email}</option>)}
                </select>
              </label>
            </div>}
            {workflowDialogConfig.due && <label className="mt-4 block text-sm font-semibold text-slate-700">Due date<input type="date" value={workflowForm.due_date} onChange={event => setWorkflowForm(current => ({ ...current, due_date: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>}
            {workflowDialogConfig.comments && <label className="mt-4 block text-sm font-semibold text-slate-700">{workflowDialogConfig.comments}<textarea rows={4} value={workflowForm.comments} onChange={event => setWorkflowForm(current => ({ ...current, comments: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm" /></label>}
            {busy === 'workflow' && <div className="mt-5"><div className="mb-2 flex justify-between text-xs font-semibold text-violet-700"><span>{workflowDialog === 'issue' ? 'Generating and storing controlled PDF and Word files…' : 'Recording workflow decision…'}</span><span>Processing</span></div><div className="h-2 overflow-hidden rounded-full bg-violet-100"><div className="h-full w-2/3 animate-pulse rounded-full bg-violet-600" /></div></div>}
            <div className="mt-6 flex justify-end gap-2"><button onClick={() => setWorkflowDialog('')} disabled={busy === 'workflow'} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">Cancel</button><button onClick={runWorkflow} disabled={!workflowReady || busy === 'workflow'} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{busy === 'workflow' ? 'Processing…' : workflowDialogConfig.action}</button></div>
          </div>
        </div>
      )}

      {previewOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-slate-950/80 p-4">
          <div className="proposal-no-print mx-auto mb-3 flex w-full max-w-6xl items-center justify-between rounded-xl bg-white p-3 shadow-xl">
            <div><div className="font-bold text-slate-900">Complete A4 print preview</div><div className="text-xs text-slate-500">Exact paginated PDF layout · {draft.sections.filter(item => item.included).length} included sections</div></div>
            <div className="flex gap-2"><button onClick={printPreview} disabled={!previewUrl} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Print</button><button onClick={() => setPreviewOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">Close</button></div>
          </div>
          <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 items-center justify-center overflow-hidden rounded-xl bg-slate-200 shadow-2xl">
            {previewLoading && <div className="text-center text-sm font-semibold text-slate-600"><div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />Paginating proposal, resolving contents pages, and applying RADAI branding…</div>}
            {!previewLoading && previewUrl && <iframe id="technical-proposal-pdf-preview" title="Technical proposal A4 preview" src={previewUrl} className="h-full w-full border-0" />}
            {!previewLoading && previewError && <div className="max-w-lg p-8 text-center"><div className="font-semibold text-rose-700">{previewError}</div><button onClick={openPreview} className="mt-4 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white">Retry preview</button></div>}
            {!previewLoading && !previewUrl && !previewError && <ProposalPreview proposal={draft} />}
          </div>
        </div>
      )}
    </div>
  )
}

export default FinalProposalStudio
