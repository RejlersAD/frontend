import PropTypes from "prop-types";
import SalesEmailThreadRole from "./SalesEmailThreadRole";

const text = (value) => typeof value === "string" ? value.trim() : "";
const object = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : null;
const records = (value) => Array.isArray(value) ? value.filter(object) : [];
const sourceRecords = (value) => {
  const seen = new Set();
  return records(value).filter((source) => {
    const id = text(source.id);
    if (!id || seen.has(id) || !["message", "quoted"].includes(source.origin)) return false;
    seen.add(id);
    return true;
  });
};
const sourceDate = (value) => {
  if (!text(value)) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(date);
};

function SourceQuote({ source }) {
  const sender = [text(source.sender_name), text(source.sender_email)].filter(Boolean).join(" · ");
  const date = sourceDate(source.sent_at);
  return <figure className="sales-email-analysis-source">
    <figcaption className="space-y-1 text-xs leading-5 text-slate-600">
      <p className="font-semibold text-slate-800">{text(source.label) || "Email source"}</p>
      {text(source.subject) && <p>{source.subject}</p>}
      {(sender || date) && <p>{[sender, date].filter(Boolean).join(" · ")}</p>}
      <p>{source.origin === "quoted" ? "Quoted content" : "Message content"}</p>
    </figcaption>
    {text(source.excerpt)
      ? <blockquote className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-700">{source.excerpt}</blockquote>
      : <p className="mt-2 text-xs text-slate-600">No source excerpt is available.</p>}
  </figure>;
}

const identifiedSource = (analysis, sources, idField, flag) => {
  const id = text(analysis[idField]);
  if (!id || records(analysis.sources).filter((source) => source.id === id).length !== 1) return null;
  if (flag === "is_original_request" && analysis.coverage?.original_identified !== true) return null;
  const found = id && sources.find((source) => source.id === id && source[flag] === true);
  if (flag === "is_selected" && found?.origin !== "message") return null;
  if (flag === "is_first_incoming" && (found?.origin !== "message" || found.direction !== "incoming" || !sourceDate(found.sent_at))) return null;
  return found || null;
};

