/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, CheckCircle2, ClipboardCheck, Clock, GitPullRequest,
  History, Loader2, MessageSquare, Plus, RefreshCw, Send, ShieldCheck,
  Users, XCircle,
} from 'lucide-react'

import planningIntelligenceService from '../../services/planningIntelligence.service'
import SchedulingDefaultsApprovalPanel from './SchedulingDefaultsApprovalPanel'

const ITEM_TYPES = ['change_request', 'decision', 'action', 'risk', 'issue']
const ACTIVE_STATUSES = ['open', 'in_review', 'approved']
const CLOSED_STATUSES = ['implemented', 'closed', 'rejected']
const label = value => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())
const apiError = (error, fallback) => {
  const data = error?.response?.data
  if (typeof data?.error === 'string') return data.error
  if (typeof data?.detail === 'string') return data.detail
  if (data && typeof data === 'object') return Object.values(data).flat().map(String).join(' ')
  return fallback
}
const memberName = member => member?.name || member?.email || 'Unassigned'

const priorityStyle = {
  low: 'bg-slate-100 text-slate-600', medium: 'bg-blue-100 text-blue-700',
  high: 'bg-amber-100 text-amber-700', critical: 'bg-rose-100 text-rose-700',
}
const statusStyle = {
  open: 'bg-blue-50 text-blue-700', in_review: 'bg-amber-50 text-amber-700',
  approved: 'bg-emerald-50 text-emerald-700', implemented: 'bg-violet-50 text-violet-700',
  closed: 'bg-slate-100 text-slate-600', rejected: 'bg-rose-50 text-rose-700',
  pending: 'bg-amber-50 text-amber-700', changes_requested: 'bg-orange-50 text-orange-700',
}

const CommentThread = ({ comments, currentUserId, canManage, value, onChange, onSubmit, onResolve }) => (
  <div className="mt-3 border-t pt-3">
    <div className="space-y-2 max-h-52 overflow-auto">
      {!comments.length && <div className="text-xs text-slate-400">No discussion yet.</div>}
      {comments.map(comment => <div key={comment.id} className={`rounded-lg p-2.5 text-sm ${comment.is_resolved ? 'bg-emerald-50/60' : 'bg-slate-50'}`} style={{ marginLeft: comment.parent ? 20 : 0 }}><div className="flex gap-2 items-center"><b className="text-xs text-slate-700">{memberName(comment.author)}</b><span className="text-[10px] text-slate-400">{new Date(comment.created_at).toLocaleString()}</span>{comment.is_resolved && <span className="text-[10px] text-emerald-600">Resolved</span>}{!comment.is_resolved && (canManage || comment.author?.id === currentUserId) && <button onClick={() => onResolve(comment.id)} className="ml-auto text-[10px] text-violet-600">Resolve</button>}</div><p className="mt-1 text-slate-600 whitespace-pre-wrap">{comment.body}</p></div>)}
    </div>
    <form onSubmit={onSubmit} className="flex gap-2 mt-2"><input required value={value} onChange={event => onChange(event.target.value)} placeholder="Add a comment..." className="flex-1 border rounded-lg px-3 py-2 text-sm" /><button className="p-2 bg-violet-600 text-white rounded-lg"><Send className="w-4 h-4" /></button></form>
  </div>
)

