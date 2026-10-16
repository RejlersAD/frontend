/**
 * WorkbookImportModal.jsx — confirm table for the smart multi-sheet Excel
 * legend import (Legend Manager → "Import Excel Workbook").
 *
 * Flow: previewLegendWorkbook(file) renders one row per sheet with the
 * predicted section (overridable dropdown, LEGEND_SECTIONS + Skip), kind
 * badge, row/image counts and a data sample. Confirm → importLegendWorkbook.
 *
 * Styling mirrors ImportFromRepositoryModal (native <dialog>, same palette).
 * SOFT-CODED: copy + kind badge palette below.
 */
import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { previewLegendWorkbook, importLegendWorkbook, LEGEND_SECTIONS } from '../../../services/pidCheckerV2API';
import {
  TableCellsIcon, XMarkIcon, ArrowPathIcon, CheckCircleIcon,
  ExclamationTriangleIcon, PhotoIcon,
} from '@heroicons/react/24/outline';

// ── Soft-coded ────────────────────────────────────────────────────────────
const COPY = {
  title: 'Import legend workbook',
  subtitle: 'Every sheet is mapped to a legend section — override any prediction or set a sheet to Skip.',
  confirm: 'Import workbook',
};
const KIND_STYLES = {
  codes:     { label: 'Codes',     bg: 'rgba(59,130,246,0.10)',  fg: '#1d4ed8', border: 'rgba(59,130,246,0.25)'  },
  numbering: { label: 'Numbering', bg: 'rgba(139,92,246,0.10)',  fg: '#6d28d9', border: 'rgba(139,92,246,0.25)'  },
  symbols:   { label: 'Symbols',   bg: 'rgba(236,72,153,0.10)',  fg: '#be185d', border: 'rgba(236,72,153,0.25)'  },
  notes:     { label: 'Notes',     bg: 'rgba(245,158,11,0.12)',  fg: '#b45309', border: 'rgba(245,158,11,0.28)'  },
  fields:    { label: 'Fields',    bg: 'rgba(59,130,246,0.10)', fg: '#1d4ed8', border: 'rgba(59,130,246,0.25)' },
  unknown:   { label: 'Unknown',   bg: 'rgba(100,116,139,0.08)', fg: '#475569', border: 'rgba(100,116,139,0.22)' },
};
const CONFIDENCE_COLORS = { high: '#047857', medium: '#b45309', low: '#94a3b8' };

