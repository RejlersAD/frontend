/**
 * Solutions Configuration — Dynamic, Soft-coded
 *
 * ARCHITECTURE
 * ────────────────────────────────────────────────────────────────────────────
 *  • Engineering solutions are AUTO-DERIVED from engineeringStructure.config.js.
 *    Add a sub-feature entry there → it appears on /solutions automatically.
 *    No other file needs to be touched.
 *
 *  • Non-engineering solutions (Documents, Finance, QHSE …) are maintained in
 *    the MANUAL_SOLUTIONS array at the bottom of this file.
 *
 *  • SOLUTIONS = buildEngineeringSolutions() + MANUAL_SOLUTIONS
 *
 *  • SOLUTION_STATS counters are computed live from SOLUTIONS — never stale.
 *
 * HOW TO ADD A NEW FEATURE
 * ────────────────────────────────────────────────────────────────────────────
 *  Engineering feature → add a subFeatures entry in engineeringStructure.config.js
 *  Platform feature    → add an entry to MANUAL_SOLUTIONS below
 */

// ─── Engineering feature registry (single source of truth) ───────────────────
import { ENGINEERING_DISCIPLINES } from './engineeringStructure.config'

// ─── Icons for non-engineering categories ────────────────────────────────────
import {
  ClipboardDocumentCheckIcon,
  CurrencyDollarIcon,
  ShieldCheckIcon,
  ArrowPathIcon,
  BriefcaseIcon,
} from '@heroicons/react/24/outline'

// ─── Soft-coded constants ─────────────────────────────────────────────────────
/**
 * sessionStorage key used to persist the intended destination when an
 * unauthenticated user clicks "Get Started" on a solution card.
 * After login the user is automatically sent to this route.
 */
export const REDIRECT_AFTER_LOGIN_KEY = 'radai_redirect_after_login'

// ─── Category definitions ─────────────────────────────────────────────────────
// Engineering categories auto-built from ENGINEERING_DISCIPLINES.
const _engineeringCategories = Object.fromEntries(
  Object.values(ENGINEERING_DISCIPLINES)
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
    .map(d => [
      d.id,
      {
        id:          d.id,
        title:       d.fullName || d.name,
        description: d.description,
        icon:        d.icon,
        group:       'engineering',
        order:       d.order ?? 99,
      },
    ])
)

const _platformCategories = {
  documents: {
    id:          'documents',
    title:       'Document Management',
    description: 'CRS workflows, PFD conversion, and document version control',
    icon:        ClipboardDocumentCheckIcon,
    group:       'platform',
    order:       20,
  },
  finance: {
    id:          'finance',
    title:       'Finance & Procurement',
    description: 'Invoice automation, procurement, and financial insights',
    icon:        CurrencyDollarIcon,
    group:       'platform',
    order:       21,
  },
  qhse: {
    id:          'qhse',
    title:       'QHSE',
    description: 'Quality, Health, Safety & Environmental management',
    icon:        ShieldCheckIcon,
    group:       'platform',
    order:       22,
  },
}

export const SOLUTION_CATEGORIES = { ..._engineeringCategories, ..._platformCategories }

// ─── Auto-derive engineering solutions ───────────────────────────────────────
function _isAI(feature) {
  const d = (feature.description || '').toLowerCase()
  return (
    feature.badge === 'AI' ||
    d.includes('ai-powered') ||
    d.includes(' ai ') ||
    d.startsWith('ai ')
  )
}

