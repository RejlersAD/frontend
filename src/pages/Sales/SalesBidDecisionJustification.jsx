import { useEffect, useId, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Loader2, Sparkles } from 'lucide-react';
import salesService from '../../services/sales.service';

const decisions = new Set(['bid', 'conditional_bid', 'no_bid']);
const aiLimit = 4000;

export default function SalesBidDecisionJustification({ opportunityId, currentRecordId, decision, value, busy, onChange }) {
  const inputId = useId();
  const request = useRef(null);
  const input = useRef(null);
  const current = useRef(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [suggestion, setSuggestion] = useState(null);
  const active = String(currentRecordId ?? '') === opportunityId;
  current.current = { opportunityId, decision, value, active, busy };

  const cancelRequest = () => {
    request.current?.controller.abort();
    request.current = null;
  };
  useEffect(() => {
    cancelRequest(); setWorking(false); setError(''); setSuggestion(null);
  }, [opportunityId, decision, active, busy]);
  useEffect(() => {
    if (request.current && request.current.text !== value) {
      cancelRequest(); setWorking(false);
    }
  }, [value]);
  useEffect(() => () => cancelRequest(), []);

  const edit = text => {
    cancelRequest(); setWorking(false); setError(''); setSuggestion(null); onChange(text);
  };
  const generate = async () => {
    if (request.current || busy || !active || !decisions.has(decision) || value.length > aiLimit) return;
    const command = { controller: new AbortController(), opportunityId, decision, text: value, mode: value.trim() ? 'rewrite' : 'draft' };
    request.current = command; setWorking(true); setError('');
    try {
      const result = await salesService.draftBidDecisionJustification(opportunityId, { decision, text: value }, { signal: command.controller.signal });
      const latest = current.current;
      if (request.current !== command || !latest.active || latest.busy || latest.opportunityId !== command.opportunityId || latest.decision !== command.decision || latest.value !== command.text) return;
      const source = result?.source_context;
      if (typeof result?.text !== 'string' || !result.text.trim() || result.text.length > aiLimit || String(source?.opportunity_id) !== opportunityId || source?.decision !== decision || source?.mode !== command.mode) {
        throw new Error('The AI suggestion could not be verified. Your text is kept. Try again.');
      }
      request.current = null;
      setSuggestion({ previous: value, text: result.text, type: typeof source.opportunity_type_label === 'string' ? source.opportunity_type_label : 'Not provided' });
      onChange(result.text);
    } catch (failure) {
      if (request.current !== command || command.controller.signal.aborted) return;
      const detail = failure?.response?.data?.detail;
      setError(typeof detail === 'string' && detail.trim() ? detail : failure?.response || failure?.code ? 'AI assistance is unavailable. Your text is kept. Try again or continue editing.' : failure.message || 'AI assistance is unavailable. Your text is kept.');
    } finally {
      if (request.current === command) request.current = null;
      if (!command.controller.signal.aborted && current.current.opportunityId === command.opportunityId && current.current.decision === command.decision) setWorking(false);
    }
  };
  const undo = () => {
    if (!suggestion || value !== suggestion.text || busy) return;
    edit(suggestion.previous); input.current?.focus();
  };
  const actionLabel = value.trim() ? 'Rewrite with AI' : 'Write with AI';
  return <div className="sm:col-span-2">
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={inputId} className="text-sm font-semibold text-slate-700">Decision justification</label>
      <button type="button" aria-label={actionLabel} title={actionLabel} onClick={generate} disabled={working || busy || !active || !decisions.has(decision) || value.length > aiLimit} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 disabled:cursor-default disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-500">
        {working ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
      </button>
    </div>
    <textarea ref={input} id={inputId} rows={4} value={value} disabled={busy} onChange={event => edit(event.target.value)} aria-describedby={`${inputId}-hint${error ? ` ${inputId}-error` : ''}`} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
    <div id={`${inputId}-hint`} className="mt-1 text-xs leading-5 text-slate-600">
      {working ? <span role="status">Writing an AI suggestion… You can keep editing.</span> : !active ? 'The selected opportunity changed. Reopen this action to use AI.' : value.length > aiLimit ? 'AI can revise up to 4,000 characters. Your full text is kept.' : !decisions.has(decision) ? 'Choose a decision to use AI.' : suggestion ? <span role="status">AI suggestion · Opportunity Type: {suggestion.type}. Review before recording.</span> : 'AI uses the selected decision and saved Opportunity Type.'}
      {suggestion && value === suggestion.text && !busy && <button type="button" onClick={undo} className="ml-2 rounded text-violet-700 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600">Undo AI text</button>}
    </div>
    {error && <p id={`${inputId}-error`} role="alert" className="mt-2 text-sm text-rose-800">{error}</p>}
  </div>;
}

SalesBidDecisionJustification.propTypes = {
  opportunityId: PropTypes.string.isRequired,
  currentRecordId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  decision: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  busy: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
};
