import { useEffect, useState } from 'react'
import * as HeroIcons from '@heroicons/react/24/outline'
import hrCoreService from '../../services/hrCore.service'

const suggestions = [
  'What is the annual leave policy?',
  'How does the probation process work?',
  'What is the expense reimbursement process?',
]

const rows = (payload) => Array.isArray(payload) ? payload : (payload?.results || [])

export default function HRAssistantPanel() {
  const [question, setQuestion] = useState('')
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    hrCoreService.getAssistantHistory().then((data) => setHistory(rows(data))).catch(() => {})
  }, [])

  const ask = async (event) => {
    event?.preventDefault()
    const value = question.trim()
    if (!value || loading) return
    setLoading(true); setError('')
    try {
      const answer = await hrCoreService.askAssistant(value)
      setHistory((current) => [answer, ...current])
      setQuestion('')
    } catch (requestError) {
      setError(requestError?.response?.data?.detail || requestError?.response?.data?.question?.[0] || 'The HR assistant is unavailable.')
    } finally { setLoading(false) }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-violet-700 to-blue-700 px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-white/15 p-2"><HeroIcons.SparklesIcon className="h-6 w-6" /></span>
            <div><h2 className="font-bold">RADAI HR Assistant</h2><p className="text-xs text-violet-100">Answers are limited to policies you are authorized to view.</p></div>
          </div>
        </div>
        <form onSubmit={ask} className="border-b border-slate-100 p-5">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Ask an HR policy question</label>
          <div className="flex gap-2">
            <input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={2000} className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="Example: How many annual leave days can I carry forward?" />
            <button disabled={loading || !question.trim()} className="rounded-xl bg-violet-700 px-5 text-sm font-semibold text-white disabled:opacity-50">{loading ? 'Checking…' : 'Ask'}</button>
          </div>
          {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
          <div className="mt-3 flex flex-wrap gap-2">{suggestions.map((item) => <button type="button" key={item} onClick={() => setQuestion(item)} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 hover:border-violet-300">{item}</button>)}</div>
        </form>
        <div className="max-h-[620px] space-y-4 overflow-y-auto p-5">
          {!history.length && <div className="py-14 text-center text-sm text-slate-400">Ask a question to search your authorized policy library.</div>}
          {history.map((item) => (
            <article key={item.id} className="rounded-xl border border-slate-200 p-4">
              <p className="font-semibold text-slate-900">{item.question}</p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.answer}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${item.grounded ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{item.grounded ? 'Policy grounded' : 'No policy evidence'}</span>
                {(item.citations || []).map((citation, index) => citation.source_url ? <a key={`${citation.policy_id}-${index}`} href={citation.source_url} target="_blank" rel="noreferrer" className="text-xs font-medium text-blue-600 hover:underline">[{index + 1}] {citation.title} v{citation.version}</a> : <span key={`${citation.policy_id}-${index}`} className="text-xs text-slate-500">[{index + 1}] {citation.title} v{citation.version}</span>)}
              </div>
            </article>
          ))}
        </div>
      </section>
      <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <HeroIcons.ShieldCheckIcon className="h-8 w-8 text-emerald-600" />
        <h3 className="mt-3 font-bold text-slate-900">Privacy by design</h3>
        <ul className="mt-3 space-y-2 text-sm leading-5 text-slate-600">
          <li>Only published policies within your role scope are searched.</li>
          <li>Personal eligibility and confidential employee data are not inferred.</li>
          <li>Every question records citations and a tamper-evident audit event.</li>
          <li>When evidence is missing, the assistant directs you to HR.</li>
        </ul>
      </aside>
    </div>
  )
}
