/**
 * Pressure Instrument Datasheet Generator
 * =======================================
 * Route: /engineering/process/datasheet/pressure-instrument
 *
 * Thin wrapper around `DatasheetGeneratorTemplate` (MOV-style UI).
 * Backend contract preserved:
 *   POST /pid/pressure-instruments/analyze/    (sync, JSON)
 *   POST /pid/pressure-instruments/download-excel/  (sync, blob)
 */
import { Activity } from 'lucide-react';
import apiClient from '../../services/api.service';
import DatasheetGeneratorTemplate from './_shared/DatasheetGeneratorTemplate';

// ─── SOFT-CODED PAGE CONFIG ───────────────────────────────────────────────
const PRESSURE_INSTRUMENT_CONFIG = {
  pageTitle:    'Pressure Instrument Datasheet Generator',
  pageSubtitle: 'Upload P&ID → AI detects pressure instruments → Download "Pressure Instrument Data Sheet.xlsx"',
  headerIcon:   Activity,
  accent:       'purple',
  backRoute:    '/engineering/process/datasheet',

  mode: 'sync',
  endpoints: {
    analyze: '/pid/pressure-instruments/analyze/',
  },

  documents: [
    {
      key:      'file',
      label:    'P&ID Drawing',
      required: true,
      accent:   'purple',
      hint:     'PDF — primary drawing for pressure-instrument tag detection',
    },
    {
      key:      'line_list_file',
      label:    'Line List / HMB',
      required: false,
      accent:   'indigo',
      hint:     'Optional PDF — improves operating-pressure / temperature accuracy',
    },
    {
      key:      'instrument_index_file',
      label:    'Instrument Index',
      required: false,
      accent:   'blue',
      hint:     'Optional PDF — cross-checks tag list and adds missing entries',
    },
  ],

  // Backend honours these context fields if provided.
  extraFormFields: {
    drawing_number: 'AUTO',
    drawing_title:  'Pressure Instrument Analysis',
    revision:       'Rev 0',
    project_name:   'Project',
    auto_analyze:   'true',
    download_excel: 'false',     // we want JSON first, Excel via download button
  },

  submitLabel:    'Generate Pressure Instrument Datasheet',
  successTitle:   'Pressure Instrument Datasheet Generated!',
  resultFilename: 'Pressure_Instrument_Data_Sheet.xlsx',

  autoAnalysisCard: {
    title: 'Auto-Analysis Enabled',
    body:
      'Upload your P&ID and (optionally) Line List or Instrument Index. Our AI '
      + 'detects every PT / PI / PS / PG / PSV / PDT tag, extracts service, line and '
      + 'process data, validates against ISA-5.1 patterns, then populates the standard '
      + 'Pressure Instrument datasheet.',
    note: 'Tags + operating conditions auto-filled • Manual review recommended',
  },

  whatThisDoes: [
    'Detects every pressure instrument tag (PT, PI, PS, PG, PSV, PDT, PDI, …)',
    'Extracts service description, line number, piping class, equipment number',
    'Reads operating / design pressure & temperature, fluid state and density',
    'Validates ISA-5.1 tag patterns (anti-hallucination soft-coded filter)',
    'Generates a populated Pressure Instrument Excel datasheet on download',
  ],

  sections: [
    { name: 'Section 1: Tag Identification',     status: 'auto',   note: 'Auto-populated from P&ID (Tag, Type, Loop)' },
    { name: 'Section 2: Service & Line Data',    status: 'auto',   note: 'Auto-populated from P&ID + Line List' },
    { name: 'Section 3: Process Conditions',     status: 'auto',   note: 'Operating + design P/T, fluid properties' },
    { name: 'Section 4: Specification & Vendor', status: 'manual', note: 'Manual selection / vendor sizing by engineer' },
  ],

  aiCardBody:
    'Our AI cross-references P&ID, Line List and Instrument Index, then runs an '
    + 'ISA-5.1 validator to drop hallucinated tags before generating the datasheet.',

  // ── sync adapter: pull instruments JSON, defer Excel build to download click ──
  syncResponseAdapter: (data) => {
    if (!data || data.error) {
      return { success: false, error: data?.error || data?.warning || 'Analysis failed' };
    }

    const instruments  = data.instruments || [];
    const drawing_info = data.drawing_info || {};
    const detected     = data.instruments_detected ?? instruments.length;
    const validation   = data.validation;

    const validationLine = validation
      ? ` · Validator: ${validation.kept} kept / ${validation.dropped} dropped`
      : '';

    return {
      success: true,
      message: `Successfully extracted ${detected} pressure instrument(s)${validationLine}.`,
      // No base64 — we'll build the Excel only when user clicks Download
      customDownload: async () => {
        const r = await apiClient.post(
          '/pid/pressure-instruments/download-excel/',
          { instruments, drawing_info },
          { responseType: 'blob', timeout: 60000 },
        );
        return r.data;
      },
      excel_filename: 'Pressure_Instrument_Data_Sheet.xlsx',
    };
  },
};
// ──────────────────────────────────────────────────────────────────────────

const PressureInstrumentPage = () => (
  <DatasheetGeneratorTemplate config={PRESSURE_INSTRUMENT_CONFIG} />
);
export default PressureInstrumentPage;
