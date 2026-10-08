import { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useSelector } from "react-redux";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Columns,
  Download,
  FileText,
  Hourglass,
  Info,
  ListFilter,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import salesService from "../../services/sales.service";
import SalesOpportunityDetailPanel from "./SalesOpportunityDetailPanel";
import {
  ACTIVE_STAGES,
  BID_LABELS,
  DEFAULT_FILTERS,
  STATUS_LABELS,
  attentionItems,
  bidLabel,
  compactMoney,
  deadlineInfo,
  displayDate,
  filterOpportunities,
  humanize,
  initials,
  pipelineTotals,
  serviceLine,
  services,
  statusLabel,
  typeLabel,
} from "./salesOpportunityRegister.js";
import "./SalesOpportunityRegister.css";

const COLUMNS = [
  ["code", "VF Code"],
  ["title", "Opportunity / Client"],
  ["type", "Type"],
  ["service", "Service line"],
  ["deadline", "Due"],
  ["owner", "Owner"],
  ["value", "Value"],
  ["probability", "Probability"],
  ["status", "Status"],
  ["bid", "Go / No-Go"],
  ["next", "Next action"],
];
const DEFAULT_COLUMNS = ["code", "title", "deadline", "status"];
const VIEWS = [
  ["open", "Open opportunities"],
  ["all", "All opportunities"],
  ["due", "Due in 7 days"],
  ["decisions", "Pending Go/No-Go"],
];
function Menu({ label, icon: Icon, children, className = "" }) {
  const ref = useRef(null);
  useEffect(() => {
    const close = (event) => {
      if (ref.current && !ref.current.contains(event.target))
        ref.current.open = false;
    };
    const escape = (event) => {
      if (event.key === "Escape" && ref.current?.open) {
        ref.current.open = false;
        ref.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  return (
    <details className={`sor-menu ${className}`} ref={ref}>
      <summary className="sor-button">
        {Icon && <Icon size={15} />} {label}
        <ChevronDown size={12} />
      </summary>
      <div
        className="sor-menu-content"
        onClick={(event) => {
          if (event.target.closest("button")) ref.current.open = false;
        }}
      >
        {children}
      </div>
    </details>
  );
}
Menu.propTypes = {
  label: PropTypes.string.isRequired,
  icon: PropTypes.elementType,
  children: PropTypes.node,
  className: PropTypes.string,
};

function Metric({ icon: Icon, label, value, note, onClick, children }) {
  return (
    <button
      className="sor-metric"
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-label={`${label}: ${value}`}
    >
      <Icon className="sor-metric-icon" size={27} strokeWidth={1.8} />
      <span>
        <span className="sor-metric-label">{label}</span>
        <strong className={String(value).length > 14 ? "sor-metric-long" : ""}>
          {value}
        </strong>
        {children}
        <span className="sor-metric-note">{note}</span>
      </span>
    </button>
  );
}
Metric.propTypes = {
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  note: PropTypes.string.isRequired,
  onClick: PropTypes.func,
  children: PropTypes.node,
};

export default function SalesOpportunityRegister({
  rows,
  loading,
  error,
  record,
  recordLoading,
  recordError,
  onRefresh,
  onSelect,
  onRetryRecord,
  onOpenFullRecord,
  onEdit,
  onCreate,
  onAction,
  actions,
  locked,
  explorer = false,
  explorerFolder = "",
  onOpenWorkspace,
  onCloseWorkspace,
}) {
  const currentUser = useSelector((state) => state.auth?.user);
  const currentUserId = currentUser?.user?.id ?? currentUser?.id;
  const [view, setCurrentView] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS, status: "" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sort, setSort] = useState("desc");
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [density, setDensity] = useState("comfortable");
  const [checked, setChecked] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [notice, setNotice] = useState("");
  const [showAllAttention, setShowAllAttention] = useState(false);
  const [viewName, setViewName] = useState("");
  const [savingView, setSavingView] = useState(false);
  const [savedViews, setSavedViews] = useState(() => {
    try {
      const views = JSON.parse(
        localStorage.getItem("radai.opportunity.views.v1") || "[]",
      );
      return Array.isArray(views)
        ? views
            .filter(
              (view) =>
                typeof view?.name === "string" &&
                view.filters &&
                typeof view.query === "string",
            )
            .slice(0, 10)
        : [];
    } catch {
      return [];
    }
  });
  const filter = (key, value) => {
    setCurrentView("custom");
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };
  const resetFilters = () => {
    setCurrentView("all");
    setFilters({ status: "", bid: "", service: "", owner: "", deadline: "" });
    setQuery("");
    setPage(1);
  };
  const setView = (view) => {
    setCurrentView(view);
    setFilters({
      ...DEFAULT_FILTERS,
      ...(view === "mine"
        ? {
            status: "",
            owner: currentUserId == null ? "" : String(currentUserId),
          }
        : view === "all"
          ? { status: "" }
          : view === "due"
            ? { deadline: "week" }
            : view === "decisions"
              ? { status: "qualified", bid: "pending" }
              : {}),
    });
    setQuery("");
    setPage(1);
  };
  const active = useMemo(
    () => rows.filter((row) => ACTIVE_STAGES.includes(row.stage)),
    [rows],
  );
  const due = active.filter((row) => {
    const days = deadlineInfo(row.submission_due_date).days;
    return days !== null && days >= 0 && days <= 7;
  }).length;
  const pending = active.filter(
    (row) => row.stage === "qualified" && row.bid_decision === "pending",
  ).length;
  const money = useMemo(() => pipelineTotals(active), [active]);
  const attention = useMemo(() => attentionItems(rows), [rows]);
  const filtered = useMemo(
    () =>
      filterOpportunities(
        view === "mine"
          ? rows.filter(
              (row) =>
                currentUserId != null &&
                String(row.owner) === String(currentUserId),
            )
          : rows,
        query,
        filters,
      ).sort(
        (left, right) =>
          (sort === "asc" ? 1 : -1) *
          String(left.deal_code || "").localeCompare(
            String(right.deal_code || ""),
            undefined,
            { numeric: true },
          ),
      ),
    [rows, query, filters, sort, view, currentUserId],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const ownerOptions = useMemo(
    () =>
      [
        ...new Map(
          rows
            .filter((row) => row.owner)
            .map((row) => [
              String(row.owner),
              row.owner_name || "Name not provided",
            ]),
        ).entries(),
      ].sort((left, right) => left[1].localeCompare(right[1])),
    [rows],
  );
  const serviceOptions = useMemo(
    () => [...new Set(rows.flatMap(services))].sort(),
    [rows],
  );
  const availableChecked = checked.filter((id) =>
    rows.some((row) => row.id === id),
  );
  const allChecked =
    pageRows.length > 0 &&
    pageRows.every((row) => availableChecked.includes(row.id));
  const summaryValue = (value) =>
    loading || (error && !rows.length) ? "—" : value;
  const visibleColumns = COLUMNS.filter(([key]) => columns.includes(key));

  useEffect(() => {
    if (!record && !loading && !error && filtered.length) onSelect(filtered[0]);
  }, [record, loading, error, filtered, onSelect]);

  const saveView = (event) => {
    event.preventDefault();
    if (!viewName.trim()) return;
    const next = [
      ...savedViews.filter((view) => view.name !== viewName.trim()),
      { name: viewName.trim(), query, filters },
    ].slice(-10);
    setSavedViews(next);
    setSavingView(false);
    setViewName("");
    try {
      localStorage.setItem("radai.opportunity.views.v1", JSON.stringify(next));
      setNotice("View saved in this browser.");
    } catch {
      setNotice("View saved for this session. Browser storage is unavailable.");
    }
  };
  const runExport = async (selected) => {
    const ids = selected ? availableChecked : filtered.map((row) => row.id);
    if (!ids.length || exporting) return;
    if (ids.length > 10000) {
      setExportError(
        "Export up to 10,000 opportunities at a time. Narrow the filters or select fewer records.",
      );
      return;
    }
    setExportError("");
    setNotice("");
    setExporting(true);
    try {
      const blob = await salesService.exportDeals(ids);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "opportunity-register.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice(
        `Exported ${ids.length} ${ids.length === 1 ? "opportunity" : "opportunities"}.`,
      );
    } catch (requestError) {
      let response = requestError?.response?.data;
      if (response instanceof Blob) {
        try {
          response = JSON.parse(await response.text());
        } catch {
          response = null;
        }
      }
      setExportError(
        response?.detail ||
          (Array.isArray(response?.ids) ? response.ids.join(" ") : "") ||
          (requestError?.response?.status === 403
            ? "You do not have permission to export these opportunities."
            : "The export could not be completed. Please try again."),
      );
    } finally {
      setExporting(false);
    }
  };
  const exportMenu = (
    <>
      <button
        type="button"
        disabled={loading || exporting || !filtered.length}
        onClick={() => runExport(false)}
      >
        Export current view ({filtered.length})
      </button>
      <button
        type="button"
        disabled={loading || exporting || !availableChecked.length}
        onClick={() => runExport(true)}
      >
        Export selected ({availableChecked.length})
      </button>
    </>
  );
  const chips = [
    filters.status && [
      "status",
      filters.status === "active"
        ? "Open opportunities"
        : statusLabel(filters.status),
    ],
    filters.bid && ["bid", `Go/No-Go: ${bidLabel(filters.bid)}`],
    filters.service && ["service", humanize(filters.service)],
    filters.owner && [
      "owner",
      filters.owner === "unassigned"
        ? "Unassigned"
        : ownerOptions.find(([id]) => id === filters.owner)?.[1] ||
          "Selected owner",
    ],
    filters.deadline && [
      "deadline",
      { week: "Due in 7 days", overdue: "Overdue", missing: "No deadline" }[
        filters.deadline
      ],
    ],
  ].filter(Boolean);
  const toggleChecked = (row) => {
    setChecked((current) =>
      current.includes(row.id)
        ? current.filter((id) => id !== row.id)
        : [...current, row.id],
    );
  };
  const truncated = (value, className = "") => (
    <span className={`sor-cell-text ${className}`} title={value}>
      {value}
    </span>
  );
  const cell = (row, key) => {
    if (key === "code")
      return (
        <button
          type="button"
          className="sor-code sor-cell-text"
          title={row.deal_code || "Not provided"}
          onClick={() => onSelect(row)}
        >
          {row.deal_code || "Not provided"}
        </button>
      );
    if (key === "title")
      return (
        <>
          <button
            type="button"
            className="sor-title-link sor-cell-text"
            title={row.deal_name || "Untitled opportunity"}
            onClick={() => onSelect(row)}
          >
            {row.deal_name || "Untitled opportunity"}
          </button>
          {truncated(row.client_name || "Client not provided", "sor-secondary")}
        </>
      );
    if (key === "type") return truncated(typeLabel(row.opportunity_type));
    if (key === "service") return truncated(serviceLine(row));
    if (key === "deadline") {
      const deadline = deadlineInfo(row.submission_due_date);
      const context = [displayDate(row.submission_due_date), deadline.label]
        .filter(Boolean)
        .join(" · ");
      return (
        <span
          className={`sor-cell-text sor-${deadline.tone}`}
          title={context}
          aria-label={context}
        >
          {displayDate(row.submission_due_date).replace(/ \d{4}$/, "")}
        </span>
      );
    }
    if (key === "owner")
      return (
        <span className="sor-owner">
          <span
            className={`sor-avatar ${!row.owner ? "sor-avatar-empty" : ""}`}
          >
            {row.owner ? initials(row.owner_name) : "—"}
          </span>
          {truncated(row.owner_name || "Unassigned")}
        </span>
      );
    if (key === "value")
      return (
        <span
          className="sor-cell-text"
          title={
            row.estimated_value == null
              ? "Not provided"
              : `${row.currency || "Currency not provided"} ${row.estimated_value}`
          }
        >
          {compactMoney(row.estimated_value, row.currency)}
        </span>
      );
    if (key === "probability")
      return truncated(
        row.probability === null || row.probability === undefined
          ? "Not provided"
          : `${row.probability}%`,
      );
    if (key === "status")
      return (
        <span className={`sor-status sor-status--${row.stage}`}>
          {truncated(statusLabel(row.stage))}
        </span>
      );
    if (key === "bid")
      return (
        <span className={`sor-bid sor-bid-${row.bid_decision || "none"}`}>
          {row.bid_decision === "bid" ? (
            <CheckCircle2 size={16} />
          ) : row.bid_decision === "pending" ? (
            <Hourglass size={15} />
          ) : (
            <Info size={15} />
          )}
          {truncated(bidLabel(row.bid_decision))}
        </span>
      );
    return truncated(row.next_action || "Not provided");
  };

  return (
    <div
      className={`sor-workspace ${explorer ? "sor-workspace-explorer" : ""}`}
    >
      <header className="sor-header">
        <div>
          <h1>Opportunity Register</h1>
        </div>
        <div className="sor-header-actions">
          <button
            type="button"
            className="sor-button"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? "sor-spin" : ""} />
            Refresh
          </button>
          <Menu label={exporting ? "Exporting…" : "Export"} icon={Download}>
            {exportMenu}
          </Menu>
          <Menu label="More" icon={MoreHorizontal}>
            <button
              type="button"
              onClick={() => setSummaryOpen((value) => !value)}
            >
              {summaryOpen ? "Hide register summary" : "Show register summary"}
            </button>
            <button
              type="button"
              onClick={() => {
                setColumns(DEFAULT_COLUMNS);
                setDensity("comfortable");
                setPageSize(25);
              }}
            >
              Reset table layout
            </button>
            <button
              type="button"
              onClick={() => setChecked([])}
              disabled={!availableChecked.length}
            >
              Clear selection
            </button>
            <button type="button" onClick={resetFilters}>
              Show all opportunities
            </button>
          </Menu>
          <button
            type="button"
            className="sor-button sor-create"
            onClick={onCreate}
          >
            <Plus size={17} />
            New opportunity
          </button>
        </div>
      </header>
      {(error || exportError) && (
        <div role="alert" className="sor-alert">
          <AlertCircle size={17} />
          <span>{error || exportError}</span>
          <button
            type="button"
            onClick={error ? onRefresh : () => setExportError("")}
          >
            {error ? "Retry" : "Dismiss"}
          </button>
        </div>
      )}
      {notice && (
        <div role="status" className="sor-notice">
          <Check size={15} />
          {notice}
          <button
            type="button"
            aria-label="Dismiss message"
            onClick={() => setNotice("")}
          >
            <X size={14} />
          </button>
        </div>
      )}
      <div className="sor-main">
        {summaryOpen && (
          <div className="sor-summary-panel">
            <section className="sor-metrics" aria-label="Opportunity summary">
              <Metric
                icon={FileText}
                label="Open opportunities"
                value={summaryValue(active.length)}
                note="Across all service lines"
                onClick={() => setView("open")}
              />
              <Metric
                icon={CalendarDays}
                label="Submission due in 7 days"
                value={summaryValue(due)}
                note="Across open opportunities"
                onClick={() => setView("due")}
              />
              <Metric
                icon={Hourglass}
                label="Pending Go/No-Go"
                value={summaryValue(pending)}
                note="Requiring decision"
                onClick={() => setView("decisions")}
              />
              <Metric
                icon={BarChart3}
                label="Weighted pipeline"
                value={summaryValue(
                  money.totals.length
                    ? compactMoney(
                        money.totals[0].value,
                        money.totals[0].currency,
                      )
                    : "Not provided",
                )}
                note={
                  money.missing
                    ? `Known values · ${money.missing} missing value or currency`
                    : money.totals.length > 1
                      ? "By currency · no exchange rate applied"
                      : "Based on current probability"
                }
              >
                {!loading &&
                  money.totals.slice(1).map((total) => (
                    <span className="sor-metric-extra" key={total.currency}>
                      {compactMoney(total.value, total.currency)}
                    </span>
                  ))}
              </Metric>
            </section>
            <section
              className={`sor-attention ${!attention.length ? "sor-attention-clear" : ""}`}
              aria-label="Requires attention"
            >
              <div className="sor-attention-heading">
                <AlertCircle size={17} />
                <strong>
                  Requires attention ({loading ? "…" : attention.length})
                </strong>
                {attention.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setShowAllAttention((value) => !value)}
                  >
                    {showAllAttention ? "Show less" : "Show all"}
                  </button>
                )}
              </div>
              <div className="sor-attention-items">
                {loading ? (
                  <p className="sor-empty-attention">Checking opportunities…</p>
                ) : !attention.length ? (
                  <p className="sor-empty-attention">
                    {error
                      ? "Attention checks are unavailable until the register loads."
                      : "No overdue submissions, urgent deadlines or missing owners."}
                  </p>
                ) : (
                  attention
                    .slice(0, showAllAttention ? undefined : 3)
                    .map((item) => (
                      <article key={`${item.row.id}-${item.kind}`}>
                        <AlertCircle size={19} className={`sor-${item.tone}`} />
                        <div>
                          <strong>{item.title}</strong>
                          <span>
                            {item.row.deal_code} · {item.row.deal_name}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="sor-button"
                          onClick={() => onSelect(item.row)}
                        >
                          View record
                        </button>
                      </article>
                    ))
                )}
              </div>
            </section>
          </div>
        )}
        <section
          className={`sor-table-card sor-density-${density} ${columns.length <= 4 ? "sor-essential-columns" : ""}`}
          aria-label="Opportunity register"
        >
          <div
            className="sor-list-tabs"
            role="group"
            aria-label="Opportunity views"
          >
            {[
              ["all", "All opportunities"],
              ["mine", "My opportunities"],
              ["due", "Due soon"],
            ].map(([key, name]) => (
              <button
                key={key}
                type="button"
                aria-pressed={view === key}
                disabled={key === "mine" && currentUserId == null}
                onClick={() => setView(key)}
              >
                {name}
              </button>
            ))}
          </div>
          <div
            className="sor-toolbar"
            role="group"
            aria-label="Opportunity table toolbar"
          >
            <div className="sor-toolbar-controls">
              <label className="sor-search">
                <Search size={16} />
                <input
                  aria-label="Search opportunities"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search VF code, title or client"
                />
              </label>
              <button
                type="button"
                className="sor-button sor-filter-toggle"
                aria-label="Filters and table settings"
                aria-expanded={filtersOpen}
                onClick={() => setFiltersOpen((value) => !value)}
              >
                <ListFilter size={17} />
              </button>
              <span className="sor-results-count">
                {loading ? "Loading..." : `${filtered.length} opportunities`}
              </span>
              <div
                className={`sor-filter-drawer ${filtersOpen ? "sor-filter-drawer-open" : ""}`}
              >
                <div className="sor-filters">
                  <select
                    aria-label="Status"
                    value={filters.status}
                    onChange={(event) => filter("status", event.target.value)}
                  >
                    <option value="">Status</option>
                    <option value="active">Open opportunities</option>
                    {Object.entries(STATUS_LABELS).map(([value, name]) => (
                      <option key={value} value={value}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Go/No-Go"
                    value={filters.bid}
                    onChange={(event) => filter("bid", event.target.value)}
                  >
                    <option value="">Go/No-Go</option>
                    {Object.entries(BID_LABELS).map(([value, name]) => (
                      <option key={value} value={value}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Service line"
                    value={filters.service}
                    onChange={(event) => filter("service", event.target.value)}
                  >
                    <option value="">Service</option>
                    {serviceOptions.map((value) => (
                      <option key={value} value={value}>
                        {humanize(value)}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Owner"
                    value={filters.owner}
                    onChange={(event) => filter("owner", event.target.value)}
                  >
                    <option value="">Owner</option>
                    <option value="unassigned">Unassigned</option>
                    {ownerOptions.map(([value, name]) => (
                      <option key={value} value={value}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Deadline"
                    value={filters.deadline}
                    onChange={(event) => filter("deadline", event.target.value)}
                  >
                    <option value="">Deadline</option>
                    <option value="week">Due in 7 days</option>
                    <option value="overdue">Overdue</option>
                    <option value="missing">No deadline</option>
                  </select>
                  <Menu label="Saved View" className="sor-saved-view-menu">
                    {VIEWS.map(([value, name]) => (
                      <button
                        type="button"
                        key={value}
                        onClick={() => setView(value)}
                      >
                        {name}
                      </button>
                    ))}
                    {savedViews.map((view) => (
                      <button
                        type="button"
                        key={`saved-${view.name}`}
                        onClick={() => {
                          setCurrentView("custom");
                          setFilters({ ...DEFAULT_FILTERS, ...view.filters });
                          setQuery(view.query);
                          setPage(1);
                        }}
                      >
                        {view.name}
                      </button>
                    ))}
                    <button type="button" onClick={() => setSavingView(true)}>
                      <Plus size={14} />
                      Save current view
                    </button>
                  </Menu>
                </div>
                <div className="sor-table-tools">
                  <Menu label="Columns" icon={Columns}>
                    {COLUMNS.map(([key, name]) => (
                      <label key={key}>
                        <input
                          type="checkbox"
                          checked={columns.includes(key)}
                          disabled={key === "code"}
                          onChange={(event) =>
                            setColumns((current) =>
                              event.target.checked
                                ? [...current, key]
                                : current.filter((value) => value !== key),
                            )
                          }
                        />
                        {name}
                      </label>
                    ))}
                  </Menu>
                  <Menu label="Density" icon={SlidersHorizontal}>
                    {["comfortable", "compact"].map((value) => (
                      <button
                        type="button"
                        aria-pressed={density === value}
                        onClick={() => setDensity(value)}
                        key={value}
                      >
                        {density === value && <Check size={14} />}
                        {humanize(value)}
                      </button>
                    ))}
                  </Menu>
                  <Menu label="Export" icon={Download}>
                    {exportMenu}
                  </Menu>
                </div>
              </div>
            </div>
            {savingView && (
              <form className="sor-save-view" onSubmit={saveView}>
                <input
                  autoFocus
                  aria-label="View name"
                  value={viewName}
                  maxLength={50}
                  onChange={(event) => setViewName(event.target.value)}
                  placeholder="Name this view"
                  required
                />
                <button type="submit" className="sor-button">
                  Save view
                </button>
                <button
                  type="button"
                  aria-label="Cancel saved view"
                  onClick={() => setSavingView(false)}
                >
                  <X size={16} />
                </button>
              </form>
            )}
            <div
              className={`sor-chips ${!chips.length && !query && !availableChecked.length ? "sor-chips-empty" : ""}`}
            >
              {chips.map(([key, name]) => (
                <button
                  type="button"
                  className="sor-chip"
                  key={key}
                  onClick={() => filter(key, "")}
                  aria-label={`Remove ${name} filter`}
                >
                  {name}
                  <X size={12} />
                </button>
              ))}
              {(chips.length > 0 || query) && (
                <button
                  type="button"
                  className="sor-clear"
                  onClick={resetFilters}
                >
                  Clear
                </button>
              )}
              {availableChecked.length > 0 && (
                <span className="sor-selection-count">
                  {availableChecked.length} selected
                </span>
              )}
            </div>
          </div>
          <div
            className="sor-table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Opportunity table"
            aria-busy={loading}
          >
            <table data-table-typography="preserve">
              <thead>
                <tr>
                  <th className="sor-select-cell">
                    <input
                      type="checkbox"
                      aria-label="Select all on this page"
                      checked={allChecked}
                      disabled={!pageRows.length || loading}
                      onChange={() =>
                        setChecked((current) =>
                          allChecked
                            ? current.filter(
                                (id) => !pageRows.some((row) => row.id === id),
                              )
                            : [
                                ...new Set([
                                  ...current,
                                  ...pageRows.map((row) => row.id),
                                ]),
                              ],
                        )
                      }
                    />
                  </th>
                  {visibleColumns.map(([key, name]) => (
                    <th
                      key={key}
                      className={`sor-col-${key}`}
                      aria-sort={
                        key === "code"
                          ? sort === "asc"
                            ? "ascending"
                            : "descending"
                          : undefined
                      }
                    >
                      {key === "code" ? (
                        <button
                          type="button"
                          onClick={() =>
                            setSort((value) =>
                              value === "asc" ? "desc" : "asc",
                            )
                          }
                        >
                          {name}
                          {sort === "asc" ? (
                            <ArrowUp size={12} />
                          ) : (
                            <ArrowDown size={12} />
                          )}
                        </button>
                      ) : (
                        name
                      )}
                    </th>
                  ))}
                  <th className="sor-actions-cell">Actions</th>
                </tr>
              </thead>
              <tbody>
                {!loading &&
                  pageRows.map((row) => (
                    <tr
                      key={row.id}
                      className={
                        record?.id === row.id ? "sor-selected-row" : ""
                      }
                      aria-selected={record?.id === row.id}
                      onDoubleClick={() => onOpenWorkspace?.(row)}
                      onClick={(event) => {
                        if (!event.target.closest("button,input,a"))
                          onSelect(row);
                      }}
                    >
                      <td className="sor-select-cell">
                        <input
                          type="checkbox"
                          aria-label={`Select ${row.deal_code}`}
                          checked={availableChecked.includes(row.id)}
                          onChange={() => toggleChecked(row)}
                        />
                      </td>
                      {visibleColumns.map(([key]) => (
                        <td className={`sor-col-${key}`} key={key}>
                          {cell(row, key)}
                        </td>
                      ))}
                      <td className="sor-actions-cell">
                        <button
                          type="button"
                          className="sor-row-action"
                          aria-label="View"
                          title={`Open full record ${row.deal_code}`}
                          onClick={() => onOpenFullRecord(row)}
                        >
                          <MoreHorizontal size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                {(loading || !pageRows.length) && (
                  <tr>
                    <td colSpan={visibleColumns.length + 2}>
                      <div className="sor-table-empty">
                        {loading ? (
                          <RefreshCw size={26} className="sor-spin" />
                        ) : (
                          <ListFilter size={28} />
                        )}
                        <strong>
                          {loading
                            ? "Loading opportunities…"
                            : error
                              ? "Opportunities could not be loaded"
                              : rows.length
                                ? "No opportunities match this view"
                                : "Start your opportunity register"}
                        </strong>
                        <p>
                          {loading
                            ? "Preparing the complete register."
                            : error
                              ? "Retry to load the register."
                              : rows.length
                                ? "Try another search or clear the filters."
                                : "Register an opportunity or create one from Email Intake."}
                        </p>
                        {!loading &&
                          (error ? (
                            <button
                              type="button"
                              className="sor-button"
                              onClick={onRefresh}
                            >
                              Retry loading
                            </button>
                          ) : rows.length > 0 ? (
                            <button
                              type="button"
                              className="sor-button"
                              onClick={resetFilters}
                            >
                              Clear filters
                            </button>
                          ) : null)}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <footer className="sor-pagination">
            <strong>
              {filtered.length
                ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filtered.length)} of ${filtered.length}`
                : "0 opportunities"}
            </strong>
            <div>
              <label>
                Rows per page
                <select
                  aria-label="Rows per page"
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setPage(1);
                  }}
                >
                  {[10, 25, 50, 100].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="sor-page-arrow"
                aria-label="Previous page"
                onClick={() => setPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from(
                { length: Math.min(3, totalPages) },
                (_, index) =>
                  Math.min(
                    Math.max(currentPage - 1, 1),
                    Math.max(totalPages - 2, 1),
                  ) + index,
              ).map((value) => (
                <button
                  className={value === currentPage ? "sor-page-current" : ""}
                  type="button"
                  key={value}
                  aria-label={`Page ${value}`}
                  aria-current={value === currentPage ? "page" : undefined}
                  onClick={() => setPage(value)}
                >
                  {value}
                </button>
              ))}
              <button
                type="button"
                className="sor-page-arrow"
                aria-label="Next page"
                onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </footer>
        </section>
      </div>
      <SalesOpportunityDetailPanel
        record={record}
        loading={recordLoading}
        error={recordError}
        onRetry={onRetryRecord}
        onOpenFullRecord={() => onOpenFullRecord(record)}
        onEdit={onEdit}
        onAction={onAction}
        actions={actions}
        locked={locked}
        explorer={explorer}
        explorerFolder={explorerFolder}
        onOpenWorkspace={(folder) => onOpenWorkspace?.(record, folder)}
        onCloseWorkspace={onCloseWorkspace}
      />
    </div>
  );
}

SalesOpportunityRegister.propTypes = {
  explorer: PropTypes.bool,
  explorerFolder: PropTypes.string,
  onOpenWorkspace: PropTypes.func,
  onCloseWorkspace: PropTypes.func,
  rows: PropTypes.array.isRequired,
  loading: PropTypes.bool.isRequired,
  error: PropTypes.string,
  record: PropTypes.object,
  recordLoading: PropTypes.bool.isRequired,
  recordError: PropTypes.string,
  onRefresh: PropTypes.func.isRequired,
  onSelect: PropTypes.func.isRequired,
  onRetryRecord: PropTypes.func.isRequired,
  onOpenFullRecord: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  onCreate: PropTypes.func.isRequired,
  onAction: PropTypes.func.isRequired,
  actions: PropTypes.array.isRequired,
  locked: PropTypes.bool.isRequired,
};
