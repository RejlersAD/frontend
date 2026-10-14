/* eslint-disable react/prop-types */
import React from 'react';
import {
  ArrowPathIcon, ArrowRightIcon, CheckCircleIcon, ClipboardDocumentListIcon,
  InformationCircleIcon, UserPlusIcon, XMarkIcon,
} from '@heroicons/react/24/outline';
import { ENQUIRY_TRIAGE_SUGGESTIONS, enquiryTriageDate, enquiryTriageFacts, enquiryTriageRecord, enquiryTriageTimeline } from './enquiryTriagePresentation';

export default function EnquiryTriageSummary({ item, detail, loading = false, error, onRetry, onClose, onAssign, onOpen, canAssign = false }) {
  const record = enquiryTriageRecord(item, !loading && !error ? detail : null);
  const timeline = enquiryTriageTimeline(record);
  const errorText = typeof error === 'string' ? error : error?.message || 'Could not load enquiry details.';
  const description = typeof record?.message === 'string' ? record.message.trim() : '';

  return <aside className="eop-triage-summary" aria-labelledby="eop-triage-summary-title" aria-busy={loading} data-testid="enquiry-triage-summary">
    <header className="eop-triage-header"><span className="eop-triage-icon" aria-hidden="true"><ClipboardDocumentListIcon /></span>
      <h2 id="eop-triage-summary-title">Triage summary</h2><button type="button" className="eop-triage-close" aria-label="Close triage summary" onClick={() => onClose?.()}>
        <XMarkIcon aria-hidden="true" />
      </button>
    </header>
    {!record ? <div className="eop-triage-empty" data-testid="enquiry-triage-empty"><ClipboardDocumentListIcon aria-hidden="true" />
      <h3>Select an enquiry</h3><p>Choose a request to view its details and next actions.</p>
    </div> : <>
      <div className="eop-triage-request"><div className="eop-triage-reference">{record.reference || 'Reference not recorded'}</div>
        <h3 className="eop-triage-title">{record.subject || 'Subject not recorded'}</h3>
        {record.is_overdue === true && <span className="eop-triage-badge eop-triage-badge--overdue" data-testid="enquiry-triage-overdue">Overdue</span>}
      </div>
      {loading && <p className="eop-triage-loading" role="status"><ArrowPathIcon aria-hidden="true" />Loading details…</p>}
      {error && <div className="eop-triage-error" role="alert"><InformationCircleIcon aria-hidden="true" /><p>{errorText}</p>
        <button type="button" className="eop-triage-retry" onClick={() => onRetry?.()} disabled={loading}>Retry details</button>
      </div>}
      <dl className="eop-triage-facts">{enquiryTriageFacts(record).map(fact => <div key={fact.id} data-testid={`enquiry-triage-fact-${fact.id}`}>
        <dt>{fact.label}</dt><dd className={fact.overdue ? 'eop-triage-deadline--overdue' : undefined}>{fact.value}</dd>
      </div>)}</dl>
      <dl className="eop-triage-suggestions">{ENQUIRY_TRIAGE_SUGGESTIONS.map(suggestion => <div key={suggestion.id} data-testid={`enquiry-triage-${suggestion.id}`}>
        <dt>{suggestion.label}</dt><dd><InformationCircleIcon aria-hidden="true" /><span>{suggestion.value}</span></dd>
      </div>)}</dl>
      <ol className="eop-triage-timeline" aria-label="Recorded enquiry milestones" data-testid="enquiry-triage-timeline">{timeline.map(step => {
        const Icon = step.state === 'recorded' ? CheckCircleIcon : InformationCircleIcon;
        return <li key={step.id} data-state={step.state} data-testid={`enquiry-triage-stage-${step.id}`}>
          <span className="eop-timeline-marker" aria-hidden="true"><Icon /></span><strong className="eop-timeline-label">{step.label}</strong>
          {step.state === 'recorded' ? <time className="eop-timeline-date" dateTime={step.at} title={enquiryTriageDate(step.at)}>{enquiryTriageDate(step.at, true)}</time>
            : <span className="eop-timeline-date">Not recorded</span>}
        </li>;
      })}</ol>
      <section className="eop-triage-description" aria-labelledby="eop-triage-description-title"><h3 id="eop-triage-description-title">Request description</h3>
        <p tabIndex={0} role="region" aria-labelledby="eop-triage-description-title">{description || 'Description not recorded.'}</p>
      </section>
      <footer className="eop-triage-footer"><button type="button" className="eop-button eop-button--assign" onClick={() => onAssign?.(record)}
        disabled={canAssign !== true || loading} title={canAssign === true ? 'Assign this enquiry' : 'Assignment is not available for this request.'}>
        <UserPlusIcon aria-hidden="true" />Assign
      </button><button type="button" className="eop-button eop-button--primary" onClick={() => onOpen?.(record)}>
        Open &amp; respond<ArrowRightIcon aria-hidden="true" />
      </button></footer>
    </>}
  </aside>;
}
