import { radaiAlert, radaiConfirm } from "../../../../services/radaiDialog";
/**
 * WorkbookCanvas
 * G��G��G��G��G��G��G��G��G��G��G��G��G��G��
 * Cross-check & edit the SPEC and CAT workbooks before download.
 *
 * - Renders the data exactly as it will appear in the SmartPlant 3D template
 *   (one tab per template sheet, headers read from the template's Head row).
 * - Every cell is editable; edits autosave as `WorkbookCellOverride` records
 *   and are baked into the downloaded xlsx by the backend exporter.
 *
 * All UX knobs (debounce, highlight colours, density) live in `CANVAS_CONFIG`
 * G�� adjust there, never inline.
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ChatBubbleLeftRightIcon,
  ClipboardDocumentIcon,
  PaperAirplaneIcon,
  PencilSquareIcon,
  PencilIcon,
  ArrowUturnLeftIcon,
  MagnifyingGlassIcon,
  TableCellsIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  TrashIcon,
  CloudArrowUpIcon,
  ArrowUturnUpIcon,
  ArrowUturnRightIcon,
  ArchiveBoxIcon,
  ClockIcon,
  CheckIcon,
  XMarkIcon,
  DocumentTextIcon,
  ArrowTopRightOnSquareIcon,
  MapPinIcon,
  QueueListIcon,
  ChevronLeftIcon,
  PlayIcon,
  ViewColumnsIcon,
  LinkIcon,
} from "@heroicons/react/24/outline";
import {
  CheckIcon as CheckIconSolid,
  MinusIcon,
} from "@heroicons/react/24/solid";

import specCustomizationAPI from "../../../../services/specCustomizationAPI";
import {
  SPEC_CUSTOMIZATION_UI,
  workbookWorkspaceStyle,
} from "../../../../config/specCustomizationUI.config";
import "../spec-customization.css";

// G��G��G�� Soft-coded UI / behaviour knobs G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
const CANVAS_CONFIG = {
  defaultWorkbook: "spec",
  workbooks: SPEC_CUSTOMIZATION_UI.workbooks,
  autosaveDebounceMs: 500,
  cellMinWidthPx: SPEC_CUSTOMIZATION_UI.layout.cellMinWidthPx,
  rowHeaderMinWidthPx: SPEC_CUSTOMIZATION_UI.layout.sourceColumnWidthPx,
  density: {
    rowPx: 32,
    headerRowPx: 36,
    cellPaddingX: 8,
  },
  highlight: {
    edited: "bg-amber-50 ring-1 ring-amber-300",
    saving: "bg-blue-50 ring-1 ring-blue-300",
    saved: "bg-emerald-50 ring-1 ring-emerald-300",
    chatbot: "bg-cyan-50 ring-1 ring-cyan-300",
    error: "bg-rose-50 ring-1 ring-rose-300",
  },
  emptySheetMessage:
    "No rows for this sheet yet - adjust extraction or add overrides.",
  // G��G�� CAT "unrouted components" banner G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
  // Components extracted for a Piping Class but with no matching sheet in
  // the standard CAT template (e.g. a valve sub-type with no dedicated
  // sheet) are excluded from the CAT workbook rather than silently dropped
  // with zero visibility G�� this banner surfaces that gap in the canvas.
  unroutedBanner: {
    enabled: true,
    maxGroupsShown: 6,
    title: "Some components have no matching CAT sheet",
    helpText:
      "These components remain in the Piping Class data and only affect the CAT catalog view - they are not written to any CAT sheet because the standard template has no dedicated category for them.",
  },
  // ─── Column visibility toggle ─────────────────────────────────────────
  // SPEC/CAT sheets ship 25+ columns (many blank passthroughs). Users may
  // hide columns they are not reviewing; hidden state is remembered per
  // sheet for the session. All knobs here.
  columnVisibility: {
    enabled: true,
    label: "Columns",
    hiddenCountSuffix: "hidden",
    showAllLabel: "Show all",
    hideAllLabel: "Hide all",
  },
  // G��G�� Row operations G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
  rowOperations: {
    enableEdit: true,
    // Extracted rows are source data.  Until record-level change sets exist,
    // the canvas must never pretend that removing overrides deletes a row.
    enableDelete: false,
    enableBulkDelete: false,
    enableBulkSelect: false,
    confirmDelete: true,
    showRowActions: "always", // 'always' | 'hover' | 'never'
    maxBulkSelectRows: 500, // Safety limit for bulk operations
    // Actions column (Edit/Delete buttons at end of row)
    showActionsColumn: true, // Show actions column after all data columns
    actionsColumnWidth: SPEC_CUSTOMIZATION_UI.layout.actionsColumnWidthPx,
    actionsColumnLabel: "Actions", // Column header text
    enableRowEdit: true, // Show Edit button (highlights row for editing)
    enableRowDelete: false, // Source records cannot be deleted here
  },
  // G��G�� Auto-save configuration G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
  autoSave: {
    enabled: true,
    indicator: true, // Show save status indicator
    batchThreshold: 50, // Batch save if >= 50 pending edits
    batchDelayMs: 2000, // Wait 2s after last edit before batch save
  },
  // G��G�� Undo/Restore functionality G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
  undo: {
    enabled: true, // Enable undo/restore
    maxHistorySize: 50, // Keep last 50 actions
    undoKeyBinding: "Ctrl+Z", // Keyboard shortcut
    redoKeyBinding: "Ctrl+Y", // Keyboard shortcut
    showUndoButton: true, // Show undo button in toolbar
  },
  // G��G�� S3 Snapshot Management G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
  s3Snapshots: {
    // The server currently has no snapshot listing or restore API.  Hide this
    // unfinished workflow rather than presenting mock recovery data.
    enabled: false,
    showSnapshotList: true, // Show list of snapshots
    allowRestore: true, // Allow restoring from snapshots
    maxSnapshotsToShow: 10, // Show last 10 snapshots
    autoSnapshotInterval: 100, // Auto-snapshot every 100 edits
  },
  // G��G�� Fullscreen behaviour G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
  // 'native' first tries the browser Fullscreen API and falls back to a
  // CSS-fixed overlay when blocked (e.g. inside an iframe); 'overlay'
  // forces the CSS overlay; 'off' disables the toggle entirely.
  fullscreen: {
    mode: "native",
    exitOnEscape: true,
    enterLabel: "Full Screen",
    exitLabel: "Exit Full Screen",
    enterHint: "Maximise the canvas (Esc to exit)",
    exitHint: "Restore the canvas to its normal size",
    gridMaxHeight: "70vh", // normal mode
    gridMaxHeightFS: "calc(100vh - 180px)", // fullscreen mode
    overlayZIndex: 60,
  },
  chatbot: {
    enabled: SPEC_CUSTOMIZATION_UI.features.chatbot,
    maxHistory: SPEC_CUSTOMIZATION_UI.chatbot.maxHistory,
    instructionPlaceholder:
      SPEC_CUSTOMIZATION_UI.chatbot.instructionPlaceholder,
    sendHint: "Enter = Preview | approval is required before apply",
    scopes: SPEC_CUSTOMIZATION_UI.chatbot.scopes,
    taskTemplates: [
      {
        key: "material",
        label: "Material Standardization",
        prompt:
          "set MaterialGrade to from uploaded document where Description contains PIPE page 12",
      },
      {
        key: "rating",
        label: "Pressure Rating Alignment",
        prompt:
          "update PressureRating = from uploaded document where Description contains FLANGE page 21",
      },
      {
        key: "commodity",
        label: "Commodity Code Cleanup",
        prompt:
          "set CommodityCode to from uploaded document in sheet PipingCommodityFilter page 16",
      },
      {
        key: "end_connection",
        label: "End Connection Normalization",
        prompt:
          "set EndConnection to as per uploaded document for class A1 in sheet PipingComponentData page 18",
      },
    ],
    examples: [
      "set MaterialGrade to ASTM A106 Gr.B where Description contains PIPE",
      "set EndConnection to as per uploaded document for class A1 in sheet PipingComponentData page 18",
      "update PressureRating = from uploaded document where Description contains FLANGE page 21",
      "update Notes = REVIEWED for class A1 in sheet PipingMaterialsClassData",
      "set CommodityCode to VLV-001 in sheet PipingCommodityFilter",
    ],
  },
  sheetNavigator: {
    defaultMode: "compact", // compact | detailed
    storageKey: SPEC_CUSTOMIZATION_UI.storage.sheetNavigatorMode,
  },
  // ─── Hub variant (S3D Data Extraction & Integration Hub) ─────────────────
  // Used when WorkbookCanvas is rendered with variant="hub" inside the
  // redesigned SmartPlant 3D preview page. Controls pagination, the row
  // details panel and copy — layout/markup branches live in the renderer.
  hub: {
    pageSize: 10,
    virtual: {
      minVisibleRows: 10,
      maxVisibleRows: 40,
      overscanRows: 5,
    },
    labels: {
      sheets: "Sheets",
      findSheet: "Find sheet...",
      searchRows: "Search rows...",
      templateOnlyBanner:
        "Template content only. Link extracted records to verify source data.",
      rowDetails: "Row details",
      properties: "Properties",
      source: "Source",
      validation: "Validation",
      notRun: "Not run",
      validateRow: "Validate row",
      validateWorkbook: "Validate workbook",
      linkSourceRecord: "Link source record",
      noSourceRecord: "No extracted record linked",
      rowsOf: (start, end, total) => `Rows ${start}-${end} of ${total}`,
      sheetStats: (rows, linked) =>
        `${rows} template rows · ${linked} source-linked records`,
      changesSaved: "Changes saved",
      savingChanges: "Saving changes…",
      saveFailed: "Save failed",
    },
  },
  userExperience: {
    showQuickGuide: SPEC_CUSTOMIZATION_UI.features.quickGuide,
    showGridSearch: true,
    labels: {
      activeSheetFallback: "-",
      activeSheetEmpty: "No sheet selected",
      searchPlaceholder: "Search rows...",
      rowsAndSheetsSep: " | ",
      loadingWorkbook: "Loading workbook...",
      showMoreSuffix: "more...",
    },
  },
};

// `value` may be null/number/string G�� normalise to string for the input.
const toInputValue = (v) => (v === null || v === undefined ? "" : String(v));

const BULK_SELECT_COLUMN_WIDTH = 40;
const DELETE_COLUMN_WIDTH = 48;

const shortRecordId = (value) => (value ? String(value).slice(0, 8) : "");

const sourceDisplay = (source = {}) => {
  const classCode = String(source.class_code || "").trim();
  if (source.component_id) {
    return {
      label: classCode || "Unassigned class",
      detail: `Component ${shortRecordId(source.component_id)}`,
    };
  }
  if (source.class_id) {
    return {
      label: classCode || "Unassigned class",
      detail: `Class ${shortRecordId(source.class_id)}`,
    };
  }
  return { label: "Template row", detail: "No extracted record" };
};

// G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
const WorkbookCanvas = ({ job, variant = "default" }) => {
  const jobId = job?.id;
  const isHub = variant === "hub";
  const HUB_LABELS = CANVAS_CONFIG.hub.labels;

  const [workbook, setWorkbook] = useState(CANVAS_CONFIG.defaultWorkbook);
  const [data, setData] = useState(null); // preview JSON
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [activeSheet, setActiveSheet] = useState(null);
  const [search, setSearch] = useState("");

  // ─── Column visibility (soft-coded CANVAS_CONFIG.columnVisibility) ─────
  // hiddenColumns: { [sheetName]: Set<headerName> } — remembered per sheet.
  const [hiddenColumns, setHiddenColumns] = useState({});
  const [colMenuOpen, setColMenuOpen] = useState(false);

  // edits[`${sheet}::${row_key}::${col}`] = { value, status: 'editing'|'saving'|'saved'|'error', error? }
  const [edits, setEdits] = useState({});
  const debounceTimers = useRef({});

  // G��G�� Edit mode and Auto-save toggles G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
  const [editModeEnabled, setEditModeEnabled] = useState(true); // Edit mode toggle
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true); // Auto-save toggle

  // G��G�� Bulk row selection G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
  const [selectedRows, setSelectedRows] = useState(new Set()); // Set of selected row_keys
  const [selectAllChecked, setSelectAllChecked] = useState(false); // Select all checkbox state

  // G��G�� Undo/Redo history G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
  const [undoHistory, setUndoHistory] = useState([]); // Array of past actions
  const [redoHistory, setRedoHistory] = useState([]); // Array of undone actions
  const editCountRef = useRef(0); // Track edits for auto-snapshot

  // G��G�� S3 Snapshot Management G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
  const [s3SnapshotsList, setS3SnapshotsList] = useState([]); // List of S3 snapshots
  const [showSnapshotPanel, setShowSnapshotPanel] = useState(false); // Show/hide snapshot panel
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);

  // G��G�� Row operations state G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
  const [deleteConfirm, setDeleteConfirm] = useState(null); // {sheet, rowKey, rowIndex}
  const [deleting, setDeleting] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState(null); // 'saving' | 'saved' | 'error'
  const batchSaveTimer = useRef(null);
  const [editingRowKey, setEditingRowKey] = useState(null); // Currently highlighted row for editing

  // Chatbot state
  const [chatInstruction, setChatInstruction] = useState("");
  const [chatScope, setChatScope] = useState("auto");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [copiedMessageTs, setCopiedMessageTs] = useState(null);
  const [chatTouchedKeys, setChatTouchedKeys] = useState(new Set());
  const [chatPreview, setChatPreview] = useState(null);
  const [pendingRowFocus, setPendingRowFocus] = useState(null);
  const chatEndRef = useRef(null);
  const [sheetRailOpen, setSheetRailOpen] = useState(() => {
    try {
      if (window.innerWidth <= SPEC_CUSTOMIZATION_UI.layout.compactViewportPx)
        return false;
      return (
        window.localStorage.getItem(
          SPEC_CUSTOMIZATION_UI.storage.sheetRailOpen,
        ) !== "false"
      );
    } catch {
      return true;
    }
  });
  const [chatPanelOpen, setChatPanelOpen] = useState(() => {
    try {
      return (
        window.localStorage.getItem(
          SPEC_CUSTOMIZATION_UI.storage.chatbotOpen,
        ) === "true"
      );
    } catch {
      return false;
    }
  });
  const [sheetNavMode, setSheetNavMode] = useState(() => {
    try {
      if (typeof window === "undefined")
        return CANVAS_CONFIG.sheetNavigator.defaultMode;
      const raw = window.localStorage.getItem(
        CANVAS_CONFIG.sheetNavigator.storageKey,
      );
      return raw === "compact" || raw === "detailed"
        ? raw
        : CANVAS_CONFIG.sheetNavigator.defaultMode;
    } catch {
      return CANVAS_CONFIG.sheetNavigator.defaultMode;
    }
  });

  // G��G�� Fullscreen state (soft-coded fallback to CSS overlay) G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
  // Hub-variant UI state (variant="hub")
  const [sheetFilter, setSheetFilter] = useState(""); // sheet rail search
  const hubViewportRef = useRef(null);
  const [hubScrollTop, setHubScrollTop] = useState(0);
  const [hubViewportHeight, setHubViewportHeight] = useState(0);
  const [detailsTab, setDetailsTab] = useState("properties"); // row details tab
  const [lastSelectedKey, setLastSelectedKey] = useState(null); // primary row for details panel
  const [rowValidation, setRowValidation] = useState(null); // { status, text }
  const [workbookValidation, setWorkbookValidation] = useState(null); // { status, text }

  const rootRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(async () => {
    const cfg = CANVAS_CONFIG.fullscreen;
    if (cfg.mode === "off") return;
    const el = rootRef.current;
    if (!el) return;

    // Currently fullscreen G�� exit.
    if (isFullscreen) {
      if (document.fullscreenElement) {
        try {
          await document.exitFullscreen();
        } catch {
          /* noop */
        }
      }
      setIsFullscreen(false);
      return;
    }

    // Try the native Fullscreen API first when allowed.
    if (cfg.mode === "native" && el.requestFullscreen) {
      try {
        await el.requestFullscreen();
        setIsFullscreen(true);
        return;
      } catch {
        // Fall through to CSS overlay.
      }
    }
    setIsFullscreen(true);
  }, [isFullscreen]);

  // Sync state with browser-driven fullscreen changes + Esc key.
  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) setIsFullscreen(false);
    };
    const onKey = (e) => {
      if (
        CANVAS_CONFIG.fullscreen.exitOnEscape &&
        e.key === "Escape" &&
        isFullscreen
      ) {
        // Only handle the CSS-overlay case; the browser handles its own Esc.
        if (!document.fullscreenElement) setIsFullscreen(false);
      }
    };
    document.addEventListener("fullscreenchange", onFsChange);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      window.removeEventListener("keydown", onKey);
    };
  }, [isFullscreen]);

  // G��G�� Fetch preview G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
  const fetchPreview = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    setLoadError("");
    try {
      const json = await specCustomizationAPI.getWorkbookPreview(
        jobId,
        workbook,
      );
      setData(json);
      const firstSheet =
        json?.sheets?.find((s) => s.row_count > 0) || json?.sheets?.[0];
      setActiveSheet(firstSheet?.name || null);
      setEdits({});
    } catch (err) {
      setLoadError(
        err?.response?.data?.error ||
          err?.message ||
          "Failed to load workbook.",
      );
    } finally {
      setLoading(false);
    }
  }, [jobId, workbook]);

  useEffect(() => {
    fetchPreview();
  }, [fetchPreview]);

  useEffect(() => {
    if (
      !pendingRowFocus ||
      loading ||
      workbook !== pendingRowFocus.workbook ||
      !data
    )
      return;
    const sheetExists = data.sheets?.some(
      (sheet) => sheet.name === pendingRowFocus.sheetName,
    );
    if (!sheetExists) {
      setPendingRowFocus(null);
      return;
    }
    if (activeSheet !== pendingRowFocus.sheetName) {
      setActiveSheet(pendingRowFocus.sheetName);
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      const row = Array.from(
        rootRef.current?.querySelectorAll("[data-row-key]") || [],
      ).find(
        (element) =>
          element.getAttribute("data-row-key") === pendingRowFocus.rowKey,
      );
      row?.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "center",
      });
      setEditingRowKey(pendingRowFocus.rowKey);
      setPendingRowFocus(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeSheet, data, loading, pendingRowFocus, workbook]);

  const focusChatbotRow = useCallback(
    (update) => {
      const targetWorkbook = update.workbook || workbook;
      setSearch("");
      setPendingRowFocus({
        workbook: targetWorkbook,
        sheetName: update.sheet_name,
        rowKey: update.row_key,
      });
      setWorkbook(targetWorkbook);
    },
    [workbook],
  );

  // G��G�� Save / clear helpers G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
  const editKey = (sheet, rowKey, col) => `${sheet}::${rowKey}::${col}`;

  const addToHistory = useCallback((action) => {
    if (!CANVAS_CONFIG.undo.enabled) return;

    setUndoHistory((prev) => {
      const next = [...prev, action];
      if (next.length > CANVAS_CONFIG.undo.maxHistorySize) {
        next.shift(); // Remove oldest
      }
      return next;
    });
    setRedoHistory([]); // Clear redo stack when new action is performed
  }, []);

  const queueSave = useCallback(
    (sheet, rowKey, col, value, previousValue) => {
      const k = editKey(sheet, rowKey, col);

      // Record one undo action per cell edit session (the first keystroke on a
      // cell that has no pending local edit yet), so toolbar undo/redo work.
      if (CANVAS_CONFIG.undo.enabled && !edits[k]) {
        addToHistory({
          type: "edit",
          workbook,
          sheet,
          rowKey,
          column: col,
          previousValue: previousValue ?? null,
          newValue: value,
        });
      }

      setEdits((prev) => ({ ...prev, [k]: { value, status: "editing" } }));

      // If auto-save is disabled, just mark as edited and don't save
      if (!autoSaveEnabled) {
        return;
      }

      if (debounceTimers.current[k]) clearTimeout(debounceTimers.current[k]);
      debounceTimers.current[k] = setTimeout(async () => {
        setEdits((prev) => ({
          ...prev,
          [k]: { ...(prev[k] || {}), value, status: "saving" },
        }));
        setAutoSaveStatus("saving");
        try {
          await specCustomizationAPI.saveWorkbookCell(jobId, {
            workbook,
            sheet_name: sheet,
            row_key: rowKey,
            column_name: col,
            value,
          });
          setEdits((prev) => ({ ...prev, [k]: { value, status: "saved" } }));
          setAutoSaveStatus("saved");
          // Clear status after 2 seconds
          setTimeout(() => setAutoSaveStatus(null), 2000);
        } catch (err) {
          setEdits((prev) => ({
            ...prev,
            [k]: {
              value,
              status: "error",
              error: err?.response?.data?.error || err?.message,
            },
          }));
          setAutoSaveStatus("error");
          setTimeout(() => setAutoSaveStatus(null), 3000);
        }
      }, CANVAS_CONFIG.autosaveDebounceMs);
    },
    [jobId, workbook, autoSaveEnabled, edits, addToHistory],
  );

  const clearCell = useCallback(
    async (sheet, rowKey, col) => {
      const k = editKey(sheet, rowKey, col);
      try {
        await specCustomizationAPI.clearWorkbookCell(jobId, {
          workbook,
          sheet_name: sheet,
          row_key: rowKey,
          column_name: col,
        });
        setEdits((prev) => {
          const next = { ...prev };
          delete next[k];
          return next;
        });
        // Re-fetch this sheet's row so the original extracted value re-appears.
        fetchPreview();
      } catch (err) {
        setEdits((prev) => ({
          ...prev,
          [k]: {
            ...(prev[k] || {}),
            status: "error",
            error: err?.response?.data?.error || err?.message,
          },
        }));
      }
    },
    [jobId, workbook, fetchPreview],
  );

  /**
   * Delete all cell overrides for a specific row.
   */
  const handleDeleteRow = useCallback(async (sheet, rowKey, rowIndex) => {
    if (CANVAS_CONFIG.rowOperations.confirmDelete) {
      setDeleteConfirm({ sheet, rowKey, rowIndex });
      return;
    }
    await executeDeleteRow(sheet, rowKey);
  }, []);

  const executeDeleteRow = useCallback(
    async (sheet, rowKey) => {
      setDeleting(true);
      try {
        const result = await specCustomizationAPI.deleteWorkbookRow(jobId, {
          workbook,
          sheet_name: sheet,
          row_key: rowKey,
        });

        // Remove all edits for this row from local state
        setEdits((prev) => {
          const next = { ...prev };
          Object.keys(next).forEach((k) => {
            if (k.startsWith(`${sheet}::${rowKey}::`)) {
              delete next[k];
            }
          });
          return next;
        });

        // Re-fetch to update the view
        await fetchPreview();

        // Show success feedback
        console.log(
          `Deleted row ${rowKey}: ${result.deleted_count} cells removed`,
        );
      } catch (err) {
        console.error("Failed to delete row:", err);
        await radaiAlert(
          `Failed to delete row: ${err?.response?.data?.error || err?.message}`,
        );
      } finally {
        setDeleting(false);
        setDeleteConfirm(null);
      }
    },
    [jobId, workbook, fetchPreview],
  );

  const confirmDeleteRow = useCallback(() => {
    if (!deleteConfirm) return;
    executeDeleteRow(deleteConfirm.sheet, deleteConfirm.rowKey);
  }, [deleteConfirm, executeDeleteRow]);

  const cancelDeleteRow = useCallback(() => {
    setDeleteConfirm(null);
  }, []);

  /**
   * Handle Edit button click from actions column
   * Makes the specific row editable and scrolls it into view
   */
  const handleEditRow = useCallback(
    (rowKey) => {
      console.log("Edit row clicked:", rowKey);

      // Toggle editing: if already editing this row, stop editing; otherwise start editing
      if (editingRowKey === rowKey) {
        setEditingRowKey(null);
        console.log("Stopped editing row:", rowKey);
      } else {
        setEditingRowKey(rowKey);
        console.log("Started editing row:", rowKey);

        // Scroll row into view after a brief delay
        setTimeout(() => {
          const rowElement = document.querySelector(
            `tr[data-row-key="${rowKey}"]`,
          );
          if (rowElement) {
            rowElement.scrollIntoView({ behavior: "smooth", block: "center" });
            console.log("Scrolled to row:", rowKey);

            // Focus on first editable input in the row
            const firstInput = rowElement.querySelector(
              'input[type="text"]:not([readonly])',
            );
            if (firstInput) {
              firstInput.focus();
              console.log("Focused first input in row");
            }
          } else {
            console.warn("Row element not found for scrolling:", rowKey);
          }
        }, 100);
      }
    },
    [editingRowKey],
  );

  /**
   * Handle Delete button click from actions column
   * Opens confirmation modal before deleting
   */
  const handleDeleteFromActions = useCallback(
    (sheet, rowKey, rowIndex) => {
      console.log("Delete row clicked:", { sheet, rowKey, rowIndex });
      if (CANVAS_CONFIG.rowOperations.confirmDelete) {
        console.log("Opening delete confirmation modal");
        setDeleteConfirm({ sheet, rowKey, rowIndex });
      } else {
        console.log("Executing delete immediately (no confirmation)");
        executeDeleteRow(sheet, rowKey);
      }
    },
    [executeDeleteRow],
  );

  /**
   * Manual save all pending edits (when auto-save is disabled)
   */
  const saveAllPendingEdits = useCallback(async () => {
    const pendingCells = Object.entries(edits)
      .filter(([_, edit]) => edit.status === "editing")
      .map(([key, edit]) => {
        const [sheet_name, row_key, column_name] = key.split("::");
        return {
          workbook,
          sheet_name,
          row_key,
          column_name,
          value: edit.value,
        };
      });

    if (pendingCells.length === 0) {
      await radaiAlert("No pending edits to save");
      return;
    }

    setAutoSaveStatus("saving");
    try {
      const result = await specCustomizationAPI.batchSaveWorkbookCells(
        jobId,
        pendingCells,
      );

      // Mark all as saved
      setEdits((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((k) => {
          if (next[k].status === "editing") {
            next[k].status = "saved";
          }
        });
        return next;
      });

      setAutoSaveStatus("saved");
      setTimeout(() => setAutoSaveStatus(null), 2000);

      console.log(`Manually saved ${result.saved_count} cells`);
      if (result.s3_snapshot) {
        console.log("S3 snapshot created:", result.s3_snapshot.s3_key);
      }
    } catch (err) {
      console.error("Failed to save all edits:", err);
      setAutoSaveStatus("error");
      setTimeout(() => setAutoSaveStatus(null), 3000);
      await radaiAlert(
        `Failed to save: ${err?.response?.data?.error || err?.message}`,
      );
    }
  }, [edits, jobId, workbook]);

  // G��G�� Derived data for the active sheet G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
  const activeSheetData = useMemo(() => {
    if (!data || !activeSheet) return null;
    return data.sheets.find((s) => s.name === activeSheet) || null;
  }, [data, activeSheet]);

  // Headers after applying the column-visibility toggle for this sheet.
  const visibleHeaders = useMemo(() => {
    const headers = activeSheetData?.headers || [];
    if (!CANVAS_CONFIG.columnVisibility.enabled) return headers;
    const hidden = hiddenColumns[activeSheet];
    if (!hidden || hidden.size === 0) return headers;
    return headers.filter((h) => !hidden.has(h));
  }, [activeSheetData, hiddenColumns, activeSheet]);

  const toggleColumnHidden = useCallback(
    (header) => {
      setHiddenColumns((prev) => {
        const next = { ...prev };
        const setForSheet = new Set(next[activeSheet] || []);
        if (setForSheet.has(header)) setForSheet.delete(header);
        else setForSheet.add(header);
        next[activeSheet] = setForSheet;
        return next;
      });
    },
    [activeSheet],
  );

  const setAllColumnsHidden = useCallback(
    (hide) => {
      setHiddenColumns((prev) => ({
        ...prev,
        [activeSheet]: hide
          ? new Set(activeSheetData?.headers || [])
          : new Set(),
      }));
    },
    [activeSheet, activeSheetData],
  );

  const filteredRows = useMemo(() => {
    if (!activeSheetData) return [];
    const q = search.trim().toLowerCase();
    if (!q) return activeSheetData.rows;
    return activeSheetData.rows.filter((row) => {
      // Search across all cell values + the source.class_code hint.
      const code = row.source?.class_code || "";
      if (code.toLowerCase().includes(q)) return true;
      return Object.values(row.cells || {}).some(
        (v) =>
          v !== null && v !== undefined && String(v).toLowerCase().includes(q),
      );
    });
  }, [activeSheetData, search]);

  const totalRows =
    data?.sheets?.reduce((acc, s) => acc + (s.row_count || 0), 0) || 0;
  const editedKeys = Object.keys(edits).filter(
    (k) => edits[k]?.status === "saved",
  );

  // ─── Hub-variant derived data (sheet filter, pagination, details) ─────────
  const filteredSheets = useMemo(() => {
    if (!data) return [];
    const q = sheetFilter.trim().toLowerCase();
    if (!q) return data.sheets;
    return data.sheets.filter((s) => s.name.toLowerCase().includes(q));
  }, [data, sheetFilter]);

  const linkedRowCount = useMemo(() => {
    if (!activeSheetData) return 0;
    return activeSheetData.rows.filter(
      (r) => r.source?.class_id || r.source?.component_id,
    ).length;
  }, [activeSheetData]);

  const hubRowHeight = CANVAS_CONFIG.density.rowPx;
  const hubConfig = CANVAS_CONFIG.hub.virtual;
  const hubEffectiveViewportHeight =
    hubViewportHeight > 0
      ? hubViewportHeight
      : hubConfig.maxVisibleRows * hubRowHeight;
  const hubVisibleRowCount = Math.max(
    hubConfig.minVisibleRows,
    Math.min(
      hubConfig.maxVisibleRows,
      Math.ceil(hubEffectiveViewportHeight / hubRowHeight),
    ),
  );
  const hubFirstVisibleIndex = Math.max(
    0,
    Math.floor(hubScrollTop / hubRowHeight),
  );
  const hubLastVisibleIndex = Math.min(
    filteredRows.length,
    hubFirstVisibleIndex + hubVisibleRowCount,
  );
  const hubVirtualStart = Math.max(0, hubFirstVisibleIndex - hubConfig.overscanRows);
  const hubVirtualEnd = Math.min(
    filteredRows.length,
    hubLastVisibleIndex + hubConfig.overscanRows,
  );
  const hubVirtualRows = useMemo(
    () => filteredRows.slice(hubVirtualStart, hubVirtualEnd),
    [filteredRows, hubVirtualStart, hubVirtualEnd],
  );
  const hubVirtualTopSpacer = hubVirtualStart * hubRowHeight;
  const hubVirtualBottomSpacer = Math.max(
    0,
    (filteredRows.length - hubVirtualEnd) * hubRowHeight,
  );
  const hubRowsPerPage = hubVisibleRowCount;
  const hubPageCount = Math.max(
    1,
    Math.ceil(filteredRows.length / Math.max(1, hubRowsPerPage)),
  );
  const hubCurrentPage = filteredRows.length
    ? Math.min(
        hubPageCount,
        Math.floor(hubFirstVisibleIndex / Math.max(1, hubRowsPerPage)) + 1,
      )
    : 1;
  const hubFooterStart = filteredRows.length > 0 ? hubFirstVisibleIndex + 1 : 0;
  const hubFooterEnd = filteredRows.length > 0 ? hubLastVisibleIndex : 0;
  const detailsRowKey = isHub
    ? lastSelectedKey || filteredRows[0]?.row_key || null
    : null;
  const detailsRow = useMemo(() => {
    if (!detailsRowKey || !activeSheetData) return null;
    return (
      activeSheetData.rows.find((r) => r.row_key === detailsRowKey) || null
    );
  }, [detailsRowKey, activeSheetData]);

  const detailsRowNumber = useMemo(() => {
    if (!detailsRow || !activeSheetData) return 0;
    const idx = activeSheetData.rows.findIndex(
      (r) => r.row_key === detailsRow.row_key,
    );
    return idx >= 0 ? idx + 1 : 0;
  }, [detailsRow, activeSheetData]);

  const detailsRowTitle = useMemo(() => {
    if (!detailsRow) return "";
    for (const h of visibleHeaders) {
      const v = detailsRow.cells?.[h];
      if (v !== null && v !== undefined && String(v).trim() !== "")
        return String(v);
    }
    return sourceDisplay(detailsRow.source).label;
  }, [detailsRow, visibleHeaders]);

  // New sheet / new search / new workbook starts at top of the virtual list.
  useEffect(() => {
    if (!isHub) return;
    setHubScrollTop(0);
    if (hubViewportRef.current) {
      hubViewportRef.current.scrollTop = 0;
    }
  }, [isHub, activeSheet, search, workbook]);

  useEffect(() => {
    if (!isHub) return undefined;
    const viewport = hubViewportRef.current;
    if (!viewport) return undefined;
    const syncHeight = () => setHubViewportHeight(viewport.clientHeight || 0);
    syncHeight();
    if (typeof ResizeObserver === "undefined") return undefined;
    const resizeObserver = new ResizeObserver(syncHeight);
    resizeObserver.observe(viewport);
    return () => resizeObserver.disconnect();
  }, [isHub, detailsRow]);

  // G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
  // BULK ROW SELECTION
  // G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��

  const toggleRowSelection = useCallback(
    (rowKey) => {
      if (
        !selectedRows.has(rowKey) &&
        selectedRows.size >= CANVAS_CONFIG.rowOperations.maxBulkSelectRows
      ) {
        void radaiAlert(
          `Cannot select more than ${CANVAS_CONFIG.rowOperations.maxBulkSelectRows} rows at once`,
        );
        return;
      }
      setSelectedRows((prev) => {
        const next = new Set(prev);
        if (next.has(rowKey)) {
          next.delete(rowKey);
        } else {
          next.add(rowKey);
        }
        return next;
      });
    },
    [selectedRows],
  );

  const toggleSelectAll = useCallback(async () => {
    if (!activeSheetData) return;

    if (selectAllChecked) {
      setSelectedRows(new Set());
      setSelectAllChecked(false);
    } else {
      const visibleRowKeys = filteredRows.map((r) => r.row_key);
      if (
        visibleRowKeys.length > CANVAS_CONFIG.rowOperations.maxBulkSelectRows
      ) {
        await radaiAlert(
          `Cannot select more than ${CANVAS_CONFIG.rowOperations.maxBulkSelectRows} rows. Please use filters to reduce the count.`,
        );
        return;
      }
      setSelectedRows(new Set(visibleRowKeys));
      setSelectAllChecked(true);
    }
  }, [activeSheetData, filteredRows, selectAllChecked]);

  // ─── Hub-variant selection + validation helpers ───────────────────────────
  // Row selection drives the "Row details" panel; validation results are shown
  // in the panel and the bottom status bar instead of the chat drawer.
  const toggleHubRowSelection = useCallback(
    (rowKey) => {
      if (!selectedRows.has(rowKey)) setLastSelectedKey(rowKey);
      toggleRowSelection(rowKey);
    },
    [selectedRows, toggleRowSelection],
  );

  const hubPageKeys = hubVirtualRows.map((r) => r.row_key);
  const allHubPageSelected =
    hubPageKeys.length > 0 && hubPageKeys.every((k) => selectedRows.has(k));
  const someHubPageSelected = hubPageKeys.some((k) => selectedRows.has(k));

  const toggleHubPageSelection = useCallback(() => {
    const keys = hubVirtualRows.map((r) => r.row_key);
    if (keys.length === 0) return;
    setSelectedRows((prev) => {
      const next = new Set(prev);
      const everySelected = keys.every((k) => next.has(k));
      keys.forEach((k) => {
        if (everySelected) next.delete(k);
        else next.add(k);
      });
      return next;
    });
    setLastSelectedKey(keys[keys.length - 1]);
  }, [hubVirtualRows]);

  useEffect(() => {
    if (!isHub) return;
    if (filteredRows.length === 0) {
      if (selectedRows.size > 0) setSelectedRows(new Set());
      if (lastSelectedKey !== null) setLastSelectedKey(null);
      return;
    }
    const hasActiveSelection =
      lastSelectedKey &&
      selectedRows.has(lastSelectedKey) &&
      filteredRows.some((r) => r.row_key === lastSelectedKey);
    if (hasActiveSelection) return;
    const firstRowKey = filteredRows[0].row_key;
    setSelectedRows((prev) => {
      if (prev.size === 1 && prev.has(firstRowKey)) return prev;
      return new Set([firstRowKey]);
    });
    setLastSelectedKey(firstRowKey);
    setDetailsTab("properties");
  }, [isHub, filteredRows, selectedRows, lastSelectedKey]);

  const runHubValidation = useCallback(async () => {
    if (!jobId) return null;
    try {
      const result = await specCustomizationAPI.validateWorkbook(jobId, {
        workbook_scope: chatScope,
        active_workbook: workbook,
      });
      const sev = result?.severity_counts || {};
      return {
        status: result?.status || "warn",
        text: `${result?.checked_rows || 0} rows checked · ${result?.issues_total || 0} issues (high ${sev.high || 0}, medium ${sev.medium || 0}, low ${sev.low || 0})`,
      };
    } catch (err) {
      return {
        status: "error",
        text: err?.response?.data?.error || err?.message || "Validation failed",
      };
    }
  }, [jobId, workbook, chatScope]);

  const validateDetailsRow = useCallback(async () => {
    if (!detailsRow) return;
    setRowValidation({ status: "running", text: "Validating…" });
    setRowValidation(await runHubValidation());
  }, [detailsRow, runHubValidation]);

  const validateHubWorkbook = useCallback(async () => {
    setWorkbookValidation({ status: "running", text: "Validating workbook…" });
    const summary = await runHubValidation();
    setWorkbookValidation(summary);
    if (summary?.status === "error") await radaiAlert(summary.text);
  }, [runHubValidation]);

  const bulkDeleteSelectedRows = useCallback(async () => {
    if (selectedRows.size === 0) {
      await radaiAlert("No rows selected");
      return;
    }

    const confirmMsg = `Delete ${selectedRows.size} selected row${selectedRows.size === 1 ? "" : "s"}? This will remove all cell overrides for these rows.`;
    if (!(await radaiConfirm(confirmMsg))) return;

    setDeleting(true);
    try {
      const result = await specCustomizationAPI.bulkDeleteWorkbookRows(jobId, {
        workbook,
        sheet_name: activeSheet,
        row_keys: Array.from(selectedRows),
      });

      // Clear selected rows
      setSelectedRows(new Set());
      setSelectAllChecked(false);

      // Remove edits from local state
      setEdits((prev) => {
        const next = { ...prev };
        selectedRows.forEach((rowKey) => {
          Object.keys(next).forEach((k) => {
            if (k.startsWith(`${activeSheet}::${rowKey}::`)) {
              delete next[k];
            }
          });
        });
        return next;
      });

      await fetchPreview();
      console.log(
        `Bulk deleted ${result.deleted_rows} rows (${result.deleted_cells} cells)`,
      );
    } catch (err) {
      console.error("Failed to bulk delete rows:", err);
      await radaiAlert(
        `Failed to delete rows: ${err?.response?.data?.error || err?.message}`,
      );
    } finally {
      setDeleting(false);
    }
  }, [selectedRows, jobId, workbook, activeSheet, fetchPreview]);

  // G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
  // UNDO/REDO FUNCTIONALITY
  // G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��

  const performUndo = useCallback(async () => {
    if (undoHistory.length === 0) {
      await radaiAlert("Nothing to undo");
      return;
    }

    const lastAction = undoHistory[undoHistory.length - 1];

    try {
      if (lastAction.type === "edit") {
        // Restore previous value
        if (lastAction.previousValue === null) {
          await specCustomizationAPI.clearWorkbookCell(jobId, {
            workbook: lastAction.workbook,
            sheet_name: lastAction.sheet,
            row_key: lastAction.rowKey,
            column_name: lastAction.column,
          });
        } else {
          await specCustomizationAPI.saveWorkbookCell(jobId, {
            workbook: lastAction.workbook,
            sheet_name: lastAction.sheet,
            row_key: lastAction.rowKey,
            column_name: lastAction.column,
            value: lastAction.previousValue,
          });
        }
      } else if (lastAction.type === "delete_row") {
        // Cannot undo row deletion (would need to restore all cells)
        await radaiAlert(
          "Cannot undo row deletion. Please restore from S3 snapshot.",
        );
        return;
      }

      // Move from undo to redo stack
      setRedoHistory((prev) => [...prev, lastAction]);
      setUndoHistory((prev) => prev.slice(0, -1));

      await fetchPreview();
    } catch (err) {
      console.error("Failed to undo:", err);
      await radaiAlert(
        `Undo failed: ${err?.response?.data?.error || err?.message}`,
      );
    }
  }, [undoHistory, jobId, fetchPreview]);

  const performRedo = useCallback(async () => {
    if (redoHistory.length === 0) {
      await radaiAlert("Nothing to redo");
      return;
    }

    const lastRedo = redoHistory[redoHistory.length - 1];

    try {
      if (lastRedo.type === "edit") {
        await specCustomizationAPI.saveWorkbookCell(jobId, {
          workbook: lastRedo.workbook,
          sheet_name: lastRedo.sheet,
          row_key: lastRedo.rowKey,
          column_name: lastRedo.column,
          value: lastRedo.newValue,
        });
      }

      // Move from redo to undo stack
      setUndoHistory((prev) => [...prev, lastRedo]);
      setRedoHistory((prev) => prev.slice(0, -1));

      await fetchPreview();
    } catch (err) {
      console.error("Failed to redo:", err);
      await radaiAlert(
        `Redo failed: ${err?.response?.data?.error || err?.message}`,
      );
    }
  }, [redoHistory, jobId, fetchPreview]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    if (!CANVAS_CONFIG.undo.enabled) return;

    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        performUndo();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "y" || (e.key === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        performRedo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [performUndo, performRedo]);

  // G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
  // S3 SNAPSHOT MANAGEMENT
  // G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��

  const fetchS3Snapshots = useCallback(async () => {
    if (!CANVAS_CONFIG.s3Snapshots.enabled) return;

    setLoadingSnapshots(true);
    try {
      // Mock: In real implementation, call backend API to list S3 snapshots
      // const result = await specCustomizationAPI.listS3Snapshots(jobId, workbook);

      // For now, create mock snapshots
      const mockSnapshots = [
        {
          s3_key: `spec-customization/job-${jobId}/spec-20260706-143022.json.gz`,
          version_id: "v1",
          timestamp: new Date().toISOString(),
          cell_count: 5234,
          size_mb: 2.4,
        },
      ];

      setS3SnapshotsList(mockSnapshots);
    } catch (err) {
      console.error("Failed to fetch S3 snapshots:", err);
    } finally {
      setLoadingSnapshots(false);
    }
  }, [jobId, workbook]);

  const createManualSnapshot = useCallback(async () => {
    if (!CANVAS_CONFIG.s3Snapshots.enabled) return;

    setAutoSaveStatus("saving");
    try {
      // Trigger batch save which will create S3 snapshot if threshold exceeded
      const pendingCells = Object.entries(edits)
        .filter(
          ([_, edit]) => edit.status === "editing" || edit.status === "saved",
        )
        .map(([key, edit]) => {
          const [sheet_name, row_key, column_name] = key.split("::");
          return {
            workbook,
            sheet_name,
            row_key,
            column_name,
            value: edit.value,
          };
        });

      if (pendingCells.length === 0) {
        await radaiAlert("No data to snapshot. Please make some edits first.");
        return;
      }

      const result = await specCustomizationAPI.batchSaveWorkbookCells(
        jobId,
        pendingCells,
      );

      if (result.s3_snapshot) {
        setAutoSaveStatus("saved");
        setTimeout(() => setAutoSaveStatus(null), 2000);
        await radaiAlert(
          `Snapshot created: ${result.s3_snapshot.s3_key}\n${result.s3_snapshot.cell_count} cells (${result.s3_snapshot.size_mb} MB)`,
        );
        fetchS3Snapshots(); // Refresh list
      } else {
        await radaiAlert(
          "Snapshot not created. Cell count below threshold. Try editing more cells.",
        );
      }
    } catch (err) {
      console.error("Failed to create snapshot:", err);
      setAutoSaveStatus("error");
      setTimeout(() => setAutoSaveStatus(null), 3000);
      await radaiAlert(
        `Snapshot failed: ${err?.response?.data?.error || err?.message}`,
      );
    }
  }, [edits, jobId, workbook, fetchS3Snapshots]);

  const applyChatInstruction = useCallback(
    async (mode = "preview", instructionOverride = "", approvalToken = "") => {
      const instruction = (instructionOverride || chatInstruction).trim();
      if (!instruction) {
        await radaiAlert("Please enter an instruction first.");
        return;
      }

      setChatBusy(true);
      try {
        const result = await specCustomizationAPI.chatbotEditWorkbook(jobId, {
          instruction,
          workbook_scope: chatScope,
          active_workbook: workbook,
          preview_only: mode === "preview",
          ...(mode === "apply" ? { approval_token: approvalToken } : {}),
        });

        const updates = (result?.workbook_results || []).flatMap((wbResult) =>
          (wbResult?.planned_updates || []).map((update) => ({
            ...update,
            workbook: wbResult?.workbook || update.workbook || workbook,
          })),
        );

        if (mode === "preview") {
          setChatPreview(
            result?.approval_token
              ? {
                  instruction,
                  approvalToken: result.approval_token,
                  expiresIn: result.approval_expires_in || 0,
                  plannedCount: result.planned_count || updates.length,
                  updates,
                  documentContext: result?.document_context || {},
                  evidenceItems: result?.document_evidence || [],
                }
              : null,
          );
        }

        if (mode !== "preview") {
          const touched = new Set();
          (result?.workbook_results || []).forEach((wbResult) => {
            (wbResult?.planned_updates || []).forEach((u) => {
              touched.add(`${u.sheet_name}::${u.row_key}::${u.column_name}`);
            });
          });
          setChatTouchedKeys(touched);
          setTimeout(() => setChatTouchedKeys(new Set()), 6000);
        }

        setChatMessages((prev) => {
          const runtime = result?.runtime || {};
          const docCtx = result?.document_context || {};
          const evidence = result?.document_evidence || [];
          const autoValue = result?.auto_value || {};
          const confidence = result?.confidence || {};
          const rag = runtime?.rag || {};
          const cag = runtime?.cag || {};
          const sourceLabel =
            docCtx?.source === "s3"
              ? "S3 document context"
              : "Document context";
          const evidenceTop = evidence
            .slice(0, 2)
            .map((e) => `P${e.page}: ${e.snippet}`)
            .join(" || ");
          const next = [
            ...prev,
            {
              ts: Date.now(),
              mode,
              instruction,
              status: result?.warning ? "warning" : "ok",
              text:
                mode === "preview"
                  ? `Preview ready: ${result.planned_count || 0} planned cell updates across ${(result.workbooks || []).join(", ") || workbook}.`
                  : `Applied ${result.applied_count || 0} cell updates across ${(result.workbooks || []).join(", ") || workbook}.`,
              meta: `${sourceLabel}: ${docCtx?.filename || "n/a"}${docCtx?.page_count ? ` (${docCtx.page_count} pages)` : ""} | RAG rows top-k: ${rag?.top_k ?? "-"} | Doc chunks: ${rag?.document_evidence_count ?? evidence.length} | CAG: ${cag?.result_cache_hit ? "cache hit" : "cache miss"}${autoValue?.used ? ` | Auto value: ${autoValue?.resolved || "-"}` : ""}${confidence?.label ? ` | Confidence: ${confidence.label} (${confidence.score})` : ""}`,
              evidence: evidenceTop,
              evidenceItems: evidence,
              documentContext: docCtx,
              updates,
              warning: result?.warning || "",
              suggestion: result?.suggestions?.tip || "",
            },
          ];
          return next.slice(-CANVAS_CONFIG.chatbot.maxHistory);
        });

        if (mode !== "preview") {
          setChatInstruction("");
          setChatPreview(null);
          await fetchPreview();
        }
      } catch (err) {
        const msg =
          err?.response?.data?.error || err?.message || "Instruction failed";
        setChatMessages((prev) => {
          const runtime = err?.response?.data?.runtime || {};
          const docCtx = err?.response?.data?.document_context || {};
          const evidence = err?.response?.data?.document_evidence || [];
          const autoValue = err?.response?.data?.auto_value || {};
          const rag = runtime?.rag || {};
          const cag = runtime?.cag || {};
          const sourceLabel =
            docCtx?.source === "s3"
              ? "S3 document context"
              : "Document context";
          const evidenceTop = evidence
            .slice(0, 2)
            .map((e) => `P${e.page}: ${e.snippet}`)
            .join(" || ");
          const next = [
            ...prev,
            {
              ts: Date.now(),
              mode,
              instruction,
              status: "error",
              text: msg,
              meta: `${sourceLabel}: ${docCtx?.filename || "n/a"} | RAG rows top-k: ${rag?.top_k ?? "-"} | Doc chunks: ${rag?.document_evidence_count ?? evidence.length} | CAG: ${cag?.result_cache_hit ? "cache hit" : "cache miss"}${autoValue?.used ? ` | Auto value: ${autoValue?.resolved || "-"}` : ""}`,
              evidence: evidenceTop,
              evidenceItems: evidence,
              documentContext: docCtx,
              updates: [],
            },
          ];
          return next.slice(-CANVAS_CONFIG.chatbot.maxHistory);
        });
      } finally {
        setChatBusy(false);
      }
    },
    [chatInstruction, chatScope, fetchPreview, jobId, workbook],
  );

  const runWorkbookValidation = useCallback(async () => {
    if (!jobId) return;
    setChatBusy(true);
    try {
      const result = await specCustomizationAPI.validateWorkbook(jobId, {
        workbook_scope: chatScope,
        active_workbook: workbook,
      });

      const sev = result?.severity_counts || {};
      const status = result?.status || "warn";
      const statusLabel =
        status === "pass"
          ? "Validation passed"
          : status === "fail"
            ? "Validation found critical issues"
            : "Validation found warnings";
      const topIssues = (result?.issues || [])
        .slice(0, 2)
        .map((i) => `${i.sheet_name}/${i.column_name}: ${i.message}`)
        .join(" || ");

      setChatMessages((prev) => {
        const next = [
          ...prev,
          {
            ts: Date.now(),
            mode: "validate",
            instruction: "Validate extracted workbook data",
            status:
              status === "pass"
                ? "ok"
                : status === "fail"
                  ? "error"
                  : "warning",
            text: `${statusLabel}. Checked ${result?.checked_rows || 0} rows in ${result?.checked_sheets || 0} sheets.`,
            meta: `Issues: ${result?.issues_total || 0} | High: ${sev.high || 0} | Medium: ${sev.medium || 0} | Low: ${sev.low || 0}`,
            evidence: topIssues,
          },
        ];
        return next.slice(-CANVAS_CONFIG.chatbot.maxHistory);
      });
    } catch (err) {
      const msg =
        err?.response?.data?.error || err?.message || "Validation failed";
      setChatMessages((prev) => {
        const next = [
          ...prev,
          {
            ts: Date.now(),
            mode: "validate",
            instruction: "Validate extracted workbook data",
            status: "error",
            text: msg,
            meta: "Validation request failed",
          },
        ];
        return next.slice(-CANVAS_CONFIG.chatbot.maxHistory);
      });
    } finally {
      setChatBusy(false);
    }
  }, [jobId, chatScope, workbook]);

  const handleChatComposerKeyDown = useCallback(
    (e) => {
      if (e.key !== "Enter" || e.shiftKey) return;
      e.preventDefault();
      applyChatInstruction("preview");
    },
    [applyChatInstruction],
  );

  const applyApprovedChatPreview = useCallback(() => {
    if (!chatPreview?.approvalToken) return;
    applyChatInstruction(
      "apply",
      chatPreview.instruction,
      chatPreview.approvalToken,
    );
  }, [applyChatInstruction, chatPreview]);

  const clearChatHistory = useCallback(() => {
    setChatMessages([]);
    setCopiedMessageTs(null);
    setChatTouchedKeys(new Set());
    setChatPreview(null);
  }, []);

  const copyAssistantMessage = useCallback(async (msg) => {
    const payload = [
      msg.text,
      msg.warning,
      msg.meta,
      msg.evidence ? `Evidence: ${msg.evidence}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    if (!payload) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload);
        setCopiedMessageTs(msg.ts);
        setTimeout(() => setCopiedMessageTs(null), 1400);
        return;
      }
      // Fallback for older browsers.
      const ta = document.createElement("textarea");
      ta.value = payload;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopiedMessageTs(msg.ts);
      setTimeout(() => setCopiedMessageTs(null), 1400);
    } catch {
      // Swallow copy failures to avoid interrupting user flow.
    }
  }, []);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [chatMessages, chatBusy]);

  const restoreFromSnapshot = useCallback(
    async (snapshot) => {
      const confirmMsg = `Restore from snapshot created at ${new Date(snapshot.timestamp).toLocaleString()}?\nThis will overwrite current edits.`;
      if (!(await radaiConfirm(confirmMsg))) return;

      try {
        // Mock: In real implementation, call backend API to restore from S3
        // await specCustomizationAPI.restoreFromS3Snapshot(jobId, snapshot.s3_key, snapshot.version_id);

        await radaiAlert(
          "Restore from S3 snapshot is not yet implemented in backend API.\nPlease implement the backend endpoint first.",
        );

        // await fetchPreview();
        // setShowSnapshotPanel(false);
      } catch (err) {
        console.error("Failed to restore snapshot:", err);
        await radaiAlert(
          `Restore failed: ${err?.response?.data?.error || err?.message}`,
        );
      }
    },
    [jobId, fetchPreview],
  );

  // Clear selections when changing sheets
  useEffect(() => {
    setSelectedRows(new Set());
    setSelectAllChecked(false);
    setEditingRowKey(null); // Clear highlighted editing row
    setLastSelectedKey(null);
    setRowValidation(null);
  }, [activeSheet]);

  // Fetch snapshots when panel opens
  useEffect(() => {
    if (showSnapshotPanel && CANVAS_CONFIG.s3Snapshots.enabled) {
      fetchS3Snapshots();
    }
  }, [showSnapshotPanel, fetchS3Snapshots]);

  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          CANVAS_CONFIG.sheetNavigator.storageKey,
          sheetNavMode,
        );
      }
    } catch {
      // Ignore storage failures (private mode, quota, policy).
    }
  }, [sheetNavMode]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SPEC_CUSTOMIZATION_UI.storage.sheetRailOpen,
        String(sheetRailOpen),
      );
      window.localStorage.setItem(
        SPEC_CUSTOMIZATION_UI.storage.chatbotOpen,
        String(chatPanelOpen),
      );
    } catch {
      // Ignore storage failures (private mode, quota, policy).
    }
  }, [chatPanelOpen, sheetRailOpen]);

  useEffect(() => {
    if (!chatPanelOpen && !sheetRailOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      setChatPanelOpen(false);
      if (
        window.matchMedia(
          `(max-width: ${SPEC_CUSTOMIZATION_UI.layout.compactViewportPx - 1}px)`,
        ).matches
      ) {
        setSheetRailOpen(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [chatPanelOpen, sheetRailOpen]);

  // G��G�� Render G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
  if (!jobId) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 text-sm text-slate-500 dark:text-slate-400">
        Upload &amp; extract a spec first to use the workbook canvas.
      </div>
    );
  }

  const fsEnabled = CANVAS_CONFIG.fullscreen.mode !== "off";
  // When in CSS-overlay fullscreen (no native fullscreen element), pin the
  // root to the viewport; native fullscreen styles the element automatically.
  const overlayActive = isFullscreen && !document.fullscreenElement;
  const rootClass = overlayActive
    ? "spec-workspace spec-workspace--fullscreen fixed inset-0 bg-slate-50 dark:bg-slate-900 p-4 overflow-auto space-y-3"
    : "spec-workspace space-y-3";
  const rootStyle = {
    ...workbookWorkspaceStyle,
    ...(overlayActive
      ? { zIndex: CANVAS_CONFIG.fullscreen.overlayZIndex }
      : {}),
  };
  const gridMaxH = isFullscreen
    ? CANVAS_CONFIG.fullscreen.gridMaxHeightFS
    : CANVAS_CONFIG.fullscreen.gridMaxHeight;

  return (
    <div ref={rootRef} className={rootClass} style={rootStyle}>
      {/* G��G�� Header bar G�� workbook toggle + reload + stats G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G�� */}
      {!isHub && (
        <div className="spec-workspace__toolbar flex flex-wrap items-center gap-2 border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-800/95 px-2.5 py-2 shadow-sm backdrop-blur">
          <div
            className="flex gap-1 rounded-md bg-slate-100 dark:bg-slate-900 p-1"
            role="group"
            aria-label="Workbook"
          >
            {CANVAS_CONFIG.workbooks.map((wb) => (
              <button
                key={wb.key}
                onClick={() => setWorkbook(wb.key)}
                className="spec-workspace__segmented-button px-3 py-1.5 text-xs font-semibold rounded transition text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800"
                aria-pressed={workbook === wb.key}
                title={wb.description}
              >
                {wb.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setSheetRailOpen((open) => !open)}
            className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded flex items-center gap-1.5"
            aria-expanded={sheetRailOpen}
            aria-controls="workbook-sheet-navigator"
            title={SPEC_CUSTOMIZATION_UI.labels.openSheets}
          >
            <QueueListIcon className="w-4 h-4" />
            <span className="hidden sm:inline">
              {SPEC_CUSTOMIZATION_UI.labels.sheets}
            </span>
          </button>

          {CANVAS_CONFIG.chatbot.enabled && (
            <button
              onClick={() => setChatPanelOpen(true)}
              className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded flex items-center gap-1.5"
              aria-expanded={chatPanelOpen}
              aria-controls="workbook-chat-panel"
              title={SPEC_CUSTOMIZATION_UI.labels.openAssistant}
            >
              <ChatBubbleLeftRightIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Assistant</span>
              {chatPreview && (
                <span
                  className="w-2 h-2 rounded-full bg-amber-500"
                  aria-label="Review pending"
                />
              )}
            </button>
          )}

          <button
            onClick={fetchPreview}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-700 rounded-md disabled:opacity-50 flex items-center gap-1"
          >
            <ArrowPathIcon
              className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
            />
            Reload
          </button>

          {/* Edit Mode Toggle */}
          <button
            onClick={() => setEditModeEnabled(!editModeEnabled)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1 transition-all ${
              editModeEnabled
                ? "bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow ring-2 ring-purple-300"
                : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
            title={editModeEnabled ? "Disable editing" : "Enable editing"}
          >
            <PencilSquareIcon className="w-4 h-4" />
            Edit Mode {editModeEnabled ? "ON" : "OFF"}
          </button>

          {/* Auto Save Toggle */}
          <button
            onClick={() => setAutoSaveEnabled(!autoSaveEnabled)}
            disabled={!editModeEnabled}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              autoSaveEnabled
                ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow ring-2 ring-emerald-300"
                : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
            title={
              autoSaveEnabled
                ? "Disable auto-save (manual save required)"
                : "Enable auto-save"
            }
          >
            <CloudArrowUpIcon className="w-4 h-4" />
            Auto Save {autoSaveEnabled ? "ON" : "OFF"}
          </button>

          {/* Manual Save All Button (only shown when auto-save is disabled) */}
          {!autoSaveEnabled && editModeEnabled && (
            <button
              onClick={saveAllPendingEdits}
              disabled={
                Object.values(edits).filter((e) => e.status === "editing")
                  .length === 0
              }
              className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
              title="Save all pending edits"
            >
              <CheckCircleIcon className="w-4 h-4" />
              Save All (
              {
                Object.values(edits).filter((e) => e.status === "editing")
                  .length
              }
              )
            </button>
          )}

          {/* Bulk Delete Selected Button (only shown when rows are selected) */}
          {CANVAS_CONFIG.rowOperations.enableBulkSelect &&
            selectedRows.size > 0 &&
            editModeEnabled && (
              <button
                onClick={bulkDeleteSelectedRows}
                disabled={deleting}
                className="px-3 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                title={`Delete ${selectedRows.size} selected row${selectedRows.size === 1 ? "" : "s"}`}
              >
                <TrashIcon className="w-4 h-4" />
                Delete ({selectedRows.size})
              </button>
            )}

          {/* Undo Button */}
          {CANVAS_CONFIG.undo.enabled && CANVAS_CONFIG.undo.showUndoButton && (
            <button
              onClick={performUndo}
              disabled={undoHistory.length === 0 || !editModeEnabled}
              className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-700 rounded-md disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
              title={`Undo last action (${CANVAS_CONFIG.undo.undoKeyBinding})`}
            >
              <ArrowUturnUpIcon className="w-4 h-4" />
            </button>
          )}

          {/* Redo Button */}
          {CANVAS_CONFIG.undo.enabled && CANVAS_CONFIG.undo.showUndoButton && (
            <button
              onClick={performRedo}
              disabled={redoHistory.length === 0 || !editModeEnabled}
              className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-700 rounded-md disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
              title={`Redo (${CANVAS_CONFIG.undo.redoKeyBinding})`}
            >
              <ArrowUturnRightIcon className="w-4 h-4" />
            </button>
          )}

          {/* S3 Snapshot Button */}
          {CANVAS_CONFIG.s3Snapshots.enabled && (
            <button
              onClick={() => setShowSnapshotPanel(!showSnapshotPanel)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1 ${
                showSnapshotPanel
                  ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow ring-2 ring-cyan-300"
                  : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
              title="Manage S3 snapshots"
            >
              <ArchiveBoxIcon className="w-4 h-4" />
              Snapshots
            </button>
          )}

          <div className="ml-auto flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span className="hidden sm:inline">
              <strong className="text-slate-700 dark:text-slate-200">
                {totalRows}
              </strong>{" "}
              rows
              {data?.sheets
                ? `${CANVAS_CONFIG.userExperience.labels.rowsAndSheetsSep}${data.sheets.length} sheets`
                : ""}
            </span>
            {CANVAS_CONFIG.autoSave.indicator && autoSaveStatus && (
              <span
                className={`px-2 py-1 rounded-full flex items-center gap-1 ${
                  autoSaveStatus === "saving"
                    ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                    : autoSaveStatus === "saved"
                      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                      : "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
                }`}
              >
                {autoSaveStatus === "saving" ? (
                  <>
                    <CloudArrowUpIcon className="w-3.5 h-3.5 animate-pulse" />
                    Auto-saving...
                  </>
                ) : autoSaveStatus === "saved" ? (
                  <>
                    <CheckCircleIcon className="w-3.5 h-3.5" />
                    Saved to S3
                  </>
                ) : (
                  <>
                    <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                    Save failed
                  </>
                )}
              </span>
            )}
            {editedKeys.length > 0 && (
              <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200 flex items-center gap-1">
                <PencilSquareIcon className="w-3.5 h-3.5" />
                {editedKeys.length} saved edit
                {editedKeys.length === 1 ? "" : "s"}
              </span>
            )}
            {fsEnabled && (
              <button
                onClick={toggleFullscreen}
                className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-700 rounded-md flex items-center gap-1"
                title={
                  isFullscreen
                    ? CANVAS_CONFIG.fullscreen.exitHint
                    : CANVAS_CONFIG.fullscreen.enterHint
                }
              >
                {isFullscreen ? (
                  <ArrowsPointingInIcon className="w-4 h-4" />
                ) : (
                  <ArrowsPointingOutIcon className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">
                  {isFullscreen
                    ? CANVAS_CONFIG.fullscreen.exitLabel
                    : CANVAS_CONFIG.fullscreen.enterLabel}
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {isHub && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
          {/* SPEC / CAT segmented control */}
          <div
            className="flex gap-0.5 rounded-md bg-slate-100 p-0.5"
            role="group"
            aria-label="Workbook"
          >
            {CANVAS_CONFIG.workbooks.map((wb) => (
              <button
                key={wb.key}
                type="button"
                onClick={() => setWorkbook(wb.key)}
                aria-pressed={workbook === wb.key}
                title={wb.description}
                className={`rounded px-3.5 py-1.5 text-xs font-semibold transition ${
                  workbook === wb.key
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-white"
                }`}
              >
                {wb.label}
              </button>
            ))}
          </div>

          <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />

          {CANVAS_CONFIG.chatbot.enabled && (
            <button
              type="button"
              onClick={() => setChatPanelOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              aria-expanded={chatPanelOpen}
              aria-controls="workbook-chat-panel"
              title={SPEC_CUSTOMIZATION_UI.labels.openAssistant}
            >
              <ChatBubbleLeftRightIcon className="h-4 w-4" />
              Assistant
              {chatPreview && (
                <span
                  className="h-2 w-2 rounded-full bg-amber-500"
                  aria-label="Review pending"
                />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={fetchPreview}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            title="Reload workbook data"
          >
            <ArrowPathIcon
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Reload
          </button>

          <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />

          {/* Edit mode switch */}
          <button
            type="button"
            onClick={() => setEditModeEnabled(!editModeEnabled)}
            aria-pressed={editModeEnabled}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700"
            title={editModeEnabled ? "Disable editing" : "Enable editing"}
          >
            <span
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                editModeEnabled ? "bg-blue-600" : "bg-slate-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  editModeEnabled ? "translate-x-[18px]" : "translate-x-0.5"
                }`}
              />
            </span>
            Edit mode
          </button>

          {/* Save status */}
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
            {autoSaveStatus === "saving" ? (
              <>
                <ArrowPathIcon className="h-4 w-4 animate-spin text-blue-600" />
                <span className="text-blue-600">
                  {HUB_LABELS.savingChanges}
                </span>
              </>
            ) : autoSaveStatus === "error" ? (
              <>
                <ExclamationTriangleIcon className="h-4 w-4 text-rose-500" />
                <span className="text-rose-600">{HUB_LABELS.saveFailed}</span>
              </>
            ) : (
              <>
                <CheckCircleIcon className="h-4 w-4 text-emerald-500" />
                <span className="text-emerald-600">Saved</span>
              </>
            )}
          </span>

          {/* Undo / redo */}
          <button
            type="button"
            onClick={performUndo}
            disabled={undoHistory.length === 0 || !editModeEnabled}
            className="rounded-full border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-transparent"
            title={`Undo last action (${CANVAS_CONFIG.undo.undoKeyBinding})`}
          >
            <ArrowUturnUpIcon className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={performRedo}
            disabled={redoHistory.length === 0 || !editModeEnabled}
            className="rounded-full border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-transparent"
            title={`Redo (${CANVAS_CONFIG.undo.redoKeyBinding})`}
          >
            <ArrowUturnRightIcon className="h-3.5 w-3.5" />
          </button>

          <div className="ml-auto flex items-center gap-2">
            {fsEnabled && (
              <button
                type="button"
                onClick={toggleFullscreen}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                title={
                  isFullscreen
                    ? CANVAS_CONFIG.fullscreen.exitHint
                    : CANVAS_CONFIG.fullscreen.enterHint
                }
              >
                {isFullscreen ? (
                  <ArrowsPointingInIcon className="h-4 w-4" />
                ) : (
                  <ArrowsPointingOutIcon className="h-4 w-4" />
                )}
                Full screen
              </button>
            )}
          </div>
        </div>
      )}

      {loadError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-sm px-3 py-2 flex items-center gap-2">
          <ExclamationTriangleIcon className="w-4 h-4" />
          {loadError}
        </div>
      )}

      {CANVAS_CONFIG.unroutedBanner.enabled &&
        workbook === "cat" &&
        data?.unrouted_components?.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 text-sm px-3 py-2.5">
            <div className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-200">
              <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0" />
              {CANVAS_CONFIG.unroutedBanner.title}{" "}
              <span className="font-normal text-amber-700 dark:text-amber-300">
                ({data.unrouted_components.reduce((sum, g) => sum + g.count, 0)}{" "}
                components)
              </span>
            </div>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
              {CANVAS_CONFIG.unroutedBanner.helpText}
            </p>
            <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-amber-800 dark:text-amber-200">
              {data.unrouted_components
                .slice(0, CANVAS_CONFIG.unroutedBanner.maxGroupsShown)
                .map((g) => (
                  <li key={`${g.component_type}::${g.sub_type}`}>
                    <span className="font-medium">
                      {g.sub_type || g.component_type}
                    </span>
                    {" x "}
                    {g.count}
                  </li>
                ))}
              {data.unrouted_components.length >
                CANVAS_CONFIG.unroutedBanner.maxGroupsShown && (
                <li className="italic opacity-75">
                  +
                  {data.unrouted_components.length -
                    CANVAS_CONFIG.unroutedBanner.maxGroupsShown}{" "}
                  {CANVAS_CONFIG.userExperience.labels.showMoreSuffix}
                </li>
              )}
            </ul>
          </div>
        )}

      {CANVAS_CONFIG.userExperience.showQuickGuide && (
        <div className="rounded-xl border border-sky-200 bg-sky-50/70 dark:bg-sky-900/20 dark:border-sky-900/40 px-3 py-2.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300">
            Quick Guide
          </div>
          <div className="mt-1 grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-sky-900 dark:text-sky-100">
            <div>
              <span className="font-semibold">1.</span> Pick a sheet and review
              rows.
            </div>
            <div>
              <span className="font-semibold">2.</span> Ask chatbot to apply
              targeted edits.
            </div>
            <div>
              <span className="font-semibold">3.</span> Verify highlights, then
              export SPEC/CAT.
            </div>
          </div>
        </div>
      )}

      {/* G��G�� Main split: sheet sidebar + grid G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G�� */}
      {!loadError && data && (
        <div
          className={
            isHub
              ? `grid grid-cols-1 gap-3 min-[1100px]:grid-cols-[230px_minmax(0,1fr)] ${
                  detailsRow
                    ? "min-[1400px]:grid-cols-[230px_minmax(0,1fr)_330px]"
                    : ""
                }`
              : `spec-workspace__layout ${sheetRailOpen ? "" : "spec-workspace__layout--rail-closed"}`
          }
        >
          {isHub && sheetRailOpen && (
            <aside
              id="workbook-sheet-navigator"
              className="spec-workspace__sheet-rail flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
              aria-label="Workbook sheets"
            >
              <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800">
                    {HUB_LABELS.sheets}
                  </span>
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                    {data.sheets.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSheetRailOpen(false)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Collapse sheet navigator"
                  title="Collapse sheet navigator"
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                </button>
              </div>
              <div className="border-b border-slate-100 p-2">
                <div className="relative">
                  <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={sheetFilter}
                    onChange={(e) => setSheetFilter(e.target.value)}
                    placeholder={HUB_LABELS.findSheet}
                    className="w-full rounded-md border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-2 text-xs text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>
              <div className="spec-workspace__sheet-list flex-1 space-y-0.5 overflow-y-auto p-1.5">
                {filteredSheets.map((s) => {
                  const active = s.name === activeSheet;
                  return (
                    <button
                      key={s.name}
                      type="button"
                      onClick={() => setActiveSheet(s.name)}
                      aria-current={active}
                      title={s.name}
                      className={`flex w-full items-center justify-between gap-2 rounded-md border-l-2 px-2.5 py-1.5 text-left text-xs transition ${
                        active
                          ? "border-blue-600 bg-blue-50 font-medium text-blue-700"
                          : "border-transparent text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <span className="truncate">{s.name}</span>
                      <span
                        className={`tabular-nums ${active ? "text-blue-500" : "text-slate-400"}`}
                      >
                        {s.row_count}
                      </span>
                    </button>
                  );
                })}
                {filteredSheets.length === 0 && (
                  <p className="px-2 py-3 text-xs italic text-slate-400">
                    {SPEC_CUSTOMIZATION_UI.labels.noSheetResults}
                  </p>
                )}
              </div>
            </aside>
          )}

          {!isHub && (
            <>
              {sheetRailOpen && (
                <button
                  type="button"
                  className="spec-workspace__drawer-backdrop spec-workspace__sheet-backdrop"
                  onClick={() => setSheetRailOpen(false)}
                  aria-label="Close sheet navigator"
                />
              )}
              {/* Sheet list */}
              <div
                id="workbook-sheet-navigator"
                className={`spec-workspace__sheet-rail ${sheetRailOpen ? "" : "spec-workspace__sheet-rail--closed"} rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 flex flex-col overflow-hidden`}
                aria-label="Workbook sheets"
              >
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>{SPEC_CUSTOMIZATION_UI.labels.sheets}</span>
                    <span className="text-[10px] font-medium normal-case text-slate-400">
                      {data.sheets.length} total
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="inline-flex rounded-md border border-slate-200 dark:border-slate-700 overflow-hidden">
                      <button
                        onClick={() => setSheetNavMode("compact")}
                        className={`spec-workspace__segmented-button px-2 py-1 text-[10px] font-semibold normal-case transition ${
                          sheetNavMode === "compact"
                            ? ""
                            : "bg-white text-slate-500 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                        }`}
                        aria-pressed={sheetNavMode === "compact"}
                        title="Compact chip view"
                      >
                        Compact
                      </button>
                      <button
                        onClick={() => setSheetNavMode("detailed")}
                        className={`spec-workspace__segmented-button px-2 py-1 text-[10px] font-semibold normal-case transition ${
                          sheetNavMode === "detailed"
                            ? ""
                            : "bg-white text-slate-500 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                        }`}
                        aria-pressed={sheetNavMode === "detailed"}
                        title="Detailed list view"
                      >
                        Detailed
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSheetRailOpen(false)}
                      className="p-1 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                      aria-label="Close sheet navigator"
                      title="Close sheet navigator"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div
                  className={`spec-workspace__sheet-list ${
                    sheetNavMode === "compact"
                      ? "flex flex-col gap-1 px-1 pb-1"
                      : "flex flex-col gap-0.5 px-1 pb-1"
                  }`}
                >
                  {data.sheets.map((s) => {
                    const active = s.name === activeSheet;
                    return (
                      <button
                        key={s.name}
                        onClick={() => setActiveSheet(s.name)}
                        className={`spec-workspace__sheet-button w-full inline-flex items-center justify-between gap-2 px-2.5 py-1.5 text-left text-xs rounded-md transition ${
                          active
                            ? ""
                            : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900"
                        }`}
                        aria-current={active}
                        title={s.name}
                      >
                        <span className="truncate font-medium">{s.name}</span>
                        <span
                          className={`text-[10px] tabular-nums ${active ? "opacity-90" : "text-slate-400"}`}
                        >
                          {s.row_count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          <div className="spec-workspace__grid-column space-y-3">
            {/* Edit Mode Disabled Banner */}
            {!editModeEnabled && (
              <div className="rounded-xl border-2 border-amber-300 bg-amber-50 dark:bg-amber-900/20 p-3 flex items-center gap-3">
                <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                    Edit Mode is Disabled
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                    Click the &quot;Edit Mode OFF&quot; button above to enable
                    cell editing.
                  </p>
                </div>
                <button
                  onClick={() => setEditModeEnabled(true)}
                  className="px-3 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-md flex items-center gap-1"
                >
                  <PencilSquareIcon className="w-4 h-4" />
                  Enable Now
                </button>
              </div>
            )}

            {/* Auto-Save Disabled Banner */}
            {editModeEnabled && !autoSaveEnabled && (
              <div className="rounded-xl border-2 border-blue-300 bg-blue-50 dark:bg-blue-900/20 p-3 flex items-center gap-3">
                <CloudArrowUpIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                    Auto-Save is Disabled
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                    Your changes are tracked locally. Click &quot;Save All&quot;
                    to persist them, or enable Auto-Save.
                  </p>
                </div>
                <button
                  onClick={saveAllPendingEdits}
                  disabled={
                    Object.values(edits).filter((e) => e.status === "editing")
                      .length === 0
                  }
                  className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <CheckCircleIcon className="w-4 h-4" />
                  Save All Now
                </button>
              </div>
            )}

            {/* Grid */}
            {!isHub && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden flex flex-col">
                <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 px-3 py-2">
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
                    {activeSheet ||
                      CANVAS_CONFIG.userExperience.labels.activeSheetFallback}
                  </div>
                  {activeSheetData && (
                    <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                      {filteredRows.length} / {activeSheetData.row_count} rows
                    </span>
                  )}
                  {CANVAS_CONFIG.userExperience.showGridSearch && (
                    <div className="ml-auto relative">
                      <MagnifyingGlassIcon className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={
                          CANVAS_CONFIG.userExperience.labels.searchPlaceholder
                        }
                        className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-300"
                      />
                    </div>
                  )}
                  {/* Column visibility toggle (soft-coded) */}
                  {CANVAS_CONFIG.columnVisibility.enabled &&
                    activeSheetData && (
                      <div
                        className={`relative ${CANVAS_CONFIG.userExperience.showGridSearch ? "" : "ml-auto"}`}
                      >
                        <button
                          onClick={() => setColMenuOpen((o) => !o)}
                          className="px-2.5 py-1.5 text-xs font-semibold rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1"
                        >
                          <QueueListIcon className="w-4 h-4" />
                          {CANVAS_CONFIG.columnVisibility.label}
                          {(hiddenColumns[activeSheet]?.size || 0) > 0 && (
                            <span className="px-1 py-0.5 text-[10px] font-bold bg-pink-100 text-pink-700 rounded-full">
                              {hiddenColumns[activeSheet].size}{" "}
                              {CANVAS_CONFIG.columnVisibility.hiddenCountSuffix}
                            </span>
                          )}
                        </button>
                        {colMenuOpen && (
                          <div className="absolute right-0 mt-1 w-64 max-h-72 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg z-40 p-2">
                            <div className="flex items-center justify-between gap-2 px-1 pb-1.5 border-b border-slate-100 dark:border-slate-700 mb-1">
                              <button
                                onClick={() => setAllColumnsHidden(false)}
                                className="text-[11px] font-semibold text-blue-600 hover:underline"
                              >
                                {CANVAS_CONFIG.columnVisibility.showAllLabel}
                              </button>
                              <button
                                onClick={() => setAllColumnsHidden(true)}
                                className="text-[11px] font-semibold text-slate-500 hover:underline"
                              >
                                {CANVAS_CONFIG.columnVisibility.hideAllLabel}
                              </button>
                            </div>
                            {(activeSheetData.headers || []).map((h) => {
                              const isHidden =
                                hiddenColumns[activeSheet]?.has(h);
                              return (
                                <label
                                  key={h}
                                  className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={!isHidden}
                                    onChange={() => toggleColumnHidden(h)}
                                    className="w-3.5 h-3.5 accent-pink-600"
                                  />
                                  <span
                                    className="text-xs text-slate-700 dark:text-slate-200 truncate"
                                    title={h}
                                  >
                                    {h}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                </div>

                {loading ? (
                  <div className="p-6 text-sm text-slate-500 flex items-center gap-2">
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />{" "}
                    {CANVAS_CONFIG.userExperience.labels.loadingWorkbook}
                  </div>
                ) : !activeSheetData || activeSheetData.rows.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    {CANVAS_CONFIG.emptySheetMessage}
                  </div>
                ) : (
                  <div
                    className="spec-workspace__grid-viewport"
                    style={isFullscreen ? { height: gridMaxH } : undefined}
                  >
                    <table
                      className="min-w-full text-xs border-collapse"
                      style={{
                        minWidth:
                          CANVAS_CONFIG.rowHeaderMinWidthPx +
                          visibleHeaders.length * CANVAS_CONFIG.cellMinWidthPx +
                          (CANVAS_CONFIG.rowOperations.showActionsColumn
                            ? CANVAS_CONFIG.rowOperations.actionsColumnWidth
                            : 0) +
                          (CANVAS_CONFIG.rowOperations.enableBulkSelect &&
                          editModeEnabled
                            ? BULK_SELECT_COLUMN_WIDTH
                            : 0) +
                          (CANVAS_CONFIG.rowOperations.enableDelete
                            ? DELETE_COLUMN_WIDTH
                            : 0),
                      }}
                    >
                      <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300">
                        <tr
                          style={{ height: CANVAS_CONFIG.density.headerRowPx }}
                        >
                          {/* Bulk Selection Checkbox */}
                          {CANVAS_CONFIG.rowOperations.enableBulkSelect &&
                            editModeEnabled && (
                              <th
                                className="sticky z-30 bg-slate-50 dark:bg-slate-900 border-b border-r border-slate-200 dark:border-slate-700 px-2"
                                style={{
                                  left: 0,
                                  width: BULK_SELECT_COLUMN_WIDTH,
                                  minWidth: BULK_SELECT_COLUMN_WIDTH,
                                }}
                              >
                                <button
                                  onClick={toggleSelectAll}
                                  className="flex items-center justify-center w-5 h-5 rounded border-2 border-slate-400 hover:border-purple-500 transition-colors"
                                  title={
                                    selectAllChecked
                                      ? "Deselect all"
                                      : "Select all visible rows"
                                  }
                                >
                                  {selectAllChecked ? (
                                    <CheckIconSolid className="w-4 h-4 text-purple-600" />
                                  ) : selectedRows.size > 0 &&
                                    selectedRows.size < filteredRows.length ? (
                                    <MinusIcon className="w-3 h-3 text-purple-600" />
                                  ) : null}
                                </button>
                              </th>
                            )}
                          {CANVAS_CONFIG.rowOperations.enableDelete && (
                            <th
                              className="sticky z-30 bg-slate-50 dark:bg-slate-900 border-b border-r border-slate-200 dark:border-slate-700 px-2"
                              style={{
                                left:
                                  CANVAS_CONFIG.rowOperations
                                    .enableBulkSelect && editModeEnabled
                                    ? BULK_SELECT_COLUMN_WIDTH
                                    : 0,
                                width: DELETE_COLUMN_WIDTH,
                                minWidth: DELETE_COLUMN_WIDTH,
                              }}
                            >
                              <TrashIcon className="w-4 h-4 text-slate-400 mx-auto" />
                            </th>
                          )}
                          <th
                            className="sticky z-20 bg-slate-50 dark:bg-slate-900 text-left font-semibold border-b border-r border-slate-200 dark:border-slate-700 px-2"
                            style={{
                              left:
                                (CANVAS_CONFIG.rowOperations.enableBulkSelect &&
                                editModeEnabled
                                  ? BULK_SELECT_COLUMN_WIDTH
                                  : 0) +
                                (CANVAS_CONFIG.rowOperations.enableDelete
                                  ? DELETE_COLUMN_WIDTH
                                  : 0),
                              minWidth: CANVAS_CONFIG.rowHeaderMinWidthPx,
                              width: CANVAS_CONFIG.rowHeaderMinWidthPx,
                            }}
                          >
                            Source
                          </th>
                          {visibleHeaders.map((h) => (
                            <th
                              key={h}
                              className="text-left font-semibold border-b border-slate-200 dark:border-slate-700 px-2 whitespace-nowrap"
                              style={{ minWidth: CANVAS_CONFIG.cellMinWidthPx }}
                              title={h}
                            >
                              {h}
                            </th>
                          ))}
                          {/* Actions Column Header */}
                          {CANVAS_CONFIG.rowOperations.showActionsColumn && (
                            <th
                              className="text-center font-semibold border-b border-slate-200 dark:border-slate-700 px-2 sticky right-0 bg-slate-50 dark:bg-slate-900"
                              style={{
                                minWidth:
                                  CANVAS_CONFIG.rowOperations
                                    .actionsColumnWidth,
                              }}
                            >
                              {CANVAS_CONFIG.rowOperations.actionsColumnLabel}
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows.map((row, idx) => (
                          <tr
                            key={row.row_key}
                            data-row-key={row.row_key}
                            className={`hover:bg-pink-50/40 dark:hover:bg-slate-700/40 group ${
                              editingRowKey === row.row_key
                                ? "bg-blue-50 dark:bg-blue-900/20 ring-2 ring-inset ring-blue-400 dark:ring-blue-600"
                                : selectedRows.has(row.row_key)
                                  ? "bg-purple-50 dark:bg-purple-900/20"
                                  : ""
                            }`}
                            style={{ height: CANVAS_CONFIG.density.rowPx }}
                          >
                            {/* Bulk Selection Checkbox */}
                            {CANVAS_CONFIG.rowOperations.enableBulkSelect &&
                              editModeEnabled && (
                                <td
                                  className="sticky z-20 bg-white dark:bg-slate-800 border-b border-r border-slate-200 dark:border-slate-700 px-2 text-center"
                                  style={{
                                    left: 0,
                                    width: BULK_SELECT_COLUMN_WIDTH,
                                    minWidth: BULK_SELECT_COLUMN_WIDTH,
                                  }}
                                >
                                  <button
                                    onClick={() =>
                                      toggleRowSelection(row.row_key)
                                    }
                                    className={`flex items-center justify-center w-5 h-5 rounded border-2 transition-all ${
                                      selectedRows.has(row.row_key)
                                        ? "border-purple-600 bg-purple-600"
                                        : "border-slate-400 hover:border-purple-500"
                                    }`}
                                    title={
                                      selectedRows.has(row.row_key)
                                        ? "Deselect row"
                                        : "Select row"
                                    }
                                  >
                                    {selectedRows.has(row.row_key) && (
                                      <CheckIconSolid className="w-4 h-4 text-white" />
                                    )}
                                  </button>
                                </td>
                              )}
                            {CANVAS_CONFIG.rowOperations.enableDelete && (
                              <td
                                className="sticky z-20 bg-white dark:bg-slate-800 border-b border-r border-slate-200 dark:border-slate-700 px-2 text-center"
                                style={{
                                  left:
                                    CANVAS_CONFIG.rowOperations
                                      .enableBulkSelect && editModeEnabled
                                      ? BULK_SELECT_COLUMN_WIDTH
                                      : 0,
                                  width: DELETE_COLUMN_WIDTH,
                                  minWidth: DELETE_COLUMN_WIDTH,
                                }}
                              >
                                <button
                                  onClick={() =>
                                    handleDeleteRow(
                                      activeSheet,
                                      row.row_key,
                                      idx,
                                    )
                                  }
                                  disabled={deleting || !editModeEnabled}
                                  className={`text-rose-500 hover:text-rose-700 disabled:opacity-30 transition-opacity ${
                                    CANVAS_CONFIG.rowOperations
                                      .showRowActions === "hover"
                                      ? "opacity-0 group-hover:opacity-100"
                                      : "opacity-100"
                                  }`}
                                  title={
                                    !editModeEnabled
                                      ? "Enable Edit Mode to delete rows"
                                      : "Delete this row"
                                  }
                                >
                                  <TrashIcon className="w-4 h-4" />
                                </button>
                              </td>
                            )}
                            {(() => {
                              const source = sourceDisplay(row.source);
                              return (
                                <td
                                  className="spec-workspace__source-cell sticky z-10 bg-white dark:bg-slate-800 border-b border-r border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] text-slate-600 dark:text-slate-300 whitespace-nowrap"
                                  style={{
                                    left:
                                      (CANVAS_CONFIG.rowOperations
                                        .enableBulkSelect && editModeEnabled
                                        ? BULK_SELECT_COLUMN_WIDTH
                                        : 0) +
                                      (CANVAS_CONFIG.rowOperations.enableDelete
                                        ? DELETE_COLUMN_WIDTH
                                        : 0),
                                    minWidth: CANVAS_CONFIG.rowHeaderMinWidthPx,
                                    width: CANVAS_CONFIG.rowHeaderMinWidthPx,
                                    maxWidth: CANVAS_CONFIG.rowHeaderMinWidthPx,
                                  }}
                                  title={`${source.label} | ${source.detail} | ${row.row_key}`}
                                >
                                  <div className="font-semibold text-slate-700 dark:text-slate-200 truncate">
                                    {source.label}
                                  </div>
                                  <div className="text-[10px] text-slate-400 truncate">
                                    {source.detail}
                                  </div>
                                </td>
                              );
                            })()}
                            {visibleHeaders.map((col) => {
                              const k = editKey(activeSheet, row.row_key, col);
                              const local = edits[k];
                              const raw = row.cells?.[col];
                              const value = local
                                ? local.value
                                : toInputValue(raw);
                              const wasOverridden = (
                                row.overridden || []
                              ).includes(col);
                              const status = local?.status;
                              // Cell is editable if: Edit Mode is ON globally OR this specific row is being edited
                              const isRowEditable =
                                editModeEnabled ||
                                editingRowKey === row.row_key;
                              const cellCls =
                                status === "saving"
                                  ? CANVAS_CONFIG.highlight.saving
                                  : status === "saved"
                                    ? CANVAS_CONFIG.highlight.saved
                                    : status === "error"
                                      ? CANVAS_CONFIG.highlight.error
                                      : status === "editing"
                                        ? CANVAS_CONFIG.highlight.edited
                                        : chatTouchedKeys.has(k)
                                          ? CANVAS_CONFIG.highlight.chatbot
                                          : wasOverridden
                                            ? CANVAS_CONFIG.highlight.edited
                                            : "";
                              return (
                                <td
                                  key={col}
                                  className={`border-b border-slate-100 dark:border-slate-700 px-1 py-0.5 align-middle ${cellCls}`}
                                  style={{
                                    minWidth: CANVAS_CONFIG.cellMinWidthPx,
                                  }}
                                >
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="text"
                                      value={value}
                                      onChange={(e) =>
                                        queueSave(
                                          activeSheet,
                                          row.row_key,
                                          col,
                                          e.target.value,
                                          raw ?? null,
                                        )
                                      }
                                      readOnly={!isRowEditable}
                                      disabled={!isRowEditable}
                                      className={`w-full bg-transparent outline-none px-1.5 py-1 text-[11px] focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-pink-300 rounded ${
                                        !isRowEditable
                                          ? "cursor-not-allowed opacity-60"
                                          : ""
                                      }`}
                                      title={
                                        !isRowEditable
                                          ? "Click Edit button or enable Edit Mode to modify this cell"
                                          : status === "error"
                                            ? local.error
                                            : undefined
                                      }
                                    />
                                    {isRowEditable &&
                                      (wasOverridden ||
                                        status === "saved" ||
                                        status === "error") && (
                                        <button
                                          onClick={() =>
                                            clearCell(
                                              activeSheet,
                                              row.row_key,
                                              col,
                                            )
                                          }
                                          className="opacity-60 hover:opacity-100 text-slate-500 hover:text-rose-500"
                                          title="Reset to extracted value"
                                        >
                                          <ArrowUturnLeftIcon className="w-3 h-3" />
                                        </button>
                                      )}
                                    {status === "saved" && (
                                      <CheckCircleIcon
                                        className="w-3 h-3 text-emerald-500"
                                        title="Saved"
                                      />
                                    )}
                                    {status === "saving" && (
                                      <ArrowPathIcon
                                        className="w-3 h-3 animate-spin text-blue-500"
                                        title="SavingGǪ"
                                      />
                                    )}
                                  </div>
                                </td>
                              );
                            })}

                            {/* Actions Column Cell */}
                            {CANVAS_CONFIG.rowOperations.showActionsColumn && (
                              <td
                                className={`border-b border-slate-200 dark:border-slate-700 px-2 text-center sticky right-0 ${
                                  editingRowKey === row.row_key
                                    ? "bg-blue-50 dark:bg-blue-900/20"
                                    : "bg-white dark:bg-slate-800"
                                }`}
                                style={{
                                  minWidth:
                                    CANVAS_CONFIG.rowOperations
                                      .actionsColumnWidth,
                                }}
                              >
                                <div
                                  className={`flex items-center justify-center gap-2 ${
                                    CANVAS_CONFIG.rowOperations
                                      .showRowActions === "hover"
                                      ? "opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto"
                                      : "opacity-100"
                                  }`}
                                >
                                  {/* Edit Button */}
                                  {CANVAS_CONFIG.rowOperations
                                    .enableRowEdit && (
                                    <button
                                      onClick={() => handleEditRow(row.row_key)}
                                      className={`px-2 py-1 text-xs font-semibold rounded transition-colors flex items-center gap-1 ${
                                        editingRowKey === row.row_key
                                          ? "bg-blue-600 text-white shadow-sm"
                                          : "bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-900/40 dark:hover:bg-blue-800/60 dark:text-blue-300"
                                      }`}
                                      title={
                                        editingRowKey === row.row_key
                                          ? "Stop editing (click to finish)"
                                          : "Edit this row (cells become editable)"
                                      }
                                    >
                                      <PencilIcon className="w-3.5 h-3.5" />
                                      {editingRowKey === row.row_key && (
                                        <span className="text-[10px] font-bold">
                                          ON
                                        </span>
                                      )}
                                    </button>
                                  )}

                                  {/* Delete Button */}
                                  {CANVAS_CONFIG.rowOperations
                                    .enableRowDelete && (
                                    <button
                                      onClick={() =>
                                        handleDeleteFromActions(
                                          activeSheet,
                                          row.row_key,
                                          idx,
                                        )
                                      }
                                      disabled={deleting}
                                      className="px-2 py-1 text-xs font-semibold bg-rose-100 hover:bg-rose-200 text-rose-700 dark:bg-rose-900/40 dark:hover:bg-rose-800/60 dark:text-rose-300 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                      title="Delete this row"
                                    >
                                      <TrashIcon className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {isHub && !sheetRailOpen && (
              <button
                type="button"
                onClick={() => setSheetRailOpen(true)}
                className="inline-flex items-center gap-1.5 self-start rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
              >
                <QueueListIcon className="h-4 w-4" />
                {HUB_LABELS.sheets}
              </button>
            )}
            {isHub && (
              <div
                className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
                style={{
                  height: isFullscreen ? gridMaxH : "var(--spec-work-area-height)",
                }}
              >
                {/* Card header: sheet name + stats + row search + column toggle */}
                <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-slate-900">
                      {activeSheet ||
                        CANVAS_CONFIG.userExperience.labels.activeSheetFallback}
                    </h3>
                    {activeSheetData && (
                      <p className="mt-0.5 text-xs text-slate-500">
                        {HUB_LABELS.sheetStats(
                          activeSheetData.row_count,
                          linkedRowCount,
                        )}
                      </p>
                    )}
                  </div>
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    {CANVAS_CONFIG.userExperience.showGridSearch && (
                      <div className="relative">
                        <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder={HUB_LABELS.searchRows}
                          className="w-52 rounded-md border border-slate-200 bg-white py-1.5 pl-8 pr-2 text-xs text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                    )}
                    {CANVAS_CONFIG.columnVisibility.enabled &&
                      activeSheetData && (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setColMenuOpen((o) => !o)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                          >
                            <ViewColumnsIcon className="h-4 w-4" />
                            {CANVAS_CONFIG.columnVisibility.label}
                            {(hiddenColumns[activeSheet]?.size || 0) > 0 && (
                              <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-600">
                                {hiddenColumns[activeSheet].size}{" "}
                                {
                                  CANVAS_CONFIG.columnVisibility
                                    .hiddenCountSuffix
                                }
                              </span>
                            )}
                          </button>
                          {colMenuOpen && (
                            <div className="absolute right-0 z-40 mt-1 max-h-72 w-64 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
                              <div className="mb-1 flex items-center justify-between gap-2 border-b border-slate-100 px-1 pb-1.5">
                                <button
                                  type="button"
                                  onClick={() => setAllColumnsHidden(false)}
                                  className="text-[11px] font-semibold text-blue-600 hover:underline"
                                >
                                  {CANVAS_CONFIG.columnVisibility.showAllLabel}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setAllColumnsHidden(true)}
                                  className="text-[11px] font-semibold text-slate-500 hover:underline"
                                >
                                  {CANVAS_CONFIG.columnVisibility.hideAllLabel}
                                </button>
                              </div>
                              {(activeSheetData.headers || []).map((h) => {
                                const isHidden =
                                  hiddenColumns[activeSheet]?.has(h);
                                return (
                                  <label
                                    key={h}
                                    className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-slate-50"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={!isHidden}
                                      onChange={() => toggleColumnHidden(h)}
                                      className="h-3.5 w-3.5 accent-blue-600"
                                    />
                                    <span
                                      className="truncate text-xs text-slate-700"
                                      title={h}
                                    >
                                      {h}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                  </div>
                </div>

                {/* Template-only warning */}
                {activeSheetData &&
                  activeSheetData.row_count > 0 &&
                  linkedRowCount === 0 && (
                    <div className="mx-4 mt-3 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                      <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0 text-amber-500" />
                      {HUB_LABELS.templateOnlyBanner}
                    </div>
                  )}

                {loading ? (
                  <div className="flex items-center gap-2 p-6 text-sm text-slate-500">
                    <ArrowPathIcon className="h-4 w-4 animate-spin" />{" "}
                    {CANVAS_CONFIG.userExperience.labels.loadingWorkbook}
                  </div>
                ) : !activeSheetData || activeSheetData.rows.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">
                    {CANVAS_CONFIG.emptySheetMessage}
                  </div>
                ) : (
                  <div
                    className="spec-workspace__grid-viewport mt-3"
                    ref={hubViewportRef}
                    onScroll={(e) => setHubScrollTop(e.currentTarget.scrollTop)}
                  >
                    <table
                      className="min-w-full border-collapse text-[13px]"
                      style={{
                        minWidth:
                          40 +
                          48 +
                          120 +
                          visibleHeaders.length * CANVAS_CONFIG.cellMinWidthPx,
                      }}
                    >
                      <thead className="sticky top-0 z-10 bg-white text-xs font-medium text-slate-500">
                        <tr>
                          <th className="w-10 border-b border-slate-100 px-3 py-2.5 text-left">
                            <button
                              type="button"
                              onClick={toggleHubPageSelection}
                              className={`flex h-4 w-4 items-center justify-center rounded border transition ${
                                allHubPageSelected
                                  ? "border-blue-600 bg-blue-600"
                                  : "border-slate-300 hover:border-blue-500"
                              }`}
                              title={
                                allHubPageSelected
                                  ? "Deselect visible rows"
                                  : "Select visible rows"
                              }
                            >
                              {allHubPageSelected ? (
                                <CheckIconSolid className="h-3 w-3 text-white" />
                              ) : someHubPageSelected ? (
                                <MinusIcon className="h-3 w-3 text-blue-600" />
                              ) : null}
                            </button>
                          </th>
                          <th className="w-12 border-b border-slate-100 px-2 py-2.5 text-left">
                            Row
                          </th>
                          {visibleHeaders.map((h) => (
                            <th
                              key={h}
                              className="whitespace-nowrap border-b border-slate-100 px-2 py-2.5 text-left"
                              title={h}
                            >
                              {h}
                            </th>
                          ))}
                          <th className="w-[120px] border-b border-slate-100 px-2 py-2.5 text-left">
                            Source status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {hubVirtualTopSpacer > 0 && (
                          <tr aria-hidden="true">
                            <td
                              colSpan={visibleHeaders.length + 3}
                              style={{ height: hubVirtualTopSpacer }}
                            />
                          </tr>
                        )}
                        {hubVirtualRows.map((row, idx) => {
                          const selected = selectedRows.has(row.row_key);
                          const rowNum = hubVirtualStart + idx + 1;
                          const linked = Boolean(
                            row.source?.class_id || row.source?.component_id,
                          );
                          return (
                            <tr
                              key={row.row_key}
                              data-row-key={row.row_key}
                              className={`border-b border-slate-100 transition-colors hover:bg-slate-50/70 ${
                                selected
                                  ? "bg-blue-50/70 hover:bg-blue-50"
                                  : "bg-white"
                              }`}
                              style={{ height: CANVAS_CONFIG.density.rowPx }}
                            >
                              <td className="px-3 py-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleHubRowSelection(row.row_key)
                                  }
                                  className={`flex h-4 w-4 items-center justify-center rounded border transition ${
                                    selected
                                      ? "border-blue-600 bg-blue-600"
                                      : "border-slate-300 hover:border-blue-500"
                                  }`}
                                  title={
                                    selected ? "Deselect row" : "Select row"
                                  }
                                >
                                  {selected && (
                                    <CheckIconSolid className="h-3 w-3 text-white" />
                                  )}
                                </button>
                              </td>
                              <td className="px-2 py-1 text-xs tabular-nums text-slate-400">
                                {String(rowNum).padStart(2, "0")}
                              </td>
                              {visibleHeaders.map((col) => {
                                const k = editKey(
                                  activeSheet,
                                  row.row_key,
                                  col,
                                );
                                const local = edits[k];
                                const raw = row.cells?.[col];
                                const value = local
                                  ? local.value
                                  : toInputValue(raw);
                                const status = local?.status;
                                const cellCls =
                                  status === "saving"
                                    ? CANVAS_CONFIG.highlight.saving
                                    : status === "saved"
                                      ? CANVAS_CONFIG.highlight.saved
                                      : status === "error"
                                        ? CANVAS_CONFIG.highlight.error
                                        : status === "editing"
                                          ? CANVAS_CONFIG.highlight.edited
                                          : "";
                                return (
                                  <td
                                    key={col}
                                    className={`px-1.5 py-1 ${cellCls}`}
                                  >
                                    <input
                                      type="text"
                                      value={value}
                                      onChange={(e) =>
                                        queueSave(
                                          activeSheet,
                                          row.row_key,
                                          col,
                                          e.target.value,
                                          raw ?? null,
                                        )
                                      }
                                      readOnly={!editModeEnabled}
                                      disabled={!editModeEnabled}
                                      className={`w-full rounded bg-transparent px-1.5 py-1 text-[13px] text-slate-800 outline-none transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                        selected
                                          ? "border border-blue-200 bg-white"
                                          : "border border-transparent hover:border-slate-200 focus:border-blue-400"
                                      }`}
                                      title={
                                        status === "error"
                                          ? local?.error
                                          : undefined
                                      }
                                    />
                                  </td>
                                );
                              })}
                              <td className="px-2 py-1">
                                {linked ? (
                                  <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">
                                    Linked
                                  </span>
                                ) : (
                                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                                    Template
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {hubVirtualBottomSpacer > 0 && (
                          <tr aria-hidden="true">
                            <td
                              colSpan={visibleHeaders.length + 3}
                              style={{ height: hubVirtualBottomSpacer }}
                            />
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="sticky bottom-0 z-10 mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-white px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span>
                      {HUB_LABELS.rowsOf(
                        hubFooterStart,
                        hubFooterEnd,
                        filteredRows.length,
                      )}
                    </span>
                    <span>
                      Page {hubCurrentPage} of {hubPageCount}
                    </span>
                    <span>{selectedRows.size} selected</span>
                    {workbookValidation && workbookValidation.status !== "running" && (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          workbookValidation.status === "pass"
                            ? "bg-emerald-50 text-emerald-700"
                            : workbookValidation.status === "error"
                              ? "bg-rose-50 text-rose-700"
                              : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {workbookValidation.status === "pass" ? (
                          <CheckCircleIcon className="h-3 w-3" />
                        ) : (
                          <ExclamationTriangleIcon className="h-3 w-3" />
                        )}
                        {workbookValidation.text}
                      </span>
                    )}
                  </div>
                  <div className="hidden items-center gap-3 text-[11px] text-slate-500 2xl:flex">
                    <span className="flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-sm bg-blue-50 ring-1 ring-blue-200" />{" "}
                      = Selected row
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="rounded bg-slate-100 px-1 py-px text-[10px] font-medium text-slate-600">
                        Template
                      </span>{" "}
                      = Template row
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="rounded bg-emerald-50 px-1 py-px text-[10px] font-medium text-emerald-700">
                        Linked
                      </span>{" "}
                      = Source linked row
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {isHub && detailsRow && (
            <aside
              className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
              style={{
                height: isFullscreen ? gridMaxH : "var(--spec-work-area-height)",
              }}
              aria-label="Row details"
            >
              <div className="border-b border-slate-100 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-900">
                  {HUB_LABELS.rowDetails}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Row {String(detailsRowNumber).padStart(2, "0")} ·{" "}
                  {detailsRowTitle || "—"}
                </p>
              </div>
              <div
                className="flex gap-4 border-b border-slate-100 px-4"
                role="tablist"
                aria-label="Row detail sections"
              >
                {[
                  { key: "properties", label: HUB_LABELS.properties },
                  { key: "source", label: HUB_LABELS.source },
                  { key: "validation", label: HUB_LABELS.validation },
                ].map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={detailsTab === t.key}
                    onClick={() => setDetailsTab(t.key)}
                    className={`-mb-px border-b-2 pb-2 pt-1 text-xs font-medium transition-colors ${
                      detailsTab === t.key
                        ? "border-blue-600 text-blue-600"
                        : "border-transparent text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {detailsTab === "properties" &&
                  visibleHeaders.map((col) => {
                    const k = editKey(activeSheet, detailsRow.row_key, col);
                    const local = edits[k];
                    const raw = detailsRow.cells?.[col];
                    const value = local ? local.value : toInputValue(raw);
                    return (
                      <div key={col}>
                        <label className="mb-1 block text-xs font-medium text-slate-600">
                          {col}
                        </label>
                        <input
                          type="text"
                          value={value}
                          onChange={(e) =>
                            queueSave(
                              activeSheet,
                              detailsRow.row_key,
                              col,
                              e.target.value,
                              raw ?? null,
                            )
                          }
                          readOnly={!editModeEnabled}
                          disabled={!editModeEnabled}
                          className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                        />
                      </div>
                    );
                  })}

                {detailsTab === "source" &&
                  (() => {
                    const src = sourceDisplay(detailsRow.source);
                    const linked = Boolean(
                      detailsRow.source?.class_id ||
                      detailsRow.source?.component_id,
                    );
                    return linked ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                          <CheckCircleIcon className="h-4 w-4" />
                          Linked to extracted record
                        </div>
                        <div>
                          <p className="mb-1 text-xs font-medium text-slate-600">
                            Source class
                          </p>
                          <p className="text-xs font-semibold text-slate-800">
                            {src.label}
                          </p>
                        </div>
                        <div>
                          <p className="mb-1 text-xs font-medium text-slate-600">
                            Source record
                          </p>
                          <p className="font-mono text-[11px] text-slate-600">
                            {src.detail}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="flex items-center gap-2 text-xs text-slate-500">
                          <LinkIcon className="h-4 w-4 text-slate-400" />
                          {HUB_LABELS.noSourceRecord}
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            radaiAlert(
                              "Records link automatically when the extracted Piping Class or component matches a template row. This row has no match yet — adjust the extraction or edit the values directly.",
                            )
                          }
                          className="rounded-md border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50"
                        >
                          {HUB_LABELS.linkSourceRecord}
                        </button>
                      </div>
                    );
                  })()}

                {detailsTab === "validation" && (
                  <div className="space-y-3">
                    <p className="flex items-center gap-2 text-xs text-slate-500">
                      {rowValidation?.status === "running" ? (
                        <ArrowPathIcon className="h-4 w-4 animate-spin text-blue-600" />
                      ) : rowValidation?.status === "pass" ? (
                        <CheckCircleIcon className="h-4 w-4 text-emerald-500" />
                      ) : rowValidation ? (
                        <ExclamationTriangleIcon className="h-4 w-4 text-rose-500" />
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-slate-300" />
                      )}
                      {rowValidation ? rowValidation.text : HUB_LABELS.notRun}
                    </p>
                    <button
                      type="button"
                      onClick={validateDetailsRow}
                      disabled={rowValidation?.status === "running"}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline disabled:opacity-50"
                    >
                      <PlayIcon className="h-3.5 w-3.5" />
                      {rowValidation?.status === "running"
                        ? "Validating…"
                        : HUB_LABELS.validateRow}
                    </button>
                  </div>
                )}
              </div>
            </aside>
          )}

          {CANVAS_CONFIG.chatbot.enabled && chatPanelOpen && (
            <>
              <button
                type="button"
                className="spec-workspace__drawer-backdrop"
                onClick={() => setChatPanelOpen(false)}
                aria-label="Close workbook assistant"
              />
              <aside
                id="workbook-chat-panel"
                className="spec-workspace__drawer spec-workspace__drawer--right spec-workspace__chat-panel border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col overflow-hidden"
                aria-label="Workbook assistant"
              >
                <div className="px-3 py-2.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/40 flex items-center gap-2">
                  <ChatBubbleLeftRightIcon className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      Workbook Chatbot
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      Document-aware assistant for workbook edits
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setChatPanelOpen(false)}
                    className="ml-auto p-1.5 rounded text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
                    aria-label="Close workbook assistant"
                    title="Close workbook assistant"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-3 py-3 bg-slate-50 dark:bg-slate-900/30 space-y-3">
                  {chatMessages.length === 0 ? (
                    <div className="text-xs text-slate-500 dark:text-slate-400 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
                      Start a chat and describe the workbook change you need.
                    </div>
                  ) : (
                    chatMessages
                      .slice()
                      .reverse()
                      .map((m) => (
                        <div key={m.ts} className="space-y-1.5">
                          <div className="flex justify-end">
                            <div className="max-w-[92%] flex items-end gap-2">
                              <div className="rounded-full w-6 h-6 text-[10px] font-bold bg-cyan-700 text-white flex items-center justify-center shadow-sm">
                                U
                              </div>
                              <div className="rounded-2xl rounded-br-md bg-cyan-600 text-white px-3 py-2 text-xs leading-relaxed shadow-sm">
                                <div className="text-[10px] opacity-90 mb-0.5">
                                  You •{" "}
                                  {new Date(m.ts).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </div>
                                {m.instruction}
                              </div>
                            </div>
                          </div>
                          <div className="flex justify-start">
                            <div className="max-w-[92%] flex items-end gap-2">
                              <div className="rounded-full w-6 h-6 text-[10px] font-bold bg-slate-700 text-white flex items-center justify-center shadow-sm">
                                AI
                              </div>
                              <div
                                className={`rounded-2xl rounded-bl-md px-3 py-2 text-xs border shadow-sm ${
                                  m.status === "ok"
                                    ? "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                                    : m.status === "warning"
                                      ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-200"
                                      : "bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-200"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="text-[10px] opacity-70">
                                    Assistant
                                  </div>
                                  <button
                                    onClick={() => copyAssistantMessage(m)}
                                    className="inline-flex items-center gap-1 text-[10px] opacity-80 hover:opacity-100"
                                    title="Copy assistant message"
                                  >
                                    <ClipboardDocumentIcon className="w-3.5 h-3.5" />
                                    {copiedMessageTs === m.ts
                                      ? "Copied"
                                      : "Copy"}
                                  </button>
                                </div>
                                <div className="font-semibold">{m.text}</div>
                                {m.warning && (
                                  <div className="mt-1">{m.warning}</div>
                                )}
                                {m.suggestion && (
                                  <div className="mt-1 opacity-80">
                                    Suggestion: {m.suggestion}
                                  </div>
                                )}
                                {m.documentContext?.available && (
                                  <div className="mt-2 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-2">
                                    <div className="flex items-start gap-2">
                                      <DocumentTextIcon className="w-4 h-4 mt-0.5 text-cyan-700 dark:text-cyan-300 flex-shrink-0" />
                                      <div className="min-w-0 flex-1">
                                        <div className="text-[10px] uppercase font-semibold text-slate-500">
                                          Source document
                                        </div>
                                        {m.documentContext.file_url ? (
                                          <a
                                            href={m.documentContext.file_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="mt-0.5 flex items-center gap-1 font-semibold text-cyan-700 dark:text-cyan-300 hover:underline"
                                          >
                                            <span className="truncate">
                                              {m.documentContext.filename ||
                                                "Open document"}
                                            </span>
                                            <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5 flex-shrink-0" />
                                          </a>
                                        ) : (
                                          <div className="mt-0.5 font-semibold truncate">
                                            {m.documentContext.filename ||
                                              "Uploaded document"}
                                          </div>
                                        )}
                                        <div className="text-[10px] text-slate-500">
                                          {[
                                            m.documentContext.document_number,
                                            m.documentContext.page_count
                                              ? `${m.documentContext.page_count} pages`
                                              : "",
                                          ]
                                            .filter(Boolean)
                                            .join(" | ")}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                                {m.evidenceItems?.length > 0 && (
                                  <div className="mt-2 space-y-1">
                                    <div className="text-[10px] uppercase font-semibold text-slate-500">
                                      Document evidence
                                    </div>
                                    {m.evidenceItems
                                      .slice(0, 3)
                                      .map((item, index) => {
                                        const content = (
                                          <>
                                            <span className="font-semibold text-cyan-700 dark:text-cyan-300">
                                              Page {item.page}
                                            </span>
                                            <span className="line-clamp-2">
                                              {item.snippet}
                                            </span>
                                          </>
                                        );
                                        return m.documentContext?.file_url ? (
                                          <a
                                            key={`${item.page}-${index}`}
                                            href={`${m.documentContext.file_url}#page=${item.page}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="block rounded border border-slate-200 dark:border-slate-700 p-1.5 hover:border-cyan-400"
                                          >
                                            {content}
                                          </a>
                                        ) : (
                                          <div
                                            key={`${item.page}-${index}`}
                                            className="rounded border border-slate-200 dark:border-slate-700 p-1.5"
                                          >
                                            {content}
                                          </div>
                                        );
                                      })}
                                  </div>
                                )}
                                {m.updates?.length > 0 && (
                                  <div className="mt-2 space-y-1">
                                    <div className="text-[10px] uppercase font-semibold text-slate-500">
                                      Affected records
                                    </div>
                                    {m.updates
                                      .slice(0, 3)
                                      .map((update, index) => (
                                        <button
                                          key={`${update.workbook}-${update.sheet_name}-${update.row_key}-${index}`}
                                          type="button"
                                          onClick={() =>
                                            focusChatbotRow(update)
                                          }
                                          className="w-full flex items-center gap-2 rounded border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-left hover:border-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/20"
                                          title={`Open ${update.sheet_name} row ${update.row_key}`}
                                        >
                                          <MapPinIcon className="w-3.5 h-3.5 text-cyan-700 dark:text-cyan-300 flex-shrink-0" />
                                          <span className="min-w-0 flex-1">
                                            <span className="block font-semibold truncate">
                                              {update.source?.class_code ||
                                                "Template row"}
                                            </span>
                                            <span className="block text-[10px] text-slate-500 truncate">
                                              {update.workbook?.toUpperCase()} /{" "}
                                              {update.sheet_name}
                                            </span>
                                          </span>
                                        </button>
                                      ))}
                                  </div>
                                )}
                                {m.meta && (
                                  <details className="mt-2 text-[10px] opacity-75">
                                    <summary className="cursor-pointer">
                                      Technical details
                                    </summary>
                                    <div className="mt-1">{m.meta}</div>
                                  </details>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                  )}

                  {chatBusy && (
                    <div className="flex justify-start">
                      <div className="max-w-[70%] flex items-end gap-2">
                        <div className="rounded-full w-6 h-6 text-[10px] font-bold bg-slate-700 text-white flex items-center justify-center shadow-sm">
                          AI
                        </div>
                        <div className="rounded-2xl rounded-bl-md px-3 py-2 text-xs border shadow-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-2">
                          <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                          Assistant is analyzing your workbook and uploaded
                          document...
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 space-y-2">
                  <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
                    <div className="w-full px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-md text-slate-500 dark:text-slate-400">
                      Workbook assistant
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={runWorkbookValidation}
                        disabled={chatBusy}
                        className="px-2.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 border border-slate-300 rounded-md disabled:opacity-50"
                        title="Validate extracted data"
                      >
                        Validate
                      </button>
                      <button
                        onClick={clearChatHistory}
                        className="px-2.5 py-2 text-xs font-medium text-slate-500 hover:text-slate-700 border border-slate-300 rounded-md"
                        title="Clear chat"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <select
                    value={chatScope}
                    onChange={(e) => setChatScope(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md"
                  >
                    {CANVAS_CONFIG.chatbot.scopes.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>

                  <textarea
                    value={chatInstruction}
                    onChange={(e) => setChatInstruction(e.target.value)}
                    onKeyDown={handleChatComposerKeyDown}
                    placeholder={CANVAS_CONFIG.chatbot.instructionPlaceholder}
                    rows={3}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-cyan-300"
                  />
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    Enter to preview | Shift+Enter for a new line
                  </div>
                  {/* Soft-coded grammar hints (mirrors backend supported_patterns) */}
                  {Array.isArray(CANVAS_CONFIG.chatbot.patternHints) && (
                    <div className="rounded-md bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 px-2 py-1.5 space-y-0.5">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        Supported instructions
                      </p>
                      {CANVAS_CONFIG.chatbot.patternHints.map((hint) => (
                        <p
                          key={hint}
                          className="text-[10px] text-slate-500 dark:text-slate-400 font-mono leading-snug"
                        >
                          {hint}
                        </p>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => applyChatInstruction("preview")}
                    disabled={chatBusy || !chatInstruction.trim()}
                    className="w-full px-3 py-2 text-xs font-semibold bg-cyan-600 hover:bg-cyan-700 text-white rounded-md disabled:opacity-50 flex items-center justify-center gap-1"
                  >
                    {chatBusy ? (
                      <>
                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                        Applying...
                      </>
                    ) : (
                      <>
                        <PaperAirplaneIcon className="w-4 h-4" />
                        Preview proposed changes
                      </>
                    )}
                  </button>

                  {chatPreview && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900 space-y-2">
                      <div className="font-semibold">
                        Review required: {chatPreview.plannedCount} proposed
                        cell change{chatPreview.plannedCount === 1 ? "" : "s"}
                      </div>
                      <div className="max-h-28 overflow-y-auto space-y-1 font-mono text-[10px]">
                        {chatPreview.updates
                          .slice(0, 5)
                          .map((update, index) => (
                            <button
                              type="button"
                              onClick={() => focusChatbotRow(update)}
                              className="w-full flex items-start gap-1.5 rounded px-1 py-1 text-left hover:bg-amber-100"
                              key={`${update.sheet_name}-${update.row_key}-${update.column_name}-${index}`}
                            >
                              <MapPinIcon className="w-3 h-3 mt-0.5 flex-shrink-0" />
                              <span>
                                <span className="font-semibold">
                                  {update.source?.class_code || "Template row"}{" "}
                                  | {update.sheet_name}/{update.column_name}
                                </span>
                                <span className="block">
                                  {String(update.previous_value ?? "") ||
                                    "(empty)"}{" "}
                                  to {update.value}
                                </span>
                              </span>
                            </button>
                          ))}
                        {chatPreview.updates.length > 5 && (
                          <div>
                            …and {chatPreview.updates.length - 5} more changes
                          </div>
                        )}
                      </div>
                      <button
                        onClick={applyApprovedChatPreview}
                        disabled={chatBusy}
                        className="w-full px-3 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-md disabled:opacity-50"
                      >
                        Apply approved changes
                      </button>
                    </div>
                  )}
                </div>
              </aside>
            </>
          )}
        </div>
      )}

      {isHub && data && !loadError && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            {autoSaveStatus === "saving" ? (
              <ArrowPathIcon className="h-4 w-4 animate-spin text-blue-600" />
            ) : autoSaveStatus === "error" ? (
              <ExclamationTriangleIcon className="h-4 w-4 text-rose-500" />
            ) : (
              <CheckCircleIcon className="h-4 w-4 text-emerald-500" />
            )}
            <span>
              <span className="font-semibold text-slate-700">
                {workbook.toUpperCase()} workbook
              </span>{" "}
              · {activeSheet || "—"} ·{" "}
              {autoSaveStatus === "saving"
                ? HUB_LABELS.savingChanges
                : autoSaveStatus === "error"
                  ? HUB_LABELS.saveFailed
                  : HUB_LABELS.changesSaved}
            </span>
            {workbookValidation && workbookValidation.status !== "running" && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  workbookValidation.status === "pass"
                    ? "bg-emerald-50 text-emerald-700"
                    : workbookValidation.status === "error"
                      ? "bg-rose-50 text-rose-700"
                      : "bg-amber-50 text-amber-700"
                }`}
              >
                {workbookValidation.status === "pass" ? (
                  <CheckCircleIcon className="h-3 w-3" />
                ) : (
                  <ExclamationTriangleIcon className="h-3 w-3" />
                )}
                {workbookValidation.text}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={validateHubWorkbook}
            disabled={workbookValidation?.status === "running"}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-600 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            {workbookValidation?.status === "running" ? (
              <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <PlayIcon className="h-3.5 w-3.5" />
            )}
            {workbookValidation?.status === "running"
              ? "Validating…"
              : HUB_LABELS.validateWorkbook}
          </button>
        </div>
      )}

      {/* Delete row confirmation modal */}
      {deleteConfirm && CANVAS_CONFIG.rowOperations.confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl max-w-md w-full mx-4 p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <ExclamationTriangleIcon className="w-8 h-8 text-rose-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                  Delete Row
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                  Are you sure you want to delete this row and all its cell
                  overrides? This action cannot be undone.
                </p>
                <div className="bg-slate-50 dark:bg-slate-900 rounded p-3 mb-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    Sheet: {deleteConfirm.sheet}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">
                    Row: {deleteConfirm.rowKey}
                  </p>
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={cancelDeleteRow}
                    className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeleteRow}
                    disabled={deleting}
                    className="px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {deleting ? (
                      <>
                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <TrashIcon className="w-4 h-4" />
                        Delete Row
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* S3 Snapshot Management Panel */}
      {showSnapshotPanel && CANVAS_CONFIG.s3Snapshots.enabled && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl max-w-2xl w-full mx-4 p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <ArchiveBoxIcon className="w-6 h-6 text-cyan-600" />
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    S3 Snapshots
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Manage workbook backups stored in AWS S3
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSnapshotPanel(false)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
              >
                <XMarkIcon className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={createManualSnapshot}
                className="px-3 py-2 text-sm font-semibold bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg flex items-center gap-2"
              >
                <ArchiveBoxIcon className="w-4 h-4" />
                Create Snapshot Now
              </button>
              <button
                onClick={fetchS3Snapshots}
                disabled={loadingSnapshots}
                className="px-3 py-2 text-sm font-semibold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg flex items-center gap-2 disabled:opacity-50"
              >
                <ArrowPathIcon
                  className={`w-4 h-4 ${loadingSnapshots ? "animate-spin" : ""}`}
                />
                Refresh List
              </button>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <CloudArrowUpIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-semibold mb-1">Automatic Snapshots</p>
                  <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                    <li>
                      - Created automatically when cell count exceeds 5000
                    </li>
                    <li>- Created when JSON size exceeds 10MB</li>
                    <li>
                      - Every {CANVAS_CONFIG.s3Snapshots.autoSnapshotInterval}{" "}
                      edits (when enabled)
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Snapshot List */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Recent Snapshots
              </h4>

              {loadingSnapshots ? (
                <div className="text-center py-8 text-slate-500">
                  <ArrowPathIcon className="w-6 h-6 animate-spin mx-auto mb-2" />
                  Loading snapshots...
                </div>
              ) : s3SnapshotsList.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <ArchiveBoxIcon className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm">No snapshots found</p>
                  <p className="text-xs mt-1">
                    Create your first snapshot to enable restore
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {s3SnapshotsList
                    .slice(0, CANVAS_CONFIG.s3Snapshots.maxSnapshotsToShow)
                    .map((snapshot, idx) => (
                      <div
                        key={idx}
                        className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <ClockIcon className="w-4 h-4 text-slate-400" />
                              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                {new Date(snapshot.timestamp).toLocaleString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                              <span>
                                {snapshot.cell_count.toLocaleString()} cells
                              </span>
                              <span>{snapshot.size_mb} MB</span>
                              <span
                                className="font-mono text-[10px] truncate max-w-xs"
                                title={snapshot.s3_key}
                              >
                                {snapshot.s3_key.split("/").pop()}
                              </span>
                            </div>
                          </div>
                          {CANVAS_CONFIG.s3Snapshots.allowRestore && (
                            <button
                              onClick={() => restoreFromSnapshot(snapshot)}
                              className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md flex items-center gap-1"
                            >
                              <ArrowUturnLeftIcon className="w-3.5 h-3.5" />
                              Restore
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                Snapshots are stored in:{" "}
                <code className="bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded">
                  s3://
                  {CANVAS_CONFIG.s3Snapshots.enabled
                    ? "radai-workbook-snapshots"
                    : "N/A"}
                </code>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkbookCanvas;
