import { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ArrowRightIcon,
  BriefcaseIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  ClockIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  TrophyIcon,
} from "@heroicons/react/24/outline";
import salesService from "../../services/sales.service";
import SalesMailboxConnectionDialog from "./SalesMailboxConnectionDialog";
import SalesSharedMailboxStatus from "./SalesSharedMailboxStatus";
import SalesOpportunityRegistrationDialog from "./SalesOpportunityRegistrationDialog";
import { opportunityTotal } from "./salesOpportunityRegistration";

const PIPELINE = [
  ["qualified", "Qualified", "from-sky-200 to-sky-300 text-slate-900"],
  ["bid", "Bid decision", "from-sky-300 to-blue-400 text-slate-900"],
  ["proposal", "Proposal", "from-blue-400 to-blue-500 text-white"],
  ["submitted", "Submitted", "from-blue-500 to-blue-700 text-white"],
  ["negotiation", "Negotiation", "from-blue-700 to-blue-900 text-white"],
];
const KPI_TONES = {
  blue: {
    card: "border-blue-200 bg-gradient-to-br from-white to-blue-50/70",
    icon: "bg-blue-100/80 text-blue-700",
    value: "text-blue-950",
  },
  violet: {
    card: "border-violet-200 bg-gradient-to-br from-white to-violet-50/70",
    icon: "bg-violet-100/80 text-violet-700",
    value: "text-violet-950",
  },
  emerald: {
    card: "border-emerald-200 bg-gradient-to-br from-white to-emerald-50/70",
    icon: "bg-emerald-100/80 text-emerald-700",
    value: "text-emerald-950",
  },
  rose: {
    card: "border-rose-200 bg-gradient-to-br from-white to-rose-50/80",
    icon: "bg-rose-100/80 text-rose-700",
    value: "text-rose-950",
  },
};
const list = (data) =>
  Array.isArray(data) ? data : (data?.results ?? data?.clients ?? []);
const dueDays = (value) =>
  value
    ? Math.ceil((new Date(`${value}T23:59:59`) - new Date()) / 86400000)
    : null;
const dateLabel = (value) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(value))
    : "Not set";

function Panel({ title, action, children }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white">
      <header className="flex min-h-12 items-center justify-between px-5 py-3">
        <h2 className="text-base font-bold text-[#102a47]">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}
function Initials({ name }) {
  const value = String(name || "Unassigned")
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700">
      {value}
    </span>
  );
}
Panel.propTypes = {
  title: PropTypes.string.isRequired,
  action: PropTypes.node,
  children: PropTypes.node.isRequired,
};
Panel.defaultProps = { action: null };
Initials.propTypes = { name: PropTypes.string };
Initials.defaultProps = { name: "Unassigned" };

