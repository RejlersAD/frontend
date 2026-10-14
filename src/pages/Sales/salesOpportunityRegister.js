import {
  businessDate,
  opportunityMoney,
} from "./salesOpportunityRegistration.js";

export const ACTIVE_STAGES = [
  "lead",
  "qualified",
  "proposal",
  "negotiation",
  "award_pending",
];
export const STATUS_LABELS = {
  lead: "Open",
  qualified: "Qualification",
  proposal: "Proposal preparation",
  negotiation: "Negotiation",
  award_pending: "Award approval",
  awarded: "Awarded",
  converted: "Converted to project",
  lost: "Lost",
  no_bid: "No bid",
  cancelled: "Cancelled",
};
export const BID_LABELS = {
  pending: "Pending",
  bid: "Go",
  conditional_bid: "Conditional Go",
  no_bid: "No-Go",
};
export const DEFAULT_FILTERS = {
  status: "active",
  bid: "",
  service: "",
  owner: "",
  deadline: "",
};
export const humanize = (value) =>
  String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
export const statusLabel = (stage) =>
  Object.hasOwn(STATUS_LABELS, stage)
    ? STATUS_LABELS[stage]
    : humanize(stage) || "Not provided";
export const bidLabel = (value) =>
  Object.hasOwn(BID_LABELS, value) ? BID_LABELS[value] : "No decision";
export const typeLabel = (value) => {
  const labels = {
    EOI: "EOI",
    budgetary: "Budgetary",
    technical: "Technical",
    commercial: "Commercial",
    techno_commercial: "Techno Commerical",
    other: "Others",
  };
  return Object.hasOwn(labels, value)
    ? labels[value]
    : humanize(value) || "Not provided";
};
export const services = (record) =>
  Array.isArray(record.service_categories)
    ? record.service_categories.filter(
        (value) => typeof value === "string" && value.trim(),
      )
    : [];
export const serviceLine = (record) =>
  services(record).map(humanize).join(", ") || "Not provided";
