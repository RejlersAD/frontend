/**
 * ImportFromRepositoryModal.jsx — pull a project legend pack straight from the
 * project's mapped file-server folder (R: drive replica) into the Legend
 * Manager's AI pack-upload flow.
 *
 * Bridge logic:
 *   Project Organizer project (UUID, has `code`)
 *     → core Project (integer id, matched by code)        [projectControl]
 *     → ReplicaScope(s) mapped to that project            [file-replica]
 *     → ReplicaEntry files (PDF/images, name search)      [file-replica]
 *     → downloadEntry() → File → uploadLegendPack()       [existing flow]
 *
 * SOFT-CODED: candidate extensions, search hints and copy live below.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import * as Replica from '../../../services/fileReplica.service';
import { listProjects as listCoreProjects } from '../../../services/projectControl.service';
import {
  FolderIcon, MagnifyingGlassIcon, ArrowDownTrayIcon,
  CheckCircleIcon, ExclamationTriangleIcon, XMarkIcon,
  DocumentIcon, ArrowPathIcon, LinkIcon,
} from '@heroicons/react/24/outline';

// ── Soft-coded knobs ────────────────────────────────────────────────────────
const CANDIDATE_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'tiff', 'tif', 'bmp'];
const SEARCH_HINTS = ['legend', 'symbol', 'pid', ''];
const COPY = {
  title: 'Import legend sheets from project repository',
  noMapping:
    'No file-server folder is mapped to this project yet. Map the project folder in Admin → File Server Replica, then return here.',
  noMatch:
    'No legend-sheet candidates found in the mapped folder. Try a different search term or check the folder contents.',
};

const coreProjectCode = (p) => p?.project_code || p?.code || '';
const coreProjectName = (p) => p?.name || p?.project_name || p?.title || '';
const isCandidate = (entry) =>
  !entry.is_directory && CANDIDATE_EXTENSIONS.includes((entry.file_extension || '').toLowerCase());
const fmtSize = (n) =>
  n == null ? '' : n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

const ImportFromRepositoryModal = ({ open, onClose, project, onImport }) => {
  // project: { project_id (UUID), name, code } from Project Organizer
  const dialogRef = useRef(null);

  const [phase, setPhase] = useState('resolve'); // resolve | ready | empty | error
  const [error, setError] = useState('');
  const [scopes, setScopes] = useState([]);
  const [entries, setEntries] = useState([]);
  const [entriesBusy, setEntriesBusy] = useState(false);
  const [search, setSearch] = useState('legend');
  const [selectedId, setSelectedId] = useState(null);
  const [importBusy, setImportBusy] = useState(false);

  // ── Resolve organizer project → core project → replica scopes ──────────
  useEffect(() => {
    if (!open || !project) return;
    let live = true;
    setPhase('resolve'); setError(''); setScopes([]); setEntries([]); setSelectedId(null);
    (async () => {
      try {
        const coreProjects = await listCoreProjects({ page_size: 500 });
        const rows = Array.isArray(coreProjects) ? coreProjects : coreProjects?.results || [];
        const code = String(project.code || '').trim().toLowerCase();
        const name = String(project.name || '').trim().toLowerCase();
        const match =
          rows.find(p => code && String(coreProjectCode(p)).trim().toLowerCase() === code) ||
          rows.find(p => name && String(coreProjectName(p)).trim().toLowerCase() === name);
        if (!live) return;
        if (!match) { setPhase('empty'); setError(COPY.noMapping); return; }
        const mapped = (await Replica.listScopes({ project: match.id }))
          .filter(s => s.access_enabled);
        if (!live) return;
        if (!mapped.length) { setPhase('empty'); setError(COPY.noMapping); return; }
        setScopes(mapped);
        setPhase('ready');
      } catch (err) {
        if (!live) return;
        setPhase('error');
        setError(Replica.replicaError(err, 'Could not resolve the project repository mapping.'));
      }
    })();
    return () => { live = false; };
  }, [open, project]);

  // ── Load candidate files from the mapped scope(s) ──────────────────────
  useEffect(() => {
    if (phase !== 'ready' || !scopes.length) return;
    let live = true;
    setEntriesBusy(true);
    (async () => {
      try {
        const seen = new Set();
        const found = [];
        for (const scope of scopes) {
          for (const hint of SEARCH_HINTS.includes(search) ? [search] : [search, ...SEARCH_HINTS]) {
            const data = await Replica.listEntries({
              scope: scope.id,
              ...(hint ? { search: hint } : {}),
              page_size: 200,
            });
            const rows = Replica.itemsFrom(data);
            rows.filter(isCandidate).forEach(e => {
              if (!seen.has(e.id)) { seen.add(e.id); found.push(e); }
            });
            if (found.length >= 50) break;
          }
        }
        if (!live) return;
        // Legend-ish names first, then the rest by path
        const score = (e) => /legend|symbol/i.test(e.name) ? 0 : 1;
        found.sort((a, b) => score(a) - score(b) || a.relative_path.localeCompare(b.relative_path));
        setEntries(found);
      } catch (err) {
        if (live) toast.error(Replica.replicaError(err, 'Could not list repository files.'));
      } finally { if (live) setEntriesBusy(false); }
    })();
    return () => { live = false; };
  }, [phase, scopes, search]);

  const selected = useMemo(
    () => entries.find(e => e.id === selectedId) || null,
    [entries, selectedId],
  );

  const handleImport = async () => {
    if (!selected || importBusy) return;
    setImportBusy(true);
    try {
      const blob = await Replica.downloadEntry(selected.id);
      const file = new File([blob], selected.name, {
        type: selected.content_type || blob.type || 'application/octet-stream',
      });
      await onImport(file);
      dialogRef.current?.close();
      onClose();
    } catch (err) {
      toast.error(Replica.replicaError(err, 'Could not fetch the file from the repository.'));
    } finally { setImportBusy(false); }
  };

  // Native <dialog> lifecycle
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  if (!open) return null;

  return (
    <dialog ref={dialogRef} aria-label={COPY.title} onCancel={(e) => { e.preventDefault(); onClose(); }}
      className="rounded-2xl p-0 w-[min(720px,94vw)] backdrop:bg-slate-900/40 shadow-2xl">
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #e2e8f0' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)' }}>
            <FolderIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800 m-0">{COPY.title}</h2>
            <p className="text-xs text-slate-500 m-0">
              {project?.name || ''}{project?.code ? ` · ${project.code}` : ''}
            </p>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
        {phase === 'resolve' && (
          <div className="flex items-center gap-2 text-sm text-slate-500 py-8 justify-center">
            <ArrowPathIcon className="w-4 h-4 animate-spin" /> Resolving project repository…
          </div>
        )}

        {(phase === 'empty' || phase === 'error') && (
          <div className="flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm"
            style={{
              background: phase === 'error' ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.07)',
              border: `1px solid ${phase === 'error' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.25)'}`,
              color: phase === 'error' ? '#b91c1c' : '#92400e',
            }}>
            <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="m-0">{error}</p>
              {phase === 'empty' && (
                <a href="/admin/file-server-replica" className="inline-flex items-center gap-1 mt-2 font-semibold underline">
                  <LinkIcon className="w-3.5 h-3.5" /> Open File Server Replica
                </a>
              )}
            </div>
          </div>
        )}

        {phase === 'ready' && (
          <>
            {/* Mapped folders */}
            <div className="mb-3 flex flex-wrap gap-1.5">
              {scopes.map(s => (
                <span key={s.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                  style={{ background: 'rgba(59,130,246,0.08)', color: '#1d4ed8', border: '1px solid rgba(59,130,246,0.22)' }}>
                  <CheckCircleIcon className="w-3.5 h-3.5" /> {s.relative_path}
                </span>
              ))}
            </div>

            {/* Search */}
            <div className="relative mb-3">
              <MagnifyingGlassIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search files in the mapped folder (e.g. legend, symbol)…"
                className="w-full pl-9 pr-3 py-2 rounded-xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400/40"
              />
            </div>

            {/* Candidates */}
            {entriesBusy ? (
              <div className="flex items-center gap-2 text-sm text-slate-500 py-6 justify-center">
                <ArrowPathIcon className="w-4 h-4 animate-spin" /> Scanning mapped folder…
              </div>
            ) : entries.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">{COPY.noMatch}</p>
            ) : (
              <ul className="space-y-1.5">
                {entries.map(e => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(e.id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors"
                      style={{
                        border: selectedId === e.id ? '1.5px solid #6366f1' : '1px solid #e2e8f0',
                        background: selectedId === e.id ? 'rgba(99,102,241,0.06)' : '#fff',
                      }}>
                      <DocumentIcon className="w-5 h-5 text-slate-400 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-slate-800 truncate">{e.name}</div>
                        <div className="text-[11px] text-slate-400 truncate">{e.relative_path}</div>
                      </div>
                      <span className="text-[11px] text-slate-400 flex-shrink-0">{fmtSize(e.size_bytes)}</span>
                      {selectedId === e.id && <CheckCircleIcon className="w-5 h-5 text-indigo-500 flex-shrink-0" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 px-5 py-4" style={{ borderTop: '1px solid #e2e8f0' }}>
        <button type="button" onClick={onClose}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100">
          Cancel
        </button>
        <button
          type="button"
          onClick={handleImport}
          disabled={!selected || importBusy}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: 'linear-gradient(135deg,#8b5cf6,#6366f1)' }}>
          <ArrowDownTrayIcon className="w-4 h-4" />
          {importBusy ? 'Fetching…' : 'Import as legend pack (AI)'}
        </button>
      </div>
    </dialog>
  );
};

export default ImportFromRepositoryModal;
