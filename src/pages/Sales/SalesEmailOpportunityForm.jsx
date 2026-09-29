import { useId } from "react";
import PropTypes from "prop-types";
import { X as XMarkIcon } from "lucide-react";
import useModalAccessibility from "../../hooks/useModalAccessibility";
import SalesEmailCustomerMatch from "./SalesEmailCustomerMatch";

const fieldClass = "mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100";
const scopeTypes = ["conceptual", "pre_feed", "feed", "basic_engineering", "detailed_engineering", "epcm", "epc", "pmc", "owner_engineer", "feasibility", "other"];
const currencies = ["AED", "USD", "EUR", "GBP", "SAR", "QAR"];

export default function SalesEmailOpportunityForm({
  subject, information, bodyPreview, clients, clientChoice, onClientChange,
  newClientName, onSubmit, onClose, submitting, error,
  fieldErrors, loadingClients, clientError, onRetryClients, showLocation,
  onReloadEmail, reloadingEmail, reviewPanel, requireSourceReload,
}) {
  const headingId = useId();
  const descriptionId = useId();
  const formId = useId();
  const dialogRef = useModalAccessibility(true, onClose, submitting);
  const extracted = information || {};
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
          <h2 id={headingId} className="text-lg font-semibold text-[#102a47]">Create opportunity from email</h2>
          <p id={descriptionId} className="mt-1 text-sm leading-5 text-slate-600">Review the suggested details and choose the client before creating the opportunity.</p>
        </div>
        <button type="button" onClick={onClose} disabled={submitting} aria-label="Close dialog" className="shrink-0 rounded-md p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-50"><XMarkIcon className="h-5 w-5" aria-hidden="true" /></button>
      </header>
      <form onSubmit={onSubmit} className="min-h-0 overflow-y-auto p-5">
        {error && <p role="alert" className="mb-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        {onReloadEmail && <button type="button" onClick={onReloadEmail} disabled={reloadingEmail || submitting} className="sales-email-button mb-4">{reloadingEmail ? "Reloading email details…" : "Reload email details"}</button>}
        {reviewPanel}
        <fieldset disabled={submitting} className="grid min-w-0 gap-4 sm:grid-cols-2">
          <div className="min-w-0 text-sm font-semibold text-slate-700 sm:col-span-2"><label htmlFor={`${formId}-deal_name`}>Opportunity name</label><input {...fieldProps("deal_name")} name="deal_name" required defaultValue={extracted.title || subject} maxLength="300" className={fieldClass} />{fieldError("deal_name")}</div>
          <div className="min-w-0 text-sm font-semibold text-slate-700 sm:col-span-2"><label htmlFor={`${formId}-client`}>Client</label>
            <select {...fieldProps("client")} name="client_choice" required value={clientChoice} onChange={(event) => onClientChange(event.target.value)} disabled={loadingClients || Boolean(clientError)} className={fieldClass}>
              <option value="">{loadingClients ? "Loading clients…" : "Select client"}</option>
              {newClientName && <option value="__new__">Add new client: {newClientName}</option>}
              {clients.map((client) => <option key={client.id} value={client.id}>{client.company_name}</option>)}
            </select>
            {clientChoice === "__new__" && newClientName && <span className="mt-2 block text-xs font-normal leading-5 text-slate-600">{newClientName} will be added as a client when you create the opportunity.</span>}
            {fieldError("client")}
            <SalesEmailCustomerMatch information={information} clients={clients} clientChoice={clientChoice} onUseClient={onClientChange} disabled={submitting || loadingClients || Boolean(clientError) || reloadingEmail || requireSourceReload} />
          </div>
          {loadingClients && <p role="status" className="text-sm text-slate-600 sm:col-span-2">Loading client options…</p>}
          {clientError && <div className="space-y-2 sm:col-span-2"><p role="alert" className="text-sm text-rose-800">{clientError}</p>{onRetryClients && <button type="button" onClick={onRetryClients} className="sales-email-button">Retry clients</button>}</div>}
          {!loadingClients && !clientError && clients.length === 0 && !newClientName && <p className="text-xs text-slate-600 sm:col-span-2">No clients are available to your account.</p>}
          {field("client_reference", "Client reference", <input {...fieldProps("client_reference")} name="client_reference" defaultValue={extracted.tender_reference || ""} className={fieldClass} />)}
          {field("estimated_value", "Estimated value", <input {...fieldProps("estimated_value")} name="estimated_value" type="number" min="0" step="0.01" required defaultValue={extracted.estimated_value || ""} className={fieldClass} />)}
          {field("currency", "Currency", <>
            <select {...fieldProps("currency")} name="currency" required defaultValue={!extracted.currency ? "AED" : currencies.includes(extracted.currency) ? extracted.currency : ""} className={fieldClass}><option value="">Select currency</option>{currencies.map((value) => <option key={value}>{value}</option>)}</select>
            {!extracted.currency && <span className="mt-1 block text-xs font-normal leading-5 text-slate-600">AED is the form default. Confirm the currency.</span>}
          </>)}
          {field("expected_close_date", "Expected award date", <input {...fieldProps("expected_close_date")} name="expected_close_date" type="date" required defaultValue={extracted.expected_award_date || ""} className={fieldClass} />)}
          {field("submission_due_date", "Proposal deadline", <input {...fieldProps("submission_due_date")} name="submission_due_date" type="date" defaultValue={extracted.deadline_date || extracted.due_date || ""} className={fieldClass} />)}
          {field("scope_type", "Scope type", <select {...fieldProps("scope_type")} name="scope_type" defaultValue={extracted.scope_type || "other"} className={fieldClass}>{scopeTypes.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select>)}
          {showLocation && <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Project location<input name="location" defaultValue={extracted.location || ""} className={fieldClass} /></label>}
          <div className="min-w-0 text-sm font-semibold text-slate-700 sm:col-span-2"><label htmlFor={`${formId}-description`}>Scope summary</label><textarea {...fieldProps("description")} name="description" rows="4" defaultValue={extracted.scope_summary || bodyPreview || ""} className={fieldClass} />{fieldError("description")}</div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4 sm:col-span-2">
            <button type="button" onClick={onClose} className="sales-email-button">Cancel</button>
            <button type="submit" disabled={loadingClients || reloadingEmail || requireSourceReload || Boolean(clientError) || (!clients.some((client) => client.id === clientChoice) && !(clientChoice === "__new__" && newClientName))} className="rounded-md bg-[#c7442d] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ac3825] disabled:cursor-not-allowed disabled:opacity-50">{submitting ? "Creating…" : "Create opportunity"}</button>
          </div>
        </fieldset>
      </form>
    </section>
  </div>;
}

SalesEmailOpportunityForm.propTypes = {
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
