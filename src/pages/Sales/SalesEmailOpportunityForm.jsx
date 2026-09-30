import { useEffect, useId, useRef, useState } from "react";
import PropTypes from "prop-types";
import { X as XMarkIcon } from "lucide-react";
import useModalAccessibility from "../../hooks/useModalAccessibility";
import SalesEmailCustomerMatch from "./SalesEmailCustomerMatch";
import useSalesRegistrationOptions from "./useSalesRegistrationOptions";
import { businessDate, detectedOpportunityType, initialProposalDeadline } from "./salesOpportunityRegistration";

const fieldClass = "mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100";
const secondaryButtonClass = "sales-email-button rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50";
const scopeTypes = ["conceptual", "pre_feed", "feed", "basic_engineering", "detailed_engineering", "epcm", "epc", "pmc", "owner_engineer", "procurement", "construction", "commissioning", "feasibility", "other"];
const currencies = ["AED", "USD", "EUR", "GBP", "SAR", "QAR"];

export default function SalesEmailOpportunityForm({
  subject, information, bodyPreview, clients, clientChoice, onClientChange,
  newClientName, onSubmit, onClose, submitting, error,
  fieldErrors, loadingClients, clientError, onRetryClients, showLocation,
  onReloadEmail, reloadingEmail, reviewPanel, requireSourceReload,
  receivedAt, classificationCode, manual = false, frameworks = [],
}) {
  const headingId = useId();
  const descriptionId = useId();
  const formId = useId();
  const dialogRef = useModalAccessibility(true, onClose, submitting);
  const extracted = information || {};
  const registration = useSalesRegistrationOptions();
  const [owner, setOwner] = useState("");
  const ownerInitialized = useRef(false);
  const [opportunityType, setOpportunityType] = useState(() => detectedOpportunityType(information, classificationCode));
  useEffect(() => { if (!ownerInitialized.current && registration.defaultOwner) { ownerInitialized.current = true; setOwner(registration.defaultOwner); } }, [registration.defaultOwner]);
  const registrationBlocked = registration.loading || Boolean(registration.error) || !registration.owners.some((option) => String(option.id) === owner);
  const aiReviewed = extracted.ai_review?.status === "validated";
  const currencySources = extracted.field_sources?.currency;
  const detectedCurrency = typeof extracted.currency === "string" && /^[A-Z]{3}$/.test(extracted.currency) ? extracted.currency : "";
  const sourcedCurrency = detectedCurrency && typeof extracted.evidence?.currency === "string" && extracted.evidence.currency.trim() &&
    Array.isArray(currencySources) && currencySources.length > 0 && Array.isArray(extracted.analysis?.sources) &&
    currencySources.every((id) => typeof id === "string" && id && extracted.analysis.sources.filter((source) => source?.id === id).length === 1 &&
      extracted.analysis.sources.some((source) => source?.id === id && ["message", "quoted"].includes(source.origin)));
  const [offeredCurrencies, setOfferedCurrencies] = useState([]);
  useEffect(() => {
    if (sourcedCurrency) setOfferedCurrencies((previous) => previous.includes(detectedCurrency) ? previous : [...previous, detectedCurrency]);
  }, [sourcedCurrency, detectedCurrency]);
  // Keep a selected source-backed currency available when a source refresh changes suggestions.
  const currencyOptions = [...new Set([...currencies, ...offeredCurrencies, ...(sourcedCurrency ? [detectedCurrency] : [])])];
  const errorFor = (name) => {
    const value = fieldErrors?.[name];
    return typeof value === "string" ? value : "";
  };
  const fieldProps = (name) => ({
    id: `${formId}-${name}`,
    "aria-invalid": Boolean(errorFor(name)),
    "aria-describedby": errorFor(name) ? `${formId}-${name}-error` : undefined,
  });
  const fieldError = (name) => errorFor(name) && <span id={`${formId}-${name}-error`} className="mt-1 block text-xs font-normal text-rose-800">{errorFor(name)}</span>;
  const field = (name, label, input) => <div key={name} className="min-w-0 text-sm font-semibold text-slate-700"><label htmlFor={`${formId}-${name}`}>{label}</label>{input}{fieldError(name)}</div>;
  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-3 sm:p-4">
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={headingId} aria-describedby={descriptionId} tabIndex={-1} className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div className="min-w-0">
          <h2 id={headingId} className="text-lg font-semibold text-[#102a47]">{manual ? "Register opportunity (VF)" : "Create opportunity from email"}</h2>
          <p id={descriptionId} className="mt-1 text-sm leading-5 text-slate-600">Register the opportunity now. Commercial details can be completed before qualification.</p>
        </div>
        <button type="button" onClick={onClose} disabled={submitting} aria-label="Close dialog" className="shrink-0 rounded-md p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-50"><XMarkIcon className="h-5 w-5" aria-hidden="true" /></button>
      </header>
      <form onSubmit={onSubmit} className="min-h-0 overflow-y-auto p-5">
        {error && <p role="alert" className="mb-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        {onReloadEmail && <button type="button" onClick={onReloadEmail} disabled={reloadingEmail || submitting} className={`${secondaryButtonClass} mb-4`}>{reloadingEmail ? "Reloading email details…" : "Reload email details"}</button>}
        {reviewPanel}
        {registration.loading && <p role="status" className="mb-3 text-sm text-slate-600">Loading registration options…</p>}
        {registration.error && <div className="mb-3"><p role="alert" className="text-sm text-rose-800">{registration.error}</p><button type="button" className={`${secondaryButtonClass} mt-2`} onClick={registration.load} disabled={submitting}>Retry registration options</button></div>}
        <fieldset disabled={submitting} className="grid min-w-0 gap-4 sm:grid-cols-2">
          <div className="text-sm text-slate-700"><span className="font-semibold">VF code</span><p className="mt-1">Assigned automatically when saved</p></div>
          <div className="text-sm text-slate-700"><span className="font-semibold">Status</span><p className="mt-1">Open</p></div>
          {field("opportunity_type", "Opportunity type", <select {...fieldProps("opportunity_type")} name="opportunity_type" required value={opportunityType} disabled={registration.loading || Boolean(registration.error)} onChange={(event) => setOpportunityType(event.target.value)} className={fieldClass}><option value="">Select opportunity type</option>{registration.opportunityTypes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>)}
          {field("owner", "Owner", <select {...fieldProps("owner")} name="owner" required value={owner} disabled={registration.loading || Boolean(registration.error)} onChange={(event) => setOwner(event.target.value)} className={fieldClass}><option value="">Select owner</option>{registration.owners.map((option) => <option key={option.id} value={String(option.id)}>{option.name}</option>)}</select>)}
          <div className="min-w-0 text-sm font-semibold text-slate-700 sm:col-span-2"><label htmlFor={`${formId}-deal_name`}>Opportunity name</label><input {...fieldProps("deal_name")} name="deal_name" required defaultValue={extracted.title || subject} maxLength="300" className={fieldClass} />{fieldError("deal_name")}</div>
          <div className="min-w-0 text-sm font-semibold text-slate-700 sm:col-span-2"><label htmlFor={`${formId}-client`}>Client</label>
            <select {...fieldProps("client")} name="client_choice" required value={clientChoice} onChange={(event) => onClientChange(event.target.value)} disabled={loadingClients || Boolean(clientError)} className={fieldClass}>
              <option value="">{loadingClients ? "Loading clients…" : "Select client"}</option>
              {newClientName && <option value="__new__">Add new client: {newClientName}</option>}
              {clients.map((client) => <option key={client.id} value={client.id}>{client.company_name}</option>)}
            </select>
            {clientChoice === "__new__" && newClientName && <span className="mt-2 block text-xs font-normal leading-5 text-slate-600">{newClientName} will be added as a client when you create the opportunity.</span>}
            {fieldError("client")}
            {!manual && <SalesEmailCustomerMatch information={information} clients={clients} clientChoice={clientChoice} onUseClient={onClientChange} disabled={submitting || loadingClients || Boolean(clientError) || reloadingEmail || requireSourceReload} />}
          </div>
          {loadingClients && <p role="status" className="text-sm text-slate-600 sm:col-span-2">Loading client options…</p>}
          {clientError && <div className="space-y-2 sm:col-span-2"><p role="alert" className="text-sm text-rose-800">{clientError}</p>{onRetryClients && <button type="button" onClick={onRetryClients} className={secondaryButtonClass}>Retry clients</button>}</div>}
          {!loadingClients && !clientError && clients.length === 0 && !newClientName && <p className="text-xs text-slate-600 sm:col-span-2">No clients are available to your account.</p>}
          {field("open_date", "Open date", <input {...fieldProps("open_date")} name="open_date" type="date" required={manual} defaultValue={businessDate(receivedAt || (manual ? new Date() : null))} className={fieldClass} />)}
          {field("submission_due_date", "Proposal deadline", <input {...fieldProps("submission_due_date")} name="submission_due_date" type="date" defaultValue={initialProposalDeadline(extracted, classificationCode)} className={fieldClass} />)}
          {receivedAt && <p className="text-xs leading-5 text-slate-600 sm:col-span-2">Source email received: {receivedAt}. Open date uses Gulf Standard Time (UTC+04:00). Review the submission date against the email; exact deadline time and timezone remain in source evidence.</p>}
          <p className="text-xs text-slate-600 sm:col-span-2">Creator and creation time are recorded automatically when saved.</p>
          <details className="sm:col-span-2" open={Boolean(extracted.estimated_value || extracted.currency || extracted.expected_award_date || extracted.scope_summary)}>
            <summary className="cursor-pointer rounded-md py-2 text-sm font-semibold text-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">Commercial details (optional)</summary>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {field("client_reference", "Client reference", <input {...fieldProps("client_reference")} name="client_reference" defaultValue={extracted.tender_reference || ""} className={fieldClass} />)}
          {field("estimated_value", "Estimated value", <input {...fieldProps("estimated_value")} name="estimated_value" type="number" min="0" step="0.01" defaultValue={extracted.estimated_value ?? ""} className={fieldClass} />)}
          {field("currency", "Currency", <>
            <select {...fieldProps("currency")} name="currency" defaultValue={currencyOptions.includes(detectedCurrency) ? detectedCurrency : ""} className={fieldClass}><option value="">Not provided</option>{currencyOptions.map((value) => <option key={value}>{value}</option>)}</select>
          </>)}
          {field("expected_close_date", "Expected award date", <input {...fieldProps("expected_close_date")} name="expected_close_date" type="date" defaultValue={extracted.expected_award_date || ""} className={fieldClass} />)}
          {field("scope_type", "Scope type", <select {...fieldProps("scope_type")} name="scope_type" defaultValue={scopeTypes.includes(extracted.scope_type) ? extracted.scope_type : ""} className={fieldClass}><option value="">Not provided</option>{scopeTypes.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select>)}
          {manual && <>
            {field("framework", "Framework (optional)", <select {...fieldProps("framework")} name="framework" className={fieldClass}><option value="">None</option>{frameworks.filter((item) => String(item.client) === String(clientChoice)).map((item) => <option key={item.id} value={item.id}>{item.framework_number}</option>)}</select>)}
            {field("estimated_hours", "Estimated hours", <input {...fieldProps("estimated_hours")} name="estimated_hours" type="number" min="0" step="0.01" className={fieldClass} />)}
            {field("project_duration_months", "Duration in months", <input {...fieldProps("project_duration_months")} name="project_duration_months" type="number" min="1" className={fieldClass} />)}
          </>}
          {showLocation && <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Project location<input name="location" defaultValue={extracted.location || ""} className={fieldClass} /></label>}
          <div className="min-w-0 text-sm font-semibold text-slate-700 sm:col-span-2"><label htmlFor={`${formId}-description`}>Scope summary</label><textarea {...fieldProps("description")} name="description" rows="4" defaultValue={extracted.scope_summary || (aiReviewed ? "" : bodyPreview) || ""} className={fieldClass} />{fieldError("description")}</div>
            </div>
          </details>
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4 sm:col-span-2">
            <button type="button" onClick={onClose} className={secondaryButtonClass}>Cancel</button>
            <button type="submit" disabled={registrationBlocked || loadingClients || reloadingEmail || requireSourceReload || Boolean(clientError) || (!clients.some((client) => client.id === clientChoice) && !(clientChoice === "__new__" && newClientName))} className="sales-email-opportunity-submit rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? "Creating…" : "Create opportunity"}</button>
          </div>
        </fieldset>
      </form>
    </section>
  </div>;
}

SalesEmailOpportunityForm.propTypes = {
  receivedAt: PropTypes.string,
  classificationCode: PropTypes.string,
  manual: PropTypes.bool,
  frameworks: PropTypes.array,
  subject: PropTypes.string,
  information: PropTypes.object,
  bodyPreview: PropTypes.string,
  clients: PropTypes.array.isRequired,
  clientChoice: PropTypes.string.isRequired,
  onClientChange: PropTypes.func.isRequired,
  newClientName: PropTypes.string,
  onSubmit: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  submitting: PropTypes.bool,
  error: PropTypes.string,
  fieldErrors: PropTypes.object,
  loadingClients: PropTypes.bool,
  clientError: PropTypes.string,
  onRetryClients: PropTypes.func,
  showLocation: PropTypes.bool,
  onReloadEmail: PropTypes.func,
  reloadingEmail: PropTypes.bool,
  reviewPanel: PropTypes.node,
  requireSourceReload: PropTypes.bool,
};
SalesEmailOpportunityForm.defaultProps = {
  subject: "", information: null, bodyPreview: "", newClientName: "",
  submitting: false, error: "", fieldErrors: {}, loadingClients: false,
  clientError: "", onRetryClients: null, showLocation: false,
  onReloadEmail: null, reloadingEmail: false, reviewPanel: null,
  requireSourceReload: false,
};
