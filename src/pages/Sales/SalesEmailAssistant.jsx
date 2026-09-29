import { useEffect, useId, useRef, useState } from "react";
import PropTypes from "prop-types";
import { CalendarCheck, Check, Copy, FileText, Loader2, PenLine, Send, Sparkles } from "lucide-react";
import salesService from "../../services/sales.service";
import "./SalesEmailAssistant.css";

const text = (value) => typeof value === "string" ? value.trim() : "";
const object = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : null;
const emptyState = (scope) => ({ scope, question: "", pending: false, result: null, draft: "", error: "", copyStatus: "" });
const actions = [
  { action: "extract_requirements", label: "Extract requirements", Icon: FileText },
  { action: "check_deadline", label: "Check deadline", Icon: CalendarCheck },
  { action: "draft_reply", label: "Draft reply", Icon: PenLine },
];

function selectedSource(source) {
  if (!object(source)) return null;
  if (text(source.intakeId) && !source.connectionId && !source.messageId) {
    return { kind: "saved", intakeId: source.intakeId };
  }
  if (!source.intakeId && text(source.connectionId) && text(source.messageId)) {
    return { kind: "live", connectionId: source.connectionId, messageId: source.messageId };
  }
  return null;
}

function assistantResult(payload, action) {
  const expectedKind = action === "draft_reply" ? "reply_draft" : "answer";
  if (!object(payload) || payload.version !== 1 || payload.needs_review !== true || typeof payload.partial !== "boolean" ||
      !object(payload.coverage) || !text(payload.provider) || payload.provider.length > 100 || !text(payload.model) || payload.model.length > 200 ||
      payload.kind !== expectedKind || !text(payload.answer) || payload.answer.length > 8000 ||
      !Array.isArray(payload.citations) || payload.citations.length > 8 ||
      payload.citations.some((citation) => !object(citation) || !text(citation.source_id) || citation.source_id.length > 200 ||
        !text(citation.excerpt) || citation.excerpt.length > 1800) ||
      payload.citations.reduce((total, citation) => total + citation.excerpt.length, 0) > 6000) {
    throw new Error("Invalid assistant response.");
  }
  return {
    kind: payload.kind,
    answer: payload.answer,
    partial: payload.partial,
    citations: payload.citations.map(({ source_id: sourceId, excerpt }) => ({ sourceId, excerpt })),
  };
}

function failureMessage(error) {
  const status = error?.response?.status;
  if (status === 401) return "Sign in again to ask about this email.";
  if (status === 403) return "You do not have access to this email.";
  if (status === 404) return "This email is no longer available. Refresh emails.";
  if (status === 409) return "This email has changed. Reload it before asking again.";
  if (status === 429) return "Ask RADAI is busy. Please try again shortly.";
  if ([502, 503, 504].includes(status)) return "Ask RADAI is unavailable. Check the AI configuration or try again later.";
  return "Ask RADAI could not answer. Your question and edits are kept. Please try again.";
}

