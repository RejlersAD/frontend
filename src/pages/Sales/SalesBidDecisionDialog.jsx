import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PencilSquareIcon,
  SparklesIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import salesService from '../../services/sales.service';
import {
  BACKEND_DECISION,
  GO,
  NO_GO,
  businessToday,
  currentUserName,
  displayDateTime,
  generateBidJustification,
  goInsights,
  intelligenceOf,
  noGoInsights,
  summaryOf,
  wordCount,
} from './salesBidDecision';
import './SalesBidDecisionDialog.css';
const AI_LIMIT = 4000;

export default function SalesBidDecisionDialog({ record, busy, error, onClose, onSubmit, onReadyChange }) {
  const user = useSelector((state) => state.auth?.user);
  const summary = useMemo(() => summaryOf(record || {}), [record]);
  const [decision, setDecision] = useState('');
  const [justification, setJustification] = useState('');
  const [editing, setEditing] = useState(false);
  const [variant, setVariant] = useState(0);
  const [refining, setRefining] = useState(false);
  const [refineError, setRefineError] = useState('');
  const [aiSource, setAiSource] = useState('instant');
  const [localError, setLocalError] = useState('');
  const [intel, setIntel] = useState(() => intelligenceOf(null));
  const [intelStatus, setIntelStatus] = useState('loading');
  const runId = useRef(0);
  const insights = decision === GO ? goInsights() : decision === NO_GO ? noGoInsights() : [];

  // Load RADAI Opportunity Intelligence once per opportunity so the draft is
  // grounded in live findings (client needs, deliverables, risks, deadlines).
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
        // If a draft is already on screen, re-ground it in the fresh findings.
        if (decision) {
          const grounded = generateBidJustification(record, decision, variant, digest);
          if (grounded && grounded.trim() && aiSource !== 'ai') {
            setJustification(grounded);
          }
        }
      })
      .catch(() => {
        if (!alive) return;
        setIntel(intelligenceOf(null));
        setIntelStatus('unavailable');
      });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record.id]);
  const words = wordCount(justification);
  const today = businessToday();
  const owner = currentUserName(user?.user || user);


  const refine = async (activeDecision, instantText) => {
    const run = ++runId.current;
    setRefining(true);
    setRefineError('');
    try {
      const intelSummary = intel?.available
        ? [
          intel.needs.slice(0, 2).map((i) => i.text).join('; '),
          intel.submissions.slice(0, 2).map((i) => i.text).join('; '),
          intel.risks.slice(0, 2).map((i) => i.text).join('; '),
        ].filter(Boolean).join('\n')
        : '';
      const result = await salesService.draftBidDecisionJustification(record.id, {
        decision: BACKEND_DECISION[activeDecision],
        text: [instantText, intelSummary ? `RADAI Opportunity Intelligence:\n${intelSummary}` : ''].filter(Boolean).join('\n\n'),
      });
      if (run !== runId.current) return;
      const backendText = typeof result?.text === 'string' ? result.text.trim() : '';
      if (backendText && backendText.length > 20 && backendText.length <= AI_LIMIT) {
        setJustification(backendText);
        setAiSource('ai');
      }
      // Otherwise keep the instant draft already on screen — never blank it.
    } catch {
      if (run !== runId.current) return;
      setRefineError('Backend AI unavailable - showing instant executive draft. You can Regenerate or Edit.');
    } finally {
      if (run === runId.current) setRefining(false);
    }
  };

  useEffect(() => () => { runId.current += 1; }, []);

  const pick = (next) => {
    if (next !== GO && next !== NO_GO) return;
    let safeText = '';
    try {
      const instantText = generateBidJustification(record, next, 0, intel);
      safeText = instantText && instantText.trim() ? instantText : '';
    } catch {
      safeText = '';
    }
    // Never show an empty draft: fall back to a minimal executive sentence.
    if (!safeText) {
      safeText =
        next === GO
          ? 'Based on the available opportunity information, it is recommended to proceed with bid submission.'
          : 'Following evaluation, a no-bid decision is recommended and logged for pipeline monitoring.';
    }
    setDecision(next);
    setEditing(false);
    setRefineError('');
    setLocalError('');
    setAiSource('instant');
    setJustification(safeText);
    setVariant(0);
    refine(next, safeText);
  };

  const regenerate = () => {
    if (!decision || refining || busy) return;
    const next = variant + 1;
    setVariant(next);
    const instantText = generateBidJustification(record, decision, next, intel);
    setJustification(instantText);
    setAiSource('instant');
    setEditing(false);
    setRefineError('');
    refine(decision, instantText);
  };

  const canSave = Boolean(decision) && justification.trim().length >= 20 && !busy && !refining;
  const draftReady = Boolean(decision) && justification.trim().length >= 20 && !refining;
  useEffect(() => {
    onReadyChange?.(draftReady);
  }, [draftReady, onReadyChange]);
  const submit = (event) => {
    event.preventDefault();
    if (!decision) {
      setLocalError('Select Go or No-Go to generate the executive justification.');
      return;
    }
    if (justification.trim().length < 20) {
      setLocalError('Justification is too short for a governance record. Regenerate or expand it.');
      return;
    }
    onSubmit({ decision: BACKEND_DECISION[decision], bid_justification: justification.trim() });
  };
  return (
    <div className="sbd-overlay">
      <section role="dialog" aria-modal="true" aria-labelledby="sbd-title" className="sbd-dialog">
        <header className="sbd-head">
          <div>
            <h2 id="sbd-title">Record Bid / No-Bid Decision</h2>
            <p>Single-click executive decision with AI justification and governance trail.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="sbd-x">
            <XMarkIcon aria-hidden="true" />
          </button>
        </header>
        <form onSubmit={submit} className="sbd-body">
          {(error || localError) && <div role="alert" className="sbd-alert">{error || localError}</div>}
          <section aria-label="Opportunity summary" className="sbd-card">
            <h3>Opportunity Summary</h3>
            <dl>
              <div><dt>Opportunity ID</dt><dd>{summary.id}</dd></div>
              <div className="sbd-span"><dt>Opportunity Title</dt><dd>{summary.title}</dd></div>
              <div><dt>Client</dt><dd>{summary.client}</dd></div>
              <div><dt>Opportunity Type</dt><dd>{summary.type}</dd></div>
              <div><dt>Owner</dt><dd>{summary.owner}</dd></div>
              <div><dt>Submission Deadline</dt><dd>{summary.deadline}</dd></div>
              <div><dt>Estimated Value</dt><dd>{summary.value}</dd></div>
              <div><dt>Win Probability</dt><dd>{summary.winProb === null ? 'Not provided' : `${summary.winProb}%`}</dd></div>
              <div><dt>Current Stage</dt><dd>{summary.stage}</dd></div>
            </dl>
          </section>
          <section aria-label="Decision" className="sbd-card">
            <h3>Decision *</h3>
            <div role="radiogroup" aria-label="Bid decision" className="sbd-decisions">
              <button
                type="button"
                role="radio"
                aria-checked={decision === GO}
                onClick={() => pick(GO)}
                className={decision === GO ? 'sbd-go sbd-on' : 'sbd-go'}
              >
                <span aria-hidden="true" className="sbd-radio-dot" />
                <span><strong>Go</strong><small>Pursue bid submission</small></span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={decision === NO_GO}
                onClick={() => pick(NO_GO)}
                className={decision === NO_GO ? 'sbd-nogo sbd-on' : 'sbd-nogo'}
              >
                <span aria-hidden="true" className="sbd-radio-dot" />
                <span><strong>No-Go</strong><small>Decline this pursuit</small></span>
              </button>
            </div>
            {!decision && <p className="sbd-hint">Select Go or No-Go — justification generates instantly.</p>}
          </section>
          {decision && (
            <div className="sbd-grid">
              <section aria-label="Generated justification" className="sbd-card sbd-justify">
                <div className="sbd-justify-head">
                  <h3><SparklesIcon aria-hidden="true" /> AI Generated Decision Justification</h3>
                  <span className="sbd-source">{refining ? 'Generating…' : aiSource === 'ai' ? 'Backend AI' : 'Instant draft'}</span>
                </div>
                <p className="sbd-intel-line" role="status">
                  {intelStatus === 'loading' && 'Loading RADAI Opportunity Intelligence…'}
                  {intelStatus === 'ready' && `Grounded in RADAI Opportunity Intelligence${intel.counts?.ready ? ` (${intel.counts.ready} verified source${intel.counts.ready === 1 ? '' : 's'})` : ''}.`}
                  {intelStatus !== 'loading' && intelStatus !== 'ready' && 'Opportunity Intelligence unavailable — draft uses opportunity record only.'}
                </p>
                {editing ? (
                  <textarea value={justification} disabled={busy} rows={7} maxLength={AI_LIMIT} onChange={(e) => setJustification(e.target.value)} aria-label="Edit justification" className="sbd-textarea" />
                ) : (
                  <p className="sbd-text">{justification || (refining ? 'Generating executive justification…' : '')}</p>
                )}
                {refining && <p role="status" className="sbd-loading">Refining with backend AI… your instant draft stays visible.</p>}
                <p className="sbd-meta">{words} words · executive-ready</p>
                {refineError && <p role="status" className="sbd-note">{refineError}</p>}
                <div className="sbd-justify-actions">
                  <button type="button" onClick={regenerate} disabled={refining || busy} className="sbd-btn">
                    <ArrowPathIcon aria-hidden="true" /> {refining ? 'Generating…' : 'Regenerate'}
                  </button>
                  <button type="button" onClick={() => setEditing((v) => !v)} disabled={!justification || refining || busy} className="sbd-btn">
                    <PencilSquareIcon aria-hidden="true" /> {editing ? 'Done' : 'Edit'}
                  </button>
                </div>
              </section>
              <aside aria-label="Decision insights" className="sbd-card sbd-insights">
                <h3>Decision Insights</h3>
                <ul>
                  {insights.map((item) => (
                    <li key={item.label}>
                      {decision === GO
                        ? <CheckCircleIcon aria-hidden="true" className="sbd-good" />
                        : <ExclamationTriangleIcon aria-hidden="true" className="sbd-warn" />}
                      <span><strong>{item.label}</strong><small>{item.hint}</small></span>
                    </li>
                  ))}
                </ul>
              </aside>
            </div>
          )}
          {decision && intel.available && (
            <section aria-label="Opportunity intelligence evidence" className="sbd-card sbd-intel">
              <h3>Opportunity Intelligence — evidence grounding this draft</h3>
              <div className="sbd-intel-grid">
                {!!intel.needs.length && (
                  <div>
                    <h4>Client needs</h4>
                    <ul>{intel.needs.slice(0, 3).map((item, i) => <li key={i}>{item.text}{item.source ? ` — ${item.source}` : ''}</li>)}</ul>
                  </div>
                )}
                {!!intel.submissions.length && (
                  <div>
                    <h4>Submission requirements</h4>
                    <ul>{intel.submissions.slice(0, 3).map((item, i) => <li key={i}>{item.text}{item.source ? ` — ${item.source}` : ''}</li>)}</ul>
                  </div>
                )}
                {!!intel.risks.length && (
                  <div>
                    <h4>Risks</h4>
                    <ul>{intel.risks.slice(0, 3).map((item, i) => <li key={i}>{item.text}{item.source ? ` — ${item.source}` : ''}</li>)}</ul>
                  </div>
                )}
                {!!intel.deadlines.length && (
                  <div>
                    <h4>Deadlines</h4>
                    <ul>{intel.deadlines.slice(0, 3).map((item, i) => <li key={i}>{item.text}{item.source ? ` — ${item.source}` : ''}</li>)}</ul>
                  </div>
                )}
              </div>
              <p className="sbd-meta">Findings verified against tender sources · review before recording.</p>
            </section>
          )}
          <section aria-label="Governance" className="sbd-card sbd-gov">
            <h3>Governance</h3>
            <dl>
              <div><dt>Decision Owner</dt><dd>{owner}</dd></div>
              <div><dt>Decision Date</dt><dd>{displayDateTime(today)}</dd></div>
              <div><dt>Decision Source</dt><dd>{editing ? 'AI Assisted + Manual Edit' : 'AI Assisted'}</dd></div>
            </dl>
          </section>
          <footer className="sbd-foot">
            <button type="button" onClick={onClose} className="sbd-cancel">Cancel</button>
            <button type="submit" disabled={!canSave} className="sbd-save">
              {busy ? 'Saving…' : 'Save Decision'}
            </button>
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
