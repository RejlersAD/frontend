/**
 * HMB Extractor
 * =============
 * Route: /engineering/process/hmb-extractor
 *
 * Thin wrapper around `DatasheetGeneratorTemplate` (same reusable UI used by
 * SDV Streams / Pressure Instrument). Standalone feature — upload a Heat &
 * Material Balance (HMB) PDF and get the extracted stream table as an
 * Excel workbook. No P&ID upload, no valve/equipment mapping required.
 *
 * Backend contract:
 *   POST /process-datasheet/datasheets/extract-hmb/   (sync, JSON)
 *
 * First adopter of the shared Project Organizer — a project must be
 * selected/created before the upload form is shown, and every successful
 * extraction is logged as cross-tool project activity (fire-and-forget).
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Waves } from 'lucide-react';
import { FolderIcon, FolderPlusIcon } from '@heroicons/react/24/outline';
import DatasheetGeneratorTemplate from '../../ProcessDatasheet/_shared/DatasheetGeneratorTemplate';
import { PROJECT_ORGANIZER_CONFIG } from '../../../config/projectOrganizer.config';
import projectOrganizerService from '../../../services/projectOrganizerService';
import { ProjectCard, ProjectFormModal, ProjectSwitcher, useActiveProject } from '../../../components/ProjectOrganizer';

const ACTIVE_PROJECT_STORAGE_KEY = 'hmbExtractorActiveProject';
const TOOL_CODE = 'hmb_extractor';
const T = PROJECT_ORGANIZER_CONFIG.defaultTheme;

// ─── SOFT-CODED PAGE CONFIG ───────────────────────────────────────────────
const buildConfig = ({ activeProject, onSyncSuccess }) => ({
  pageTitle:    'HMB Extractor',
  pageSubtitle: 'Upload a Heat & Material Balance (HMB) document → AI extracts stream data → Download as Excel',
  headerIcon:   Waves,
  accent:       'blue',
  backRoute:    '/engineering/process/datasheet',

  mode: 'sync',
  endpoints: {
    analyze: '/process-datasheet/datasheets/extract-hmb/',
  },

  documents: [
    {
      key:      'hmb_file',
      label:    'Heat & Material Balance (HMB)',
      required: true,
      accent:   'blue',
      hint:     'PDF — one or more HMB tables to extract stream data from',
    },
  ],

  submitLabel:    'Extract HMB Streams',
  successTitle:   'HMB Streams Extracted!',
  resultFilename: 'HMB_Streams.xlsx',

  autoAnalysisCard: {
    title: 'Auto-Analysis Enabled',
    body:
      'Upload your HMB document. Our AI reads every stream table and extracts '
      + 'fluid, phase, operating/design pressure and temperature data into a '
      + 'structured Excel workbook.',
    note: 'Streams auto-extracted • Manual review recommended',
  },

  whatThisDoes: [
    'Reads every stream table across all pages of the HMB document',
    'Extracts fluid, phase, state and line number per stream',
    'Captures operating & design pressures and temperatures with units',
    'Outputs a structured HMB Streams Excel workbook',
  ],

  sections: [
    { name: 'Section 1: Stream Identification', status: 'auto', note: 'Stream ID, line number, fluid, phase' },
    { name: 'Section 2: Process Conditions',    status: 'auto', note: 'Operating & design pressure/temperature' },
  ],

  aiCardBody:
    'Our AI extracts only visible values from the HMB document — no '
    + 'calculated or hallucinated data — for a reliable stream reference sheet.',

  onSyncSuccess,
});
// ──────────────────────────────────────────────────────────────────────────

const HMBExtractorPage = () => {
  const navigate = useNavigate();
  const { activeProject, setActiveProject, clearActiveProject, hydrated } = useActiveProject(ACTIVE_PROJECT_STORAGE_KEY);

  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const items = await projectOrganizerService.listProjects();
      setProjects(items);
    } catch (_) {
      setProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const handleCreate = async (payload) => {
    setBusy(true);
    try {
      const created = await projectOrganizerService.createProject(payload);
      setShowCreate(false);
      setActiveProject(created);
      await loadProjects();
    } catch (err) {
      alert(err?.response?.data?.error || 'Could not create project.');
    } finally {
      setBusy(false);
    }
  };

  // Fire-and-forget — never blocks or interrupts the extraction UX.
  const onSyncSuccess = useCallback((normalised) => {
    if (!activeProject) return;
    const count = normalised?.stream_count;
    const summary = typeof count === 'number'
      ? `Extracted ${count} stream(s) from HMB document`
      : 'Extracted HMB stream data';
    projectOrganizerService
      .logProjectActivity(activeProject.project_id, { toolCode: TOOL_CODE, summary })
      .catch(() => { /* non-fatal — activity logging is best-effort */ });
  }, [activeProject]);

  if (!hydrated || loadingProjects) {
    return <div style={{ minHeight: '100vh', background: T.pageBg }} />;
  }

  // ── Gate: require a project before showing the extractor ──
  if (!activeProject) {
    return (
      <div style={{ minHeight: '100vh', background: T.pageBg, padding: '24px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Waves style={{ color: T.accent }} width={26} height={26} />
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: T.text }}>HMB Extractor</h1>
        </div>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: T.muted }}>
          Select or create a project to organise your HMB extractions.
        </p>

        <button
          onClick={() => setShowCreate(true)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 18,
            background: `linear-gradient(135deg, ${T.accent}, ${T.accentAlt})`,
            color: '#fff', border: 'none', padding: '10px 18px',
            borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <FolderPlusIcon width={18} /> New Project
        </button>

        {projects.length === 0 ? (
          <div style={{
            background: T.cardBg, padding: 50, textAlign: 'center',
            borderRadius: 12, border: `1px dashed ${T.accentBorder}`,
          }}>
            <FolderIcon width={48} style={{ color: T.accent, opacity: 0.5, margin: '0 auto 12px' }} />
            <h2 style={{ margin: 0, fontSize: 18, color: T.text }}>No projects yet</h2>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: T.muted }}>Create one to get started.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
            {projects.map((p) => (
              <ProjectCard key={p.project_id} project={p} theme={T} onOpen={() => setActiveProject(p)} />
            ))}
          </div>
        )}

        {showCreate && (
          <ProjectFormModal
            theme={T}
            busy={busy}
            onClose={() => setShowCreate(false)}
            onSubmit={handleCreate}
          />
        )}
      </div>
    );
  }

  // ── Active project selected: show the extractor with a switcher header ──
  return (
    <div>
      <div style={{
        display: 'flex', justifyContent: 'flex-end', padding: '16px 24px 0',
        background: 'transparent',
      }}>
        <ProjectSwitcher
          projects={projects}
          activeProject={activeProject}
          loading={loadingProjects}
          theme={T}
          onSwitch={setActiveProject}
          onCreate={() => setShowCreate(true)}
          onClear={clearActiveProject}
          onManage={() => navigate(PROJECT_ORGANIZER_CONFIG.routes.manage)}
        />
      </div>
      <DatasheetGeneratorTemplate config={buildConfig({ activeProject, onSyncSuccess })} />
      {showCreate && (
        <ProjectFormModal
          theme={T}
          busy={busy}
          onClose={() => setShowCreate(false)}
          onSubmit={handleCreate}
        />
      )}
    </div>
  );
};

export default HMBExtractorPage;