export default function EnterpriseSalesWorkspace() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useSelector((state) => state.auth);
  const [opportunities, setOpportunities] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [modal, setModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mailboxDialogOpen, setMailboxDialogOpen] = useState(() =>
    new URLSearchParams(window.location.search).has("outlook"),
  );
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [deals, proposals] = await Promise.all([
        salesService.getDeals({ page_size: 500 }),
        salesService.getQuotes({ page_size: 500 }),
      ]);
      setOpportunities(list(deals));
      setQuotes(list(proposals));
    } catch (requestError) {
      setError(
        requestError?.response?.data?.detail ||
          "Sales records could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const quoteByDeal = useMemo(
    () => new Map(quotes.map((quote) => [String(quote.deal), quote])),
    [quotes],
  );
  const active = opportunities.filter((row) =>
    ["lead", "qualified", "proposal", "negotiation", "award_pending"].includes(
      row.stage,
    ),
  );
  const weighted = opportunityTotal(active, (row) => row.weighted_value);
  const proposalDue = active.filter((row) => {
    const days = dueDays(row.submission_due_date);
    return days !== null && days >= 0 && days <= 7;
  }).length;
  const quarter = Math.floor(new Date().getMonth() / 3);
  const wins = opportunities
    .filter((row) => {
      const closed = row.actual_close_date && new Date(row.actual_close_date);
      return (
        ["awarded", "converted"].includes(row.stage) &&
        closed &&
        closed.getFullYear() === new Date().getFullYear() &&
        Math.floor(closed.getMonth() / 3) === quarter
      );
    });

  const exceptions = useMemo(() => {
    const result = [];
    opportunities.forEach((row) => {
      const due = dueDays(row.submission_due_date);
      const base = { row, due, owner: row.owner_name || "Unassigned" };
      if (
        due !== null &&
        due <= 3 &&
        ["qualified", "proposal"].includes(row.stage)
      )
        result.push({
          ...base,
          issue: "Tender deadline approaching",
          severity: due <= 1 ? "High" : "Medium",
          action: "Review",
        });
      if (row.stage === "qualified" && row.bid_decision === "pending")
        result.push({
          ...base,
          issue: "Bid/no-bid decision overdue",
          severity: due !== null && due < 0 ? "High" : "Medium",
          action: "Decide",
        });
      if (row.stage === "proposal" && !quoteByDeal.has(String(row.id)))
        result.push({
          ...base,
          issue: "Engineering estimate missing",
          severity: "Medium",
          action: "Add estimate",
        });
      if (row.stage === "award_pending")
        result.push({
          ...base,
          issue: "Award approval pending",
          severity: "High",
          action: "Review",
        });
    });
    return result.sort((a, b) => (a.due ?? 999) - (b.due ?? 999)).slice(0, 4);
  }, [opportunities, quoteByDeal]);

  const stages = PIPELINE.map(([id, label, classes]) => {
    const rows = opportunities.filter((row) => {
      const quote = quoteByDeal.get(String(row.id));
      if (id === "qualified")
        return row.stage === "qualified" && row.bid_decision !== "pending";
      if (id === "bid")
        return row.stage === "qualified" && row.bid_decision === "pending";
      if (id === "proposal")
        return (
          row.stage === "proposal" &&
          (!quote ||
            [
              "draft",
              "scope_development",
              "estimation",
              "internal_review",
              "approval",
              "ready_to_submit",
            ].includes(quote.status))
        );
      if (id === "submitted")
        return (
          row.stage === "proposal" &&
          ["submitted", "sent", "viewed"].includes(quote?.status)
        );
      return row.stage === "negotiation";
    });
    return {
      id,
      label,
      classes,
      rows,
    };
  });
  const deadlines = active
    .filter((row) => row.submission_due_date)
    .sort((a, b) => a.submission_due_date.localeCompare(b.submission_due_date))
    .slice(0, 4);
  const statuses = [
    [
      "In preparation",
      quotes.filter((row) =>
        ["draft", "scope_development", "estimation"].includes(row.status),
      ).length,
      ClockIcon,
      "text-blue-600",
    ],
    [
      "Internal approval",
      quotes.filter((row) =>
        ["internal_review", "approval", "ready_to_submit"].includes(row.status),
      ).length,
      ExclamationTriangleIcon,
      "text-amber-500",
    ],
    [
      "Submitted",
      quotes.filter((row) => ["submitted", "sent"].includes(row.status)).length,
      CheckCircleIcon,
      "text-emerald-600",
    ],
    [
      "Clarification",
      quotes.filter((row) =>
        ["clarification", "negotiation"].includes(row.status),
      ).length,
      ArrowRightIcon,
      "text-slate-700",
    ],
    [
      "Award decision",
      opportunities.filter((row) => row.stage === "award_pending").length,
      TrophyIcon,
      "text-amber-500",
    ],
  ];

  const exportCsv = () => {
    const safe = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const body = opportunities.map((row) =>
      [
        row.deal_code,
        row.deal_name,
        row.client_name,
        row.stage,
        row.estimated_value,
        row.currency,
        row.submission_due_date,
        row.owner_name,
      ]
        .map(safe)
        .join(","),
    );
    const url = URL.createObjectURL(
      new Blob(
        [
          [
            "Opportunity,Title,Client,Stage,Value,Currency,Deadline,Owner",
            ...body,
          ].join("\n"),
        ],
        { type: "text/csv" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "sales-opportunities.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-full bg-slate-100 text-slate-950">
      <main className="min-w-0">
        <div className="space-y-4 p-5">
          <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-[#102a47]">
                Sales &amp; Proposals
              </h1>
              <p className="text-sm text-slate-600">
                Manage consulting opportunities, tenders, proposals and project
                handovers
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => navigate("/sales/email-intake")}
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-[#102a47] hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              >
                <EnvelopeIcon className="h-4 w-4 text-blue-700" />
                Email intake
              </button>
              <button
                type="button"
                onClick={() => setMailboxDialogOpen(true)}
                className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              >
                <EnvelopeIcon className="h-4 w-4" />
                Connect Outlook
              </button>
              <button
                onClick={load}
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold"
              >
                <ArrowPathIcon
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
              <button
                onClick={exportCsv}
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold"
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
                Export
              </button>
              <button
                onClick={() => setModal(true)}
                className="inline-flex items-center gap-2 rounded-md bg-[#f04b2f] px-5 py-2 text-sm font-semibold text-white hover:bg-[#d83f26] focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
              >
                <PlusIcon className="h-5 w-5" />
                New opportunity
              </button>
            </div>
          </header>
          {isAuthenticated && (
            <SalesSharedMailboxStatus key={user?.user?.id ?? user?.id ?? ""} />
          )}
          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {error}
            </div>
          )}
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              [
                ChartBarIcon,
                "Weighted pipeline",
                weighted,
                `${active.length} active opportunities`,
                "blue",
                "/sales/opportunities",
              ],
              [
                CalendarDaysIcon,
                "Proposals due",
                proposalDue,
                "Next 7 days",
                "violet",
                "/sales/proposals",
              ],
              [
                TrophyIcon,
                "Expected wins",
                opportunityTotal(wins, (row) => row.award_value ?? row.actual_value),
                "This quarter",
                "emerald",
                "/sales/opportunities",
              ],
              [
                ExclamationTriangleIcon,
                "At-risk opportunities",
                exceptions.filter((item) => item.severity === "High").length,
                "Action required",
                "rose",
                "/sales/opportunities",
              ],
            ].map(([Icon, label, value, hint, tone, path]) => (
              <button
                type="button"
                key={label}
                onClick={() => navigate(path)}
                className={`flex min-h-24 gap-4 rounded-xl border p-4 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${KPI_TONES[tone].card}`}
              >
                <span
                  className={`h-fit rounded-lg p-2.5 ${KPI_TONES[tone].icon}`}
                >
                  <Icon className="h-6 w-6" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    {label}
                  </p>
                  <p
                    className={`mt-1 text-2xl font-bold tabular-nums ${KPI_TONES[tone].value}`}
                  >
                    {value}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
                </div>
              </button>
            ))}
          </section>

          <div className="grid gap-3 xl:grid-cols-[1.05fr_.95fr]">
            <Panel
              title="Requires attention"
              action={
                <button
                  onClick={() => navigate("/sales/opportunities")}
                  className="text-xs font-semibold text-blue-600 underline"
                >
                  View all
                </button>
              }
            >
              <div className="overflow-x-auto px-5 pb-4">
                <table className="w-full min-w-[650px] text-sm">
                  <thead className="border-b border-slate-200 text-left text-slate-500">
                    <tr>
                      <th className="py-2">Issue</th>
                      <th>Client / Project</th>
                      <th>Owner</th>
                      <th>Due</th>
                      <th>Severity</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {exceptions.map((item, index) => (
                      <tr key={`${item.row.id}-${index}`}>
                        <td className="py-2.5">
                          <span className="flex gap-2">
                            <ExclamationTriangleIcon
                              className={`h-4 w-4 ${item.severity === "High" ? "text-rose-600" : "text-amber-500"}`}
                            />
                            {item.issue}
                          </span>
                        </td>
                        <td>
                          <b>{item.row.client_name}</b>
                          <small className="block text-slate-500">
                            {item.row.deal_name}
                          </small>
                        </td>
                        <td>
                          <span className="flex items-center gap-2">
                            <Initials name={item.owner} />
                            {item.owner}
                          </span>
                        </td>
                        <td className={item.due <= 1 ? "text-rose-600" : ""}>
                          {item.due === null
                            ? "—"
                            : item.due < 0
                              ? `${-item.due}d overdue`
                              : item.due === 0
                                ? "Today"
                                : `${item.due} days`}
                        </td>
                        <td
                          className={
                            item.severity === "High" ? "text-rose-600" : ""
                          }
                        >
                          {item.severity}
                        </td>
                        <td>
                          <button
                            onClick={() =>
                              navigate(
                                `/sales/opportunities?record=${item.row.id}`,
                              )
                            }
                            className="rounded border border-slate-300 px-3 py-1.5 font-semibold text-blue-600"
                          >
                            {item.action}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!exceptions.length && (
                      <tr>
                        <td
                          colSpan="6"
                          className="py-8 text-center text-slate-500"
                        >
                          No governed exceptions require attention.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>
            <Panel title="Weighted pipeline">
              <div className="px-5 pb-5">
                <div className="flex overflow-hidden rounded-sm">
                  {stages.map((stage, index) => (
                    <div
                      key={stage.id}
                      style={{
                        clipPath:
                          index === 0
                            ? "polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)"
                            : index === stages.length - 1
                              ? "polygon(0 0, 100% 0, 100% 100%, 0 100%, 12px 50%)"
                              : "polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%, 12px 50%)",
                      }}
                      className={`min-w-0 flex-1 bg-gradient-to-r px-3 py-3 text-center text-sm font-semibold ${index ? "-ml-2 pl-5" : ""} ${stage.classes}`}
                    >
                      {stage.label}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-5">
                  {stages.map((stage) => (
                    <div key={stage.id} className="py-3">
                      <p className="text-base font-bold text-[#102a47]">
                        {opportunityTotal(stage.rows, (row) => row.weighted_value)}
                      </p>
                      <p className="text-[13px] text-slate-500">
                        {stage.rows.length} opps
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex justify-between bg-slate-50 px-4 py-4 text-sm">
                  <span>Total weighted pipeline</span>
                  <span className="text-right">
                    <b className="block text-xl text-[#102a47]">
                      {weighted}
                    </b>
                    <small>{active.length} opportunities</small>
                  </span>
                </div>
              </div>
            </Panel>
          </div>

          <div className="grid gap-3 xl:grid-cols-[1.35fr_.65fr]">
            <Panel
              title="Upcoming proposal deadlines"
              action={
                <button
                  onClick={() => navigate("/sales/proposals")}
                  className="text-xs font-semibold text-blue-600 underline"
                >
                  View all
                </button>
              }
            >
              <div className="overflow-x-auto px-5 pb-4">
                <table className="w-full min-w-[620px] text-sm">
                  <thead className="border-b border-slate-200 text-left text-slate-500">
                    <tr>
                      <th className="py-2">Opportunity</th>
                      <th>Client</th>
                      <th>Scope</th>
                      <th>Deadline</th>
                      <th>Owner</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {deadlines.map((row) => (
                      <tr key={row.id}>
                        <td className="py-2.5 font-medium">{row.deal_name}</td>
                        <td>{row.client_name}</td>
                        <td className="capitalize">
                          {row.scope_type?.replaceAll("_", " ") || "—"}
                        </td>
                        <td>{dateLabel(row.submission_due_date)}</td>
                        <td>
                          <span className="flex items-center gap-2">
                            <Initials name={row.owner_name} />
                            {row.owner_name || "Unassigned"}
                          </span>
                        </td>
                        <td>
                          <span className="flex gap-1">
                            <ClockIcon className="h-4 w-4 text-blue-600" />
                            {row.stage === "proposal"
                              ? "In preparation"
                              : row.stage === "lead" ? "Open" : row.stage_display}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {!deadlines.length && (
                      <tr>
                        <td
                          colSpan="6"
                          className="py-8 text-center text-slate-500"
                        >
                          No upcoming proposal deadlines.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>
            <Panel title="Proposal status">
              <div className="divide-y divide-slate-200 px-5 pb-3">
                {statuses.map(([label, count, Icon, color]) => (
                  <div
                    key={label}
                    className="flex items-center gap-3 py-2 text-sm"
                  >
                    <Icon className={`h-5 w-5 ${color}`} />
                    <span>{label}</span>
                    <b className="ml-auto">{count}</b>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
          <nav
            aria-label="Sales quick links"
            className="flex flex-wrap items-center border-y border-slate-200 bg-slate-50/70 px-2 text-sm"
          >
            <span className="mr-2 flex min-h-10 items-center gap-2 px-3 text-xs font-bold uppercase tracking-wide text-slate-600">
              <BriefcaseIcon className="h-4 w-4 text-slate-500" />
              Quick links
            </span>
            {[
              ["View all opportunities", "opportunities"],
              ["Proposals", "proposals"],
              ["Clients", "clients"],
              ["Framework agreements", "frameworks"],
              ["Forecasts", "forecasts"],
              ["Email intake", "email-intake"],
            ].map(([label, id]) => (
              <button
                key={id}
                onClick={() => navigate(`/sales/${id}`)}
                className="flex min-h-10 min-w-36 flex-1 items-center justify-center gap-1 border-l border-slate-200 px-3 font-semibold text-blue-700 transition-colors hover:bg-blue-50 hover:text-blue-900 focus:outline-none focus-visible:bg-blue-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600"
              >
                {label}
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            ))}
          </nav>
        </div>
      </main>
      {modal && <SalesOpportunityRegistrationDialog onClose={() => setModal(false)} onCreated={(record) => { setModal(false); navigate(`/sales/opportunities?record=${encodeURIComponent(record.id)}`); }} />}
      <SalesMailboxConnectionDialog
        open={mailboxDialogOpen}
        onClose={() => setMailboxDialogOpen(false)}
      />
    </div>
  );
}