const GovernancePanel = ({ projectId, versionId, versionStatus, activities = [], onWorkspaceRefresh, onNotice }) => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [section, setSection] = useState('items')
  const [selectedItem, setSelectedItem] = useState(null)
  const [comment, setComment] = useState('')
  const [reviewComments, setReviewComments] = useState({})
  const [showItemForm, setShowItemForm] = useState(false)
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [itemDraft, setItemDraft] = useState({ item_type: 'action', title: '', description: '', priority: 'medium', due_date: '', activity: '', owner: '', schedule_impact_days: 0, cost_impact: 0 })
  const [reviewDraft, setReviewDraft] = useState({ title: '', description: '', due_date: '', reviewer_ids: [] })

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    try {
      const result = await planningIntelligenceService.getScheduleGovernance(versionId)
      setData(result)
      setSelectedItem(current => current ? result.items.find(item => item.id === current.id) || null : null)
    } catch (error) {
      onNotice('error', apiError(error, 'Unable to load governance workspace.'))
    } finally {
      setLoading(false)
    }
  }, [versionId, onNotice])

  useEffect(() => { load() }, [load])

  const perform = async (key, action, success) => {
    setBusy(key)
    try {
      await action()
      await load(true)
      onNotice('success', success)
    } catch (error) {
      onNotice('error', apiError(error, 'The governance action could not be completed.'))
    } finally {
      setBusy('')
    }
  }

  const createItem = async event => {
    event.preventDefault()
    await perform('item', () => planningIntelligenceService.createGovernanceItem(versionId, {
      ...itemDraft, activity: itemDraft.activity || null, owner: itemDraft.owner || null,
      due_date: itemDraft.due_date || null,
    }), 'Governance item raised.')
    setItemDraft({ item_type: 'action', title: '', description: '', priority: 'medium', due_date: '', activity: '', owner: '', schedule_impact_days: 0, cost_impact: 0 })
    setShowItemForm(false)
  }

  const updateItem = async (item, values) => {
    await perform(`item-${item.id}`, () => planningIntelligenceService.updateGovernanceItem(versionId, { item_id: item.id, ...values }), 'Governance item updated.')
  }

  const addItemComment = async event => {
    event.preventDefault()
    if (!selectedItem || !comment.trim()) return
    await perform('comment', () => planningIntelligenceService.addGovernanceComment(versionId, { item: selectedItem.id, body: comment.trim() }), 'Comment added.')
    setComment('')
  }

  const addReviewComment = async (event, review) => {
    event.preventDefault()
    const body = reviewComments[review.id]?.trim()
    if (!body) return
    await perform(`review-comment-${review.id}`, () => planningIntelligenceService.addGovernanceComment(versionId, { review: review.id, body }), 'Review comment added.')
    setReviewComments(current => ({ ...current, [review.id]: '' }))
  }

  const resolveComment = async id => {
    await perform(`resolve-${id}`, () => planningIntelligenceService.resolveGovernanceComment(versionId, id), 'Comment resolved.')
  }

  const toggleReviewer = id => setReviewDraft(current => ({
    ...current,
    reviewer_ids: current.reviewer_ids.includes(id)
      ? current.reviewer_ids.filter(value => value !== id)
      : [...current.reviewer_ids, id],
  }))

  const createReview = async event => {
    event.preventDefault()
    await perform('review', () => planningIntelligenceService.createScheduleReview(versionId, {
      ...reviewDraft, due_date: reviewDraft.due_date || null,
    }), 'Formal schedule review requested.')
    setReviewDraft({ title: '', description: '', due_date: '', reviewer_ids: [] })
    setShowReviewForm(false)
  }

  const decide = async (review, decision) => {
    const promptText = decision === 'approved' ? 'Approval comment (optional)' : 'Decision comment (required)'
    const decisionComment = window.prompt(promptText, '')
    if (decisionComment === null || (decision !== 'approved' && !decisionComment.trim())) return
    await perform(`decision-${review.id}`, () => planningIntelligenceService.decideScheduleReview(versionId, {
      review_id: review.id, decision, comment: decisionComment,
    }), `Review decision recorded: ${label(decision)}.`)
    await onWorkspaceRefresh?.()
  }

  const grouped = useMemo(() => ({
    active: data?.items?.filter(item => ACTIVE_STATUSES.includes(item.status)) || [],
    closed: data?.items?.filter(item => CLOSED_STATUSES.includes(item.status)) || [],
  }), [data])

  if (loading) return <div className="h-72 flex items-center justify-center text-slate-500"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading governance...</div>
  if (!data) return null

  const selected = selectedItem ? data.items.find(item => item.id === selectedItem.id) : null
  return (
    <div className="p-4 space-y-4 bg-slate-50/60">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="mr-auto"><h2 className="font-bold text-slate-800">Governance & Collaboration</h2><p className="text-xs text-slate-500">Controlled changes, accountable decisions, formal reviews, and project discussion.</p></div>
        <button onClick={() => load()} className="p-2 border rounded-lg text-slate-500"><RefreshCw className="w-4 h-4" /></button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[
        ['Open Items', data.summary.open_items, GitPullRequest, 'text-blue-600'],
        ['Critical', data.summary.critical_items, AlertTriangle, 'text-rose-600'],
        ['Pending Reviews', data.summary.pending_reviews, ClipboardCheck, 'text-amber-600'],
        ['Open Comments', data.summary.unresolved_comments, MessageSquare, 'text-violet-600'],
      ].map(([title, value, Icon, tone]) => <div key={title} className="bg-white border rounded-xl p-3 shadow-sm"><div className="flex justify-between text-xs uppercase tracking-wide text-slate-400 font-semibold">{title}<Icon className={`w-4 h-4 ${tone}`} /></div><div className={`text-xl font-bold mt-1 ${tone}`}>{value}</div></div>)}</div>

      <div className="bg-white border rounded-xl px-2 pt-2 flex flex-wrap gap-1">{[
        ['items', 'Governance Board', GitPullRequest], ['reviews', 'Reviews & Approvals', ShieldCheck],
        ['defaults', 'Default Approvals', ShieldCheck], ['team', 'Team', Users], ['audit', 'Audit Trail', History],
      ].map(([id, title, Icon]) => <button key={id} onClick={() => setSection(id)} className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold border-b-2 ${section === id ? 'border-violet-600 text-violet-700' : 'border-transparent text-slate-500'}`}><Icon className="w-4 h-4" />{title}</button>)}</div>

      {section === 'items' && <div className="grid xl:grid-cols-[1.45fr_1fr] gap-4">
        <section className="bg-white border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center"><div><h3 className="font-semibold text-slate-800">Change, Decision & Action Register</h3><p className="text-xs text-slate-400">{grouped.active.length} active · {grouped.closed.length} completed</p></div>{data.can_manage && <button onClick={() => setShowItemForm(value => !value)} className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold"><Plus className="w-4 h-4" /> Raise Item</button>}</div>
          {showItemForm && <form onSubmit={createItem} className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3 bg-violet-50 border-b"><select value={itemDraft.item_type} onChange={event => setItemDraft(value => ({ ...value, item_type: event.target.value }))} className="border rounded-lg px-3 py-2 text-sm">{ITEM_TYPES.map(value => <option key={value} value={value}>{label(value)}</option>)}</select><select value={itemDraft.priority} onChange={event => setItemDraft(value => ({ ...value, priority: event.target.value }))} className="border rounded-lg px-3 py-2 text-sm">{['low', 'medium', 'high', 'critical'].map(value => <option key={value}>{value}</option>)}</select><input required value={itemDraft.title} onChange={event => setItemDraft(value => ({ ...value, title: event.target.value }))} placeholder="Title" className="md:col-span-2 border rounded-lg px-3 py-2 text-sm" /><textarea value={itemDraft.description} onChange={event => setItemDraft(value => ({ ...value, description: event.target.value }))} placeholder="Description" className="md:col-span-2 border rounded-lg px-3 py-2 text-sm" /><select value={itemDraft.activity} onChange={event => setItemDraft(value => ({ ...value, activity: event.target.value }))} className="border rounded-lg px-3 py-2 text-sm"><option value="">No linked activity</option>{activities.map(row => <option key={row.id} value={row.id}>{row.external_id} - {row.name}</option>)}</select><select value={itemDraft.owner} onChange={event => setItemDraft(value => ({ ...value, owner: event.target.value }))} className="border rounded-lg px-3 py-2 text-sm"><option value="">Unassigned owner</option>{data.members.map(row => <option key={row.id} value={row.id}>{memberName(row)}</option>)}</select><input type="date" value={itemDraft.due_date} onChange={event => setItemDraft(value => ({ ...value, due_date: event.target.value }))} className="border rounded-lg px-3 py-2 text-sm" /><div className="grid grid-cols-2 gap-2"><input type="number" step="0.25" value={itemDraft.schedule_impact_days} onChange={event => setItemDraft(value => ({ ...value, schedule_impact_days: event.target.value }))} placeholder="Impact days" className="border rounded-lg px-3 py-2 text-sm" /><input type="number" step="0.01" value={itemDraft.cost_impact} onChange={event => setItemDraft(value => ({ ...value, cost_impact: event.target.value }))} placeholder="Cost impact" className="border rounded-lg px-3 py-2 text-sm" /></div><button disabled={Boolean(busy)} className="md:col-span-2 bg-violet-600 text-white rounded-lg py-2 text-sm font-semibold">Create Governance Item</button></form>}
          <div className="divide-y max-h-[62vh] overflow-auto">{data.items.map(item => <button key={item.id} onClick={() => setSelectedItem(item)} className={`w-full text-left p-4 hover:bg-slate-50 ${selected?.id === item.id ? 'bg-violet-50/70' : ''}`}><div className="flex gap-2 items-center"><span className={`text-[10px] rounded px-2 py-1 font-semibold ${priorityStyle[item.priority]}`}>{label(item.priority)}</span><span className="text-[10px] uppercase text-slate-400">{label(item.item_type)}</span>{item.is_overdue && <span className="text-[10px] text-rose-600 font-semibold">Overdue</span>}<span className={`ml-auto text-[10px] rounded px-2 py-1 ${statusStyle[item.status]}`}>{label(item.status)}</span></div><div className="font-semibold text-slate-800 mt-2">{item.title}</div><div className="text-xs text-slate-500 mt-1 line-clamp-2">{item.description}</div><div className="flex gap-3 mt-2 text-[11px] text-slate-400"><span>{memberName(item.owner)}</span>{item.due_date && <span>Due {item.due_date}</span>}<span>{item.comments.length} comments</span>{Number(item.schedule_impact_days) !== 0 && <span>{item.schedule_impact_days}d impact</span>}</div></button>)}</div>
        </section>
        <section className="bg-white border rounded-xl p-4 self-start xl:sticky xl:top-24">{!selected ? <div className="py-16 text-center text-sm text-slate-400"><GitPullRequest className="w-9 h-9 mx-auto mb-2 text-slate-300" />Select an item to review its governance record.</div> : <div><div className="flex gap-2 items-start"><div className="flex-1"><span className="text-xs uppercase text-violet-600 font-semibold">{label(selected.item_type)}</span><h3 className="font-bold text-slate-800 mt-1">{selected.title}</h3></div><span className={`text-xs rounded px-2 py-1 ${statusStyle[selected.status]}`}>{label(selected.status)}</span></div><p className="text-sm text-slate-600 mt-3 whitespace-pre-wrap">{selected.description || 'No description.'}</p><div className="grid grid-cols-2 gap-2 mt-3 text-xs"><div className="bg-slate-50 p-2 rounded"><span className="text-slate-400">Owner</span><div className="font-semibold mt-1">{memberName(selected.owner)}</div></div><div className="bg-slate-50 p-2 rounded"><span className="text-slate-400">Due date</span><div className="font-semibold mt-1">{selected.due_date || 'Not set'}</div></div></div>{data.can_manage && <div className="grid grid-cols-2 gap-2 mt-3"><select value={selected.status} onChange={event => updateItem(selected, { status: event.target.value })} className="border rounded-lg px-2 py-2 text-sm">{[...ACTIVE_STATUSES, ...CLOSED_STATUSES].map(value => <option key={value} value={value}>{label(value)}</option>)}</select><select value={selected.owner?.id || ''} onChange={event => updateItem(selected, { owner: event.target.value || null })} className="border rounded-lg px-2 py-2 text-sm"><option value="">Unassigned</option>{data.members.map(row => <option key={row.id} value={row.id}>{memberName(row)}</option>)}</select></div>}<CommentThread comments={selected.comments} currentUserId={data.current_user_id} canManage={data.can_manage} value={comment} onChange={setComment} onSubmit={addItemComment} onResolve={resolveComment} /></div>}</section>
      </div>}

      {section === 'defaults' && <SchedulingDefaultsApprovalPanel projectId={projectId} onNotice={onNotice} />}

      {section === 'reviews' && <section className="bg-white border rounded-xl overflow-hidden"><div className="px-4 py-3 border-b flex items-center"><div><h3 className="font-semibold text-slate-800">Formal Reviews & Approvals</h3><p className="text-xs text-slate-400">All assigned reviewers must approve before the schedule version is approved.</p></div>{data.can_manage && versionStatus === 'calculated' && <button onClick={() => setShowReviewForm(value => !value)} className="ml-auto inline-flex gap-1.5 items-center px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold"><Plus className="w-4 h-4" /> Request Review</button>}</div>{showReviewForm && <form onSubmit={createReview} className="p-4 bg-emerald-50 border-b space-y-2"><input required value={reviewDraft.title} onChange={event => setReviewDraft(value => ({ ...value, title: event.target.value }))} placeholder="Review title" className="w-full border rounded-lg px-3 py-2 text-sm" /><textarea value={reviewDraft.description} onChange={event => setReviewDraft(value => ({ ...value, description: event.target.value }))} placeholder="Review scope and acceptance criteria" className="w-full border rounded-lg px-3 py-2 text-sm" /><input type="date" value={reviewDraft.due_date} onChange={event => setReviewDraft(value => ({ ...value, due_date: event.target.value }))} className="border rounded-lg px-3 py-2 text-sm" /><div className="flex flex-wrap gap-2">{data.members.map(member => <label key={member.id} className={`border rounded-lg px-3 py-2 text-sm bg-white ${reviewDraft.reviewer_ids.includes(member.id) ? 'border-emerald-500 text-emerald-700' : ''}`}><input type="checkbox" checked={reviewDraft.reviewer_ids.includes(member.id)} onChange={() => toggleReviewer(member.id)} className="mr-2" />{memberName(member)} <span className="text-xs text-slate-400">({label(member.role)})</span></label>)}</div><button disabled={!reviewDraft.reviewer_ids.length || Boolean(busy)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold disabled:opacity-40">Submit for Approval</button></form>}<div className="p-4 space-y-4">{!data.reviews.length && <div className="py-12 text-center text-sm text-slate-400">No formal reviews have been requested.</div>}{data.reviews.map(review => { const myDecision = review.decisions.find(row => row.reviewer.id === data.current_user_id); return <div key={review.id} className="border rounded-xl p-4"><div className="flex flex-wrap gap-2 items-start"><div className="flex-1"><h4 className="font-semibold text-slate-800">{review.title}</h4><p className="text-sm text-slate-500 mt-1">{review.description}</p><div className="text-xs text-slate-400 mt-2">Requested by {memberName(review.requested_by)} {review.due_date ? `· Due ${review.due_date}` : ''}</div></div><span className={`text-xs rounded px-2 py-1 ${statusStyle[review.status]}`}>{label(review.status)}</span></div><div className="grid md:grid-cols-2 xl:grid-cols-3 gap-2 mt-3">{review.decisions.map(decision => <div key={decision.id} className="bg-slate-50 rounded-lg p-3"><div className="flex items-center gap-2">{decision.status === 'approved' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : decision.status === 'pending' ? <Clock className="w-4 h-4 text-amber-500" /> : <XCircle className="w-4 h-4 text-rose-500" />}<b className="text-sm text-slate-700">{memberName(decision.reviewer)}</b><span className="ml-auto text-[10px] text-slate-400">{label(decision.status)}</span></div>{decision.comment && <p className="text-xs text-slate-500 mt-2">{decision.comment}</p>}</div>)}</div>{review.status === 'pending' && myDecision?.status === 'pending' && <div className="flex flex-wrap gap-2 mt-3"><button onClick={() => decide(review, 'approved')} className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold">Approve</button><button onClick={() => decide(review, 'changes_requested')} className="px-3 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold">Request Changes</button><button onClick={() => decide(review, 'rejected')} className="px-3 py-2 bg-rose-600 text-white rounded-lg text-sm font-semibold">Reject</button></div>}<CommentThread comments={review.comments} currentUserId={data.current_user_id} canManage={data.can_manage} value={reviewComments[review.id] || ''} onChange={value => setReviewComments(current => ({ ...current, [review.id]: value }))} onSubmit={event => addReviewComment(event, review)} onResolve={resolveComment} /></div>})}</div></section>}

      {section === 'team' && <section className="bg-white border rounded-xl overflow-hidden"><h3 className="font-semibold text-slate-800 px-4 py-3 border-b">Project Team</h3><div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 p-4">{data.members.map(member => <div key={member.id} className="border rounded-xl p-3 flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-bold">{memberName(member).slice(0, 2).toUpperCase()}</div><div className="min-w-0"><div className="font-semibold text-slate-800 truncate">{memberName(member)}</div><div className="text-xs text-slate-400 truncate">{member.email}</div><span className="inline-block mt-1 text-[10px] bg-slate-100 text-slate-600 rounded px-2 py-0.5">{label(member.role)}</span></div></div>)}</div></section>}

      {section === 'audit' && <section className="bg-white border rounded-xl overflow-hidden"><h3 className="font-semibold text-slate-800 px-4 py-3 border-b">Immutable Activity Feed</h3><div className="divide-y max-h-[65vh] overflow-auto">{data.audit_events.map(event => { const actor = data.members.find(row => row.id === event.actor); return <div key={event.id} className="px-4 py-3 flex gap-3"><div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"><History className="w-4 h-4 text-slate-500" /></div><div><div className="text-sm text-slate-700"><b>{memberName(actor)}</b> · {label(event.action.replaceAll('.', '_'))}</div><div className="text-xs text-slate-400 mt-1">{new Date(event.created_at).toLocaleString()} · {event.entity_type} #{event.entity_id}</div></div></div> })}</div></section>}
    </div>
  )
}

export default GovernancePanel
