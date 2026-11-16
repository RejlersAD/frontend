import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { XMarkIcon } from '@heroicons/react/24/outline';
import salesService from '../../services/sales.service';
import { analysisDueDateTime } from './salesAnalysisDeadline.js';
import {
  BACKEND_DECISION, GO, NO_GO, businessToday, currentUserName,
  displayDateTime, generateBidJustification, intelligenceOf,
  noGoReasonOptions, summaryOf, wordCount,
} from './salesBidDecision';
import './SalesBidDecisionDialog.css';

const JUSTIFICATION_LIMIT = 4000;

export default function SalesBidDecisionDialog({ record, busy, error, onClose, onSubmit, onReadyChange }) {
  const user = useSelector((state) => state.auth?.user);
  const summary = useMemo(() => summaryOf(record || {}), [record]);
  const recordedDecision = record?.bid_decision;
  const initialDecision = recordedDecision === 'no_bid' ? NO_GO
    : ['bid', 'conditional_bid'].includes(recordedDecision) ? GO : '';
  const [decision, setDecision] = useState(initialDecision);
  const [justification, setJustification] = useState(record?.bid_decision_reason || '');
  const [manualJustification, setManualJustification] = useState(false);
  const [suggestionSelected, setSuggestionSelected] = useState(false);
  const [hasNoGoReason, setHasNoGoReason] = useState(false);
  const [localError, setLocalError] = useState('');
  const [intel, setIntel] = useState(() => intelligenceOf(null));
  const [intelStatus, setIntelStatus] = useState('loading');
  const noGoOptions = useMemo(() => noGoReasonOptions(intel), [intel]);

  useEffect(() => {
    let alive = true;
    setIntel(intelligenceOf(null));
    setIntelStatus('loading');
    salesService.getOpportunityAnalysis(record.id)
      .then((data) => {
        if (!alive) return;
        const digest = intelligenceOf(data);
        setIntel(digest);
        setIntelStatus(digest.available ? 'ready' : String(data?.status || 'unavailable'));
      })
      .catch(() => {
        if (!alive) return;
        setIntel(intelligenceOf(null));
        setIntelStatus('unavailable');
      });
    return () => { alive = false; };
  }, [record.id]);

  useEffect(() => {
    if (!decision || manualJustification || (decision === initialDecision && record.bid_decision_reason)) return;
    setJustification(generateBidJustification(record, decision, 0, intel));
  }, [decision, initialDecision, intel, manualJustification, record]);

  const pick = (next) => {
    if ((next !== GO && next !== NO_GO) || next === decision) return;
    const preserveText = (next === NO_GO && suggestionSelected)
      || (!decision && manualJustification && !suggestionSelected);
    setDecision(next);
    setLocalError('');
    if (!preserveText) {
      setJustification(generateBidJustification(record, next, 0, intel));
      setManualJustification(false);
      setSuggestionSelected(false);
      setHasNoGoReason(false);
    }
  };

  const applySuggestion = (option) => {
    setJustification(generateBidJustification(record, NO_GO, 0, intel,
      `${option.reason} Business prediction: ${option.prediction}`));
    setDecision('');
    setManualJustification(true);
    setSuggestionSelected(true);
    setHasNoGoReason(true);
    setLocalError('');
  };

  const decisionUnchanged = decision === GO
    ? ['bid', 'conditional_bid'].includes(recordedDecision)
    : decision === NO_GO && recordedDecision === 'no_bid';
  const reasonReady = decision !== NO_GO || hasNoGoReason;
  const textReady = justification.trim().length >= 20;
  const draftReady = Boolean(decision) && !decisionUnchanged && reasonReady && textReady;
  const canSave = draftReady && !busy;
  useEffect(() => { onReadyChange?.(draftReady); }, [draftReady, onReadyChange]);

  const submit = (event) => {
    event.preventDefault();
    if (!decision) {
      setLocalError('Select Go or No-Go before saving the decision.');
      return;
    }
    if (!reasonReady) {
      setLocalError('Enter or select a specific business reason for No-Go before saving.');
      return;
    }
    if (!textReady) {
      setLocalError('Justification is too short for a governance record. Expand it before saving.');
      return;
    }
    if (!canSave) return;
    onSubmit({ decision: BACKEND_DECISION[decision], bid_justification: justification.trim() });
  };

  const client = intel.available && intel.client && !/clarification required/i.test(intel.client)
    ? intel.client : summary.client;
  const deadline = intel.available
    ? analysisDueDateTime(record, intel.opportunitySummary) : summary.deadline;
  const owner = currentUserName(user?.user || user);

  return (
    <div className="sbd-overlay">
      <section role="dialog" aria-modal="true" aria-labelledby="sbd-title" className="sbd-dialog">
        <div className="sbd-head">
          <div>
            <h2 id="sbd-title">{initialDecision ? 'Reverse Go / No-Go Decision' : 'Record Go / No-Go Decision'}</h2>
            <p>Review the opportunity, write the justification, then select the decision.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="sbd-x">
            <XMarkIcon aria-hidden="true" />
          </button>
        </div>
        <form onSubmit={submit} className="sbd-body">
          {(error || localError) && <div role="alert" className="sbd-alert">{error || localError}</div>}
          <section aria-label="Opportunity snapshot" className="sbd-card sbd-snapshot">
            <h3>Opportunity Snapshot</h3>
            <h4>{summary.title}</h4>
            <dl>
              <div><dt>Client</dt><dd>{client}</dd></div>
              <div><dt>Opportunity</dt><dd>{summary.type}</dd></div>
              <div><dt>Deadline</dt><dd>{deadline}</dd></div>
              <div><dt>Owner</dt><dd>{summary.owner}</dd></div>
              <div><dt>Stage</dt><dd>{summary.stage}</dd></div>
            </dl>
          </section>
          <section aria-label="Decision justification" className="sbd-card sbd-justify">
            <label htmlFor="sbd-justification">Decision Justification *</label>
            <textarea id="sbd-justification" value={justification} disabled={busy} rows={7}
              maxLength={JUSTIFICATION_LIMIT} className="sbd-textarea"
              placeholder="Write the business reason for your decision."
              onChange={(event) => {
                setJustification(event.target.value);
                setManualJustification(true);
                setHasNoGoReason(Boolean(event.target.value.trim()));
                setLocalError('');
              }} />
            <div className="sbd-justify-meta">
              <span role="status">{intelStatus === 'loading' ? 'Loading Opportunity Intelligence…'
                : intelStatus === 'ready' ? 'Draft uses Opportunity Intelligence; review internal assumptions.'
                  : 'Opportunity Intelligence unavailable; review the opportunity record.'}</span>
              <span>{wordCount(justification)} words</span>
            </div>
            <div className="sbd-reason-links" role="group" aria-label="Suggested No-Go reasons">
              <span>Suggested No-Go reasons</span>
              {noGoOptions.map((option) => (
                <button key={option.id} type="button" disabled={busy || intelStatus === 'loading'}
                  title={option.evidence ? `Tender evidence: ${option.evidence.source}` : 'Verify against tender and internal records'}
                  onClick={() => applySuggestion(option)}>{option.label}</button>
              ))}
            </div>
            {decision === NO_GO && !reasonReady && <p className="sbd-hint">Add a specific business reason or use a suggestion before saving.</p>}
          </section>
          <section aria-label="Decision" className="sbd-card">
            <h3>Decision *</h3>
            <div role="radiogroup" aria-label="Go decision" className="sbd-decisions">
              <button type="button" role="radio" aria-checked={decision === GO} onClick={() => pick(GO)}
                className={decision === GO ? 'sbd-go sbd-on' : 'sbd-go'}>
                <span><strong>Go</strong><small>Pursue submission</small></span>
              </button>
              <button type="button" role="radio" aria-checked={decision === NO_GO} onClick={() => pick(NO_GO)}
                className={decision === NO_GO ? 'sbd-nogo sbd-on' : 'sbd-nogo'}>
                <span><strong>No-Go</strong><small>Decline pursuit</small></span>
              </button>
            </div>
            {decisionUnchanged && <p className="sbd-hint">Choose the other decision to save a revision.</p>}
          </section>
          <section aria-label="Governance" className="sbd-card sbd-gov">
            <h3>Governance</h3>
            <dl>
              <div><dt>Decision Owner</dt><dd>{owner}</dd></div>
              <div><dt>Decision Date</dt><dd>{displayDateTime(businessToday())}</dd></div>
              <div><dt>Decision Source</dt><dd>{intel.available ? 'Opportunity Intelligence' : 'Opportunity Record'} + Manager Review</dd></div>
            </dl>
          </section>
          <footer className="sbd-foot">
            <button type="button" onClick={onClose} className="sbd-cancel">Cancel</button>
            <button type="submit" disabled={!canSave} className="sbd-save">{busy ? 'Saving…' : 'Save Decision'}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}

SalesBidDecisionDialog.propTypes = {
  record: PropTypes.object.isRequired,
  busy: PropTypes.bool,
  error: PropTypes.string,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  onReadyChange: PropTypes.func,
};

SalesBidDecisionDialog.defaultProps = { busy: false, error: '', onReadyChange: undefined };