export default function SalesEmailAssistant({ source, disabled = false, information, onUnavailable }) {
  const selected = selectedSource(source);
  const scope = JSON.stringify(selected);
  const latest = useRef(null);
  latest.current = { selected, scope, disabled, onUnavailable };
  const generation = useRef(0);
  const active = useRef(false);
  const pendingRequest = useRef(null);
  const [state, setState] = useState(() => emptyState(scope));
  const id = useId();
  const currentState = state.scope === scope ? state : emptyState(scope);
  const unavailable = disabled || !selected;

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      generation.current += 1;
      pendingRequest.current = null;
    };
  }, []);

  useEffect(() => {
    generation.current += 1;
    pendingRequest.current = null;
    setState(emptyState(scope));
    return () => {
      generation.current += 1;
      pendingRequest.current = null;
    };
  }, [scope]);

  useEffect(() => {
    if (!disabled) return;
    generation.current += 1;
    pendingRequest.current = null;
    setState((previous) => ({ ...previous, pending: false, result: null, draft: "", copyStatus: "" }));
  }, [disabled]);

  const update = (patch) => setState((previous) => ({ ...(previous.scope === scope ? previous : emptyState(scope)), ...patch }));

  const ask = async (action) => {
    const input = latest.current;
    if (!active.current || input.disabled || !input.selected || pendingRequest.current !== null) return;
    const question = action === "question" ? currentState.question.trim() : "";
    if (action === "question" && (!question || question.length > 2000)) {
      update({ error: "Enter a question of up to 2,000 characters." });
      return;
    }
    const request = ++generation.current;
    pendingRequest.current = request;
    const current = () => active.current && generation.current === request && latest.current.scope === input.scope && !latest.current.disabled;
    update({ pending: true, error: "", copyStatus: "" });
    try {
      const payload = { action, question };
      const response = input.selected.kind === "saved"
        ? await salesService.askEmailIntake(input.selected.intakeId, payload)
        : await salesService.askMailboxEmail(input.selected.connectionId, { ...payload, message_id: input.selected.messageId });
      if (!current()) return;
      const result = assistantResult(response, action);
      update({ result, draft: result.kind === "reply_draft" ? result.answer : "", pending: false });
    } catch (error) {
      if (!current()) return;
      const inaccessible = [401, 403, 404].includes(error?.response?.status);
      update({ pending: false, error: failureMessage(error), ...(inaccessible ? { result: null, draft: "" } : {}) });
      if (inaccessible && typeof latest.current.onUnavailable === "function") latest.current.onUnavailable(error.response.status);
    } finally {
      if (current()) pendingRequest.current = null;
    }
  };

  const copyDraft = async () => {
    if (unavailable || currentState.pending || !currentState.draft || !navigator.clipboard?.writeText) {
      update({ copyStatus: "Copy is unavailable. Select the draft text to copy it." });
      return;
    }
    const sourceScope = scope;
    const request = generation.current;
    try {
      await navigator.clipboard.writeText(currentState.draft);
      if (active.current && latest.current.scope === sourceScope && generation.current === request && !latest.current.disabled) update({ copyStatus: "Draft copied." });
    } catch {
      if (active.current && latest.current.scope === sourceScope && generation.current === request && !latest.current.disabled) update({ copyStatus: "Copy is unavailable. Select the draft text to copy it." });
    }
  };

  const result = !unavailable ? currentState.result : null;
  const sourceLabel = (sourceId) => {
    const sources = Array.isArray(information?.analysis?.sources) ? information.analysis.sources : [];
    const matches = sources.filter((item) => item?.id === sourceId);
    if (matches.length !== 1) return "Email source";
    return matches[0].origin === "quoted" ? "Quoted email content" : "Email content";
  };

  return <section className="sales-email-assistant" aria-labelledby={`${id}-heading`} aria-busy={currentState.pending}>
    <header className="sales-email-assistant-header">
      <h3 id={`${id}-heading`}><Sparkles aria-hidden="true" />Ask RADAI</h3>
      <span>Selected email</span>
    </header>
    <div className="sales-email-assistant-actions" aria-label="Email assistant actions">
      {actions.map(({ action, label, Icon }) => <button type="button" key={action} onClick={() => ask(action)} disabled={unavailable || currentState.pending}>
        <Icon aria-hidden="true" /><span>{label}</span>
      </button>)}
    </div>
    <form className="sales-email-assistant-form" onSubmit={(event) => { event.preventDefault(); ask("question"); }}>
      <label className="sr-only" htmlFor={`${id}-question`}>Ask about the selected email</label>
      <input id={`${id}-question`} type="text" value={currentState.question} maxLength={2000}
        onChange={(event) => update({ question: event.target.value })}
        placeholder="Ask anything about this email…" autoComplete="off"
        aria-describedby={`${id}-hint${currentState.error ? ` ${id}-error` : ""}`}
        disabled={unavailable || currentState.pending} />
      <button type="submit" aria-label="Ask RADAI" title="Ask RADAI" disabled={unavailable || currentState.pending || !currentState.question.trim()}>
        {currentState.pending ? <Loader2 className="sales-email-assistant-spinner" aria-hidden="true" /> : <Send aria-hidden="true" />}
      </button>
    </form>
    <p id={`${id}-hint`} className="sales-email-assistant-hint">{unavailable ? "Select an available email to ask RADAI." : "Answers use the available email content. Review AI suggestions before use."}</p>
    {currentState.pending && <p role="status" className="sales-email-assistant-hint">Reviewing the selected email…</p>}
    {currentState.error && <p id={`${id}-error`} role="alert" className="sales-email-assistant-error">{currentState.error}</p>}
    {result && <div className="sales-email-assistant-result">
      {result.partial && <p className="sales-email-assistant-hint">Only part of the conversation was available. Check earlier messages before acting.</p>}
      {result.kind === "reply_draft" && result.citations.length > 0 ? <>
        <div className="sales-email-assistant-result-heading"><label htmlFor={`${id}-draft`}>Reply draft</label>
          <button type="button" onClick={copyDraft} disabled={currentState.pending || !currentState.draft.trim()}>
            {currentState.copyStatus === "Draft copied." ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}Copy draft
          </button>
        </div>
        <textarea id={`${id}-draft`} value={currentState.draft} rows={7} maxLength={16000} disabled={currentState.pending}
          onChange={(event) => update({ draft: event.target.value, copyStatus: "" })} aria-describedby={`${id}-draft-hint`} />
        <p id={`${id}-draft-hint`} className="sales-email-assistant-hint">Review and edit before use. Nothing has been sent or saved to Outlook.</p>
        {currentState.copyStatus && <p role="status" className="sales-email-assistant-hint">{currentState.copyStatus}</p>}
      </> : <><h4>RADAI answer</h4><p className="sales-email-assistant-answer">{result.answer}</p></>}
      {result.citations.length > 0 ? <details className="sales-email-assistant-citations">
        <summary>Source evidence ({result.citations.length})</summary>
        <ol>{result.citations.map((citation, index) => <li key={`${citation.sourceId}-${index}`}>
          <p>{sourceLabel(citation.sourceId)}</p><blockquote>{citation.excerpt}</blockquote>
        </li>)}</ol>
      </details> : <p className="sales-email-assistant-hint">No supporting excerpt was returned. Verify against the email.</p>}
    </div>}
  </section>;
}

SalesEmailAssistant.propTypes = {
  source: PropTypes.shape({ connectionId: PropTypes.string, messageId: PropTypes.string, intakeId: PropTypes.string }),
  disabled: PropTypes.bool,
  information: PropTypes.object,
  onUnavailable: PropTypes.func,
};
