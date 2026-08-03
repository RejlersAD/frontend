import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  SparklesIcon,
  DocumentTextIcon,
  TableCellsIcon,
  CpuChipIcon,
  ArrowPathIcon,
  CloudArrowUpIcon,
  MagnifyingGlassIcon,
  QueueListIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';

/**
 * Digitization Datasheet Page — Digitization discipline
 *
 * Soft-coded hub for digital transformation datasheet tools.
 * To add / remove / enable a card: edit the `datasheetTools` array below.
 * No other file changes required.
 */

// ─── Soft-coded tool configuration ───────────────────────────────────────────
const HIDDEN_DATASHEET_TOOL_IDS = new Set([
  'datasheet_analytics',
]);

const datasheetTools = [
  {
    id: 'legacy_pdf_digitizer',
    name: 'Legacy PDF Digitizer',
    description:
      'Upload scanned or native PDF datasheets and extract all tabular data into structured, editable spreadsheets using AI OCR.',
    icon: CloudArrowUpIcon,
    gradient: 'from-pink-500 to-fuchsia-600',
    path: '/engineering/digitization/datasheet/pdf-digitizer',
    badge: 'AI',
    disabled: true,
    features: [
      'Scanned PDF OCR extraction',
      'Table structure recognition',
      'Multi-page batch processing',
      'Confidence scoring per field',
      'Export to Excel / JSON / CSV',
    ],
  },
  {
    id: 'datasheet_index',
    name: 'Datasheet Index',
    description:
      'Auto-generate a searchable master index of all project datasheets — equipment tags, revisions, status, and responsible engineer.',
    icon: QueueListIcon,
    gradient: 'from-fuchsia-500 to-purple-600',
    path: '/engineering/digitization/datasheet/index',
    badge: 'AI',
    disabled: true,
    features: [
      'Auto tag & revision detection',
      'Filter by discipline / status',
      'Missing datasheet gap report',
      'Bulk upload & auto-classify',
      'Export register to Excel',
    ],
  },
  {
    id: 'cross_reference_checker',
    name: 'Cross-Reference Checker',
    description:
      'Automatically compare datasheet values against P&IDs, equipment list, and line list to flag inconsistencies before issue.',
    icon: MagnifyingGlassIcon,
    gradient: 'from-purple-500 to-fuchsia-600',
    path: '/engineering/digitization/datasheet/cross-reference',
    badge: 'AI',
    disabled: true,
    features: [
      'Datasheet vs P&ID tag check',
      'Operating condition mismatch',
      'Nozzle schedule reconciliation',
      'Confidence-scored findings',
      'PDF mark-up export',
    ],
  },
  {
    id: 'template_library',
    name: 'Template Library',
    description:
      'Central library of discipline-specific datasheet templates. Clone, configure, and deploy templates across projects instantly.',
    icon: DocumentTextIcon,
    gradient: 'from-rose-500 to-pink-600',
    path: '/engineering/digitization/datasheet/templates',
    badge: 'Coming Soon',
    disabled: true,
    features: [
      'Discipline-based template catalogue',
      'Custom field configuration',
      'Logo / header branding',
      'Version control per template',
      'Clone to new project',
    ],
  },
  {
    id: 'datasheet_analytics',
    name: 'Datasheet Analytics',
    description:
      'Track datasheet completion rates, revision velocity, and outstanding actions across all disciplines on a single dashboard.',
    icon: ChartBarIcon,
    gradient: 'from-fuchsia-600 to-rose-600',
    path: '/engineering/digitization/datasheet/analytics',
    badge: 'Coming Soon',
    disabled: true,
    features: [
      'Completion % per discipline',
      'Revision frequency heatmap',
      'Outstanding action tracker',
      'Milestone progress chart',
      'Exportable PDF summary',
    ],
  },
  {
    id: 'instrument_digitization',
    name: 'Instrument Digitization',
    description:
      'Digitize instrument datasheets from vendor PDFs and map values to your project Instrument Index automatically.',
    icon: CpuChipIcon,
    gradient: 'from-pink-600 to-purple-600',
    path: '/engineering/digitization/datasheet/instrument',
    badge: 'AI',
    disabled: true,
    features: [
      'Vendor datasheet parsing',
      'Auto-map to Instrument Index',
      'Multi-make / multi-model support',
      'Highlight unmatched parameters',
      'Bulk import queue',
    ],
  },
  {
    id: 'revision_tracker',
    name: 'Revision Tracker',
    description:
      'Compare two revisions of any datasheet side-by-side, auto-generate change notes, and maintain a full revision history.',
    icon: ArrowPathIcon,
    gradient: 'from-purple-600 to-pink-500',
    path: '/engineering/digitization/datasheet/revision-tracker',
    badge: 'Coming Soon',
    disabled: true,
    features: [
      'Side-by-side revision diff',
      'Auto-generated change summary',
      'Approval workflow integration',
      'ISO 19650 metadata tagging',
      'Full audit trail per sheet',
    ],
  },
  {
    id: 'structured_data_export',
    name: 'Structured Data Export',
    description:
      'Export all project datasheet data into a single structured database (Excel, JSON, or SQL) for downstream tools and reporting.',
    icon: TableCellsIcon,
    gradient: 'from-fuchsia-500 to-pink-700',
    path: '/engineering/digitization/datasheet/export',
    badge: 'Coming Soon',
    disabled: true,
    features: [
      'Multi-discipline data merge',
      'Configurable column mapping',
      'Excel / JSON / CSV / SQL export',
      'Scheduled auto-export',
      'API endpoint for integration',
    ],
  },
];
// ─────────────────────────────────────────────────────────────────────────────

