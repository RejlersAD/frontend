import { useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import { createPortal } from 'react-dom'
import { AlertTriangle, ArrowRight, CheckCircle2, X } from 'lucide-react'
import './ScheduleWarnings.css'

export default function ScheduleWarnings({ issues, staleInputs, sourceTimingGap, onClose, onReview, onInputs, onSources, children }) {
  const close = useRef(null)
  useEffect(() => {
    const trigger = document.activeElement
    close.current?.focus()
    const escape = event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose() }
    }
    document.addEventListener('keydown', escape, true)
    return () => {
      document.removeEventListener('keydown', escape, true)
      if (trigger?.isConnected) trigger.focus()
    }
  }, [onClose])
  const count = issues.length + Number(staleInputs) + Number(sourceTimingGap)
  return createPortal(<section className="schedule-warnings" role="dialog" aria-label="Schedule warnings" aria-modal="false">
    <header>{count ? <AlertTriangle size={19} /> : <CheckCircle2 size={19} />}<div><h2>{count ? 'Schedule needs attention' : 'Schedule checks'}</h2><span>{count ? `${count} ${count === 1 ? 'issue' : 'issues'} to review` : 'No issues reported'}</span></div><button ref={close} type="button" aria-label="Close schedule warnings" onClick={onClose}><X size={18} /></button></header>
    <div className="schedule-warnings-content">
      {staleInputs && <article><strong>Input updates need review</strong><p>Review the latest project inputs before approval.</p><button type="button" onClick={() => { onClose(); onInputs() }}>Review inputs<ArrowRight size={14} /></button></article>}
      {sourceTimingGap && <article><strong>Source timing needs linking</strong><p>Link recovered schedule rows to deliverables before calculating.</p><button type="button" onClick={() => { onClose(); onSources() }}>Review extracted schedule<ArrowRight size={14} /></button></article>}
      {issues.slice(0, 5).map((issue, index) => <article key={`${issue.code || 'issue'}-${index}`}><p>{issue.message || issue.description || issue.detail || issue.code?.replaceAll('_', ' ') || 'Schedule review required'}{issue.grouped_issues?.length > 1 && ` (${issue.grouped_issues.length} activities)`}</p></article>)}
      {issues.length > 5 && <p className="schedule-warnings-more">{issues.length - 5} more issues in schedule assurance.</p>}
      {!count && <p className="schedule-warnings-clear"><CheckCircle2 size={17} />No schedule issues reported.</p>}
      {children}
    </div>
    <footer><button type="button" onClick={() => { onClose(); onReview() }}>Review schedule issues<ArrowRight size={15} /></button></footer>
  </section>, document.body)
}

ScheduleWarnings.propTypes = {
  issues: PropTypes.array.isRequired, staleInputs: PropTypes.bool, sourceTimingGap: PropTypes.bool,
  onClose: PropTypes.func.isRequired, onReview: PropTypes.func.isRequired, onInputs: PropTypes.func.isRequired,
  onSources: PropTypes.func.isRequired, children: PropTypes.node,
}
