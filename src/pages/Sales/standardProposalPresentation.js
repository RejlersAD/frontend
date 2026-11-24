// Presentation rules for the standard technical proposal (DEC-TP-001).
// Turns engine output into proposal-management language: no finding codes, file paths,
// hashes, source keys or analysis structures reach the proposal user.

const FACT_LABELS = {
  client: 'Client',
  tender_title: 'Tender',
  rft_number: 'Tender (RFT) number',
  rft_title: 'Tender title',
  quote_ref: 'Our reference',
  revision: 'Revision',
  submission_date: 'Submission date',
  validity_days: 'Offer validity',
  signatory: 'Signatory',
}

const FACT_ORDER = ['client', 'tender_title', 'rft_number', 'rft_title', 'quote_ref', 'revision', 'submission_date', 'validity_days', 'signatory']

const FOLDER_LABELS = {
  proposal: 'Proposal',
  internal: 'Internal',
  tender: 'Tender',
  correspondence: 'Correspondence',
  submitted: 'Submitted',
  award: 'Award',
}

export const fileName = value => String(value || '').replace(/\\/g, '/').split('/').filter(Boolean).pop() || ''

// Replace slash-separated paths in free text by their last segment. A path starts with a
// space-free segment followed by "/"; later folder names may contain spaces.
export const plainText = value => String(value || '')
  .replace(/(^|[\s(])[^\s/()]+\/(?:[^/\n()]*\/)*/g, '$1')
  .replace(/`([^`]+)`/g, '$1')

const factLabel = key => FACT_LABELS[key] || String(key || '').replace(/_/g, ' ')

const FINDINGS = {
  META_MISSING: message => {
    const field = (/`([^`]+)`/.exec(message) || [])[1]
    return { title: `${factLabel(field)} not found`, detail: 'Add it to the cover page, covering letter or qualification statement.' }
  },
  SECTION_NO_SOURCE: message => ({
    title: `${(/section (.+?) has no source/i.exec(message) || [])[1] || message.split(':')[0] || 'A required section'} has no tender source`,
    detail: 'Select the tender documents that cover it and generate again.',
  }),
  SECTION_NOT_DRAFTED: message => ({
    title: `${message.split(':')[0]} could not be written`,
    detail: `${message.split(':').slice(1).join(':').trim()}. Rewrite the section or generate again.`.replace(/^\. /, ''),
  }),
  UNSUPPORTED_STATEMENT_REMOVED: message => ({
    title: message, detail: 'Statements without a tender source are never included in the proposal.',
  }),
  OPEN_POINT: message => ({
    title: message.split(': ').slice(1).join(': ') || message,
    detail: `Raised while writing ${message.split(': ')[0]}.`,
  }),
  EVIDENCE_REQUIRED: message => ({
    title: `${message.split(':')[0]} needs company evidence`,
    detail: `${(/\(([^)]+)\)/.exec(message) || [])[1] || 'Company documents'} – supplied by the Rejlers Evidence Library.`,
  }),
  REQUIREMENT_NOT_ADDRESSED: message => ({
    title: message.split(';')[0], detail: 'Check them in the compliance matrix at the end of the proposal.',
  }),
  REVIEW_NOT_ATTACHED: () => ({
    title: 'The PDF was not attached to the review canvas', detail: 'Attach it from Review & comments.',
  }),
  COMPONENT_NO_SOURCE: message => ({
    title: `Document missing in ${(/^(.+?):/.exec(message) || [])[1] || 'a section'}`,
    detail: 'The section is generated without it.',
  }),
  LEGACY_REFERENCE: message => {
    const ref = (/(Q-\d{6})/.exec(message) || [])[1] || 'another bid'
    const file = fileName((/ in (.+?) \(/.exec(message) || [])[1])
    return { title: `${file || 'A document'} refers to ${ref}`, detail: /hidden/i.test(message)
      ? 'The reference is hidden in the document. Remove it before submission.'
      : 'Update the document so it refers to this bid only.' }
  },
  FOREIGN_BID_ARTIFACT: message => {
    const ref = (/belongs to (Q-\d{6})/.exec(message) || [])[1] || 'another bid'
    const file = fileName((/^(.+?) belongs to/.exec(message) || [])[1])
    return { title: `${file} belongs to ${ref}`, detail: /ASSEMBLED/.test(message)
      ? 'It is included in this proposal. Replace it with this bid’s version.'
      : 'It is not included in this proposal.' }
  },
  UNSUPPORTED_FORMAT: message => ({
    title: `${fileName((/rendered: (.+?)(?: \(|$)/.exec(message) || [])[1]) || 'A file'} cannot be included`,
    detail: /renderable twin/.test(message) ? 'A PDF copy of the same document is used instead.' : 'Provide it as PDF or Word.',
  }),
  DUPLICATE_FILE: message => ({
    title: `${fileName((/^(.+?) duplicates/.exec(message) || [])[1])} is a duplicate`,
    detail: 'Only one copy is used.',
  }),
  VARIANT_FILE: message => ({
    title: `${fileName((/^(.+?) looks like/.exec(message) || [])[1])} looks like a draft or markup copy`,
    detail: 'It is not included.',
  }),
  EXPECTED_INPUT_EMPTY: message => ({
    title: `${(/^(.+?) folder is empty/.exec(message) || [])[1] || 'An expected input'} is empty`,
    detail: 'Check whether it is needed for this bid.',
  }),
  UNCLASSIFIED: message => ({
    title: `${fileName((/^(.+?) matched no/.exec(message) || [])[1])} is not assigned to a section`,
    detail: 'It is not included. Rename or move it into the right proposal folder.',
  }),
  FACT_CONFLICT: message => ({
    title: `Another reference also appears (${(/(Q-\d{6})/.exec(message) || [])[1] || 'unknown'})`,
    detail: 'The most frequent reference is used. Check the documents.',
  }),
  RENDER_FAILED: message => ({ title: `${fileName(message.split(':')[0])} could not be converted`, detail: 'Open and re-save the document, then generate again.' }),
  MERGE_FAILED: message => ({ title: `${fileName(message.split(':')[0])} could not be added to the Word master`, detail: 'It is included in the PDF only.' }),
  FRONTMATTER_LAYOUT: () => ({ title: 'Table of contents or divider pages need checking', detail: 'Review the first pages of the preview.' }),
  EMBEDDED_OBJECT_DROPPED: message => ({ title: `${fileName(message.split(':')[0])} contains an object that is not editable in Word`, detail: 'It is still shown in the PDF.' }),
  MASTER_RENDER_FAILED: () => ({ title: 'Word master preview unavailable', detail: 'The Word file was still created.' }),
}