const DigitizationDatasheetPage = () => {
  const navigate = useNavigate();
  const visibleDatasheetTools = datasheetTools.filter(
    (tool) => !HIDDEN_DATASHEET_TOOL_IDS.has(tool.id)
  );

  const handleNavigate = (tool) => {
    if (!tool.disabled) {
      navigate(tool.path);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">

      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Digitization Datasheets
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              AI-powered tools for digitising, managing, and cross-checking engineering datasheets
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 rounded-full text-sm font-medium">
              Digitization
            </span>
            <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm font-medium flex items-center gap-1">
              <SparklesIcon className="w-3.5 h-3.5" />
              AI Powered
            </span>
          </div>
        </div>

        {/* Coming Soon Banner */}
        <div className="bg-fuchsia-50 dark:bg-fuchsia-900/20 border border-fuchsia-200 dark:border-fuchsia-800 rounded-xl p-4 flex items-start gap-3">
          <SparklesIcon className="w-6 h-6 text-fuchsia-600 dark:text-fuchsia-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-fuchsia-800 dark:text-fuchsia-300 font-semibold text-sm">
              Digitization Datasheet Suite — Under Development
            </p>
            <p className="text-fuchsia-700 dark:text-fuchsia-400 text-sm mt-1">
              These AI-powered tools are currently in development. They will allow your team to digitise
              legacy datasheets, auto-index project documentation, cross-reference engineering data, and
              export structured datasets — eliminating manual entry and reducing transcription errors.
            </p>
          </div>
        </div>
      </div>

      {/* ── Tool Cards Grid ───────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleDatasheetTools.map((tool) => {
            const IconComponent = tool.icon;
            const isDisabled = tool.disabled ?? true;
            const isAI = tool.badge === 'AI';

            return (
              <div
                key={tool.id}
                className={`
                  relative bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden
                  transition-all duration-300
                  ${isDisabled
                    ? 'opacity-60 cursor-not-allowed'
                    : 'hover:shadow-2xl hover:-translate-y-1 cursor-pointer'}
                `}
                onClick={() => handleNavigate(tool)}
              >
                {/* Gradient top bar */}
                <div className={`h-2 bg-gradient-to-r ${tool.gradient}`} />

                {/* Card body */}
                <div className="p-6">
                  {/* Icon + Title */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-lg bg-gradient-to-r ${tool.gradient} ${isDisabled ? 'opacity-50' : ''}`}>
                        <IconComponent className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                          {tool.name}
                        </h3>
                        {tool.badge && (
                          <span className={`
                            inline-block px-2 py-1 text-xs font-medium rounded-full mt-1
                            ${isAI
                              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}
                          `}>
                            {isAI && <span className="mr-1">✦</span>}{tool.badge}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
                    {tool.description}
                  </p>

                  {/* Features */}
                  <div className="mb-4">
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Key Capabilities:
                    </p>
                    <ul className="space-y-1">
                      {tool.features.slice(0, 3).map((feature, idx) => (
                        <li
                          key={idx}
                          className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400 dark:bg-fuchsia-500" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Footer */}
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-500">
                      {tool.features.length} capabilities planned
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                      In Development
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DigitizationDatasheetPage;
