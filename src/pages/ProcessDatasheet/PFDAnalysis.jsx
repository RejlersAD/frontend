/**
 * Pump Hydraulic Calculation — Tabbed Workspace
 * =============================================
 * Route: /engineering/process/datasheet/pfd
 *
 * Aligns the page with the standard Pump Hydraulic Calculation Excel
 * template (10 sub-sheets) while preserving the existing AI extraction
 * pipeline. The first tab embeds the working `DatasheetGeneratorTemplate`
 * (P&ID upload → async analyze → download .xlsx) — its backend contract
 * is NOT modified. The remaining tabs are rendered from a soft-coded
 * config so visuals follow the template exactly.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Droplets, Sparkles, Download, History as HistoryIcon, Save } from 'lucide-react';
import DatasheetGeneratorTemplate from './_shared/DatasheetGeneratorTemplate';
import PumpHydraulicSheetRenderer from '../../components/ProcessDatasheet/PumpHydraulicSheetRenderer';
import PumpHydraulicHistoryPanel from '../../components/ProcessDatasheet/PumpHydraulicHistoryPanel';
import PUMP_HYDRAULIC_TABS from '../../config/pumpHydraulicTemplate.config';
import { applyExtractedDataToForm } from '../../config/pumpHydraulicAIMapper';
import exportPumpHydraulicWorkbook from '../../config/pumpHydraulicExporter';
import { saveSnapshot, SNAPSHOT_SOURCES } from '../../config/pumpHydraulicHistory';

// ─── Soft-coded page config ───────────────────────────────────────────────
const BACK_ROUTE   = '/engineering/process/datasheet';
const PAGE_TITLE   = 'Pump Hydraulic Calculation';
const PAGE_SUBTITLE = 'Standard 10-section workbook · AI-assisted extraction · Soft-coded template alignment';

// Soft-coded: the tab to auto-jump to once AI extraction completes.
const POST_EXTRACTION_TAB = 'pump_cal';

// Existing AI / upload contract — preserved verbatim from previous page.
// `onResults` is added (callback only — no backend change) to map extracted
// equipment data into the local form state.
const buildUploadConfig = ({ onResults }) => ({
  pageTitle:    'Upload & AI Extract',
  pageSubtitle: 'Upload P&ID → AI extracts pumps and process conditions → Auto-fills datasheet & generates Excel',
  headerIcon:   Droplets,
  accent:       'blue',
  backRoute:    BACK_ROUTE,
  mode: 'async_external',
  endpoints: {
    analyze:  '/pid/equipment/analyze/',
    status:   (id) => `/pid/equipment/status/${id}/`,
    results:  (id) => `/pid/equipment/results/${id}/`,
    download: (id) => `/pid/equipment/download-excel/${id}/`,
  },
  documents: [
    { key: 'file',       label: 'P&ID Drawing',                       required: true,  accent: 'blue',   hint: 'PDF — primary drawing for pump tag detection' },
    { key: 'hmb_file',   label: 'Heat & Material Balance (HMB) / PFD', required: false, accent: 'indigo', hint: 'Optional PDF — improves operating-condition + fluid-property accuracy' },
    { key: 'pump_curve', label: 'Pump Curves / Vendor Datasheets',     required: false, accent: 'purple', hint: 'Optional PDF — boosts head, NPSH and efficiency extraction' },
  ],
  submitLabel:    'Extract & Auto-Fill Datasheet',
  successTitle:   'Pump Hydraulic Datasheet Generated!',
  successBody:    'Datasheet auto-populated from extracted data. Review the sub-pages or download the .xlsx.',
  resultFilename: 'Pump_Hydraulic_Datasheet.xlsx',
  buildSuccessMessage: (results) =>
    `Extracted ${results?.total ?? 0} pump(s)`
    + (results?.drawing_ref ? ` from ${results.drawing_ref}` : '')
    + ' — datasheet fields auto-populated. Switch to any sub-page to review.',
  whatThisDoes: [
    'Detects every pump tag (P-XXX, P-XXXX, etc.) in the P&ID',
    'Reads suction / discharge pressures, temperatures and fluid data from HMB',
    'Calculates differential head, hydraulic & shaft power, and NPSH available',
    'Pulls vendor performance points from supplied pump curves',
    'Auto-populates all datasheet sub-pages (Cover, Pump Cal, Result Summary, Pressure Drop Cal …)',
    'Outputs a populated Pump Hydraulic Calculation Excel datasheet',
  ],
  onResults,
});

// ──────────────────────────────────────────────────────────────────────────
const PumpHydraulicTabbedPage = () => {
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState(PUMP_HYDRAULIC_TABS[0].id);
  const [extractionInfo, setExtractionInfo] = useState(null); // { applied, total, drawing_ref }
  const [historyOpen, setHistoryOpen] = useState(false);
  const [savedNotice, setSavedNotice] = useState(null); // { label, when }
  const activeTab = PUMP_HYDRAULIC_TABS.find((t) => t.id === activeId) || PUMP_HYDRAULIC_TABS[0];

  // Build the upload config once — `onResults` maps extracted equipment data
  // into the form's localStorage and surfaces a summary banner.
  const uploadConfig = useMemo(
    () => buildUploadConfig({
      onResults: (resultsData) => {
        const { applied } = applyExtractedDataToForm(resultsData);
        const summary = {
          applied,
          total: resultsData?.total ?? 0,
          drawing_ref: resultsData?.drawing_ref || '',
        };
        setExtractionInfo(summary);
        // Auto-switch to the Pump Cal tab so user sees populated data immediately.
        if (applied > 0) setActiveId(POST_EXTRACTION_TAB);
        // Auto-archive a history snapshot so the user can always return to
        // this AI-extracted state — defer one tick so localStorage has been
        // written by the renderer's debounced save.
        setTimeout(() => {
          saveSnapshot({
            label:   `AI Extraction — ${summary.drawing_ref || 'P&ID'}`.trim(),
            source:  SNAPSHOT_SOURCES.AI_EXTRACTION,
            context: { total: summary.total, drawing_ref: summary.drawing_ref, applied },
          });
        }, 800);
      },
    }),
    [],
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(BACK_ROUTE)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <div className="h-8 w-px bg-slate-200" />
              <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
                <Droplets className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">{PAGE_TITLE}</h1>
                <p className="text-xs text-slate-500">{PAGE_SUBTITLE}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const snap = saveSnapshot({ source: SNAPSHOT_SOURCES.MANUAL });
                  if (snap) setSavedNotice({ label: snap.label || snap.projectKey, when: Date.now() });
                }}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-sm transition-colors"
                title="Capture the current form state as a history snapshot"
              >
                <Save className="w-4 h-4" />
                Save to History
              </button>
              <button
                onClick={() => setHistoryOpen(true)}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg shadow-sm transition-colors"
                title="View past snapshots — load, re-download or delete old documents"
              >
                <HistoryIcon className="w-4 h-4" />
                History
              </button>
              <button
                onClick={() => exportPumpHydraulicWorkbook()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 rounded-lg shadow-sm transition-colors"
                title="Export the populated 10-sheet Pump Hydraulic Calculation workbook"
              >
                <Download className="w-4 h-4" />
                Download Datasheet (.xlsx)
              </button>
            </div>
          </div>
        </div>

        {/* ── Tab Bar (sub-pages) ──────────────────────────────────── */}
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 overflow-x-auto -mb-px">
            {PUMP_HYDRAULIC_TABS.map((tab) => {
              const Icon = tab.icon;
              const active = tab.id === activeId;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveId(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                    active
                      ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {Icon && <Icon className="w-4 h-4" />}
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Tab Content ────────────────────────────────────────────── */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {savedNotice && (
          <div className="mb-4 flex items-center gap-2 p-3 rounded-lg border border-slate-200 bg-white shadow-sm text-sm text-slate-700">
            <Save className="w-4 h-4 text-blue-600" />
            <span>Snapshot saved to history{savedNotice.label ? ` — ${savedNotice.label}` : ''}.</span>
            <button
              onClick={() => { setHistoryOpen(true); setSavedNotice(null); }}
              className="ml-2 text-blue-700 hover:underline text-xs font-semibold"
            >
              Open History
            </button>
            <button
              onClick={() => setSavedNotice(null)}
              className="ml-auto text-slate-400 hover:text-slate-700 text-xs"
            >
              Dismiss
            </button>
          </div>
        )}
        {extractionInfo && (
          <div className="mb-4 flex items-start gap-3 p-4 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-900">
            <Sparkles className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <div className="font-semibold">
                AI extraction complete — {extractionInfo.applied} field{extractionInfo.applied === 1 ? '' : 's'} auto-populated
              </div>
              <div className="text-emerald-800/80">
                {extractionInfo.total} pump(s) detected
                {extractionInfo.drawing_ref ? ` from drawing ${extractionInfo.drawing_ref}` : ''}.
                Switch between sub-pages to review and refine the values; computed cells (amber) update automatically.
              </div>
            </div>
            <button
              onClick={() => setExtractionInfo(null)}
              className="ml-auto text-emerald-700 hover:text-emerald-900 text-xs"
            >
              Dismiss
            </button>
          </div>
        )}
        {activeTab.isUploadTab ? (
          <DatasheetGeneratorTemplate config={uploadConfig} />
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="mb-4 pb-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                {activeTab.icon && <activeTab.icon className="w-5 h-5 text-blue-600" />}
                {activeTab.label}
              </h2>
            </div>
            <PumpHydraulicSheetRenderer tab={activeTab} />
          </div>
        )}
      </div>

      {/* ── History Panel (slide-over) ─────────────────────────────── */}
      <PumpHydraulicHistoryPanel
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onAfterLoad={() => setActiveId(POST_EXTRACTION_TAB)}
      />
    </div>
  );
};

export default PumpHydraulicTabbedPage;