function buildEngineeringSolutions() {
  const solutions = []
  Object.values(ENGINEERING_DISCIPLINES)
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
    .forEach(discipline => {
      ;(discipline.subFeatures || []).forEach(feature => {
        const isAI = _isAI(feature)
        solutions.push({
          id:               feature.id,
          category:         discipline.id,
          title:            feature.fullName || feature.name,
          shortDescription: feature.description || '',
          fullDescription:  feature.description || '',
          icon:             feature.icon || discipline.icon,
          features:         feature.capabilities || [],
          benefits:         [],
          tags:             [discipline.name, ...(feature.badge ? [feature.badge] : [])].filter(Boolean),
          moduleCode:       feature.moduleCode || null,
          link:             feature.path,
          badge:            feature.badge || null,
          isAI,
          isPremium:        !!feature.moduleCode,
          discipline:       discipline.id,
          disciplineLabel:  discipline.name,
        })
      })
    })
  return solutions
}

// ─── Manually maintained platform solutions ───────────────────────────────────
const MANUAL_SOLUTIONS = [
  {
    id:               'pfd-to-pid',
    category:         'documents',
    title:            'PFD to P&ID Conversion',
    shortDescription: 'AI-powered conversion of Process Flow Diagrams to P&ID format with five-stage analysis',
    fullDescription:  'Upload a PFD and let RADAI AI extract streams, equipment, and instrumentation through a five-stage analysis pipeline, producing a standards-compliant P&ID.',
    icon:             ArrowPathIcon,
    features: [
      'Automated stream & equipment extraction',
      'Five-stage AI analysis pipeline',
      'Standards-compliant P&ID output',
      'Full audit trail & history',
    ],
    benefits: ['Eliminate manual conversion', 'Consistent output format', 'Full version history'],
    tags:            ['AI', 'PFD', 'P&ID', 'Conversion'],
    moduleCode:      'pfd_to_pid',
    link:            '/pfd/upload',
    badge:           'AI',
    isAI:            true,
    isPremium:       true,
    discipline:      null,
    disciplineLabel: null,
  },
  {
    id:               'crs-documents',
    category:         'documents',
    title:            'CRS Document Control',
    shortDescription: 'Comment Response Sheet management with multi-revision control and approval workflows',
    fullDescription:  'Full CRS lifecycle: create, track, approve and close comment chains across multiple revisions with complete audit trail and chain-level review.',
    icon:             ClipboardDocumentCheckIcon,
    features: [
      'Multi-revision tracking',
      'Comment chain management',
      'Approval workflow automation',
      'Full revision history & audit trail',
    ],
    benefits: ['Reduce review cycle time by 50%', 'Complete accountability record', 'Better team collaboration'],
    tags:            ['Document Control', 'Workflow', 'CRS'],
    moduleCode:      'crs_documents',
    link:            '/crs/documents',
    badge:           null,
    isAI:            false,
    isPremium:       true,
    discipline:      null,
    disciplineLabel: null,
  },
  {
    id:               'invoice-automation',
    category:         'finance',
    title:            'Invoice Automation',
    shortDescription: 'AI-powered invoice upload, data extraction, and multi-stage approval workflow management',
    fullDescription:  'Upload invoices and let RADAI extract key data automatically. Route approvals, track payment status, and generate financial insights.',
    icon:             CurrencyDollarIcon,
    features: [
      'AI data extraction from invoices',
      'Multi-stage approval workflows',
      'Invoice status & payment tracking',
      'Financial reporting & insights',
    ],
    benefits: ['Eliminate manual data entry', 'Faster approvals', 'Better financial visibility'],
    tags:            ['Finance', 'AI', 'Automation'],
    moduleCode:      'finance',
    link:            '/finance',
    badge:           'AI',
    isAI:            true,
    isPremium:       true,
    discipline:      null,
    disciplineLabel: null,
  },
  {
    id:               'procurement-management',
    category:         'finance',
    title:            'Procurement Management',
    shortDescription: 'End-to-end procurement: vendor management, requisitions, purchase orders, and receipts',
    fullDescription:  'AI-assisted procurement platform covering vendor onboarding, purchase requisitions, order management, and receipt tracking with full audit trail.',
    icon:             BriefcaseIcon,
    features: [
      'AI-assisted vendor onboarding',
      'Purchase requisition management',
      'Purchase order lifecycle',
      'Receipt tracking & reconciliation',
    ],
    benefits: ['Streamline end-to-end procurement', 'Better vendor relationships', 'Full audit trail'],
    tags:            ['Procurement', 'AI', 'Workflow'],
    moduleCode:      'procurement',
    link:            '/procurement',
    badge:           'AI',
    isAI:            true,
    isPremium:       true,
    discipline:      null,
    disciplineLabel: null,
  },
  {
    id:               'qhse-management',
    category:         'qhse',
    title:            'QHSE Management',
    shortDescription: 'Quality, Health, Safety & Environmental project management and compliance reporting',
    fullDescription:  'Integrated QHSE platform covering quality management, H&S tracking, environmental compliance, and energy management for engineering projects.',
    icon:             ShieldCheckIcon,
    features: [
      'Quality management & QA/QC checklists',
      'Health & Safety incident tracking',
      'Environmental compliance monitoring',
      'Energy management & reporting',
    ],
    benefits: ['Centralised QHSE data', 'Automated compliance reporting', 'Reduced regulatory risk'],
    tags:            ['QHSE', 'Compliance', 'Safety', 'Quality'],
    moduleCode:      'qhse',
    link:            '/qhse/general',
    badge:           null,
    isAI:            false,
    isPremium:       true,
    discipline:      null,
    disciplineLabel: null,
  },
]