function ConversationSources({ analysis, sources }) {
  const selected = identifiedSource(analysis, sources, "selected_source_id", "is_selected");
  const original = identifiedSource(analysis, sources, "original_request_source_id", "is_original_request");
  const firstIncoming = identifiedSource(analysis, sources, "first_incoming_source_id", "is_first_incoming");
  const directions = { incoming: "Incoming", outgoing: "Outgoing", draft: "Draft", unknown: "Direction unknown" };
  return <section aria-label="Conversation">
    <h4>Conversation</h4>
    <p className="mt-2 text-xs leading-5 text-slate-600">First incoming is the earliest evidenced incoming message in the available history; earlier messages may be missing.</p>
    {!selected && <p className="mt-2 text-xs leading-5 text-slate-600">The selected email&apos;s source is not identified.</p>}
    {!original && <p className="mt-2 text-xs leading-5 text-slate-600">Original-request evidence is unavailable.</p>}
    {!firstIncoming && <p className="mt-2 text-xs leading-5 text-slate-600">The first incoming message in the available history is not identified.</p>}
    {sources.length > 0 ? <ol aria-label="Conversation sources" className="mt-3 space-y-3">{sources.map((source) => {
      const direction = typeof source.direction === "string" && Object.hasOwn(directions, source.direction) ? source.direction : "unknown";
      const sender = [text(source.sender_name), text(source.sender_email)].filter(Boolean).join(" · ");
      return <li key={source.id} className="min-w-0 rounded-md border border-slate-200 bg-white p-3 [overflow-wrap:anywhere]">
        <div className="flex flex-wrap items-center gap-1.5">
          <SalesEmailThreadRole role={source.thread_role} reason={source.thread_role_reason} />
          {direction !== "draft" && <span className="sales-email-status">{directions[direction]}</span>}
          {selected?.id === source.id && <span className="sales-email-status bg-blue-50 text-blue-900">Selected email</span>}
          {firstIncoming?.id === source.id && <span className="sales-email-status" title="Earliest dated incoming mailbox or saved message available. It may already be a reply.">First incoming available</span>}
          {original?.id === source.id && <span className="sales-email-status bg-emerald-50 text-emerald-900">Original request</span>}
        </div>
        <p className="mt-2 text-xs font-semibold text-slate-600">{source.origin === "quoted" ? "Quoted content · not a separate mailbox message" : "Mailbox message"}</p>
        <p className="mt-1 whitespace-pre-wrap text-sm font-semibold leading-5 text-slate-800">{text(source.subject) || "Subject unavailable"}</p>
        <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-600">{sender || "Sender unavailable"}</p>
        <p className="mt-0.5 text-xs leading-5 text-slate-600">{sourceDate(source.sent_at) || "Sent time unavailable"}</p>
        <details className="sales-email-analysis-evidence mt-2">
          <summary>Source evidence</summary>
          {text(source.thread_role_reason) && <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-600">{source.thread_role_reason}</p>}
          <SourceQuote source={source} />
        </details>
      </li>;
    })}</ol> : <p className="mt-2 text-xs leading-5 text-slate-600">No conversation sources are available.</p>}
  </section>;
}

export function SalesEmailSourceEvidence({ sourceIds, sources }) {
  const ids = Array.isArray(sourceIds) ? new Set(sourceIds.filter((id) => typeof id === "string" && id)) : new Set();
  const selected = sourceRecords(sources).filter((source) => ids.has(source.id));
  if (!ids.size) return null;
  if (!selected.length) return <p className="mt-2 text-xs text-slate-600">Source evidence is unavailable.</p>;
  return <details className="sales-email-analysis-evidence">
    <summary>Evidence</summary>
    <div className="mt-2 space-y-3">{selected.map((source) => <SourceQuote key={source.id} source={source} />)}</div>
  </details>;
}

export default function SalesEmailAnalysis({ analysis, savedContent, nextStepRef }) {
  const detected = object(analysis);
  if (!detected || detected.version !== 1) return <section className="sales-email-analysis" aria-label="Email analysis unavailable" ref={nextStepRef} tabIndex={-1}>
    <h3 className="sales-email-analysis-heading">Email analysis</h3>
    <p className="text-sm leading-6 text-slate-600">Analysis is not available for this email.</p>
    {savedContent && <p className="text-xs leading-5 text-slate-600">Only saved email content is available; mailbox history was not retrieved.</p>}
  </section>;

  const sources = sourceRecords(detected.sources);
  const hasThreadContext = ["selected_source_id", "original_request_source_id", "first_incoming_source_id"].some((key) => Object.hasOwn(detected, key)) || sources.some((source) => Object.hasOwn(source, "thread_role"));
  const original = identifiedSource(detected, sources, "original_request_source_id", "is_original_request");
  const points = records(detected.key_points).filter((point) => text(point.label) && text(point.value));
  const requested = records(detected.requested_actions).filter((action) => text(action.text));
  const suggested = records(detected.suggested_actions).filter((action) => text(action.text));
  const limitations = Array.isArray(detected.limitations) ? detected.limitations.filter((value) => text(value)) : [];
  const coverage = object(detected.coverage) || {};
  const coverageLabels = {
    complete: "The available conversation was reviewed.",
    partial: "Only part of this conversation was available. Review the source evidence before acting.",
    selected_only: "Based on the selected email and any quoted content it contains.",
    saved_content: "Based on available saved messages and their quoted content. Live mailbox history was not retrieved.",
  };
  const coverageStatus = text(coverage.status);
  const coverageText = Object.hasOwn(coverageLabels, coverageStatus)
    ? coverageLabels[coverageStatus]
    : "Conversation coverage is not available.";
  const messageCount = Number.isInteger(coverage.messages_reviewed) && coverage.messages_reviewed >= 0 ? coverage.messages_reviewed : null;
  const segmentCount = Number.isInteger(coverage.segments_reviewed) && coverage.segments_reviewed >= 0 ? coverage.segments_reviewed : null;

  return <div className="sales-email-analysis">
    <div>
      <h3 className="sales-email-analysis-heading">Email analysis</h3>
      {text(detected.message_kind) && <p className="mt-2 text-xs leading-5 text-slate-600"><span className="font-semibold">Message type: </span>{detected.message_kind.replaceAll("_", " ")}</p>}
    </div>
    {hasThreadContext && <ConversationSources analysis={detected} sources={sources} />}
    <section aria-label="What this email means">
      <h4>What this email means</h4>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">{text(detected.summary) || "No supported summary was detected."}</p>
    </section>
    <section aria-label="Key points">
      <h4>Key points</h4>
      {points.length ? <dl className="mt-2 space-y-3">{points.map((point, index) => <div key={index}>
        <dt className="text-xs font-semibold text-slate-600">{point.label}</dt>
        <dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-800">{point.value}<SalesEmailSourceEvidence sourceIds={point.source_ids} sources={sources} /></dd>
      </div>)}</dl> : <p className="mt-2 text-sm leading-6 text-slate-600">No supported key points were detected.</p>}
    </section>
    <section aria-label="Requested actions">
      <h4>Requested actions</h4>
      {requested.length ? <ul className="mt-2 list-disc space-y-3 pl-4">{requested.map((action, index) => <li key={index} className="text-sm leading-6 text-slate-800">
        <p className="whitespace-pre-wrap">{action.text}</p>
        <SalesEmailSourceEvidence sourceIds={action.source_ids} sources={sources} />
      </li>)}</ul> : <p className="mt-2 text-sm leading-6 text-slate-600">No explicit actions were detected in the reviewed content.</p>}
    </section>
    <section aria-label="Suggested next step" ref={nextStepRef} tabIndex={-1}>
      <h4>Suggested next step</h4>
      {suggested.length ? <ul className="mt-2 space-y-3">{suggested.map((action, index) => <li key={index} className="sales-email-analysis-suggestion">
        <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">{action.text}</p>
        {text(action.reason) && <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-600">{action.reason}</p>}
        <SalesEmailSourceEvidence sourceIds={action.source_ids} sources={sources} />
      </li>)}</ul> : <p className="mt-2 text-sm leading-6 text-slate-600">No next step was suggested.</p>}
    </section>
    <section aria-label="Coverage and limitations">
      <h4>Coverage and limitations</h4>
      <div className="mt-2 space-y-2 text-xs leading-5 text-slate-600">
        <p>{coverageText}</p>
        {(messageCount !== null || segmentCount !== null) && <p>{[
          messageCount !== null ? `${messageCount} ${messageCount === 1 ? "message" : "messages"} reviewed` : "",
          segmentCount !== null ? `${segmentCount} ${segmentCount === 1 ? "source segment" : "source segments"}` : "",
        ].filter(Boolean).join(" · ")}</p>}
        {coverage.original_identified === true && (!hasThreadContext || original) && <p>Original request identified in the reviewed content.</p>}
        {coverage.original_identified === false && <p>The original request was not identified.</p>}
        {limitations.length > 0 && <ul className="list-disc space-y-1 pl-4">{limitations.map((limitation, index) => <li key={index}>{limitation}</li>)}</ul>}
      </div>
    </section>
    {!hasThreadContext && sources.length > 0 && <details className="sales-email-analysis-evidence">
      <summary>Thread sources ({sources.length})</summary>
      <div className="mt-2 space-y-3">{sources.map((source) => <SourceQuote key={source.id} source={source} />)}</div>
    </details>}
  </div>;
}

SourceQuote.propTypes = { source: PropTypes.object.isRequired };
ConversationSources.propTypes = { analysis: PropTypes.object.isRequired, sources: PropTypes.array.isRequired };
SalesEmailSourceEvidence.propTypes = { sourceIds: PropTypes.array, sources: PropTypes.array };
SalesEmailSourceEvidence.defaultProps = { sourceIds: null, sources: null };
SalesEmailAnalysis.propTypes = { analysis: PropTypes.object, savedContent: PropTypes.bool, nextStepRef: PropTypes.shape({ current: PropTypes.any }) };
SalesEmailAnalysis.defaultProps = { analysis: null, savedContent: false, nextStepRef: null };
