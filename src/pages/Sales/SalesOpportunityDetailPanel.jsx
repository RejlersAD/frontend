import { useEffect, useId, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, Copy, ExternalLink, FileText, History, Lock, Mail, MoreHorizontal, Pencil, RefreshCw, XCircle } from "lucide-react";
import SalesOpportunityHistory from "./SalesOpportunityHistory";
import SalesOpportunityWorkspace from "./SalesOpportunityWorkspace.jsx";
import { opportunityMoney } from "./salesOpportunityRegistration";
import { STATUS_LABELS, bidLabel, deadlineInfo, displayDate, serviceLine, statusLabel, typeLabel } from "./salesOpportunityRegister.js";
import "./SalesOpportunityDetailPanel.css";

const text = (value) => typeof value === "string" ? value.trim() : "";
const object = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const present = (value) => typeof value === "number" && Number.isFinite(value) ? String(value) : text(value) || "Not provided";
const words = (value) => text(value).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const lookup = (labels, value) => typeof value === "string" && Object.hasOwn(labels, value) ? labels[value] : "";
const scopeLabels = { feed: "FEED", pre_feed: "Pre-FEED", epc: "EPC", epcm: "EPCM", pmc: "PMC" };
const tabs = ["Overview", "Workspace", "Activity"];
const formatDate = (value, includeTime = false) => {
  const raw = text(value);
  if (!raw) return "Not provided";
  const calendar = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  if (calendar) return displayDate(raw);
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "Not provided";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Dubai", ...(includeTime ? { hour: "2-digit", minute: "2-digit", timeZoneName: "short" } : {}) }).format(date);
};
const percentage = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 100 ? `${Number(value)}%` : "Not provided";
const listText = (values, labels = {}) => Array.isArray(values) ? values.filter((value) => typeof value === "string" && value.trim()).map((value) => lookup(labels, value) || words(value)).join(", ") : "";
const recordName = (details) => text(details?.full_name) || [text(details?.first_name), text(details?.last_name)].filter(Boolean).join(" ") || text(details?.username);
const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
const hasIdentity = (value) => ["string", "number"].includes(typeof value) && String(value).trim();
const decisionActor = (record, history) => {
  if (!hasIdentity(record.bid_decided_by)) return "Not provided";
  const id = String(record.bid_decided_by);
  const people = [record.owner_details, ...(Array.isArray(record.team_members_details) ? record.team_members_details : [])];
  const canonical = people.find((person) => person && String(person.id) === id);
  if (recordName(canonical)) return recordName(canonical);
  if (hasIdentity(record.created_by) && String(record.created_by) === id && text(record.created_by_name)) return text(record.created_by_name);
  const evidence = history.find((event) => event?.event_type === "bid_decision" && hasIdentity(event.actor) && String(event.actor) === id && object(event.data).decision === record.bid_decision && text(event.actor_name));
  return text(evidence?.actor_name) || "Not provided";
};

function Section({ number, title, children }) {
  const headingId = useId();
  return <section className="sor-detail-section" aria-labelledby={headingId}>
    <h3 id={headingId} className="sor-detail-section-heading"><span aria-hidden="true">{number}.</span>{title}</h3>
    {children}
  </section>;
}
Section.propTypes = { number: PropTypes.number.isRequired, title: PropTypes.string.isRequired, children: PropTypes.node.isRequired };

function Facts({ rows }) {
  return <dl className="sor-detail-facts">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "Not provided"}</dd></div>)}</dl>;
}
Facts.propTypes = { rows: PropTypes.array.isRequired };

