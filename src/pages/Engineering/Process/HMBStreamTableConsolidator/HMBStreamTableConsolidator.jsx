/* eslint-disable react/prop-types */
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  AlertTriangle,
  ArrowDownUp,
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  Maximize2,
  MoreHorizontal,
  PencilLine,
  Plus,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Table2,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "react-toastify";
import apiClient from "../../../../services/api.service";
import ProjectFormModal from "../../../../components/ProjectOrganizer/ProjectFormModal";
import { PROJECT_ORGANIZER_CONFIG } from "../../../../config/projectOrganizer.config";
import { createProject as createOrganizerProject } from "../../../../services/projectOrganizerService";
import {
  buildComparison,
  buildTemplateComparisonRows,
  resolveTemplateProperty,
  convertTemplateEditValue,
  buildGoverningCaseColumns,
  getGoverningCaseValue,
  formatValue,
  rowVaries,
} from "./compare.ts";
import { useCases } from "./useCases";
import { MASTER_REVIEW_ROWS } from "./template.ts";
import useRadaiChatPage from "../../../../hooks/useRadaiChatPage";
import "./HMBStreamTableConsolidator.css";

const PROJECT_STORAGE_KEY = "hmbExtractorActiveProject";
const CONSOLIDATOR_ARCHIVE_ENDPOINT =
  "/process-datasheet/datasheets/hmb-stream-consolidator/archive/";
const CONSOLIDATOR_ARCHIVE_DOWNLOAD_BASE =
  "/process-datasheet/datasheets/hmb-stream-consolidator/archive";

const PROJECT_MODAL_THEME = {
  ...PROJECT_ORGANIZER_CONFIG.defaultTheme,
  accent: "#175cd3",
  accentAlt: "#124baa",
  accentSoft: "rgba(23,92,211,0.08)",
  accentBorder: "rgba(23,92,211,0.24)",
};

function readActiveProjectId() {
  try {
    const raw = localStorage.getItem(PROJECT_STORAGE_KEY);
    if (!raw) return "";
    const parsed = JSON.parse(raw);
    return String(parsed?.project_id || "").trim();
  } catch {
    return "";
  }
}

function saveActiveProject(project) {
  if (!project || !project.project_id) return;
  localStorage.setItem(
    PROJECT_STORAGE_KEY,
    JSON.stringify({
      project_id: project.project_id,
      name: project.name || "",
      code: project.code || "",
      plant: project.plant || "",
      client: project.client || "",
      discipline: project.discipline || "",
    }),
  );
}

function isNotFoundResponse(error) {
  return Number(error?.response?.status) === 404;
}

function isMissingProjectResponse(error) {
  const data = error?.response?.data;
  return isNotFoundResponse(error) && (
    data?.code === "project_not_found" || data?.error === "Project not found."
  );
}

async function getArchiveHistory(projectId) {
  try {
    return await apiClient.get(CONSOLIDATOR_ARCHIVE_ENDPOINT, {
      params: projectId ? { project_id: projectId } : undefined,
      suppressErrorToast: true,
    });
  } catch (error) {
    // A deleted or stale active-project ID should not hide workbooks that the
    // backend can still safely return for the authenticated uploader.
    if (!projectId || !isMissingProjectResponse(error)) throw error;
    return apiClient.get(CONSOLIDATOR_ARCHIVE_ENDPOINT);
  }
}

async function postArchiveWorkbook(formData) {
  return apiClient.post(CONSOLIDATOR_ARCHIVE_ENDPOINT, formData, {
    suppressErrorToast: true,
  });
}

function normalizeProjectId(value) {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") {
    if (typeof value.project_id === "string") return value.project_id.trim();
    // Protect against React click events being passed as first arg.
    if ("nativeEvent" in value || "currentTarget" in value || "target" in value)
      return "";
  }
  return "";
}

function formatArchiveDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function formatBytes(sizeBytes) {
  const value = Number(sizeBytes);
  if (!Number.isFinite(value) || value <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let unit = 0;
  let scaled = value;
  while (scaled >= 1024 && unit < units.length - 1) {
    scaled /= 1024;
    unit += 1;
  }
  return `${scaled.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

const ACCEPTED_FILES = ".xlsx,.xlsm,.xls,.csv";

const MAX_RATE_COLUMNS = [
  {
    kind: "liquid",
    label: "Max Liquid",
    hint: "Values copied from the case with the highest Light Liquid Act Flow for this stream",
  },
  {
    kind: "gas",
    label: "Max Gas",
    hint: "Values copied from the case with the highest Std Ideal Gas Vol Flow (or Standard Gas Flow) for this stream",
  },
  {
    kind: "water",
    label: "Max Water",
    hint: "Values copied from the case with the highest Heavy Liquid Flow for this stream",
  },
];

function Dropzone({
  importing,
  onImport,
  compact = false,
  pickerRef: externalPickerRef,
}) {
  const inputRef = useRef(null);
  const activeInputRef = externalPickerRef || inputRef;
  const [dragging, setDragging] = useState(false);

  const openPicker = () => {
    if (!importing) activeInputRef.current?.click();
  };

  return (
    <div
      className={`hmbc-dropzone${compact ? " is-compact" : ""}${dragging ? " is-dragging" : ""}${importing ? " is-busy" : ""}`}
      role="button"
      tabIndex={0}
      aria-label="Choose HMB case workbooks"
      onClick={openPicker}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openPicker();
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (!importing) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (!importing && event.dataTransfer.files.length)
          onImport(event.dataTransfer.files);
      }}
    >
      <input
        ref={activeInputRef}
        type="file"
        multiple
        accept={ACCEPTED_FILES}
        tabIndex={-1}
        onChange={(event) => {
          if (event.target.files?.length) onImport(event.target.files);
          event.target.value = "";
        }}
      />
      <UploadCloud aria-hidden="true" />
      <div>
        <strong>
          {importing
            ? "Parsing workbooks…"
            : compact
              ? "Drop files or browse"
              : "Drop HMB workbooks here"}
        </strong>
        <span>
          {compact
            ? "XLSX · XLSM · XLS · CSV"
            : "or select files — one workbook per case"}
        </span>
      </div>
    </div>
  );
}

function CasePanel({
  cases,
  activeCaseId,
  importing,
  onSelect,
  onRemove,
  onRename,
  onImport,
  onDemo,
}) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const pickerRef = useRef(null);
  const visibleCases = cases.filter((item) =>
    String(item.name || "")
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );

  return (
    <aside className="hmbc-case-panel" aria-label="Imported cases">
      <div className="hmbc-case-panel-title">
        <span>Cases</span>
        <div>
          <strong>{cases.length}</strong>
          <button
            type="button"
            className="hmbc-add-case"
            onClick={() => pickerRef.current?.click()}
            aria-label="Add case workbooks"
          >
            <Plus /> Add
          </button>
        </div>
      </div>
      <Dropzone
        importing={importing}
        onImport={onImport}
        compact
        pickerRef={pickerRef}
      />
      <label className="hmbc-case-search">
        <Search />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search cases..."
        />
      </label>
      <div className="hmbc-case-list">
        {visibleCases.map((item) => {
          const valueCount = item.streams.reduce(
            (total, stream) =>
              total +
              stream.properties.filter((property) => property.value !== null)
                .length,
            0,
          );
          const active = item.id === activeCaseId;
          const metadata = (
            <>
              <span>
                <FileSpreadsheet aria-hidden="true" /> {item.fileName}
              </span>
              <small>
                {item.streams.filter((stream) => stream.included).length}/
                {item.streams.length} streams · {valueCount.toLocaleString()}{" "}
                values
              </small>
            </>
          );
          return (
            <div
              className={`hmbc-case-card${active ? " is-active" : ""}`}
              key={item.id}
            >
              {editingId === item.id ? (
                <div className="hmbc-case-select is-editing">
                  <span
                    className="hmbc-case-dot"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="hmbc-case-copy">
                    <input
                      autoFocus
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onBlur={() => {
                        if (draft.trim()) onRename(item.id, draft.trim());
                        setEditingId(null);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") event.currentTarget.blur();
                        if (event.key === "Escape") setEditingId(null);
                      }}
                    />
                    {metadata}
                  </span>
                </div>
              ) : (
                <button
                  className="hmbc-case-select"
                  type="button"
                  onClick={() => onSelect(item.id)}
                  aria-pressed={active}
                >
                  <span
                    className="hmbc-case-dot"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="hmbc-case-copy">
                    <strong
                      title="Double-click to rename"
                      onDoubleClick={(event) => {
                        event.stopPropagation();
                        setEditingId(item.id);
                        setDraft(item.name);
                      }}
                    >
                      {item.name}
                    </strong>
                    {metadata}
                  </span>
                </button>
              )}
              <button
                className="hmbc-remove-case"
                type="button"
                onClick={() => onRemove(item.id)}
                aria-label={`Remove ${item.name}`}
              >
                <Trash2 />
              </button>
            </div>
          );
        })}
      </div>
      <button className="hmbc-load-demo" type="button" onClick={onDemo}>
        <Database /> Load demo cases
      </button>
      <div className="hmbc-privacy-note">
        <ShieldCheck aria-hidden="true" />
        <span>
          Source files: session only <i aria-label="Information">ⓘ</i>
        </span>
      </div>
    </aside>
  );
}

function CellEditor({ value, edited, onCommit, blankNull = false }) {
  const [editing, setEditing] = useState(false);
  if (!editing) {
    return (
      <button
        className={`hmbc-cell-value${edited ? " is-edited" : ""}`}
        type="button"
        onClick={() => setEditing(true)}
        title="Edit extracted value"
      >
        {blankNull && value === null ? "" : formatValue(value)}
      </button>
    );
  }
  return (
    <input
      className="hmbc-cell-editor"
      autoFocus
      defaultValue={value === null ? "" : String(value)}
      aria-label="Edit extracted value"
      onFocus={(event) => event.currentTarget.select()}
      onBlur={(event) => {
        const original = value === null ? "" : String(value);
        if (event.currentTarget.value.trim() !== original)
          onCommit(event.currentTarget.value);
        setEditing(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") setEditing(false);
      }}
    />
  );
}

function ReviewView({ caseData, onToggleStream, onSetCell }) {
  const [query, setQuery] = useState("");
  const [showUnits, setShowUnits] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const properties = MASTER_REVIEW_ROWS;
  const normalizedQuery = query.trim().toLowerCase();
  const visibleProperties = properties;
  const visibleStreams = caseData.streams.filter((stream) =>
    stream.name.toLowerCase().includes(normalizedQuery),
  );
  const sectionRowSpans = new Map();
  for (const row of visibleProperties)
    sectionRowSpans.set(
      row.section,
      (sectionRowSpans.get(row.section) || 0) + 1,
    );

  return (
    <section
      className={`hmbc-view${expanded ? " is-expanded" : ""}`}
      aria-labelledby="hmbc-review-title"
    >
      <div className="hmbc-review-toolbar">
        <strong>Review extracted values</strong>
        <label className="hmbc-sheet-select">
          <span>Sheets</span>
          <select
            value={
              caseData.sheetNames?.join(", ") || caseData.sheetName || "Streams"
            }
            onChange={() => {}}
            aria-label="Workbook sheets"
          >
            <option>
              {caseData.sheetNames?.join(", ") ||
                caseData.sheetName ||
                "Streams"}
            </option>
          </select>
        </label>
        <label className="hmbc-review-search">
          <Search />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search streams..."
          />
        </label>
        <label className="hmbc-units-select">
          <span>Units</span>
          <select value="source" onChange={() => {}} aria-label="Units">
            <option value="source">Source</option>
          </select>
        </label>
        <button
          className="hmbc-columns-button"
          type="button"
          aria-pressed={showUnits}
          onClick={() => setShowUnits((value) => !value)}
        >
          <Table2 /> Columns
        </button>
        <button
          className="hmbc-expand-button"
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-label={expanded ? "Exit expanded table" : "Expand table"}
        >
          <Maximize2 />
        </button>
      </div>
      <div className="hmbc-view-heading">
        <div>
          <h2 id="hmbc-review-title">{caseData.name}</h2>
          <p>
            Sheets “{caseData.sheetNames?.join(", ") || caseData.sheetName}” ·{" "}
            {caseData.streams.filter((stream) => stream.included).length} of{" "}
            {caseData.streams.length} streams included
          </p>
        </div>
        <span>
          <PencilLine aria-hidden="true" /> Select any value to add a reviewed
          override.
        </span>
      </div>
      <div
        className="hmbc-table-scroll"
        role="region"
        aria-label={`Extracted values for ${caseData.name}`}
        tabIndex={0}
      >
        <table className="hmbc-table hmbc-review-table">
          <thead>
            <tr>
              <th className="hmbc-case-template-title" colSpan={2} rowSpan={2}>
                {caseData.templateTitle || caseData.name}
              </th>
              <th>Stream</th>
              {visibleStreams.map((stream) => (
                <th className="hmbc-stream-id" key={stream.name}>
                  <label className="hmbc-stream-toggle">
                    <span className={!stream.included ? "is-disabled" : ""}>
                      {stream.name}
                    </span>
                    <input
                      type="checkbox"
                      checked={stream.included}
                      onChange={() => onToggleStream(stream.name)}
                    />
                  </label>
                </th>
              ))}
            </tr>
            <tr>
              <th>Description</th>
              {visibleStreams.map((stream) => (
                <th className="hmbc-stream-description" key={stream.name}>
                  {stream.description || "—"}
                </th>
              ))}
            </tr>
            <tr>
              <th className="hmbc-phase-heading" rowSpan={2}>
                Phase
              </th>
              <th className="hmbc-property-heading" rowSpan={2}>
                Property
              </th>
              <th className="hmbc-unit-heading">&nbsp;</th>
              {visibleStreams.map((stream) => (
                <th className="hmbc-template-spacer-cell" key={stream.name} />
              ))}
            </tr>
            <tr>
              <th className="hmbc-unit-heading">
                PFD No.
                <br />
                Unit
              </th>
              {visibleStreams.map((stream) => (
                <th className="hmbc-pfd-number" key={stream.name}>
                  {stream.pfdNo || "—"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="hmbc-template-row-spacer">
              <td colSpan={visibleStreams.length + 3} />
            </tr>
            {visibleProperties.map((row, rowIndex) => {
              const firstInSection =
                rowIndex === 0 ||
                visibleProperties[rowIndex - 1].section !== row.section;
              const sectionDivider = false;
              return (
                <tr
                  key={`${row.section}-${row.name}-${row.unit}-${rowIndex}`}
                  className={`${firstInSection && rowIndex > 0 ? "hmbc-section-start" : ""}${sectionDivider ? " hmbc-composition-divider" : ""}`}
                >
                  {firstInSection && (
                    <th
                      className="hmbc-phase-cell"
                      rowSpan={sectionRowSpans.get(row.section)}
                      scope="rowgroup"
                    >
                      {row.section === "__template-divider__"
                        ? ""
                        : row.section}
                    </th>
                  )}
                  <th className="hmbc-property-cell" scope="row">
                    {row.name}
                  </th>
                  <td className="hmbc-unit">
                    {showUnits && !sectionDivider ? row.unit || "—" : ""}
                  </td>
                  {visibleStreams.map((stream) => {
                    const resolved = resolveTemplateProperty(stream, row);
                    const property = resolved?.property;
                    return (
                      <td className="hmbc-review-value" key={stream.name}>
                        {property ? (
                          stream.included ? (
                            <CellEditor
                              value={resolved.value}
                              edited={property.edited}
                              blankNull
                              onCommit={(raw) =>
                                onSetCell(
                                  stream.name,
                                  property.name,
                                  convertTemplateEditValue(raw, row.unit, property.unit),
                                  property.section || "",
                                  property.unit || "",
                                )
                              }
                            />
                          ) : (
                            <span className="hmbc-excluded-value">
                              {resolved.value === null
                                ? ""
                                : formatValue(resolved.value)}
                            </span>
                          )
                        ) : (
                          <span className="hmbc-missing-value">&nbsp;</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="hmbc-review-footer">
        <span>
          {caseData.streams.filter((stream) => stream.included).length} /{" "}
          {caseData.streams.length} streams <i />{" "}
          {caseData.streams.reduce(
            (total, stream) =>
              total +
              stream.properties.filter((property) => property.edited).length,
            0,
          )}{" "}
          reviewed cells
        </span>
        <span>
          <ShieldCheck /> Source files: session only
        </span>
      </div>
    </section>
  );
}

function ComparisonView({ cases }) {
  const [query, setQuery] = useState("");
  const [firstColumnFilter, setFirstColumnFilter] = useState("all");
  const [highlight, setHighlight] = useState(true);
  const [differencesOnly, setDifferencesOnly] = useState(false);
  const [limit, setLimit] = useState(1500);
  const scrollRef = useRef(null);
  const sentinelRef = useRef(null);
  const comparison = useMemo(() => {
    const base = buildComparison(cases);
    return {
      ...base,
      rows: buildTemplateComparisonRows(cases, MASTER_REVIEW_ROWS),
    };
  }, [cases]);
  const governingColumns = useMemo(
    () => buildGoverningCaseColumns(cases),
    [cases],
  );
  const caseIds = useMemo(() => cases.map((item) => item.id), [cases]);
  const propertyNames = useMemo(
    () =>
      [...new Set(comparison.rows.map((row) => row.propertyName))].sort(
        (left, right) =>
          left.localeCompare(right, undefined, { numeric: true }),
      ),
    [comparison.rows],
  );
  const varyingCount = useMemo(
    () => comparison.rows.filter((row) => rowVaries(row, caseIds)).length,
    [comparison.rows, caseIds],
  );
  const visibleRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return comparison.rows.filter((row) => {
      if (differencesOnly && !rowVaries(row, caseIds)) return false;
      if (
        firstColumnFilter.startsWith("stream:") &&
        row.streamName !== firstColumnFilter.slice(7)
      )
        return false;
      if (
        firstColumnFilter.startsWith("property:") &&
        row.propertyName !== firstColumnFilter.slice(9)
      )
        return false;
      return (
        !normalized ||
        row.streamName.toLowerCase().includes(normalized) ||
        row.propertyName.toLowerCase().includes(normalized)
      );
    });
  }, [comparison.rows, differencesOnly, caseIds, firstColumnFilter, query]);

  useEffect(() => setLimit(1500), [visibleRows]);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined")
      return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting)
          setLimit((current) => Math.min(current + 1500, visibleRows.length));
      },
      { root: scrollRef.current, rootMargin: "1200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [visibleRows.length]);

  const shownRows = visibleRows.slice(0, limit);
  return (
    <section
      className="hmbc-view hmbc-comparison-view"
      aria-labelledby="hmbc-comparison-title"
    >
      <div className="hmbc-comparison-toolbar">
        <div>
          <h2 id="hmbc-comparison-title">Cross-case comparison</h2>
          <p>
            {comparison.streamNames.length.toLocaleString()} streams ·{" "}
            {comparison.rows.length.toLocaleString()} rows · {cases.length}{" "}
            cases
          </p>
        </div>
        <label className="hmbc-search">
          <Search aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter stream or property"
          />
        </label>
        <label className="hmbc-check">
          <input
            type="checkbox"
            checked={highlight}
            onChange={(event) => setHighlight(event.target.checked)}
          />
          Highlight variation <span>{varyingCount.toLocaleString()}</span>
        </label>
        <label className="hmbc-check">
          <input
            type="checkbox"
            checked={differencesOnly}
            onChange={(event) => setDifferencesOnly(event.target.checked)}
          />
          <ArrowDownUp aria-hidden="true" />
          Differences only
        </label>
      </div>
      <div
        ref={scrollRef}
        className="hmbc-table-scroll is-comparison"
        role="region"
        aria-label="Cross-case comparison matrix"
        tabIndex={0}
      >
        <table className="hmbc-table hmbc-comparison-table">
          <thead>
            <tr>
              <th className="is-sticky" colSpan={2}>
                <label className="hmbc-column-filter">
                  <span>Stream / property</span>
                  <select
                    aria-label="Filter by stream or property"
                    value={firstColumnFilter}
                    onChange={(event) =>
                      setFirstColumnFilter(event.target.value)
                    }
                  >
                    <option value="all">All streams / properties</option>
                    <optgroup label="Streams">
                      {comparison.streamNames.map((streamName) => (
                        <option key={streamName} value={`stream:${streamName}`}>
                          {streamName}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Properties">
                      {propertyNames.map((propertyName) => (
                        <option
                          key={propertyName}
                          value={`property:${propertyName}`}
                        >
                          {propertyName}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </label>
              </th>
              <th>Unit</th>
              {cases.map((item) => (
                <th key={item.id}>
                  <span className="hmbc-column-case">
                    <i style={{ backgroundColor: item.color }} />
                    {item.name}
                  </span>
                </th>
              ))}
              {MAX_RATE_COLUMNS.map((column) => (
                <th
                  key={column.kind}
                  className="hmbc-max-col"
                  title={column.hint}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shownRows.map((row, index) => {
              const newStream =
                index === 0 ||
                shownRows[index - 1].streamName !== row.streamName;
              const firstInSection = newStream || shownRows[index - 1]?.section !== row.section;
              const sectionRowSpan = visibleRows.filter((candidate) => candidate.streamName === row.streamName && candidate.section === row.section).length;
              const varies = highlight && rowVaries(row, caseIds);
              return (
                <Fragment
                  key={`${row.streamName}-${row.propertyName}-${index}`}
                >
                  {newStream && (
                    <tr className="hmbc-stream-band">
                      <th colSpan={cases.length + 6}>{row.streamName}</th>
                    </tr>
                  )}
                  <tr
                    className={`${varies ? "is-varying" : ""}${firstInSection && index > 0 ? " hmbc-section-start" : ""}`}
                    style={{
                      contentVisibility: "auto",
                      containIntrinsicSize: "0 40px",
                    }}
                  >
                    {firstInSection && <th className="hmbc-phase-cell" rowSpan={sectionRowSpan} scope="rowgroup">{row.section}</th>}
                    <th className="is-sticky hmbc-property-cell" scope="row">{row.propertyName}</th>
                    <td className="hmbc-unit">{row.unit || "—"}</td>
                    {cases.map((item) => (
                      <td
                        className={row.editedFlags[item.id] ? "is-edited" : ""}
                        key={item.id}
                      >
                        {formatValue(row.values[item.id])}
                      </td>
                    ))}
                    {MAX_RATE_COLUMNS.map((column) => {
                      const governing = governingColumns.get(row.streamName)?.[
                        column.kind
                      ];
                      const value = getGoverningCaseValue(row, governing);
                      return (
                        <td
                          key={column.kind}
                          className={`hmbc-max-cell${value == null ? " is-missing" : ""}`}
                          title={governing?.caseName ? `${column.hint}; governing case: ${governing.caseName}` : column.hint}
                        >
                          {value == null ? "—" : formatValue(value)}
                        </td>
                      );
                    })}
                  </tr>
                </Fragment>
              );
            })}
            {!visibleRows.length && (
              <tr>
                <td className="hmbc-no-results" colSpan={cases.length + 6}>
                  No comparison rows match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {shownRows.length < visibleRows.length && (
          <div ref={sentinelRef} className="hmbc-loading-rows">
            Showing {shownRows.length.toLocaleString()} of{" "}
            {visibleRows.length.toLocaleString()} rows…
          </div>
        )}
      </div>
      <div className="hmbc-legend">
        <span>
          <i className="is-varying" />
          Value varies across cases
        </span>
        <span>
          <i className="is-edited">123.4</i>Reviewed manual override
        </span>
        <span>
          <i className="is-missing">—</i>Property absent in this case
        </span>
        <span>
          <i className="is-max">MAX</i>Max Liquid / Gas / Water — complete copy
          of the governing case column for this stream
        </span>
      </div>
    </section>
  );
}

function ExportDialog({ cases, open, onClose }) {
  const [options, setOptions] = useState({
    includeSummary: true,
    highlightVariation: true,
    flagEdited: true,
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [busy, onClose, open]);

  if (!open) return null;
  const runExport = async () => {
    setBusy(true);
    try {
      const { exportComparison } = await import("./export.ts");
      await exportComparison(cases, options);
      toast.success("Comparison workbook exported.");
      onClose();
    } catch (error) {
      toast.error(
        `Export failed: ${error instanceof Error ? error.message : "Unexpected error."}`,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="hmbc-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        className="hmbc-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hmbc-export-title"
      >
        <div className="hmbc-modal-header">
          <div>
            <h2 id="hmbc-export-title">Export Excel comparison</h2>
            <p>
              {cases.length} cases will be aligned by case-insensitive stream
              name.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close export dialog"
          >
            <X />
          </button>
        </div>
        <div className="hmbc-export-options">
          {[
            [
              "includeSummary",
              "Summary sheet",
              "Case index with source workbook, selected sheet, stream count and value count.",
            ],
            [
              "highlightVariation",
              "Highlight cross-case variation",
              "Amber formatting identifies rows where numeric or text values differ.",
            ],
            [
              "flagEdited",
              "Flag reviewed overrides",
              "Manually edited values use orange italic formatting in the workbook.",
            ],
          ].map(([key, label, hint]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={options[key]}
                onChange={(event) =>
                  setOptions((current) => ({
                    ...current,
                    [key]: event.target.checked,
                  }))
                }
              />
              <span>
                <strong>{label}</strong>
                <small>{hint}</small>
              </span>
            </label>
          ))}
        </div>
        <div className="hmbc-modal-footer">
          <span>
            HMB_Comparison_{new Date().toISOString().slice(0, 10)}.xlsx
          </span>
          <button
            className="hmbc-button is-primary"
            type="button"
            onClick={runExport}
            disabled={busy}
          >
            <Download />
            {busy ? "Building workbook…" : "Download workbook"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmResetDialog({ open, onCancel, onConfirm }) {
  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onCancel, open]);

  if (!open) return null;
  return (
    <div
      className="hmbc-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        className="hmbc-modal hmbc-reset-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="hmbc-reset-title"
        aria-describedby="hmbc-reset-description"
      >
        <div className="hmbc-modal-header">
          <div>
            <h2 id="hmbc-reset-title">Reset this browser session?</h2>
            <p id="hmbc-reset-description">
              All imported cases and reviewed overrides will be cleared. This
              action cannot be undone.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close reset confirmation"
          >
            <X />
          </button>
        </div>
        <div className="hmbc-modal-footer">
          <button
            className="hmbc-button is-secondary"
            type="button"
            onClick={onCancel}
          >
            Keep session
          </button>
          <button
            className="hmbc-button is-danger"
            type="button"
            onClick={onConfirm}
          >
            <Trash2 />
            Reset session
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  importing,
  onImport,
  onDemo,
  errors,
  onClearErrors,
  view,
  setView,
  archiveRecords,
  archiveBusy,
  archiveError,
  onRefreshArchive,
  onOpenWorkbook,
  openingArchiveId,
}) {
  const pickerRef = useRef(null);
  return (
    <main className="hmbc-empty-workspace">
      <div
        className="hmbc-empty-tabs"
        role="tablist"
        aria-label="HMB Workspace views"
      >
        {[
          [Table2, "review", "Review"],
          [ArrowDownUp, "compare", "Compare"],
          [Archive, "saved", "Saved"],
        ].map(([Icon, key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={view === key}
            onClick={() => setView(key)}
          >
            <Icon />
            {label}
          </button>
        ))}
        <div className="hmbc-empty-summary">
          0 cases · 0 streams{" "}
          <span>
            <CheckCircle2 /> Session only
          </span>
        </div>
      </div>
      {view !== "saved" && (
        <aside className="hmbc-empty-cases">
          <div className="hmbc-empty-cases-title">
            <strong>Cases</strong>
            <span>0</span>
            <button
              type="button"
              onClick={() => pickerRef.current?.click()}
              disabled={importing}
            >
              <Plus /> Add
            </button>
          </div>
          <Dropzone
            importing={importing}
            onImport={onImport}
            compact
            pickerRef={pickerRef}
          />
          <label className="hmbc-case-search">
            <Search />
            <input placeholder="Search cases..." disabled />
          </label>
          <button
            className="hmbc-load-demo"
            type="button"
            onClick={onDemo}
            disabled={importing}
          >
            <Database /> Load demo cases
          </button>
          <div className="hmbc-privacy-note">
            <ShieldCheck />
            <span>
              Source files: session only <i>ⓘ</i>
            </span>
          </div>
        </aside>
      )}
      <section
        className={`hmbc-empty-main${view === "saved" ? " is-saved-view" : ""}`}
      >
        {view === "saved" ? (
          <ArchiveHistoryPanel
            records={archiveRecords}
            busy={archiveBusy}
            error={archiveError}
            onRefresh={onRefreshArchive}
            onOpenWorkbook={onOpenWorkbook}
            openingRecordId={openingArchiveId}
          />
        ) : (
          <>
            <div className="hmbc-empty-review-toolbar">
              <h2>
                {view === "compare"
                  ? "Cross-case comparison"
                  : "Review extracted values"}
              </h2>
              <label>
                <span>Sheet</span>
                <select disabled>
                  <option>Streams</option>
                </select>
              </label>
              <label className="hmbc-review-search">
                <Search />
                <input placeholder="Search streams..." disabled />
              </label>
              <label>
                <span>Units</span>
                <select disabled>
                  <option>Source</option>
                </select>
              </label>
              <button type="button" disabled>
                <Table2 /> Columns
              </button>
              <button
                className="hmbc-empty-expand"
                type="button"
                disabled
                aria-label="Expand table"
              >
                <Maximize2 />
              </button>
            </div>
            {errors.length > 0 && (
              <div className="hmbc-import-errors" role="alert">
                <AlertTriangle />
                <div>
                  <strong>
                    {errors.length} workbook{errors.length === 1 ? "" : "s"}{" "}
                    could not be imported
                  </strong>
                  {errors.map((error, index) => (
                    <span key={`${error.fileName}-${index}`}>
                      {error.fileName}: {error.message}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={onClearErrors}
                  aria-label="Dismiss import errors"
                >
                  <X />
                </button>
              </div>
            )}
            <div className="hmbc-empty-table-scroll">
              <table className="hmbc-table">
                <thead>
                  <tr>
                    <th>Property</th>
                    <th>Unit</th>
                    <th>Stream</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan="3">
                      Drop HMB workbooks or load demo cases to populate the
                      review table.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="hmbc-review-footer">
              <span>
                0 / 0 streams <i /> 0 reviewed cells
              </span>
              <span>
                <ShieldCheck /> Source files: session only
              </span>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function ArchiveHistoryPanel({
  records,
  busy,
  error,
  onRefresh,
  onOpenWorkbook,
  openingRecordId,
}) {
  return (
    <section className="hmbc-archive-panel" aria-live="polite">
      <div className="hmbc-archive-header">
        <div>
          <h2>Saved project workbook</h2>
          <p>Reopen a comparison workbook saved under the selected project.</p>
        </div>
        <button
          className="hmbc-button is-secondary"
          type="button"
          onClick={onRefresh}
          disabled={busy}
        >
          <Archive />
          {busy ? "Refreshing..." : "Refresh"}
        </button>
      </div>
      {error ? <p className="hmbc-archive-error">{error}</p> : null}
      {!error && !records.length ? (
        <p className="hmbc-archive-empty">
          No workbook has been saved for the selected project yet.
        </p>
      ) : null}
      {!!records.length && (
        <div className="hmbc-archive-list" role="list">
          {records.map((record) => (
            <article
              className="hmbc-archive-item"
              role="listitem"
              key={record.id}
            >
              <strong title={record.filename}>{record.filename}</strong>
              <span>Saved {formatArchiveDate(record.created_at)}</span>
              <small>
                {formatBytes(record.size_bytes)} · {record.case_count} cases ·{" "}
                {record.included_stream_count} streams ·{" "}
                {record.edited_value_count} overrides
              </small>
              <div className="hmbc-archive-actions">
                <button
                  className="hmbc-button is-secondary"
                  type="button"
                  onClick={() => onOpenWorkbook(record)}
                  disabled={openingRecordId === record.id}
                >
                  <FileSpreadsheet />
                  {openingRecordId === record.id
                    ? "Opening..."
                    : "Open workbook"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default function HMBStreamTableConsolidator() {
  const casesState = useCases();
  const [view, setView] = useState("review");
  const [exportOpen, setExportOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [savingArchive, setSavingArchive] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [projectModalError, setProjectModalError] = useState("");
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveError, setArchiveError] = useState("");
  const [archiveRecords, setArchiveRecords] = useState([]);
  const [openingArchiveId, setOpeningArchiveId] = useState("");
  const includedStreamCount = useMemo(
    () =>
      casesState.cases.reduce(
        (total, item) =>
          total + item.streams.filter((stream) => stream.included).length,
        0,
      ),
    [casesState.cases],
  );

  // ── RADAI Chat context — publish flattened stream-table rows so the
  // floating assistant verifies/validates within THIS tool's data (profile:
  // soft-coded in config/radaiChatPages.config.js → 'hmb_consolidator').
  const chatRows = useMemo(
    () =>
      casesState.cases.flatMap((item) =>
        item.streams.flatMap((stream) =>
          (stream.properties || []).map((prop) => ({
            case: item.name,
            stream: stream.name,
            property: prop.name,
            value: prop.value,
            unit: prop.unit || "",
            edited: Boolean(prop.edited),
            included: stream.included !== false,
          })),
        ),
      ),
    [casesState.cases],
  );
  useRadaiChatPage("hmb_consolidator", {
    document: casesState.cases.length
      ? {
          name: casesState.cases.map((c) => c.fileName || c.name).join(", "),
          type: "HYSYS stream table workbook",
        }
      : null,
    columns: [
      { key: "case", label: "Case" },
      { key: "stream", label: "Stream" },
      { key: "property", label: "Property" },
      { key: "value", label: "Value" },
      { key: "unit", label: "Unit" },
      { key: "edited", label: "Edited" },
    ],
    rows: chatRows,
    rowCount: chatRows.length,
    summary: casesState.cases.length
      ? {
          cases: casesState.cases.length,
          case_names: casesState.cases.map((c) => c.name),
          streams_included: includedStreamCount,
          edited_values: casesState.editedCount,
        }
      : null,
  });

  const reset = () => {
    casesState.resetAll();
    setView("review");
    setResetOpen(false);
  };

  const loadArchiveHistory = async () => {
    setArchiveBusy(true);
    setArchiveError("");
    try {
      const projectId = readActiveProjectId();
      if (!projectId) {
        setArchiveRecords([]);
        setArchiveError("Create or select a project to save workbook history.");
        return;
      }
      const { data } = await getArchiveHistory(projectId);
      const results = Array.isArray(data?.results) ? data.results : [];
      setArchiveRecords(results);
    } catch (error) {
      if (isNotFoundResponse(error)) {
        setArchiveError(
          "Archive endpoint is not available on this backend runtime. Please restart/update backend and try again.",
        );
        setArchiveRecords([]);
        return;
      }
      setArchiveError(
        error?.response?.data?.error ||
          "Could not load saved project workbook.",
      );
    } finally {
      setArchiveBusy(false);
    }
  };

  useEffect(() => {
    void loadArchiveHistory();
  }, []);

  useEffect(() => {
    if (view !== "saved") return;
    void loadArchiveHistory();
  }, [view]);

  const createProjectAndSave = async (projectPayload) => {
    setCreatingProject(true);
    setProjectModalError("");
    try {
      const created = await createOrganizerProject({
        name: projectPayload.name,
        description: projectPayload.description,
        status: "active",
        metadata: {
          source_tool: "hmb_stream_table_consolidator",
        },
      });
      saveActiveProject(created);
      setShowProjectModal(false);
      toast.success(`Project ${created?.name || ""} created.`);
      await saveArchive(created.project_id);
    } catch (error) {
      setProjectModalError(
        error?.response?.data?.error ||
          "Could not create a project. Enter Project Name and try again.",
      );
    } finally {
      setCreatingProject(false);
    }
  };

  const openSavedWorkbook = async (record) => {
    if (!record?.id || openingArchiveId) return;
    setOpeningArchiveId(record.id);
    try {
      const response = await apiClient.get(
        `${CONSOLIDATOR_ARCHIVE_DOWNLOAD_BASE}/${encodeURIComponent(record.id)}/download/`,
        { responseType: "blob" },
      );
      const { reopenComparisonWorkbook } = await import("./reopen.ts");
      const buffer = await response.data.arrayBuffer();
      const reopenedCases = reopenComparisonWorkbook(buffer, record.filename);
      casesState.replaceCases(reopenedCases);
      setView("review");
      toast.success(
        `Reopened ${record.filename} with ${reopenedCases.length} case${reopenedCases.length === 1 ? "" : "s"}.`,
      );
    } catch (error) {
      if (isNotFoundResponse(error)) {
        toast.error("Saved workbook was not found or is no longer available.");
      } else {
        toast.error(
          error?.response?.data?.error ||
            error?.message ||
            "Could not open saved workbook.",
        );
      }
    } finally {
      setOpeningArchiveId("");
    }
  };

  const saveArchive = async (projectIdOverride = "") => {
    if (!casesState.cases.length || savingArchive) return;
    const projectId =
      normalizeProjectId(projectIdOverride) || readActiveProjectId();
    if (!projectId) {
      setProjectModalError("");
      setShowProjectModal(true);
      return;
    }
    setSavingArchive(true);
    try {
      const { buildComparisonWorkbookBlob, buildComparisonFilename } =
        await import("./export.ts");
      const exportOptions = {
        includeSummary: true,
        highlightVariation: true,
        flagEdited: true,
      };
      const blob = await buildComparisonWorkbookBlob(
        casesState.cases,
        exportOptions,
      );
      const filename = buildComparisonFilename();
      const archiveFile = new File([blob], filename, {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const form = new FormData();
      form.append("archive_file", archiveFile);
      form.append("project_id", projectId);
      form.append("filename", filename);
      form.append("case_count", String(casesState.cases.length));
      form.append("included_stream_count", String(includedStreamCount));
      form.append("edited_value_count", String(casesState.editedCount));

      const { data } = await postArchiveWorkbook(form);

      const savedName =
        data?.archive?.filename ||
        data?.source_upload?.original_filename ||
        data?.output_template?.filename ||
        filename;
      toast.success(`Saved ${savedName} under the selected project.`);
      await loadArchiveHistory();
    } catch (error) {
      if (isMissingProjectResponse(error)) {
        // Do not clear a project the user selected while this upload was running.
        if (readActiveProjectId() === projectId) {
          localStorage.removeItem(PROJECT_STORAGE_KEY);
        }
        setProjectModalError(
          "The selected project could not be found. Create a project here, or close this form and select another project. Your extracted values are still available.",
        );
        setShowProjectModal(true);
        return;
      }
      if (isNotFoundResponse(error)) {
        toast.error(
          "Saving is temporarily unavailable. Your extracted values are still available; use Export Excel to keep a copy.",
        );
        return;
      }
      const message =
        error?.response?.data?.error ||
        error?.message ||
        "Could not archive workbook in RADAI.";
      toast.error(message);
    } finally {
      setSavingArchive(false);
    }
  };

  return (
    <div className="hmbc-page">
      <header className="hmbc-page-header">
        <div className="hmbc-title-row">
          <div>
            <h1>HMB Workspace</h1>
          </div>
          <div className="hmbc-title-side">
            <section className="hmbc-header-archive" aria-live="polite">
              <div>
                <strong>Saved project workbook</strong>
                {archiveError ? (
                  <span>{archiveError}</span>
                ) : archiveBusy ? (
                  <span>Loading saved workbook list...</span>
                ) : archiveRecords.length ? (
                  <span title={archiveRecords[0].filename}>
                    Latest: {archiveRecords[0].filename}
                  </span>
                ) : (
                  <span>No workbook saved for the active project yet.</span>
                )}
              </div>
              <button
                className="hmbc-button is-secondary"
                type="button"
                onClick={() => setView("saved")}
              >
                <Archive />
                Saved
              </button>
            </section>
            <div className="hmbc-header-actions">
              <button
                className="hmbc-button is-secondary hmbc-save-action"
                type="button"
                onClick={() => saveArchive()}
                disabled={savingArchive || !casesState.cases.length}
              >
                <Save />
                {savingArchive ? "Saving..." : "Save"}
              </button>
              <button
                className="hmbc-button is-secondary hmbc-reset-action"
                type="button"
                onClick={() => setResetOpen(true)}
                disabled={!casesState.cases.length}
              >
                <RotateCcw />
                Reset
              </button>
              <button
                className="hmbc-button is-primary"
                type="button"
                onClick={() => setExportOpen(true)}
                disabled={!casesState.cases.length}
              >
                <Download />
                Export Excel
              </button>
              <div className="hmbc-more-wrap">
                <button
                  className="hmbc-button hmbc-more-button"
                  type="button"
                  aria-label="More actions"
                  aria-expanded={moreOpen}
                  onClick={() => setMoreOpen((open) => !open)}
                >
                  <MoreHorizontal />
                </button>
                {moreOpen && (
                  <div className="hmbc-more-menu">
                    <button
                      type="button"
                      onClick={() => {
                        setView("saved");
                        setMoreOpen(false);
                      }}
                    >
                      <Archive /> Saved workbooks
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setResetOpen(true);
                        setMoreOpen(false);
                      }}
                    >
                      <RotateCcw /> Reset session
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>
      <section className="hmbc-workflow" aria-label="Consolidation workflow">
        {[
          ["01", "Upload cases", casesState.cases.length > 0],
          ["02", "Review values", casesState.cases.length > 0],
          ["03", "Compare and export", view === "compare"],
        ].map(([number, label, done], index) => (
          <Fragment key={number}>
            <div className={done ? "is-complete" : ""}>
              {done ? <CheckCircle2 /> : <span>{number}</span>}
              <strong>{label}</strong>
            </div>
            {index < 2 && <i />}
          </Fragment>
        ))}
      </section>
      {showProjectModal ? (
        <ProjectFormModal
          initial={null}
          onClose={() => {
            if (creatingProject) return;
            setShowProjectModal(false);
            setProjectModalError("");
          }}
          onSubmit={createProjectAndSave}
          busy={creatingProject}
          theme={PROJECT_MODAL_THEME}
          formError={projectModalError}
        />
      ) : null}
      {casesState.cases.length === 0 ? (
        <EmptyState
          importing={casesState.importing}
          onImport={casesState.importFiles}
          onDemo={casesState.loadDemo}
          errors={casesState.errors}
          onClearErrors={casesState.clearErrors}
          view={view}
          setView={setView}
          archiveRecords={archiveRecords}
          archiveBusy={archiveBusy}
          archiveError={archiveError}
          onRefreshArchive={loadArchiveHistory}
          onOpenWorkbook={openSavedWorkbook}
          openingArchiveId={openingArchiveId}
        />
      ) : (
        <div className="hmbc-workspace">
          {casesState.cases.length > 0 ? (
            <CasePanel
              cases={casesState.cases}
              activeCaseId={casesState.activeCaseId}
              importing={casesState.importing}
              onSelect={(id) => {
                casesState.setActiveCaseId(id);
                setView("review");
              }}
              onRemove={casesState.removeCase}
              onRename={casesState.renameCase}
              onImport={casesState.importFiles}
              onDemo={casesState.loadDemo}
            />
          ) : null}
          <main className="hmbc-main">
            {casesState.cases.length > 0 ? (
              <div className="hmbc-workspace-toolbar">
                <div
                  className="hmbc-tabs"
                  role="tablist"
                  aria-label="Consolidator views"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={view === "review"}
                    onClick={() => setView("review")}
                  >
                    <Table2 />
                    Review
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={view === "compare"}
                    onClick={() => setView("compare")}
                  >
                    <ArrowDownUp />
                    Compare
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={view === "saved"}
                    onClick={() => setView("saved")}
                  >
                    <Archive />
                    Saved
                  </button>
                </div>
                <div className="hmbc-summary">
                  <span>{casesState.cases.length} cases</span>
                  <span>
                    {includedStreamCount.toLocaleString()} included streams
                  </span>
                  {casesState.editedCount > 0 && (
                    <span className="is-edited">
                      {casesState.editedCount.toLocaleString()} overrides
                    </span>
                  )}
                  <span
                    className={`hmbc-saved-state${archiveRecords.length ? " is-saved" : ""}`}
                  >
                    <CheckCircle2 />{" "}
                    {archiveRecords.length ? "Saved" : "Session only"}
                  </span>
                </div>
              </div>
            ) : null}
            {casesState.errors.length > 0 && (
              <div className="hmbc-inline-warning" role="alert">
                <AlertTriangle />
                Some workbooks could not be imported. Reset the session to clear
                the import history.
              </div>
            )}
            {view === "review" && casesState.activeCase && (
              <ReviewView
                caseData={casesState.activeCase}
                onToggleStream={(stream) =>
                  casesState.toggleStream(casesState.activeCase.id, stream)
                }
                onSetCell={(stream, property, raw, section, unit) =>
                  casesState.setCellValue(
                    casesState.activeCase.id,
                    stream,
                    property,
                    raw,
                    section,
                    unit,
                  )
                }
              />
            )}
            {view === "compare" && <ComparisonView cases={casesState.cases} />}
            {view === "saved" && (
              <ArchiveHistoryPanel
                records={archiveRecords}
                busy={archiveBusy}
                error={archiveError}
                onRefresh={loadArchiveHistory}
                onOpenWorkbook={openSavedWorkbook}
                openingRecordId={openingArchiveId}
              />
            )}
          </main>
        </div>
      )}
      <ExportDialog
        cases={casesState.cases}
        open={exportOpen}
        onClose={() => setExportOpen(false)}
      />
      <ConfirmResetDialog
        open={resetOpen}
        onCancel={() => setResetOpen(false)}
        onConfirm={reset}
      />
    </div>
  );
}
