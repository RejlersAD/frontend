/**
 * WorkbookCanvas
 * ──────────────
 * Cross-check & edit the SPEC and CAT workbooks before download.
 *
 * - Renders the data exactly as it will appear in the SmartPlant 3D template
 *   (one tab per template sheet, headers read from the template's Head row).
 * - Every cell is editable; edits autosave as `WorkbookCellOverride` records
 *   and are baked into the downloaded xlsx by the backend exporter.
 *
 * All UX knobs (debounce, highlight colours, density) live in `CANVAS_CONFIG`
 * — adjust there, never inline.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
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
} from '@heroicons/react/24/outline';
import { 
  CheckIcon as CheckIconSolid,
  MinusIcon,
} from '@heroicons/react/24/solid';

import specCustomizationAPI from '../../../../services/specCustomizationAPI';

// ─── Soft-coded UI / behaviour knobs ────────────────────────────────────────
const CANVAS_CONFIG = {
  defaultWorkbook: 'spec',
  workbooks: [
    { key: 'spec', label: 'SPEC Workbook', sub: 'Piping spec rules',  accent: 'from-pink-500 to-rose-500'   },
    { key: 'cat',  label: 'CAT Workbook',  sub: 'Component catalog', accent: 'from-violet-500 to-fuchsia-500' },
  ],
  autosaveDebounceMs: 500,
  cellMinWidthPx:     140,
  rowHeaderMinWidthPx: 220,
  density: {
    rowPx:        32,
    headerRowPx:  36,
    cellPaddingX: 8,
  },
  highlight: {
    edited:   'bg-amber-50 ring-1 ring-amber-300',
    saving:   'bg-blue-50 ring-1 ring-blue-300',
    saved:    'bg-emerald-50 ring-1 ring-emerald-300',
    error:    'bg-rose-50 ring-1 ring-rose-300',
  },
  emptySheetMessage: 'No rows for this sheet yet — adjust extraction or add overrides.',
  // ── CAT "unrouted components" banner ──────────────────────────────────
  // Components extracted for a Piping Class but with no matching sheet in
  // the standard CAT template (e.g. a valve sub-type with no dedicated
  // sheet) are excluded from the CAT workbook rather than silently dropped
  // with zero visibility — this banner surfaces that gap in the canvas.
  unroutedBanner: {
    enabled: true,
    maxGroupsShown: 6,
    title: 'Some components have no matching CAT sheet',
    helpText: 'These components remain in the Piping Class data and only affect the CAT catalog view — they are not written to any CAT sheet because the standard template has no dedicated category for them.',
  },
  // ── Row operations ────────────────────────────────────────────────────
  rowOperations: {
    enableEdit: true,
    enableDelete: true,
    enableBulkDelete: true,
    enableBulkSelect: true,         // Enable checkbox selection
    confirmDelete: true,
    showRowActions: 'always',       // 'always' | 'hover' | 'never'
    maxBulkSelectRows: 500,         // Safety limit for bulk operations
    // Actions column (Edit/Delete buttons at end of row)
    showActionsColumn: true,        // Show actions column after all data columns
    actionsColumnWidth: 140,        // Width in pixels
    actionsColumnLabel: 'Actions',  // Column header text
    enableRowEdit: true,            // Show Edit button (highlights row for editing)
    enableRowDelete: true,          // Show Delete button in actions column
  },
  // ── Auto-save configuration ───────────────────────────────────────────
  autoSave: {
    enabled: true,
    indicator: true,                // Show save status indicator
    batchThreshold: 50,             // Batch save if >= 50 pending edits
    batchDelayMs: 2000,             // Wait 2s after last edit before batch save
  },
  // ── Undo/Restore functionality ────────────────────────────────────────
  undo: {
    enabled: true,                  // Enable undo/restore
    maxHistorySize: 50,             // Keep last 50 actions
    undoKeyBinding: 'Ctrl+Z',       // Keyboard shortcut
    redoKeyBinding: 'Ctrl+Y',       // Keyboard shortcut
    showUndoButton: true,           // Show undo button in toolbar
  },
  // ── S3 Snapshot Management ────────────────────────────────────────────
  s3Snapshots: {
    enabled: true,                  // Enable S3 snapshot features
    showSnapshotList: true,         // Show list of snapshots
    allowRestore: true,             // Allow restoring from snapshots
    maxSnapshotsToShow: 10,         // Show last 10 snapshots
    autoSnapshotInterval: 100,      // Auto-snapshot every 100 edits
  },
  // ── Fullscreen behaviour ──────────────────────────────────────────────
  // 'native' first tries the browser Fullscreen API and falls back to a
  // CSS-fixed overlay when blocked (e.g. inside an iframe); 'overlay'
  // forces the CSS overlay; 'off' disables the toggle entirely.
  fullscreen: {
    mode:            'native',
    exitOnEscape:    true,
    enterLabel:      'Full Screen',
    exitLabel:       'Exit Full Screen',
    enterHint:       'Maximise the canvas (Esc to exit)',
    exitHint:        'Restore the canvas to its normal size',
    gridMaxHeight:   '70vh',      // normal mode
    gridMaxHeightFS: 'calc(100vh - 180px)', // fullscreen mode
    overlayZIndex:   60,
  },
};

// `value` may be null/number/string — normalise to string for the input.
const toInputValue = (v) => (v === null || v === undefined ? '' : String(v));

// ─────────────────────────────────────────────────────────────────────────────
const WorkbookCanvas = ({ job }) => {
  const jobId = job?.id;

  const [workbook,    setWorkbook]    = useState(CANVAS_CONFIG.defaultWorkbook);
  const [data,        setData]        = useState(null);   // preview JSON
  const [loading,     setLoading]     = useState(false);
  const [loadError,   setLoadError]   = useState('');
  const [activeSheet, setActiveSheet] = useState(null);
  const [search,      setSearch]      = useState('');

  // edits[`${sheet}::${row_key}::${col}`] = { value, status: 'editing'|'saving'|'saved'|'error', error? }
  const [edits, setEdits] = useState({});
  const debounceTimers   = useRef({});

  // ── Edit mode and Auto-save toggles ──────────────────────────────────────
  const [editModeEnabled, setEditModeEnabled] = useState(true);   // Edit mode toggle
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);   // Auto-save toggle

  // ── Bulk row selection ───────────────────────────────────────────────────
  const [selectedRows, setSelectedRows] = useState(new Set());     // Set of selected row_keys
  const [selectAllChecked, setSelectAllChecked] = useState(false); // Select all checkbox state

  // ── Undo/Redo history ────────────────────────────────────────────────────
  const [undoHistory, setUndoHistory] = useState([]);              // Array of past actions
  const [redoHistory, setRedoHistory] = useState([]);              // Array of undone actions
  const editCountRef = useRef(0);                                  // Track edits for auto-snapshot

  // ── S3 Snapshot Management ───────────────────────────────────────────────
  const [s3SnapshotsList, setS3SnapshotsList] = useState([]);      // List of S3 snapshots
  const [showSnapshotPanel, setShowSnapshotPanel] = useState(false); // Show/hide snapshot panel
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);

  // ── Row operations state ─────────────────────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState(null);  // {sheet, rowKey, rowIndex}
  const [deleting, setDeleting] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState(null); // 'saving' | 'saved' | 'error'
  const batchSaveTimer = useRef(null);
  const [editingRowKey, setEditingRowKey] = useState(null);  // Currently highlighted row for editing

  // ── Fullscreen state (soft-coded fallback to CSS overlay) ───────────────
  const rootRef                 = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(async () => {
    const cfg = CANVAS_CONFIG.fullscreen;
    if (cfg.mode === 'off') return;
    const el = rootRef.current;
    if (!el) return;

    // Currently fullscreen → exit.
    if (isFullscreen) {
      if (document.fullscreenElement) {
        try { await document.exitFullscreen(); } catch { /* noop */ }
      }
      setIsFullscreen(false);
      return;
    }

    // Try the native Fullscreen API first when allowed.
    if (cfg.mode === 'native' && el.requestFullscreen) {
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
      if (CANVAS_CONFIG.fullscreen.exitOnEscape && e.key === 'Escape' && isFullscreen) {
        // Only handle the CSS-overlay case; the browser handles its own Esc.
        if (!document.fullscreenElement) setIsFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      window.removeEventListener('keydown', onKey);
    };
  }, [isFullscreen]);

  // ── Fetch preview ────────────────────────────────────────────────────────
  const fetchPreview = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    setLoadError('');
    try {
      const json = await specCustomizationAPI.getWorkbookPreview(jobId, workbook);
      setData(json);
      const firstSheet = json?.sheets?.find((s) => s.row_count > 0) || json?.sheets?.[0];
      setActiveSheet(firstSheet?.name || null);
      setEdits({});
    } catch (err) {
      setLoadError(err?.response?.data?.error || err?.message || 'Failed to load workbook.');
    } finally {
      setLoading(false);
    }
  }, [jobId, workbook]);

  useEffect(() => { fetchPreview(); }, [fetchPreview]);

  // ── Save / clear helpers ────────────────────────────────────────────────
  const editKey = (sheet, rowKey, col) => `${sheet}::${rowKey}::${col}`;

  const queueSave = useCallback((sheet, rowKey, col, value) => {
    const k = editKey(sheet, rowKey, col);

    setEdits((prev) => ({ ...prev, [k]: { value, status: 'editing' } }));

    // If auto-save is disabled, just mark as edited and don't save
    if (!autoSaveEnabled) {
      return;
    }

    if (debounceTimers.current[k]) clearTimeout(debounceTimers.current[k]);
    debounceTimers.current[k] = setTimeout(async () => {
      setEdits((prev) => ({ ...prev, [k]: { ...(prev[k] || {}), value, status: 'saving' } }));
      setAutoSaveStatus('saving');
      try {
        await specCustomizationAPI.saveWorkbookCell(jobId, {
          workbook,
          sheet_name:  sheet,
          row_key:     rowKey,
          column_name: col,
          value,
        });
        setEdits((prev) => ({ ...prev, [k]: { value, status: 'saved' } }));
        setAutoSaveStatus('saved');
        // Clear status after 2 seconds
        setTimeout(() => setAutoSaveStatus(null), 2000);
      } catch (err) {
        setEdits((prev) => ({
          ...prev,
          [k]: { value, status: 'error', error: err?.response?.data?.error || err?.message },
        }));
        setAutoSaveStatus('error');
        setTimeout(() => setAutoSaveStatus(null), 3000);
      }
    }, CANVAS_CONFIG.autosaveDebounceMs);
  }, [jobId, workbook, autoSaveEnabled]);

  const clearCell = useCallback(async (sheet, rowKey, col) => {
    const k = editKey(sheet, rowKey, col);
    try {
      await specCustomizationAPI.clearWorkbookCell(jobId, {
        workbook, sheet_name: sheet, row_key: rowKey, column_name: col,
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
        [k]: { ...(prev[k] || {}), status: 'error', error: err?.response?.data?.error || err?.message },
      }));
    }
  }, [jobId, workbook, fetchPreview]);

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

  const executeDeleteRow = useCallback(async (sheet, rowKey) => {
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
      console.log(`Deleted row ${rowKey}: ${result.deleted_count} cells removed`);
    } catch (err) {
      console.error('Failed to delete row:', err);
      alert(`Failed to delete row: ${err?.response?.data?.error || err?.message}`);
    } finally {
      setDeleting(false);
      setDeleteConfirm(null);
    }
  }, [jobId, workbook, fetchPreview]);

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
  const handleEditRow = useCallback((rowKey) => {
    console.log('Edit row clicked:', rowKey);
    
    // Toggle editing: if already editing this row, stop editing; otherwise start editing
    if (editingRowKey === rowKey) {
      setEditingRowKey(null);
      console.log('Stopped editing row:', rowKey);
    } else {
      setEditingRowKey(rowKey);
      console.log('Started editing row:', rowKey);
      
      // Scroll row into view after a brief delay
      setTimeout(() => {
        const rowElement = document.querySelector(`tr[data-row-key="${rowKey}"]`);
        if (rowElement) {
          rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          console.log('Scrolled to row:', rowKey);
          
          // Focus on first editable input in the row
          const firstInput = rowElement.querySelector('input[type="text"]:not([readonly])');
          if (firstInput) {
            firstInput.focus();
            console.log('Focused first input in row');
          }
        } else {
          console.warn('Row element not found for scrolling:', rowKey);
        }
      }, 100);
    }
  }, [editingRowKey]);

  /**
   * Handle Delete button click from actions column
   * Opens confirmation modal before deleting
   */
  const handleDeleteFromActions = useCallback((sheet, rowKey, rowIndex) => {
    console.log('Delete row clicked:', { sheet, rowKey, rowIndex });
    if (CANVAS_CONFIG.rowOperations.confirmDelete) {
      console.log('Opening delete confirmation modal');
      setDeleteConfirm({ sheet, rowKey, rowIndex });
    } else {
      console.log('Executing delete immediately (no confirmation)');
      executeDeleteRow(sheet, rowKey);
    }
  }, [executeDeleteRow]);

  /**
   * Manual save all pending edits (when auto-save is disabled)
   */
  const saveAllPendingEdits = useCallback(async () => {
    const pendingCells = Object.entries(edits)
      .filter(([_, edit]) => edit.status === 'editing')
      .map(([key, edit]) => {
        const [sheet_name, row_key, column_name] = key.split('::');
        return { workbook, sheet_name, row_key, column_name, value: edit.value };
      });

    if (pendingCells.length === 0) {
      alert('No pending edits to save');
      return;
    }

    setAutoSaveStatus('saving');
    try {
      const result = await specCustomizationAPI.batchSaveWorkbookCells(jobId, pendingCells);
      
      // Mark all as saved
      setEdits((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((k) => {
          if (next[k].status === 'editing') {
            next[k].status = 'saved';
          }
        });
        return next;
      });
      
      setAutoSaveStatus('saved');
      setTimeout(() => setAutoSaveStatus(null), 2000);
      
      console.log(`Manually saved ${result.saved_count} cells`);
      if (result.s3_snapshot) {
        console.log('S3 snapshot created:', result.s3_snapshot.s3_key);
      }
    } catch (err) {
      console.error('Failed to save all edits:', err);
      setAutoSaveStatus('error');
      setTimeout(() => setAutoSaveStatus(null), 3000);
      alert(`Failed to save: ${err?.response?.data?.error || err?.message}`);
    }
  }, [edits, jobId, workbook]);

  // ── Derived data for the active sheet ───────────────────────────────────
  const activeSheetData = useMemo(() => {
    if (!data || !activeSheet) return null;
    return data.sheets.find((s) => s.name === activeSheet) || null;
  }, [data, activeSheet]);

  const filteredRows = useMemo(() => {
    if (!activeSheetData) return [];
    const q = search.trim().toLowerCase();
    if (!q) return activeSheetData.rows;
    return activeSheetData.rows.filter((row) => {
      // Search across all cell values + the source.class_code hint.
      const code = row.source?.class_code || '';
      if (code.toLowerCase().includes(q)) return true;
      return Object.values(row.cells || {}).some(
        (v) => v !== null && v !== undefined && String(v).toLowerCase().includes(q),
      );
    });
  }, [activeSheetData, search]);

  const totalRows  = data?.sheets?.reduce((acc, s) => acc + (s.row_count || 0), 0) || 0;
  const editedKeys = Object.keys(edits).filter((k) => edits[k]?.status === 'saved');

  // ═══════════════════════════════════════════════════════════════════════════
  // BULK ROW SELECTION
  // ═══════════════════════════════════════════════════════════════════════════
  
  const toggleRowSelection = useCallback((rowKey) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) {
        next.delete(rowKey);
      } else {
        if (next.size >= CANVAS_CONFIG.rowOperations.maxBulkSelectRows) {
          alert(`Cannot select more than ${CANVAS_CONFIG.rowOperations.maxBulkSelectRows} rows at once`);
          return prev;
        }
        next.add(rowKey);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (!activeSheetData) return;
    
    if (selectAllChecked) {
      setSelectedRows(new Set());
      setSelectAllChecked(false);
    } else {
      const visibleRowKeys = filteredRows.map(r => r.row_key);
      if (visibleRowKeys.length > CANVAS_CONFIG.rowOperations.maxBulkSelectRows) {
        alert(`Cannot select more than ${CANVAS_CONFIG.rowOperations.maxBulkSelectRows} rows. Please use filters to reduce the count.`);
        return;
      }
      setSelectedRows(new Set(visibleRowKeys));
      setSelectAllChecked(true);
    }
  }, [activeSheetData, filteredRows, selectAllChecked]);

  const bulkDeleteSelectedRows = useCallback(async () => {
    if (selectedRows.size === 0) {
      alert('No rows selected');
      return;
    }

    const confirmMsg = `Delete ${selectedRows.size} selected row${selectedRows.size === 1 ? '' : 's'}? This will remove all cell overrides for these rows.`;
    if (!confirm(confirmMsg)) return;

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
      console.log(`Bulk deleted ${result.deleted_rows} rows (${result.deleted_cells} cells)`);
    } catch (err) {
      console.error('Failed to bulk delete rows:', err);
      alert(`Failed to delete rows: ${err?.response?.data?.error || err?.message}`);
    } finally {
      setDeleting(false);
    }
  }, [selectedRows, jobId, workbook, activeSheet, fetchPreview]);

  // ═══════════════════════════════════════════════════════════════════════════
  // UNDO/REDO FUNCTIONALITY
  // ═══════════════════════════════════════════════════════════════════════════

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

  const performUndo = useCallback(async () => {
    if (undoHistory.length === 0) {
      alert('Nothing to undo');
      return;
    }

    const lastAction = undoHistory[undoHistory.length - 1];
    
    try {
      if (lastAction.type === 'edit') {
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
      } else if (lastAction.type === 'delete_row') {
        // Cannot undo row deletion (would need to restore all cells)
        alert('Cannot undo row deletion. Please restore from S3 snapshot.');
        return;
      }

      // Move from undo to redo stack
      setRedoHistory((prev) => [...prev, lastAction]);
      setUndoHistory((prev) => prev.slice(0, -1));
      
      await fetchPreview();
    } catch (err) {
      console.error('Failed to undo:', err);
      alert(`Undo failed: ${err?.response?.data?.error || err?.message}`);
    }
  }, [undoHistory, jobId, fetchPreview]);

  const performRedo = useCallback(async () => {
    if (redoHistory.length === 0) {
      alert('Nothing to redo');
      return;
    }

    const lastRedo = redoHistory[redoHistory.length - 1];
    
    try {
      if (lastRedo.type === 'edit') {
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
      console.error('Failed to redo:', err);
      alert(`Redo failed: ${err?.response?.data?.error || err?.message}`);
    }
  }, [redoHistory, jobId, fetchPreview]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    if (!CANVAS_CONFIG.undo.enabled) return;

    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        performUndo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        performRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [performUndo, performRedo]);

  // ═══════════════════════════════════════════════════════════════════════════
  // S3 SNAPSHOT MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

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
          version_id: 'v1',
          timestamp: new Date().toISOString(),
          cell_count: 5234,
          size_mb: 2.4,
        },
      ];
      
      setS3SnapshotsList(mockSnapshots);
    } catch (err) {
      console.error('Failed to fetch S3 snapshots:', err);
    } finally {
      setLoadingSnapshots(false);
    }
  }, [jobId, workbook]);

  const createManualSnapshot = useCallback(async () => {
    if (!CANVAS_CONFIG.s3Snapshots.enabled) return;

    setAutoSaveStatus('saving');
    try {
      // Trigger batch save which will create S3 snapshot if threshold exceeded
      const pendingCells = Object.entries(edits)
        .filter(([_, edit]) => edit.status === 'editing' || edit.status === 'saved')
        .map(([key, edit]) => {
          const [sheet_name, row_key, column_name] = key.split('::');
          return { workbook, sheet_name, row_key, column_name, value: edit.value };
        });

      if (pendingCells.length === 0) {
        alert('No data to snapshot. Please make some edits first.');
        return;
      }

      const result = await specCustomizationAPI.batchSaveWorkbookCells(jobId, pendingCells);
      
      if (result.s3_snapshot) {
        setAutoSaveStatus('saved');
        setTimeout(() => setAutoSaveStatus(null), 2000);
        alert(`Snapshot created: ${result.s3_snapshot.s3_key}\n${result.s3_snapshot.cell_count} cells (${result.s3_snapshot.size_mb} MB)`);
        fetchS3Snapshots(); // Refresh list
      } else {
        alert('Snapshot not created. Cell count below threshold. Try editing more cells.');
      }
    } catch (err) {
      console.error('Failed to create snapshot:', err);
      setAutoSaveStatus('error');
      setTimeout(() => setAutoSaveStatus(null), 3000);
      alert(`Snapshot failed: ${err?.response?.data?.error || err?.message}`);
    }
  }, [edits, jobId, workbook, fetchS3Snapshots]);

  const restoreFromSnapshot = useCallback(async (snapshot) => {
    const confirmMsg = `Restore from snapshot created at ${new Date(snapshot.timestamp).toLocaleString()}?\nThis will overwrite current edits.`;
    if (!confirm(confirmMsg)) return;

    try {
      // Mock: In real implementation, call backend API to restore from S3
      // await specCustomizationAPI.restoreFromS3Snapshot(jobId, snapshot.s3_key, snapshot.version_id);
      
      alert('Restore from S3 snapshot is not yet implemented in backend API.\nPlease implement the backend endpoint first.');
      
      // await fetchPreview();
      // setShowSnapshotPanel(false);
    } catch (err) {
      console.error('Failed to restore snapshot:', err);
      alert(`Restore failed: ${err?.response?.data?.error || err?.message}`);
    }
  }, [jobId, fetchPreview]);

  // Clear selections when changing sheets
  useEffect(() => {
    setSelectedRows(new Set());
    setSelectAllChecked(false);
    setEditingRowKey(null);  // Clear highlighted editing row
  }, [activeSheet]);

  // Fetch snapshots when panel opens
  useEffect(() => {
    if (showSnapshotPanel && CANVAS_CONFIG.s3Snapshots.enabled) {
      fetchS3Snapshots();
    }
  }, [showSnapshotPanel, fetchS3Snapshots]);

  // ── Render ──────────────────────────────────────────────────────────────
  if (!jobId) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 text-sm text-slate-500 dark:text-slate-400">
        Upload &amp; extract a spec first to use the workbook canvas.
      </div>
    );
  }

  const fsEnabled = CANVAS_CONFIG.fullscreen.mode !== 'off';
  // When in CSS-overlay fullscreen (no native fullscreen element), pin the
  // root to the viewport; native fullscreen styles the element automatically.
  const overlayActive = isFullscreen && !document.fullscreenElement;
  const rootClass = overlayActive
    ? 'fixed inset-0 bg-slate-50 dark:bg-slate-900 p-4 overflow-auto space-y-3'
    : 'space-y-3';
  const rootStyle = overlayActive
    ? { zIndex: CANVAS_CONFIG.fullscreen.overlayZIndex }
    : undefined;
  const gridMaxH = isFullscreen
    ? CANVAS_CONFIG.fullscreen.gridMaxHeightFS
    : CANVAS_CONFIG.fullscreen.gridMaxHeight;

  return (
    <div ref={rootRef} className={rootClass} style={rootStyle}>
      {/* ── Header bar — workbook toggle + reload + stats ────────────────── */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 shadow-sm">
        <div className="flex gap-1 rounded-lg bg-slate-100 dark:bg-slate-900 p-1">
          {CANVAS_CONFIG.workbooks.map((wb) => (
            <button
              key={wb.key}
              onClick={() => setWorkbook(wb.key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                workbook === wb.key
                  ? `bg-gradient-to-r ${wb.accent} text-white shadow`
                  : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
              }`}
              title={wb.sub}
            >
              <TableCellsIcon className="inline w-4 h-4 mr-1 -mt-0.5" />
              {wb.label}
            </button>
          ))}
        </div>

        <button
          onClick={fetchPreview}
          disabled={loading}
          className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-700 rounded-md disabled:opacity-50 flex items-center gap-1"
        >
          <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Reload
        </button>

        {/* Edit Mode Toggle */}
        <button
          onClick={() => setEditModeEnabled(!editModeEnabled)}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1 transition-all ${
            editModeEnabled
              ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow ring-2 ring-purple-300'
              : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
          title={editModeEnabled ? 'Disable editing' : 'Enable editing'}
        >
          <PencilSquareIcon className="w-4 h-4" />
          Edit Mode {editModeEnabled ? 'ON' : 'OFF'}
        </button>

        {/* Auto Save Toggle */}
        <button
          onClick={() => setAutoSaveEnabled(!autoSaveEnabled)}
          disabled={!editModeEnabled}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
            autoSaveEnabled
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow ring-2 ring-emerald-300'
              : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
          title={autoSaveEnabled ? 'Disable auto-save (manual save required)' : 'Enable auto-save'}
        >
          <CloudArrowUpIcon className="w-4 h-4" />
          Auto Save {autoSaveEnabled ? 'ON' : 'OFF'}
        </button>

        {/* Manual Save All Button (only shown when auto-save is disabled) */}
        {!autoSaveEnabled && editModeEnabled && (
          <button
            onClick={saveAllPendingEdits}
            disabled={Object.values(edits).filter(e => e.status === 'editing').length === 0}
            className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            title="Save all pending edits"
          >
            <CheckCircleIcon className="w-4 h-4" />
            Save All ({Object.values(edits).filter(e => e.status === 'editing').length})
          </button>
        )}

        {/* Bulk Delete Selected Button (only shown when rows are selected) */}
        {CANVAS_CONFIG.rowOperations.enableBulkSelect && selectedRows.size > 0 && editModeEnabled && (
          <button
            onClick={bulkDeleteSelectedRows}
            disabled={deleting}
            className="px-3 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            title={`Delete ${selectedRows.size} selected row${selectedRows.size === 1 ? '' : 's'}`}
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
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow ring-2 ring-cyan-300'
                : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
            title="Manage S3 snapshots"
          >
            <ArchiveBoxIcon className="w-4 h-4" />
            Snapshots
          </button>
        )}

        <div className="ml-auto flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span className="hidden sm:inline">
            <strong className="text-slate-700 dark:text-slate-200">{totalRows}</strong> rows
            {data?.sheets ? ` · ${data.sheets.length} sheets` : ''}
          </span>
          {CANVAS_CONFIG.autoSave.indicator && autoSaveStatus && (
            <span className={`px-2 py-1 rounded-full flex items-center gap-1 ${
              autoSaveStatus === 'saving' ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' :
              autoSaveStatus === 'saved' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' :
              'bg-rose-50 text-rose-700 ring-1 ring-rose-200'
            }`}>
              {autoSaveStatus === 'saving' ? (
                <>
                  <CloudArrowUpIcon className="w-3.5 h-3.5 animate-pulse" />
                  Auto-saving...
                </>
              ) : autoSaveStatus === 'saved' ? (
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
              {editedKeys.length} saved edit{editedKeys.length === 1 ? '' : 's'}
            </span>
          )}
          {fsEnabled && (
            <button
              onClick={toggleFullscreen}
              className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-700 rounded-md flex items-center gap-1"
              title={isFullscreen ? CANVAS_CONFIG.fullscreen.exitHint : CANVAS_CONFIG.fullscreen.enterHint}
            >
              {isFullscreen ? (
                <ArrowsPointingInIcon className="w-4 h-4" />
              ) : (
                <ArrowsPointingOutIcon className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">
                {isFullscreen ? CANVAS_CONFIG.fullscreen.exitLabel : CANVAS_CONFIG.fullscreen.enterLabel}
              </span>
            </button>
          )}
        </div>
      </div>

      {loadError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-sm px-3 py-2 flex items-center gap-2">
          <ExclamationTriangleIcon className="w-4 h-4" />
          {loadError}
        </div>
      )}

      {CANVAS_CONFIG.unroutedBanner.enabled && workbook === 'cat' && data?.unrouted_components?.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 text-sm px-3 py-2.5">
          <div className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-200">
            <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0" />
            {CANVAS_CONFIG.unroutedBanner.title}
            {' '}
            <span className="font-normal text-amber-700 dark:text-amber-300">
              ({data.unrouted_components.reduce((sum, g) => sum + g.count, 0)} components)
            </span>
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
            {CANVAS_CONFIG.unroutedBanner.helpText}
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-amber-800 dark:text-amber-200">
            {data.unrouted_components.slice(0, CANVAS_CONFIG.unroutedBanner.maxGroupsShown).map((g) => (
              <li key={`${g.component_type}::${g.sub_type}`}>
                <span className="font-medium">{g.sub_type || g.component_type}</span>
                {' × '}
                {g.count}
              </li>
            ))}
            {data.unrouted_components.length > CANVAS_CONFIG.unroutedBanner.maxGroupsShown && (
              <li className="italic opacity-75">
                +{data.unrouted_components.length - CANVAS_CONFIG.unroutedBanner.maxGroupsShown} more…
              </li>
            )}
          </ul>
        </div>
      )}

      {/* ── Main split: sheet sidebar + grid ─────────────────────────────── */}
      {!loadError && data && (
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-3">
          {/* Sheet list */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 h-fit lg:sticky lg:top-2">
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Sheets
            </div>
            <div className="flex flex-col gap-0.5 max-h-[60vh] overflow-auto">
              {data.sheets.map((s) => {
                const active = s.name === activeSheet;
                return (
                  <button
                    key={s.name}
                    onClick={() => setActiveSheet(s.name)}
                    className={`flex items-center justify-between gap-2 px-2.5 py-1.5 text-left text-xs rounded-md transition ${
                      active
                        ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900'
                    }`}
                    title={s.name}
                  >
                    <span className="truncate font-medium">{s.name}</span>
                    <span className={`text-[10px] tabular-nums ${active ? 'opacity-90' : 'text-slate-400'}`}>
                      {s.row_count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Edit Mode Disabled Banner */}
          {!editModeEnabled && (
            <div className="rounded-xl border-2 border-amber-300 bg-amber-50 dark:bg-amber-900/20 p-3 flex items-center gap-3">
              <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                  Edit Mode is Disabled
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                  Click the "Edit Mode OFF" button above to enable cell editing and row deletion.
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
                  Your changes are tracked locally. Click "Save All" button to persist them, or enable Auto-Save.
                </p>
              </div>
              <button
                onClick={saveAllPendingEdits}
                disabled={Object.values(edits).filter(e => e.status === 'editing').length === 0}
                className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <CheckCircleIcon className="w-4 h-4" />
                Save All Now
              </button>
            </div>
          )}

          {/* Grid */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 px-3 py-2">
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
                {activeSheet || '—'}
              </div>
              {activeSheetData && (
                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                  {filteredRows.length} / {activeSheetData.row_count} rows
                </span>
              )}
              <div className="ml-auto relative">
                <MagnifyingGlassIcon className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search rows…"
                  className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-300"
                />
              </div>
            </div>

            {loading ? (
              <div className="p-6 text-sm text-slate-500 flex items-center gap-2">
                <ArrowPathIcon className="w-4 h-4 animate-spin" /> Loading workbook…
              </div>
            ) : !activeSheetData || activeSheetData.rows.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                {CANVAS_CONFIG.emptySheetMessage}
              </div>
            ) : (
              <div className="overflow-auto" style={{ maxHeight: gridMaxH }}>
                <table className="min-w-full text-xs border-collapse">
                  <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300">
                    <tr style={{ height: CANVAS_CONFIG.density.headerRowPx }}>
                      {/* Bulk Selection Checkbox */}
                      {CANVAS_CONFIG.rowOperations.enableBulkSelect && editModeEnabled && (
                        <th className="sticky left-0 z-20 bg-slate-50 dark:bg-slate-900 border-b border-r border-slate-200 dark:border-slate-700 px-2 w-10">
                          <button
                            onClick={toggleSelectAll}
                            className="flex items-center justify-center w-5 h-5 rounded border-2 border-slate-400 hover:border-purple-500 transition-colors"
                            title={selectAllChecked ? 'Deselect all' : 'Select all visible rows'}
                          >
                            {selectAllChecked ? (
                              <CheckIconSolid className="w-4 h-4 text-purple-600" />
                            ) : selectedRows.size > 0 && selectedRows.size < filteredRows.length ? (
                              <MinusIcon className="w-3 h-3 text-purple-600" />
                            ) : null}
                          </button>
                        </th>
                      )}
                      {CANVAS_CONFIG.rowOperations.enableDelete && (
                        <th className="sticky left-0 z-20 bg-slate-50 dark:bg-slate-900 border-b border-r border-slate-200 dark:border-slate-700 px-2 w-12">
                          <TrashIcon className="w-4 h-4 text-slate-400 mx-auto" />
                        </th>
                      )}
                      <th
                        className="sticky left-0 z-20 bg-slate-50 dark:bg-slate-900 text-left font-semibold border-b border-r border-slate-200 dark:border-slate-700 px-2"
                        style={{ minWidth: CANVAS_CONFIG.rowHeaderMinWidthPx }}
                      >
                        Source
                      </th>
                      {activeSheetData.headers.map((h) => (
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
                          style={{ minWidth: CANVAS_CONFIG.rowOperations.actionsColumnWidth }}
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
                          editingRowKey === row.row_key ? 'bg-blue-50 dark:bg-blue-900/20 ring-2 ring-inset ring-blue-400 dark:ring-blue-600' :
                          selectedRows.has(row.row_key) ? 'bg-purple-50 dark:bg-purple-900/20' : ''
                        }`}
                        style={{ height: CANVAS_CONFIG.density.rowPx }}
                      >
                        {/* Bulk Selection Checkbox */}
                        {CANVAS_CONFIG.rowOperations.enableBulkSelect && editModeEnabled && (
                          <td className="sticky left-0 bg-white dark:bg-slate-800 border-b border-r border-slate-200 dark:border-slate-700 px-2 text-center">
                            <button
                              onClick={() => toggleRowSelection(row.row_key)}
                              className={`flex items-center justify-center w-5 h-5 rounded border-2 transition-all ${
                                selectedRows.has(row.row_key)
                                  ? 'border-purple-600 bg-purple-600'
                                  : 'border-slate-400 hover:border-purple-500'
                              }`}
                              title={selectedRows.has(row.row_key) ? 'Deselect row' : 'Select row'}
                            >
                              {selectedRows.has(row.row_key) && (
                                <CheckIconSolid className="w-4 h-4 text-white" />
                              )}
                            </button>
                          </td>
                        )}
                        {CANVAS_CONFIG.rowOperations.enableDelete && (
                          <td className="sticky left-0 bg-white dark:bg-slate-800 border-b border-r border-slate-200 dark:border-slate-700 px-2 text-center">
                            <button
                              onClick={() => handleDeleteRow(activeSheet, row.row_key, idx)}
                              disabled={deleting || !editModeEnabled}
                              className={`text-rose-500 hover:text-rose-700 disabled:opacity-30 transition-opacity ${
                                CANVAS_CONFIG.rowOperations.showRowActions === 'hover' 
                                  ? 'opacity-0 group-hover:opacity-100'
                                  : 'opacity-100'
                              }`}
                              title={!editModeEnabled ? 'Enable Edit Mode to delete rows' : 'Delete this row'}
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                        <td
                          className="sticky left-0 bg-white dark:bg-slate-800 border-b border-r border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] text-slate-600 dark:text-slate-300 whitespace-nowrap"
                          style={{ minWidth: CANVAS_CONFIG.rowHeaderMinWidthPx }}
                        >
                          <div className="font-semibold text-slate-700 dark:text-slate-200 truncate">
                            {row.source?.class_code || '—'}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate" title={row.row_key}>
                            {row.row_key}
                          </div>
                        </td>
                        {activeSheetData.headers.map((col) => {
                          const k = editKey(activeSheet, row.row_key, col);
                          const local = edits[k];
                          const raw   = row.cells?.[col];
                          const value = local ? local.value : toInputValue(raw);
                          const wasOverridden = (row.overridden || []).includes(col);
                          const status = local?.status;
                          // Cell is editable if: Edit Mode is ON globally OR this specific row is being edited
                          const isRowEditable = editModeEnabled || editingRowKey === row.row_key;
                          const cellCls =
                            status === 'saving' ? CANVAS_CONFIG.highlight.saving
                            : status === 'saved' ? CANVAS_CONFIG.highlight.saved
                            : status === 'error' ? CANVAS_CONFIG.highlight.error
                            : status === 'editing' ? CANVAS_CONFIG.highlight.edited
                            : wasOverridden ? CANVAS_CONFIG.highlight.edited
                            : '';
                          return (
                            <td
                              key={col}
                              className={`border-b border-slate-100 dark:border-slate-700 px-1 py-0.5 align-middle ${cellCls}`}
                              style={{ minWidth: CANVAS_CONFIG.cellMinWidthPx }}
                            >
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={value}
                                  onChange={(e) =>
                                    queueSave(activeSheet, row.row_key, col, e.target.value)
                                  }
                                  readOnly={!isRowEditable}
                                  disabled={!isRowEditable}
                                  className={`w-full bg-transparent outline-none px-1.5 py-1 text-[11px] focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-pink-300 rounded ${
                                    !isRowEditable ? 'cursor-not-allowed opacity-60' : ''
                                  }`}
                                  title={
                                    !isRowEditable 
                                      ? 'Click Edit button or enable Edit Mode to modify this cell' 
                                      : status === 'error' 
                                      ? local.error 
                                      : undefined
                                  }
                                />
                                {isRowEditable && (wasOverridden || status === 'saved' || status === 'error') && (
                                  <button
                                    onClick={() => clearCell(activeSheet, row.row_key, col)}
                                    className="opacity-60 hover:opacity-100 text-slate-500 hover:text-rose-500"
                                    title="Reset to extracted value"
                                  >
                                    <ArrowUturnLeftIcon className="w-3 h-3" />
                                  </button>
                                )}
                                {status === 'saved' && (
                                  <CheckCircleIcon className="w-3 h-3 text-emerald-500" title="Saved" />
                                )}
                                {status === 'saving' && (
                                  <ArrowPathIcon className="w-3 h-3 animate-spin text-blue-500" title="Saving…" />
                                )}
                              </div>
                            </td>
                          );
                        })}
                        
                        {/* Actions Column Cell */}
                        {CANVAS_CONFIG.rowOperations.showActionsColumn && (
                          <td
                            className={`border-b border-slate-200 dark:border-slate-700 px-2 text-center sticky right-0 ${
                              editingRowKey === row.row_key ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-white dark:bg-slate-800'
                            }`}
                            style={{ minWidth: CANVAS_CONFIG.rowOperations.actionsColumnWidth }}
                          >
                            <div className={`flex items-center justify-center gap-2 ${
                              CANVAS_CONFIG.rowOperations.showRowActions === 'hover' 
                                ? 'opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto'
                                : 'opacity-100'
                            }`}>
                              {/* Edit Button */}
                              {CANVAS_CONFIG.rowOperations.enableRowEdit && (
                                <button
                                  onClick={() => handleEditRow(row.row_key)}
                                  className={`px-2 py-1 text-xs font-semibold rounded transition-colors flex items-center gap-1 ${
                                    editingRowKey === row.row_key
                                      ? 'bg-blue-600 text-white shadow-sm'
                                      : 'bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-900/40 dark:hover:bg-blue-800/60 dark:text-blue-300'
                                  }`}
                                  title={editingRowKey === row.row_key ? 'Stop editing (click to finish)' : 'Edit this row (cells become editable)'}
                                >
                                  <PencilIcon className="w-3.5 h-3.5" />
                                  {editingRowKey === row.row_key && (
                                    <span className="text-[10px] font-bold">ON</span>
                                  )}
                                </button>
                              )}
                              
                              {/* Delete Button */}
                              {CANVAS_CONFIG.rowOperations.enableRowDelete && (
                                <button
                                  onClick={() => handleDeleteFromActions(activeSheet, row.row_key, idx)}
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
                  Are you sure you want to delete this row and all its cell overrides? This action cannot be undone.
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
                <ArrowPathIcon className={`w-4 h-4 ${loadingSnapshots ? 'animate-spin' : ''}`} />
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
                    <li>• Created automatically when cell count exceeds 5000</li>
                    <li>• Created when JSON size exceeds 10MB</li>
                    <li>• Every {CANVAS_CONFIG.s3Snapshots.autoSnapshotInterval} edits (when enabled)</li>
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
                  <p className="text-xs mt-1">Create your first snapshot to enable restore</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {s3SnapshotsList.slice(0, CANVAS_CONFIG.s3Snapshots.maxSnapshotsToShow).map((snapshot, idx) => (
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
                            <span>{snapshot.cell_count.toLocaleString()} cells</span>
                            <span>{snapshot.size_mb} MB</span>
                            <span className="font-mono text-[10px] truncate max-w-xs" title={snapshot.s3_key}>
                              {snapshot.s3_key.split('/').pop()}
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
                Snapshots are stored in: <code className="bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded">
                  s3://{CANVAS_CONFIG.s3Snapshots.enabled ? 'radai-workbook-snapshots' : 'N/A'}
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