export const initials = (name) =>
  String(name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase() || "—";
const dateNumber = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) &&
    new Date(parsed).toISOString().slice(0, 10) === value
    ? parsed
    : null;
};
export const displayDate = (value) =>
  dateNumber(value) === null
    ? "Not provided"
    : new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${value}T00:00:00Z`));
export const deadlineInfo = (value, today = businessDate(new Date())) => {
  const due = dateNumber(value),
    current = dateNumber(today);
  if (due === null || current === null)
    return { days: null, label: "", tone: "" };
  const days = Math.round((due - current) / 86400000);
  return {
    days,
    label:
      days < 0
        ? `Overdue by ${Math.abs(days)} ${days === -1 ? "day" : "days"}`
        : days === 0
          ? "Due today"
          : `${days} ${days === 1 ? "day" : "days"} remaining`,
    tone: days < 0 ? "danger" : days <= 2 ? "warning" : "",
  };
};
export const compactMoney = (value, currency) => {
  if (
    value === "" ||
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value)) ||
    !/^[A-Z]{3}$/.test(currency || "")
  )
    return opportunityMoney(value, currency);
  const number = Number(value);
  return `${currency} ${new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(number)}`;
};

// Sum stored decimal amounts exactly in hundredths; never combine currencies.
export const pipelineTotals = (rows) => {
  const sums = new Map();
  let missing = 0;
  for (const row of rows) {
    const match = String(row.weighted_value ?? "").match(
      /^(-?)(\d+)(?:\.(\d{1,2}))?$/,
    );
    if (!match || !/^[A-Z]{3}$/.test(row.currency || "")) {
      missing += 1;
      continue;
    }
    const cents =
      (BigInt(match[2]) * 100n + BigInt((match[3] || "").padEnd(2, "0"))) *
      (match[1] ? -1n : 1n);
    sums.set(row.currency, (sums.get(row.currency) || 0n) + cents);
  }
  const totals = [...sums]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, cents]) => {
      const absolute = cents < 0n ? -cents : cents;
      return {
        currency,
        value: `${cents < 0n ? "-" : ""}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`,
      };
    });
  return { totals, missing };
};

export const attentionItems = (rows, today = businessDate(new Date())) => {
  const result = [];
  for (const row of rows.filter((item) => ACTIVE_STAGES.includes(item.stage))) {
    const deadline = deadlineInfo(row.submission_due_date, today);
    if (deadline.days !== null && deadline.days <= 2)
      result.push({
        row,
        kind: "deadline",
        tone: deadline.days < 0 ? "danger" : "warning",
        title: `${row.client_name || "Submission"} · ${deadline.days < 0 ? "submission overdue" : deadline.days === 0 ? "due today" : `due in ${deadline.days} ${deadline.days === 1 ? "day" : "days"}`}`,
        priority: deadline.days < 0 ? 0 : 1,
      });
    else if (
      row.stage === "qualified" &&
      row.bid_decision === "pending" &&
      deadlineInfo(row.next_action_date, today).days < 0
    )
      result.push({
        row,
        kind: "decision",
        tone: "warning",
        title: "Bid review follow-up overdue",
        priority: 2,
      });
    else if (!row.owner)
      result.push({
        row,
        kind: "owner",
        tone: "neutral",
        title: "Owner missing",
        priority: 3,
      });
  }
  return result.sort((left, right) => left.priority - right.priority);
};

export const filterOpportunities = (
  rows,
  query,
  filters,
  today = businessDate(new Date()),
) => {
  const term = query.trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.status === "active" && !ACTIVE_STAGES.includes(row.stage))
      return false;
    if (
      filters.status &&
      filters.status !== "active" &&
      row.stage !== filters.status
    )
      return false;
    if (filters.bid && row.bid_decision !== filters.bid) return false;
    if (filters.service && !services(row).includes(filters.service))
      return false;
    if (filters.owner === "unassigned" && row.owner) return false;
    if (
      filters.owner &&
      filters.owner !== "unassigned" &&
      String(row.owner) !== filters.owner
    )
      return false;
    const days = deadlineInfo(row.submission_due_date, today).days;
    if (filters.deadline === "week" && (days === null || days < 0 || days > 7))
      return false;
    if (filters.deadline === "overdue" && (days === null || days >= 0))
      return false;
    if (filters.deadline === "missing" && days !== null) return false;
    return (
      !term ||
      [
        row.deal_code,
        row.deal_name,
        row.client_name,
        row.client_reference,
        row.owner_name,
      ].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(term),
      )
    );
  });
};

export async function loadOpportunityRegister(fetchPage) {
  const rows = [],
    seen = new Set();
  let expected;
  for (let page = 1; page <= 200; page += 1) {
    const data = await fetchPage({ page, ordering: "deal_code,id" });
    const batch = Array.isArray(data) ? data : data?.results;
    if (!Array.isArray(batch))
      throw new Error(
        "The opportunity register returned an incomplete response. Refresh to try again.",
      );
    if (expected === undefined && Number.isFinite(data.count))
      expected = data.count;
    if (Number.isFinite(data.count) && expected !== data.count)
      throw new Error(
        "The register changed while loading. Refresh to reload the complete list.",
      );
    for (const row of batch) {
      if (!row.id || seen.has(String(row.id)))
        throw new Error(
          "The register changed while loading. Refresh to reload the complete list.",
        );
      seen.add(String(row.id));
      rows.push(row);
    }
    if (!data.next) {
      if (expected !== undefined && rows.length !== expected)
        throw new Error(
          "The register changed while loading. Refresh to reload the complete list.",
        );
      return { results: rows, count: rows.length };
    }
    if (!batch.length) break;
  }
  throw new Error(
    "The complete opportunity register could not be loaded. Please refresh or contact your administrator.",
  );
}
