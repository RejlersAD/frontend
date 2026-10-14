/* eslint-disable react/prop-types */
import React from 'react';
import {
  ArrowRightIcon, BanknotesIcon, CheckCircleIcon, ChevronRightIcon, ClipboardDocumentCheckIcon,
  ClockIcon, DocumentTextIcon, InformationCircleIcon, MinusCircleIcon, ShieldCheckIcon, XCircleIcon, XMarkIcon,
} from '@heroicons/react/24/outline';
import { approvalDecisionEvidence, approvalDecisionTimestamp, approvalDecisionWorkflow, decisionDate } from './approvalDecisionPresentation';

const EVIDENCE_ICONS = { documents: DocumentTextIcon, management: ClipboardDocumentCheckIcon, budget: BanknotesIcon, risk: ShieldCheckIcon };
const detailText = value => value === null || value === undefined || value === '' || value === '—' ? 'Not reported' : String(value);

function StepIcon({ state }) {
  const Icon = state === 'approved' ? CheckCircleIcon : state === 'rejected' ? XCircleIcon
    : state === 'current' || state === 'pending' ? ClockIcon : state === 'skipped' ? MinusCircleIcon : InformationCircleIcon;
  return <Icon aria-hidden="true" />;
}

export default function ApprovalDecisionSummary({ item, details = {}, onClose, onReview, onReject, canDecide, busy = false }) {
  const workflow = approvalDecisionWorkflow(item);
  const evidence = approvalDecisionEvidence(item);
  const timestamp = approvalDecisionTimestamp(item, details);
  const priority = details.priority || { code: 'unknown', label: 'Priority not reported' };
  const priorityCode = ['normal', 'high', 'urgent', 'critical', 'low'].includes(priority.code) ? priority.code : 'unknown';
  const justification = [item?.description_reason, item?.reason, item?.justification, item?.purpose]
    .find(value => typeof value === 'string' && value.trim());
  const review = () => onReview?.(item);

  return <aside className="apc-decision-summary" aria-labelledby="apc-decision-summary-title" aria-busy={busy} data-testid="approval-decision-summary">
    <header className="apc-summary-header"><h2 id="apc-decision-summary-title">Decision summary</h2>
      <button type="button" className="apc-icon-button" aria-label="Close decision summary" onClick={() => onClose?.()} disabled={busy}>
        <XMarkIcon aria-hidden="true" />
      </button>
    </header>
    {!item ? <div className="apc-summary-empty" data-testid="approval-summary-empty"><DocumentTextIcon aria-hidden="true" />
      <h3>Select a request</h3><p>Choose a request to review its details, approval steps and supporting evidence.</p>
    </div> : <>
      <div className="apc-summary-body" key={item._queueKey || item.id} tabIndex={0} role="region" aria-label="Decision summary details">
      <div className="apc-summary-request"><div className="apc-summary-reference">{detailText(details.reference)}</div>
        <h3>{detailText(details.title)}</h3><span className={`apc-priority apc-priority--${priorityCode}`}>{priority.label || 'Priority not reported'}</span>
      </div>
      <dl className="apc-summary-facts">{[
        ['Amount', detailText(details.amountText)], ['Requester', detailText(details.requester)],
        ['Department', detailText(details.department)], [timestamp.label, timestamp.value],
      ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      {justification && <section className="apc-summary-section apc-summary-justification" aria-labelledby="apc-summary-justification-title">
        <h3 id="apc-summary-justification-title">Justification</h3><p>{justification}</p>
      </section>}
      <section className="apc-summary-section" aria-labelledby="apc-summary-workflow-title"><h3 id="apc-summary-workflow-title">Approval steps</h3>
        {details.stageLabel && <p className="apc-summary-current-stage">Current stage: {detailText(details.stageLabel)}</p>}
        {workflow.steps.length ? <ol className={`apc-approval-steps${workflow.steps.length > 3 ? ' apc-approval-steps--stacked' : ''}`}
          data-step-count={workflow.steps.length} data-testid="approval-summary-steps">{workflow.steps.map(step => <li key={step.id}
          className="apc-approval-step" data-state={step.state} data-testid={`approval-summary-step-${step.id}`}>
          <span className="apc-step-marker"><StepIcon state={step.state} /></span><div className="apc-step-body">
            <strong>{step.label}</strong><span className="apc-step-status">{step.statusLabel}</span>
            {(step.person || step.at || step.level !== null) && <span className="apc-step-meta">
              {step.level !== null && step.level !== undefined ? `Level ${step.level}` : ''}
              {step.person ? `${step.level !== null && step.level !== undefined ? ' · ' : ''}${step.personLabel || 'Reviewer'}: ${step.person}` : ''}
              {step.at ? `${step.person || step.level !== null && step.level !== undefined ? ' · ' : ''}${decisionDate(step.at)}` : ''}
            </span>}
          </div>
        </li>)}</ol> : <div className="apc-workflow-empty"><InformationCircleIcon aria-hidden="true" /><span>Approval steps not reported</span></div>}
        <p className="apc-summary-note">{workflow.description}</p>
      </section>
      <section className="apc-summary-section" aria-labelledby="apc-summary-evidence-title"><h3 id="apc-summary-evidence-title">Evidence &amp; checks</h3>
        <div className="apc-evidence-list">{evidence.map(row => {
          const Icon = row.state === 'unknown' ? InformationCircleIcon : EVIDENCE_ICONS[row.icon];
          return <button type="button" key={row.id} className="apc-evidence-row" data-state={row.state}
            data-testid={`approval-summary-evidence-${row.id}`} disabled={busy} onClick={review}
            aria-label={`Review ${row.label.toLowerCase()}: ${row.value}`} title={row.description}>
            <Icon aria-hidden="true" /><span className="apc-evidence-copy"><strong>{row.label}</strong><small>{row.value}</small></span>
            <ChevronRightIcon className="apc-evidence-arrow" aria-hidden="true" />
          </button>;
        })}</div>
      </section>
      </div>
      <footer className="apc-summary-footer">{canDecide === true && <button type="button" className="apc-button apc-button--reject"
        disabled={busy} onClick={() => onReject?.(item)}><XMarkIcon aria-hidden="true" />Reject</button>}
        <button type="button" className="apc-button apc-button--primary" disabled={busy} onClick={review}>
          {canDecide === true ? 'Review & decide' : 'Review details'}<ArrowRightIcon aria-hidden="true" />
        </button>
      </footer>
    </>}
  </aside>;
}