// ERROR → must fix before submission, WARN → check. INFO is internal and never shown.
export function presentFinding(finding) {
  if (!finding || finding.severity === 'INFO') return null
  const build = FINDINGS[finding.code]
  const text = build ? build(String(finding.message || '')) : { title: plainText(finding.message), detail: '' }
  return { tone: finding.severity === 'ERROR' ? 'blocker' : 'check', title: plainText(text.title), detail: text.detail }
}

export function presentFindings(findings) {
  const shown = (findings || []).map(presentFinding).filter(Boolean)
  const seen = new Set()
  const unique = shown.filter(item => {
    const key = `${item.tone}|${item.title}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return { blockers: unique.filter(item => item.tone === 'blocker'), checks: unique.filter(item => item.tone === 'check') }
}

export function presentFacts(facts) {
  return FACT_ORDER.filter(key => facts?.[key]?.value).map(key => ({
    key,
    label: FACT_LABELS[key],
    value: key === 'validity_days' ? `${facts[key].value} days` : key === 'revision' ? `Rev ${facts[key].value}` : String(facts[key].value),
    source: ['build parameter', 'Opportunity record'].includes(facts[key].source) ? 'Opportunity record' : fileName(facts[key].source),
  }))
}

export const folderLabel = key => FOLDER_LABELS[key] || 'Other'

// What a section will be written from, as shown by "Check documents".
const KIND_LABELS = {
  authored: 'Written from the tender', evidence: 'Company evidence needed', not_applicable: 'Standard statement',
  cover: 'From the template', letter: 'From the template', compliance: 'Generated from tender requirements',
}
export const kindLabel = kind => KIND_LABELS[kind] || 'Generated'

export function sectionCoverage(entry) {
  const documents = (entry?.documents || []).map(name => ({ name: fileName(name), pages: null }))
  const state = entry?.kind === 'authored' ? (documents.length ? 'complete' : 'missing')
    : entry?.kind === 'evidence' ? 'evidence' : 'standard'
  return { documents, state, label: kindLabel(entry?.kind) }
}

// Sections of a saved proposal version, in review language.
export function reviewSections(content) {
  const registry = content?.evidence_registry || {}
  return (content?.sections || []).map(section => {
    const paragraphs = section.paragraphs || []
    const cited = [...new Set(paragraphs.flatMap(item => item.evidence_ids || []))]
    const sources = {}
    for (const id of cited) {
      const entry = registry[id]
      if (!entry) continue
      const name = entry.kind === 'standard' ? 'Rejlers standard methodology' : fileName(entry.source)
      sources[name] = (sources[name] || 0) + 1
    }
    const issues = presentFindings(section.findings)
    const pages = section.pages || null
    return {
      key: section.key, title: section.title, kind: section.kind || 'authored', kindLabel: kindLabel(section.kind),
      attachments: Array.isArray(section.attachments) ? section.attachments : [],
      approved: Boolean(section.approved),
      sources: Object.entries(sources).sort((a, b) => b[1] - a[1]).map(([name]) => name),
      preview: paragraphs.filter(item => item.kind !== 'generated').slice(0, 2).map(item => item.text.slice(0, 420)),
      paragraphs: paragraphs.filter(item => item.kind !== 'generated').length,
      blockers: issues.blockers, checks: issues.checks, pages, firstPage: pages ? pages[0] : null,
    }
  })
}

const JOB_STATES = {
  queued: { label: 'Waiting to start', busy: true },
  running: { label: 'Building the proposal', busy: true },
  succeeded: { label: 'Proposal generated', busy: false },
  failed: { label: 'Generation failed', busy: false },
}

const JOB_ERRORS = {
  authority_changed: 'Your access to this proposal changed during generation.',
  selection_changed: 'The selected documents changed during generation. Check the documents and generate again.',
  invalid_selection: 'The selected documents are no longer available. Check the documents and generate again.',
  build_failed: 'The proposal could not be built. Try again; if it fails again, contact support.',
  attempts_exhausted: 'The proposal could not be built after several attempts. Contact support.',
}

export function presentJob(job) {
  if (!job) return null
  const state = JOB_STATES[job.status] || JOB_STATES.queued
  return { ...state, status: job.status, error: job.status === 'failed' ? (JOB_ERRORS[job.error_code] || JOB_ERRORS.build_failed) : '',
    retrying: job.status === 'running' && job.attempts > 1, section: job.section_key || null, version: job.result_version || null }
}

// Overall proposal status for the workspace header.
export function proposalStatus(content, job) {
  const running = job && (job.status === 'queued' || job.status === 'running')
  if (running) return { key: 'generating', label: 'Generating' }
  if (!content) return { key: 'empty', label: 'Not generated' }
  const sections = reviewSections(content)
  const approved = sections.filter(item => item.approved).length
  const blockers = presentFindings(content.build_findings).blockers.length
  if (content.publication_validation?.ready) return { key: 'ready', label: 'Ready to submit', approved, total: sections.length, blockers }
  if (blockers) return { key: 'attention', label: 'Needs attention', approved, total: sections.length, blockers }
  return { key: 'review', label: 'In review', approved, total: sections.length, blockers }
}

export const pageLabel = pages => (pages ? (pages[0] === pages[1] ? `p. ${pages[0]}` : `pp. ${pages[0]}–${pages[1]}`) : '')
