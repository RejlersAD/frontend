import { useEffect, useId, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Loader2, Sparkles } from 'lucide-react';
import salesService from '../../services/sales.service';
import { proposalDraftFields } from './salesProposalDraft';

export default function SalesProposalTextField({ field, label, value, values, opportunityId, quoteId = null, contextVersion, busy, enabled = true, required = false, onChange }) {
  const id = useId(), input = useRef(null), request = useRef(null), current = useRef(null);
  const [working, setWorking] = useState(false), [error, setError] = useState(''), [suggestion, setSuggestion] = useState(null);
  const drafts = proposalDraftFields(values), fingerprint = JSON.stringify(drafts);
  const scope = JSON.stringify([opportunityId, quoteId, enabled, busy]);
  current.current = { fingerprint, scope, value, contextVersion };
  const cancel = () => { request.current?.controller.abort(); request.current = null; };
  useEffect(() => { cancel(); setWorking(false); setError(''); setSuggestion(null); }, [scope]);
  useEffect(() => {
    if (request.current && request.current.fingerprint !== fingerprint) { cancel(); setWorking(false); }
  }, [fingerprint]);
  useEffect(() => { if (request.current && request.current.contextVersion !== contextVersion) { cancel(); setWorking(false); } }, [contextVersion]);
  useEffect(() => () => cancel(), []);
  const edit = text => { cancel(); setWorking(false); setError(''); setSuggestion(null); onChange(text); };
  const tooLong = Object.values(drafts).some(text => text.length > 4000);
  const generate = async () => {
    if (request.current || busy || !enabled || !opportunityId || tooLong) return;
    const command = { controller: new AbortController(), fingerprint, scope, contextVersion, text: value, mode: value.trim() ? 'rewrite' : 'draft' };
    request.current = command; setWorking(true); setError('');
    try {
      const result = await salesService.draftProposalField({ opportunityId, quoteId }, { field, text: value, draft_fields: drafts }, { signal: command.controller.signal });
      if (request.current !== command || current.current.fingerprint !== command.fingerprint || current.current.scope !== command.scope || current.current.contextVersion !== command.contextVersion) return;
      const source = result?.source_context;
      if (typeof result?.text !== 'string' || !result.text.trim() || result.text.length > 4000 || String(source?.opportunity_id) !== String(opportunityId) || (source?.quote_id ?? null) !== (quoteId || null) || source?.field !== field || source?.mode !== command.mode) throw new Error('The AI suggestion could not be verified. Your text is kept. Try again.');
      request.current = null;
      setSuggestion({ previous: value, text: result.text }); onChange(result.text, { ai: true });
    } catch (failure) {
      if (request.current !== command || command.controller.signal.aborted) return;
      const detail = failure?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : failure?.response || failure?.code ? 'AI assistance is unavailable. Your text is kept. Try again or continue editing.' : failure.message || 'AI assistance is unavailable. Your text is kept.');
    } finally {
      if (request.current === command) request.current = null;
      if (!command.controller.signal.aborted && current.current.scope === command.scope) setWorking(false);
    }
  };
  const undo = () => { if (suggestion && value === suggestion.text && !busy) { edit(suggestion.previous); input.current?.focus(); } };
  const action = `${value.trim() ? 'Rewrite' : 'Write'} ${label.toLowerCase()} with AI`;
  return <div className="sm:col-span-2 min-w-0">
    <div className="flex items-center justify-between gap-3"><label htmlFor={id} className="text-sm font-semibold text-slate-700">{label}{required && <span className="ml-1 text-rose-600">*</span>}</label>
      <button type="button" title={action} aria-label={action} onClick={generate} disabled={working || busy || !enabled || !opportunityId || tooLong} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-500">{working ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}</button></div>
    <textarea ref={input} id={id} rows={3} required={required} disabled={busy} value={value} onChange={event => edit(event.target.value)} aria-describedby={`${id}-hint${error ? ` ${id}-error` : ''}`} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
    <div id={`${id}-hint`} className="mt-1 text-xs leading-5 text-slate-600">{working ? <span role="status">Writing an AI suggestion… You can keep editing.</span> : tooLong ? 'AI accepts up to 4,000 characters per content field. Your full text is kept.' : !opportunityId ? 'Choose an opportunity to use AI.' : suggestion && suggestion.text === value ? <span role="status">AI suggestion. Review before saving.</span> : field === 'scope' ? 'AI uses the saved opportunity and your current content.' : 'Enter one item per line.'}
      {suggestion && suggestion.text === value && !busy && <button type="button" onClick={undo} className="ml-2 rounded text-violet-700 underline">Undo AI text</button>}</div>
    {error && <p id={`${id}-error`} role="alert" className="mt-2 text-sm text-rose-800">{error}</p>}
  </div>;
}
SalesProposalTextField.propTypes = { field: PropTypes.string.isRequired, label: PropTypes.string.isRequired, value: PropTypes.string.isRequired, values: PropTypes.object.isRequired, opportunityId: PropTypes.string, quoteId: PropTypes.string, contextVersion: PropTypes.oneOfType([PropTypes.number, PropTypes.string]), busy: PropTypes.bool.isRequired, enabled: PropTypes.bool, required: PropTypes.bool, onChange: PropTypes.func.isRequired };