const WorkbookImportModal = ({ open, onClose, file, projectId, onImported, defaultSection,
  workbookApi, sections = LEGEND_SECTIONS }) => {
  const previewApi = workbookApi?.previewLegendWorkbook || previewLegendWorkbook;
  const importApi = workbookApi?.importLegendWorkbook || importLegendWorkbook;
  const dialogRef = useRef(null);
  const [phase, setPhase] = useState('preview');       // preview | ready | importing | error
  const [error, setError] = useState('');
  const [sheets, setSheets] = useState([]);            // preview rows
  const [sheetMap, setSheetMap] = useState({});        // name → section | ''
  const [result, setResult] = useState(null);

  // Native <dialog> lifecycle
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  // Preview when a file arrives
  useEffect(() => {
    if (!open || !file) return;
    let live = true;
    setPhase('preview'); setError(''); setSheets([]); setSheetMap({}); setResult(null);
    (async () => {
      try {
        const res = await previewApi({ file });
        if (!live) return;
        const rows = res.sheets || [];
        setSheets(rows);
        setSheetMap(Object.fromEntries(rows.map(s => [
          s.name, s.predicted_section || (s.kind === 'fields' ? defaultSection : '') || '',
        ])));
        setPhase('ready');
      } catch (err) {
        if (!live) return;
        setPhase('error');
        setError(err?.response?.data?.error || 'Could not read the workbook.');
      }
    })();
    return () => { live = false; };
  }, [open, file, defaultSection, previewApi]);

  const handleImport = async () => {
    setPhase('importing');
    try {
      const res = await importApi({ file, sheetMap, projectId });
      const n = res.sections || 0;
      const imgs = res.image_count || 0;
      toast.success(`Workbook imported — ${n} section${n === 1 ? '' : 's'} configured, ${imgs} symbol image${imgs === 1 ? '' : 's'} extracted.`);
      setResult(res);
      setPhase('complete');
      onImported?.(res);
    } catch (err) {
      setPhase('ready');
      toast.error(err?.response?.data?.error || 'Workbook import failed.');
    }
  };

  if (!open) return null;

  const mappedCount = Object.values(sheetMap).filter(Boolean).length;

  return (
    <dialog ref={dialogRef} aria-label={COPY.title} onCancel={(e) => { e.preventDefault(); onClose(); }}
      className="rounded-2xl p-0 w-[min(960px,96vw)] backdrop:bg-slate-900/40 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #e2e8f0' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)' }}>
            <TableCellsIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800 m-0">{COPY.title}</h2>
            <p className="text-xs text-slate-500 m-0">{file?.name || ''} · {COPY.subtitle}</p>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Body */}
      <div className="px-5 py-4 max-h-[62vh] overflow-y-auto">
        {phase === 'complete' && result && (
          <div role="status" className="text-sm text-slate-700">
            <p className="font-semibold">
              Imported {result.sections} sections and {result.image_count} symbol pictures.
            </p>
            <p className="mt-2">Open a configured section to view its original worksheets, text and pictures together.</p>
            <ul className="mt-2 list-disc pl-5">
              {[...(result.created || []), ...(result.updated || [])].map(item => (
                <li key={item.legend_id}>{item.section_label}</li>
              ))}
            </ul>
            {!!result.warnings?.length && (
              <div role="alert" className="mt-3 text-amber-700">
                <p className="font-semibold">Import warnings:</p>
                <ul className="list-disc pl-5">{result.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul>
              </div>
            )}
          </div>
        )}
        {phase === 'preview' && (
          <div className="flex items-center gap-2 text-sm text-slate-500 py-10 justify-center">
            <ArrowPathIcon className="w-4 h-4 animate-spin" /> Reading workbook sheets…
          </div>
        )}

        {phase === 'error' && (
          <div className="flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm"
            style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: '#b91c1c' }}>
            <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0" /> {error}
          </div>
        )}

        {(phase === 'ready' || phase === 'importing') && (
          <table className="w-full text-xs" style={{ borderCollapse: 'separate', borderSpacing: '0 6px' }}>
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400">
                <th className="px-2 py-1">Sheet</th>
                <th className="px-2 py-1">Kind</th>
                <th className="px-2 py-1">Rows / Images</th>
                <th className="px-2 py-1">Legend section</th>
                <th className="px-2 py-1">Sample</th>
              </tr>
            </thead>
            <tbody>
              {sheets.map(s => {
                const kind = KIND_STYLES[s.kind] || KIND_STYLES.unknown;
                return (
                  <tr key={s.name} style={{ background: sheetMap[s.name] ? '#fff' : '#f8fafc' }}>
                    <td className="px-2 py-2 rounded-l-lg" style={{ border: '1px solid #e2e8f0', borderRight: 'none' }}>
                      <div className="font-semibold text-slate-800" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={s.name}>{s.name}</div>
                      <div className="text-[10px]" style={{ color: CONFIDENCE_COLORS[s.confidence] || '#94a3b8' }}>
                        {s.confidence} confidence
                      </div>
                    </td>
                    <td className="px-2 py-2" style={{ border: '1px solid #e2e8f0', borderLeft: 'none', borderRight: 'none' }}>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                        style={{ background: kind.bg, color: kind.fg, border: `1px solid ${kind.border}` }}>
                        {kind.label}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-slate-500" style={{ border: '1px solid #e2e8f0', borderLeft: 'none', borderRight: 'none' }}>
                      <span className="inline-flex items-center gap-1">{s.row_count} rows</span>
                      {s.image_count > 0 && (
                        <span className="inline-flex items-center gap-1 ml-2 text-pink-600">
                          <PhotoIcon className="w-3.5 h-3.5" />{s.image_count}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2" style={{ border: '1px solid #e2e8f0', borderLeft: 'none', borderRight: 'none' }}>
                      <select
                        value={sheetMap[s.name] ?? ''}
                        onChange={e => setSheetMap(prev => ({ ...prev, [s.name]: e.target.value }))}
                        className="px-2 py-1.5 rounded-lg text-xs border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                        style={{ minWidth: 170 }}>
                        <option value="">— Skip —</option>
                        {sections.map(sec => (
                          <option key={sec.id} value={sec.id}>{sec.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2 rounded-r-lg text-slate-400" style={{ border: '1px solid #e2e8f0', borderLeft: 'none' }}>
                      {(s.sample_rows || []).slice(0, 2).map((r, i) => (
                        <div key={i} className="truncate" style={{ maxWidth: 220 }}>{r.join(' · ')}</div>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 px-5 py-4" style={{ borderTop: '1px solid #e2e8f0' }}>
        <span className="text-xs text-slate-500">
          {phase === 'ready' || phase === 'importing'
            ? `${mappedCount} of ${sheets.length} sheets mapped`
            : ''}
        </span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100">
            {phase === 'complete' ? 'Done' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={phase !== 'ready' || mappedCount === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)' }}>
            {phase === 'importing'
              ? <><ArrowPathIcon className="w-4 h-4 animate-spin" /> Importing…</>
              : <><CheckCircleIcon className="w-4 h-4" /> {COPY.confirm}</>}
          </button>
        </div>
      </div>
    </dialog>
  );
};

export default WorkbookImportModal;