export default function SalesOpportunityDetailPanel({ record, loading = false, error = "", onRetry, onOpenFullRecord, onEdit, onAction, actions = [], locked = false, explorer = false, explorerFolder = '', onOpenWorkspace, onCloseWorkspace }) {
  const panelId = useId();
  const contentRef = useRef(null);
  const [selection, setSelection] = useState({ recordId: null, tab: "Workspace" });
  const [copyNotice, setCopyNotice] = useState("");
  useEffect(() => {
    if (!copyNotice) return undefined;
    const timer = setTimeout(() => setCopyNotice(''), 3500);
    return () => clearTimeout(timer);
  }, [copyNotice]);
  useEffect(() => { if (explorer) setSelection({ recordId: record?.id, tab: 'Workspace' }); }, [explorer, record?.id]);
  const activeTab = selection.recordId === record?.id ? selection.tab : "Workspace";
  const activate = (tab) => {
    setSelection({ recordId: record?.id, tab });
    if (tab === 'Workspace' && !explorer) onOpenWorkspace?.('');
    if (contentRef.current) contentRef.current.scrollTop = 0;
  };
  const moveTab = (event) => {
    const index = tabs.indexOf(activeTab);
    const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault();
    activate(tabs[next]);
    event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next]?.focus();
  };
  if (loading || error || !record) return <aside className={`sor-detail-panel ${explorer ? 'sor-detail-explorer' : ''}`} aria-label="Opportunity details" aria-busy={loading}>
    {explorer && <button type="button" className="sor-back-register" onClick={onCloseWorkspace}><ArrowLeft aria-hidden="true" />Back to register</button>}
    <header className="sor-detail-header"><h2 className="sor-detail-empty-title">Opportunity details</h2></header>
    <div className="sor-detail-state">
      {loading ? <><RefreshCw className="sor-detail-loading-icon" aria-hidden="true" /><p role="status">Loading opportunity details…</p></> : error ? <><FileText aria-hidden="true" /><p role="alert">{text(error) || "Opportunity details could not be loaded."}</p>{onRetry && <button className="sor-detail-secondary" type="button" onClick={onRetry}><RefreshCw aria-hidden="true" />Retry details</button>}</> : <><FileText aria-hidden="true" /><p>Select an opportunity to review its details.</p></>}
    </div>
  </aside>;

  const safeActions = (Array.isArray(actions) ? actions : []).filter((action) => text(action?.id) && text(action?.label));
  const primary = safeActions.find((action) => !action.danger);
  const secondaryActions = safeActions;
  const owner = text(record.owner_name) || recordName(record.owner_details);
  const client = text(record.client_name) || text(record.client_details?.company_name);
  const history = Array.isArray(record.stage_history) ? record.stage_history : [];
  const sourceEvent = history.find((event) => event?.event_type === "opportunity_created_from_email");
  const source = { ...object(record.custom_fields), ...object(sourceEvent?.data) };
  const analysis = object(source.reviewed_email_analysis);
  const identity = object(source.email_tender_identity);
  const fromEmail = record.opportunity_source === "client_email" || Boolean(sourceEvent || text(source.source_email_intake_id) || text(source.source_message_id));
  const quotes = Array.isArray(record.quotes) ? record.quotes.filter((quote) => quote && typeof quote === "object").slice(0, 5) : [];
  const activities = Array.isArray(record.activities) ? record.activities.filter((activity) => activity && typeof activity === "object").slice(0, 10) : [];
  const stage = text(record.stage);
  const decision = text(record.bid_decision);
  const deadline = deadlineInfo(text(record.submission_due_date));
  const stageValue = <span className={`sor-detail-status sor-detail-status--${Object.hasOwn(STATUS_LABELS, stage) ? stage : "unknown"}`}><span aria-hidden="true" />{text(statusLabel(stage)) || "Not provided"}</span>;
  const DecisionIcon = decision === "bid" || decision === "conditional_bid" ? CheckCircle2 : decision === "no_bid" ? XCircle : Clock3;
  const decisionValue = <span className={`sor-detail-decision sor-detail-decision--${decision === "bid" ? "go" : decision === "no_bid" ? "no-go" : "pending"}`}><DecisionIcon aria-hidden="true" />{text(bidLabel(decision)) || "Not provided"}</span>;
  const deadlineValue = <span className="sor-detail-deadline"><span>{displayDate(text(record.submission_due_date))}</span>{deadline.label && <span className={`sor-detail-deadline-note sor-detail-deadline-note--${deadline.tone || "normal"}`}>{deadline.label}</span>}</span>;
  const commercialRows = [
    ["Estimated value", opportunityMoney(record.estimated_value, record.currency)],
    ["Win probability", percentage(record.probability)],
    ["Weighted value", opportunityMoney(record.weighted_value, record.currency)],
  ];
  const ownerValue = owner ? <span className="sor-detail-owner"><span className="sor-detail-avatar" aria-hidden="true">{initials(owner)}</span><span>{owner}</span></span> : "Not provided";

  return <aside className={`sor-detail-panel ${explorer ? 'sor-detail-explorer' : ''}`} aria-label="Opportunity details">
    <header className="sor-detail-header">
      {explorer && <button type="button" className="sor-back-register" onClick={onCloseWorkspace}><ArrowLeft aria-hidden="true" />Back to register</button>}
      <div className="sor-detail-topline">
        <div className="sor-detail-identity"><span className="sor-detail-code">{present(record.deal_code)}</span><button type="button" className="sor-detail-icon-button" aria-label="Copy VF code" onClick={async () => { try { await navigator.clipboard.writeText(record.deal_code); setCopyNotice("VF code copied."); } catch { setCopyNotice("Copy is unavailable in this browser. Select the VF code to copy it."); } }}><Copy aria-hidden="true" /></button>{record.id && <span className="sor-detail-saved"><CheckCircle2 aria-hidden="true" />Saved</span>}</div>
        <div className="sor-detail-header-actions">
          {!locked && onEdit && <button type="button" className="sor-detail-secondary" onClick={onEdit}><Pencil aria-hidden="true" />Edit details</button>}
          {(onOpenFullRecord || secondaryActions.length > 0) && <details key={record.id} className="sor-detail-menu"><summary className="sor-detail-icon-button" aria-label="More opportunity actions" title="More actions"><MoreHorizontal aria-hidden="true" /></summary><div className="sor-detail-menu-items">
            {onOpenFullRecord && <button type="button" onClick={(event) => { event.currentTarget.closest("details").open = false; onOpenFullRecord(); }}>Open full record</button>}
            {secondaryActions.map((action) => <button key={action.id} type="button" className={action.danger ? "sor-detail-danger" : ""} disabled={!onAction} onClick={(event) => { event.currentTarget.closest("details").open = false; onAction?.(action.id); }}>{action.label}</button>)}
          </div></details>}
        </div>
      </div>
      <h2 className="sor-detail-title" title={text(record.deal_name)}>{present(record.deal_name)}</h2>
      <div className="sor-detail-meta"><span>Client <strong>{client || "Not provided"}</strong></span><span>Owner <strong>{owner || "Unassigned"}</strong></span><span>Deadline <strong>{displayDate(text(record.submission_due_date))}</strong></span>{stageValue}</div>
      {copyNotice && <p className="sor-detail-copy-notice" role="status">{copyNotice}</p>}
    </header>
    <div className="sor-detail-tabs" role="tablist" aria-label="Opportunity detail view">{tabs.map((tab) => <button key={tab} id={`${panelId}-${tab}-tab`} type="button" role="tab" aria-selected={activeTab === tab} aria-controls={`${panelId}-${tab}-panel`} tabIndex={activeTab === tab ? 0 : -1} onClick={() => activate(tab)} onKeyDown={moveTab}>{tab}</button>)}</div>
    <div ref={contentRef} key={record.id} className={`sor-detail-content ${explorer && activeTab === 'Workspace' ? 'sor-document-content' : ''}`} role="tabpanel" id={`${panelId}-${activeTab}-panel`} aria-labelledby={`${panelId}-${activeTab}-tab`} tabIndex={0}>
      <div hidden={activeTab !== "Workspace"}><SalesOpportunityWorkspace key={record.id} record={record} active={activeTab === "Workspace"} explorer={explorer} initialFolder={explorerFolder} onCloseExplorer={onCloseWorkspace} onOpenExplorer={folder => { setSelection({ recordId: record.id, tab: 'Workspace' }); onOpenWorkspace?.(folder); }} /></div>
      {activeTab === "Overview" && <>
        <Section number={1} title="Identity"><Facts rows={[["Client", client], ["Client reference", present(record.client_reference)], ["Opportunity type", text(typeLabel(text(record.opportunity_type))) || "Not provided"], ["Service line", serviceLine(record)]]} /></Section>
        <Section number={2} title="Dates & ownership"><Facts rows={[["Open date", displayDate(text(record.open_date))], ["Submission deadline", deadlineValue], ["Expected award date", displayDate(text(record.expected_close_date))], ["Owner", ownerValue]]} /></Section>
        <Section number={3} title="Commercial"><Facts rows={commercialRows} /></Section>
        <Section number={4} title="Governance"><Facts rows={[["Status", stageValue], ["Go / No-Go", decisionValue], ["Decision date", formatDate(record.bid_decided_at)], ["Decision by", decisionActor(record, history)]]} /></Section>
        <Section number={5} title="Source & workspace"><Facts rows={[["Source", record.opportunity_source ? words(record.opportunity_source) : fromEmail ? "Client email" : "Not provided"], ...(fromEmail ? [["Sender", present(source.sender_email)], ["Received", formatDate(source.received_at, true)], ["Source portal", text(analysis.source_portal) || text(identity.source_portal) || "Not provided"]] : [])]} />
          <div className="sor-detail-source-links">
            {fromEmail && <Link to={`/sales/email-intake${text(source.source_email_intake_id) ? "?view=imported" : ""}`}><Mail aria-hidden="true" />Open Email Intake</Link>}
            {sourceEvent && <button type="button" onClick={() => activate("Activity")}><History aria-hidden="true" />View source evidence</button>}
            {hasIdentity(record.framework) && <Link to={`/sales/frameworks?record=${encodeURIComponent(record.framework)}`}><ExternalLink aria-hidden="true" />Open linked framework</Link>}
          </div>
        </Section>
        <Section number={6} title="Description"><p className="sor-detail-description">{present(record.description)}</p></Section>
        <Section number={7} title="Record information"><Facts rows={[["Created by", present(record.created_by_name)], ["Created", formatDate(record.created_at, true)], ["Last updated", formatDate(record.updated_at, true)]]} /></Section>
      </>}
      {activeTab === "Overview" && <details className="sor-commercial-details"><summary>Full commercial details and proposals</summary>
        <Section number={3} title="Commercial"><Facts rows={[...commercialRows, ["Currency", present(record.currency)], ["Award value", opportunityMoney(record.award_value, record.currency)], ["Actual value", opportunityMoney(record.actual_value, record.currency)], ["Expected award date", displayDate(text(record.expected_close_date))], ["Expected start date", displayDate(text(record.expected_start_date))], ["Estimated hours", present(record.estimated_hours)], ["Duration (months)", present(record.project_duration_months)], ["Scope type", lookup(scopeLabels, record.scope_type) || words(record.scope_type)], ["Disciplines", listText(record.disciplines)], ["Delivery office", present(record.delivery_office)], ["Location", present(record.location)]]} /></Section>
        <Section number={4} title="Governance"><Facts rows={[["Priority", words(record.priority)], ["Risk level", words(record.risk_level)], ["Award status", words(record.award_status)]]} />{text(record.bid_decision_reason) && <p className="sor-detail-description">{record.bid_decision_reason}</p>}</Section>
        <section className="sor-detail-section" aria-label="Recent proposals"><h3 className="sor-detail-subheading">Recent proposals</h3>{quotes.length ? <ul className="sor-detail-related-list">{quotes.map((quote, index) => <li key={quote.id || index}>{hasIdentity(quote.id) ? <Link to={`/sales/proposals?record=${encodeURIComponent(quote.id)}`}>{present(quote.quote_number)}<ExternalLink aria-hidden="true" /></Link> : <strong>{present(quote.quote_number)}</strong>}<span>{words(quote.status) || "Not provided"}</span><span>{opportunityMoney(quote.total_amount, quote.currency)}</span></li>)}</ul> : <p className="sor-detail-muted">No proposals provided.</p>}</section>
      </details>}
      {activeTab === "Activity" && <>
        {history.length ? <div className="sor-detail-history"><SalesOpportunityHistory events={history} /></div> : <p className="sor-detail-muted">No lifecycle activity recorded.</p>}
        {activities.length > 0 && <section className="sor-detail-section" aria-label="Recent sales activities"><h3 className="sor-detail-subheading">Recent sales activities</h3><ul className="sor-detail-related-list">{activities.map((activity, index) => <li key={activity.id || index}><strong>{present(activity.subject)}</strong><span>{words(activity.activity_type) || "Activity"} · {formatDate(activity.activity_date, true)}</span>{text(activity.performed_by_name) && <span>By {activity.performed_by_name}</span>}{text(activity.outcome) && <p className="sor-detail-description">{activity.outcome}</p>}</li>)}</ul></section>}
      </>}
    </div>
    {activeTab === "Overview" && <footer className="sor-detail-footer">
      {locked && <p className="sor-detail-locked"><Lock aria-hidden="true" />Record is read-only. Use available lifecycle actions.</p>}
      <div className="sor-detail-footer-actions">{!locked && onEdit && <button type="button" className="sor-detail-secondary" onClick={onEdit}><Pencil aria-hidden="true" />Edit</button>}{primary && <button type="button" className="sor-detail-primary" onClick={() => onAction?.(primary.id)} disabled={!onAction}>{primary.label}<ArrowRight aria-hidden="true" /></button>}</div>
    </footer>}
  </aside>;
}

SalesOpportunityDetailPanel.propTypes = {
  record: PropTypes.object, loading: PropTypes.bool, error: PropTypes.string,
  explorer: PropTypes.bool, explorerFolder: PropTypes.string, onOpenWorkspace: PropTypes.func, onCloseWorkspace: PropTypes.func,
  onRetry: PropTypes.func, onOpenFullRecord: PropTypes.func, onEdit: PropTypes.func, onAction: PropTypes.func,
  actions: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string.isRequired, label: PropTypes.string.isRequired, danger: PropTypes.bool })), locked: PropTypes.bool,
};
