/**
 * Valve MTO — Processing Overlay (Soft-coded)
 * ===========================================
 * A full-screen, engaging UI shown while the backend is extracting valves
 * from a multi-page P&ID PDF (which can take 1–3 minutes). Designed to:
 *
 *   • Reassure the user the job is alive (animated stages + live counters).
 *   • Educate them with rotating piping-engineering tips & recommendations.
 *   • Show partial rows trickling in as they are returned by AI Vision.
 *   • Allow them to "Continue in background" so they can keep working
 *     while polling continues.
 *
 * Everything is configured by the soft-coded constants below — no magic
 * numbers or strings in the JSX.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Sparkles, Search as ScanSearch, FileSearch, Wrench, CheckCircle2, X,
  Lightbulb, ShieldCheck, Database, Layers, Cpu, Zap,
} from 'lucide-react';

// ─── Soft-coded config ───────────────────────────────────────────────────
export const PROCESSING_TIP_ROTATE_MS = 5000;       // 5 s per tip
export const PROCESSING_AVG_BATCH_SECONDS = 8;      // for ETA estimate

// Stages — driven off `progress` snapshot from the polling loop.
export const PROCESSING_STAGES = [
  { id: 'queue',     label: 'Queueing',       icon: Cpu,         match: (p) => !p || p.total === 0 },
  { id: 'extract',   label: 'AI Vision read', icon: ScanSearch,  match: (p) =>  p && p.current < p.total },
  { id: 'normalize', label: 'Normalising',    icon: FileSearch,  match: (p) =>  p && p.current >= p.total && p.rows > 0 },
  { id: 'finalize',  label: 'Finalising',     icon: CheckCircle2,match: (p) =>  p && p.current >= p.total },
];

// Rotating recommendations / tips shown one-at-a-time during processing.
export const PROCESSING_TIPS = [
  { icon: Lightbulb,   color: 'amber',
    title: 'Tip · Crisp scans extract better',
    body:  'High-DPI vector PDFs give the cleanest valve tag detection. Avoid camera photos of printouts.' },
  { icon: ShieldCheck, color: 'emerald',
    title: 'Best practice · PMS class',
    body:  'Always cross-check the extracted PMS class against your project Piping Material Specification.' },
  { icon: Database,    color: 'sky',
    title: 'Did you know?',
    body:  'Each successful import auto-saves a snapshot in History — no need to re-run extraction on the same drawing.' },
  { icon: Layers,      color: 'violet',
    title: 'Recommendation · Multi-area MTOs',
    body:  'After extraction, switch to the COMBINED tab to merge ISLAND + FIELD valves into one orderable list.' },
  { icon: Wrench,      color: 'orange',
    title: 'Tip · Bore vs Size',
    body:  'For ball valves, BORE (FB / RB) drives orifice diameter — verify after import for non-standard sizes.' },
  { icon: Zap,         color: 'rose',
    title: 'Speed tip',
    body:  'Splitting very large MTOs into 10–15 page chunks can finish in <1 min instead of several minutes.' },
  { icon: Sparkles,    color: 'fuchsia',
    title: 'AI Vision is live',
    body:  'Page text + diagrams are read together by GPT-4o, so even hand-marked-up PDFs can be parsed.' },
];

const ACCENT_RING = {
  amber:    'from-amber-500 to-orange-600',
  emerald:  'from-emerald-500 to-teal-600',
  sky:      'from-sky-500 to-blue-600',
  violet:   'from-violet-500 to-fuchsia-600',
  orange:   'from-orange-500 to-rose-500',
  rose:     'from-rose-500 to-pink-600',
  fuchsia:  'from-fuchsia-500 to-purple-600',
};

const formatEta = (seconds) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  if (seconds < 60) return `${Math.ceil(seconds)} s`;
  const m = Math.floor(seconds / 60);
  const s = Math.ceil(seconds % 60);
  return `${m} m ${s.toString().padStart(2, '0')} s`;
};

// ─── Component ───────────────────────────────────────────────────────────
const ProcessingOverlay = ({
  open,
  filename,
  startedAt,
  progress,        // { current, total, rows } | null
  partialRows = [],
  onClose,         // "Continue in background"
  onAbort,         // optional hard-cancel hook (currently we just hide)
}) => {
  const [tipIdx, setTipIdx] = useState(0);

  useEffect(() => {
    if (!open) return undefined;
    const id = setInterval(
      () => setTipIdx((i) => (i + 1) % PROCESSING_TIPS.length),
      PROCESSING_TIP_ROTATE_MS,
    );
    return () => clearInterval(id);
  }, [open]);

  const elapsedSec = useMemo(() => {
    if (!startedAt) return 0;
    return Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  }, [startedAt, progress]); // eslint-disable-line react-hooks/exhaustive-deps

  const pct = useMemo(() => {
    if (!progress || !progress.total) return 0;
    return Math.min(100, Math.round((progress.current / progress.total) * 100));
  }, [progress]);

  const etaSec = useMemo(() => {
    if (!progress || !progress.total || !progress.current) return null;
    const remaining = progress.total - progress.current;
    return remaining * PROCESSING_AVG_BATCH_SECONDS;
  }, [progress]);

  const activeStageId = useMemo(() => {
    const s = PROCESSING_STAGES.find((st) => st.match(progress));
    return s ? s.id : PROCESSING_STAGES[0].id;
  }, [progress]);

  if (!open) return null;
  const tip = PROCESSING_TIPS[tipIdx];
  const TipIcon = tip.icon;
  const tipAccent = ACCENT_RING[tip.color] || ACCENT_RING.amber;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-[fadeIn_.2s_ease-out]">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Decorative gradient blobs */}
        <div className="absolute -top-24 -right-20 w-72 h-72 bg-gradient-to-br from-amber-300 via-orange-300 to-rose-300 rounded-full blur-3xl opacity-50 pointer-events-none animate-pulse" />
        <div className="absolute -bottom-24 -left-20 w-72 h-72 bg-gradient-to-br from-blue-300 via-violet-300 to-emerald-300 rounded-full blur-3xl opacity-40 pointer-events-none" />

        {/* Header */}
        <div className="relative px-6 py-5 border-b border-slate-100 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/40">
            <Sparkles className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-bold text-slate-900">AI Vision is extracting your Valve MTO</div>
            <div className="text-xs text-slate-500 truncate" title={filename}>{filename || 'Uploaded PDF'}</div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              title="Hide this dialog. Extraction continues in the background."
            >
              Continue in background
            </button>
          )}
          {onAbort && (
            <button
              onClick={onAbort}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              title="Abort"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="relative p-6 space-y-5">
          {/* Stage stepper */}
          <div className="flex items-center gap-2">
            {PROCESSING_STAGES.map((st, idx) => {
              const Icon = st.icon;
              const reached = PROCESSING_STAGES.findIndex((s) => s.id === activeStageId) >= idx;
              const active  = st.id === activeStageId;
              return (
                <div key={st.id} className="flex items-center gap-2 flex-1">
                  <div
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                      active
                        ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/30'
                        : reached
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-50 text-slate-400 border border-slate-200'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${active ? 'animate-pulse' : ''}`} />
                    {st.label}
                  </div>
                  {idx < PROCESSING_STAGES.length - 1 && (
                    <div className={`flex-1 h-0.5 rounded ${reached ? 'bg-emerald-300' : 'bg-slate-200'}`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Big counter + progress bar */}
          <div className="rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5">
            <div className="flex items-end justify-between gap-4 mb-3">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-amber-200/90 font-semibold">
                  Valves found so far
                </div>
                <div className="mt-1 text-5xl font-black tabular-nums leading-none bg-gradient-to-r from-amber-200 via-orange-200 to-rose-200 bg-clip-text text-transparent">
                  {progress?.rows ?? 0}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-wider text-slate-300">Batch</div>
                <div className="text-2xl font-bold tabular-nums">
                  {progress?.current ?? 0}<span className="text-slate-400 text-lg"> / {progress?.total ?? '?'}</span>
                </div>
              </div>
            </div>
            <div className="h-2 w-full bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 transition-all duration-500 relative"
                style={{ width: `${pct}%` }}
              >
                <div className="absolute inset-0 bg-white/30 animate-pulse" />
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-300">
              <span>{pct}% complete</span>
              <span>Elapsed {formatEta(elapsedSec)}{etaSec != null && ` · ETA ~${formatEta(etaSec)}`}</span>
            </div>
          </div>

          {/* Rotating tip card */}
          <div className={`relative rounded-xl p-4 bg-gradient-to-br ${tipAccent} text-white overflow-hidden`}>
            <div className="absolute inset-0 bg-white/5" />
            <div className="relative flex items-start gap-3">
              <div className="p-2 bg-white/20 rounded-lg shrink-0">
                <TipIcon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold uppercase tracking-wide mb-0.5 opacity-90">{tip.title}</div>
                <div className="text-sm leading-relaxed">{tip.body}</div>
              </div>
            </div>
            <div className="relative mt-3 flex items-center gap-1.5">
              {PROCESSING_TIPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 rounded-full transition-all ${i === tipIdx ? 'w-6 bg-white' : 'w-1.5 bg-white/40'}`}
                />
              ))}
            </div>
          </div>

          {/* Live preview of last 5 rows */}
          {partialRows.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white">
              <div className="px-3 py-2 border-b border-slate-100 text-[11px] font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-amber-600" /> Live preview · last {Math.min(5, partialRows.length)} valves
              </div>
              <div className="overflow-hidden">
                <table className="min-w-full text-[11px]">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-semibold">Tag</th>
                      <th className="px-2 py-1.5 text-left font-semibold">Type</th>
                      <th className="px-2 py-1.5 text-left font-semibold">Class</th>
                      <th className="px-2 py-1.5 text-left font-semibold">Size</th>
                      <th className="px-2 py-1.5 text-right font-semibold">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partialRows.slice(-5).reverse().map((r, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-2 py-1 font-mono text-slate-800 truncate max-w-[140px]">{r.valve_tag || '—'}</td>
                        <td className="px-2 py-1 text-slate-700 truncate max-w-[120px]">{r.type || '—'}</td>
                        <td className="px-2 py-1 text-slate-700">{r.pms_class || r.rating || '—'}</td>
                        <td className="px-2 py-1 text-slate-700">{r.size_1 || '—'}</td>
                        <td className="px-2 py-1 text-right tabular-nums font-semibold">
                          {(Number(r.qty_island) || 0) + (Number(r.qty_field) || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProcessingOverlay;
