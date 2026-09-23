const text = value => String(value ?? '').trim()
const email = value => text(value).toLowerCase()
const pending = row => ['pending', 'in_review', 'under_review'].includes(text(row?.status || 'pending').toLowerCase())
export const isSourceApproval = row => Boolean(row?.evidence_document_id) || (row?.external === true && ['signed_purchase_requisition_pdf', 'signed_purchase_order_pdf', 'purchase_requisition'].includes(row.source))

export const activeApprovalStages = workflow => {
  const stages = (Array.isArray(workflow) ? workflow : []).map((row, index) => ({
    row,
    level: row?.level !== null && row?.level !== undefined && text(row.level) !== '' && Number.isFinite(Number(row.level)) ? Number(row.level) : index + 1,
  })).filter(({ row }) => row && !isSourceApproval(row) && pending(row))
  const level = Math.min(...stages.map(stage => stage.level))
  return stages.filter(stage => stage.level === level).map(stage => stage.row)
}

export const isAssignedApprover = (stage, currentUser) => {
  const user = currentUser?.user || currentUser || {}
  const assignedEmail = email(stage?.user_email || stage?.approver_email)
  const userEmail = email(user.email || currentUser?.user_email || currentUser?.email)
  if (assignedEmail) return Boolean(userEmail && assignedEmail === userEmail)
  const assignedId = text(stage?.user_id ?? stage?.approver_id)
  const userId = text(user.id ?? currentUser?.user_id ?? currentUser?.id)
  return Boolean(assignedId && userId && assignedId === userId)
}

export const canDecideProcurement = (record, currentUser = null, type = 'pr') => {
  if (record?.can_approve !== true) return false
  const workflow = type === 'po' ? record.approval_log : record.approval_workflow_config?.length ? record.approval_workflow_config : record.approval_hierarchy
  const active = activeApprovalStages(workflow)
  const stages = active.length ? active : record.current_approval ? [record.current_approval] : []
  return stages.length > 0 && (!currentUser || stages.some(stage => isAssignedApprover(stage, currentUser)))
}

const identityMatches = (assignedId, assignedEmail, actualId, actualEmail) => {
  if (assignedEmail && actualEmail) return assignedEmail === actualEmail
  if (assignedId && actualId) return assignedId === actualId
  return null
}

export const approvalSignatureEvidence = stage => {
  const approved = text(stage?.status).toLowerCase() === 'approved'
  const recordedName = text(stage?.approved_by_name || stage?.signature_user_name)
  if (isSourceApproval(stage)) return { signature: stage.signature_verified === false ? '' : stage.signature || '', mismatch: false, verified: approved && stage.signature_verified !== false, recordedName }
  const assignedId = text(stage?.user_id ?? stage?.approver_id)
  const assignedEmail = email(stage?.user_email || stage?.approver_email)
  const actorId = text(stage?.approved_by_id ?? stage?.approved_by?.id ?? stage?.approved_by)
  const actorEmail = email(stage?.approved_by_email || stage?.decided_by_email)
  const ownerId = text(stage?.signature_user_id)
  const ownerEmail = email(stage?.signature_user_email)
  const actorMatch = identityMatches(assignedId, assignedEmail, actorId, actorEmail)
  const ownerMatch = identityMatches(assignedId, assignedEmail, ownerId, ownerEmail)
  const actorOwnerMatch = identityMatches(actorId, actorEmail, ownerId, ownerEmail)
  const mismatch = actorMatch === false || ownerMatch === false || actorOwnerMatch === false || stage?.signature_review_required === true
  const verified = approved && !mismatch && (actorMatch === true || ownerMatch === true)
  return { signature: verified ? stage?.signature || '' : '', mismatch, verified, recordedName }
}

export const purchaseOrderSignatureEvidence = order => {
  const rows = Array.isArray(order?.approval_log) ? order.approval_log : []
  const internal = rows.filter(row => !isSourceApproval(row))
  const levels = internal.map((row, index) => text(row.level) !== '' && Number.isFinite(Number(row.level)) ? Number(row.level) : index + 1)
  const highest = Math.max(...levels)
  const finalCandidates = internal.filter((row, index) => levels[index] === highest)
  const actualId = text(order?.approved_by_id ?? order?.approved_by?.id ?? order?.approved_by)
  const actualEmail = email(order?.approved_by_email)
  const matchesActor = row => identityMatches(actualId, actualEmail,
    text(row.approved_by_id ?? row.user_id ?? row.approver_id),
    email(row.approved_by_email || row.user_email || row.approver_email)) === true
  const matchingActor = finalCandidates.filter(matchesActor)
  const candidates = matchingActor.length ? matchingActor : finalCandidates
  const finalStage = candidates.find(row => order?.approval_signature && row.signature === order.approval_signature)
    || [...candidates].sort((a, b) => (Date.parse(b.approved_at || b.date) || 0) - (Date.parse(a.approved_at || a.date) || 0))[0]
    || rows.find(row => isSourceApproval(row) && row.source !== 'purchase_requisition' && row.signature_verified === true)
  const evidence = approvalSignatureEvidence({ ...finalStage, signature: finalStage?.signature || order?.approval_signature })
  const actorConflict = internal.length > 0 && Boolean(actualId || actualEmail) && matchingActor.length === 0
  const signatureConflict = internal.length > 0 && Boolean(finalStage?.signature && order?.approval_signature) && finalStage.signature !== order.approval_signature
  const nameConflict = internal.length > 0 && text(order?.approved_by_name) && text(finalStage?.approved_by_name)
    && text(order.approved_by_name).toLowerCase() !== text(finalStage.approved_by_name).toLowerCase()
  const mismatch = evidence.mismatch || internal.some(row => approvalSignatureEvidence(row).mismatch)
    || actorConflict || signatureConflict || Boolean(nameConflict) || order?.signature_review_required === true
  const complete = internal.every(row => text(row.status).toLowerCase() === 'approved')
  const verified = evidence.verified && complete && !mismatch
  return { ...evidence, signature: verified ? evidence.signature : '', verified, mismatch, stage: finalStage }
}
