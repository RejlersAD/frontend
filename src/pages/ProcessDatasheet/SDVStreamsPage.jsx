/**
 * SDV Streams Datasheet Generator
 * ===============================
 * Route: /engineering/process/datasheet/sdv-streams
 *
 * Thin wrapper around `DatasheetGeneratorTemplate` (MOV-style UI).
 * Backend contract preserved (job_id pattern identical to MOV):
 *   POST /process-datasheet/datasheets/extract-sdv-streams/   → { job_id }
 *   GET  /process-datasheet/sdv-job-status/<job_id>/          → status / result
 */
import { Shield } from 'lucide-react';
import DatasheetGeneratorTemplate from './_shared/DatasheetGeneratorTemplate';

// ─── SOFT-CODED PAGE CONFIG ───────────────────────────────────────────────
const SDV_STREAMS_CONFIG = {
  pageTitle:    'SDV Streams Datasheet Generator',
  pageSubtitle: 'Upload P&ID + HMB → AI extracts SDV stream data → Download SDV Streams Datasheet (.xlsx)',
  headerIcon:   Shield,
  accent:       'red',
  backRoute:    '/engineering/process/datasheet',

  mode: 'async',
  endpoints: {
    analyze:   '/process-datasheet/datasheets/extract-sdv-streams/',
    jobStatus: (id) => `/process-datasheet/sdv-job-status/${id}/`,
  },

  documents: [
    {
      key:      'pid_file',
      label:    'P&ID Drawing',
      required: true,
      accent:   'red',
      hint:     'PDF — primary drawing for SDV/ESDV tag detection',
    },
    {
      key:      'hmb_file',
      label:    'Heat & Material Balance (HMB)',
      required: true,
      accent:   'orange',
      hint:     'PDF — provides operating / design conditions for each stream',
    },
    {
      key:      'other_doc',
      label:    'Cause & Effect / SAFE Chart',
      required: false,
      accent:   'purple',
      hint:     'Optional PDF — improves trip-source and shutdown-logic mapping',
    },
  ],

  extraFormFields: { equipment_type: 'sdv_streams' },

  submitLabel:  'Generate SDV Streams Datasheet',
  successTitle: 'SDV Streams Datasheet Generated!',
  resultFilename: 'SDV_Streams_Datasheet.xlsx',

  autoAnalysisCard: {
    title: 'Auto-Analysis Enabled',
    body:
      'Upload your P&ID, HMB and (optionally) Cause & Effect chart. Our AI detects '
      + 'every SDV / ESDV / XV tag, extracts service description, line data, '
      + 'process conditions and trip sources, then populates the SDV Streams datasheet.',
    note: 'Streams + process data auto-filled • Manual review recommended',
  },

  whatThisDoes: [
    'Detects every SDV / ESDV / XV tag in the P&ID',
    'Extracts upstream / downstream stream tags, line numbers and piping classes',
    'Reads operating & design pressures, temperatures and fluid data from HMB',
    'Maps trip sources from cause & effect / SAFE chart (if supplied)',
    'Outputs a populated SDV Streams Excel datasheet',
  ],

  sections: [
    { name: 'Section 1: Valve Identification',  status: 'auto',   note: 'Auto-populated from P&ID (Tag, Service, Type)' },
    { name: 'Section 2: Stream & Line Data',    status: 'auto',   note: 'Auto-populated from P&ID + HMB' },
    { name: 'Section 3: Process Conditions',    status: 'auto',   note: 'Operating + design P/T, fluid state, density' },
    { name: 'Section 4: Trip & Shutdown Logic', status: 'manual', note: 'Cross-checked vs. Cause & Effect chart' },
  ],

  aiCardBody:
    'Our AI fuses P&ID, HMB and Cause & Effect data to deliver a complete '
    + 'SDV streams datasheet ready for review.',
};
// ──────────────────────────────────────────────────────────────────────────

const SDVStreamsPage = () => <DatasheetGeneratorTemplate config={SDV_STREAMS_CONFIG} />;
export default SDVStreamsPage;