// ─── Combined solutions export ────────────────────────────────────────────────
export const SOLUTIONS = [...buildEngineeringSolutions(), ...MANUAL_SOLUTIONS]

// ─── Platform statistics (computed live — never manually updated) ─────────────
export const SOLUTION_STATS = [
  {
    id:          'features',
    label:       'Live Features',
    value:       `${SOLUTIONS.length}+`,
    description: 'Production-ready engineering tools',
    icon:        '⚙️',
  },
  {
    id:          'disciplines',
    label:       'Disciplines',
    value:       `${Object.keys(_engineeringCategories).length}+`,
    description: 'Engineering disciplines covered',
    icon:        '🏗️',
  },
  {
    id:          'ai-powered',
    label:       'AI-Powered',
    value:       `${SOLUTIONS.filter(s => s.isAI).length}+`,
    description: 'Tools with AI/ML capabilities',
    icon:        '🤖',
  },
  {
    id:          'accuracy',
    label:       'Accuracy',
    value:       '98%+',
    description: 'AI extraction accuracy on real P&IDs',
    icon:        '🎯',
  },
]

// ─── CTA configuration ────────────────────────────────────────────────────────
export const SOLUTIONS_CTA = {
  primary: {
    text:        'Get Started',
    link:        '/login',
    description: 'Sign in or request access to start using RADAI',
  },
  secondary: {
    text:        'Schedule Demo',
    link:        '/enquiry',
    description: 'See how RADAI can transform your engineering workflow',
  },
  contact: {
    text:        'Contact Us',
    link:        '/contact-support',
    description: 'Speak with our team',
  },
}

// ─── Helper functions ─────────────────────────────────────────────────────────

export const getSolutionsByCategory = (categoryId) =>
  SOLUTIONS.filter(s => s.category === categoryId)

export const getSolutionById = (id) =>
  SOLUTIONS.find(s => s.id === id)

/** Categories that have at least one solution, sorted by order */
export const getCategoriesWithSolutions = () =>
  Object.values(SOLUTION_CATEGORIES)
    .filter(cat => SOLUTIONS.some(s => s.category === cat.id))
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))

/** Full-text search across title, description, tags, discipline */
export const searchSolutions = (query) => {
  const q = query.toLowerCase()
  return SOLUTIONS.filter(
    s =>
      s.title.toLowerCase().includes(q) ||
      s.shortDescription.toLowerCase().includes(q) ||
      (s.tags || []).some(t => t.toLowerCase().includes(q)) ||
      (s.disciplineLabel || '').toLowerCase().includes(q)
  )
}
