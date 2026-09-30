export const businessDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  return ["year", "month", "day"].map((type) => parts.find((part) => part.type === type)?.value).join("-");
};

export const detectedOpportunityType = (information, classification) => {
  const value = String(classification || information?.classification?.code || information?.request_type_code || "").toLowerCase();
  if (["rfq", "request_for_quotation"].includes(value)) return "rfq";
  if (["eoi", "expression_of_interest"].includes(value)) return "eoi";
  if (["tender_opportunity", "tender", "rft", "itt", "rfp", "proposal_request"].includes(value)) return "tender";
  if (["direct_enquiry", "direct_inquiry"].includes(value)) return "direct_enquiry";
  return "";
};

export const initialProposalDeadline = (information, classification) => {
  // Changing a review classification cannot change the meaning of a sourced EOI date.
  const sourceTypes = [classification, information?.classification?.code, information?.request_type_code];
  if (sourceTypes.some((value) => detectedOpportunityType(null, value) === "eoi")) return "";
  return information?.deadline_date || information?.due_date || "";
};

export const registrationFields = (form) => ({
  opportunity_type: form.get("opportunity_type"),
  open_date: form.get("open_date") || undefined,
  owner: form.get("owner") || undefined,
  estimated_value: form.get("estimated_value") || null,
  currency: form.get("currency") || "",
  expected_close_date: form.get("expected_close_date") || null,
  submission_due_date: form.get("submission_due_date") || null,
});

export const opportunityMoney = (value, currency) => {
  if (value === null || value === undefined || value === "") return "Not provided";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "Not provided";
  const plain = new Intl.NumberFormat("en-AE", { maximumFractionDigits: 2 }).format(amount);
  if (!currency) return `${plain} (currency not provided)`;
  if (typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency)) return `${plain} (currency not verified)`;
  try { return new Intl.NumberFormat("en-AE", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${plain} (currency not verified)`; }
};

export const opportunityTotal = (rows, valueOf) => {
  const known = rows.filter((row) => valueOf(row) !== null && valueOf(row) !== undefined && valueOf(row) !== "" && Number.isFinite(Number(valueOf(row))));
  if (!known.length) return "Not provided";
  if (known.length !== rows.length) return `Incomplete — ${rows.length - known.length} opportunities missing values`;
  const currencies = new Set(known.map((row) => row.currency || ""));
  if (currencies.size !== 1 || currencies.has("")) return "Currency totals unavailable";
  return opportunityMoney(known.reduce((sum, row) => sum + Number(valueOf(row)), 0), [...currencies][0]);
};
