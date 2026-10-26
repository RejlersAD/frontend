/**
 * PidExtractionWorkspace — "RADAI IO List — P&ID extraction & vendor auto-fill".
 *
 * The approved 4-stage flow (alignment spec §2–§7):
 *   1 Upload documents (P&ID + optional IO list baseline + vendor DBs)
 *   2 Legend cross-check
 *   3 Document info
 *   4 AI Extraction Key — BYOK (drawing rules run first, free)
 * then tabbed results (IO rows · Service review · Line↔tags · Set points ·
 * Untagged · Vendor auto-fill · Conflicts) with evidence per value.
 *
 * Design rules: RADAI tokens, violet #4F2BF5 only for AI elements, no emoji.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle, Check, CheckCircle2, ChevronLeft, Download, FileText,
  Loader2, Lock, Sparkles, Trash2, Upload, X,
} from 'lucide-react'
import ioExtractionService from '../../../../services/ioExtractionService'
import ioListWorkflowService from '../../../../services/ioListWorkflowService'
import useAiKeyStatus from './useAiKeyStatus'

const VIOLET = '#4F2BF5'

const STAGES = [
  { n: 1, title: 'Upload documents' },
  { n: 2, title: 'Legend cross-check' },
  { n: 3, title: 'Document info' },
  { n: 4, title: 'AI Extraction Key — BYOK (P&ID drawings)' },
]

const RESULT_TABS = [
  { key: 'io', label: 'IO rows' },
  { key: 'service', label: 'Service review' },
  { key: 'lines', label: 'Line ↔ tags' },
  { key: 'setpoints', label: 'Set points' },
  { key: 'untagged', label: 'Untagged symbols' },
  { key: 'vendor', label: 'Vendor auto-fill' },
  { key: 'conflicts', label: 'Conflicts' },
]

const confPill = (c) => {
  if (c >= 0.85) return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
  if (c >= 0.6) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
  return 'bg-[#4F2BF5]/10 text-[#4F2BF5]'
}

function Pill({ children, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
    green: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    red: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    violet: 'bg-[#4F2BF5]/10 text-[#4F2BF5]',
  }
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${tones[tone]}`}>{children}</span>
}

export default function PidExtractionWorkspace({ project, onBack, onManageLegends }) {
  const [files, setFiles] = useState({ pid: null, iolist: null, vendor: [] })
  const [slotInfo, setSlotInfo] = useState({ pid: null, iolist: null, vendorDcs: null, vendorEsd: null })
  const [stageState, setStageState] = useState({})
  const [docInfo, setDocInfo] = useState({ docNo: '', revision: '', rejlersNumber: '' })
  const [rulesOnly, setRulesOnly] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [extraction, setExtraction] = useState(null)   // { id, status, summary }
  const [activeTab, setActiveTab] = useState('io')
  const [tabData, setTabData] = useState(null)
  const [sheetFilter, setSheetFilter] = useState('')
  const [history, setHistory] = useState([])
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')
  const pollRef = useRef(null)

  const { keyInfo, modal, setModal, testState, onTestKey, onSaveKey, onRemoveKey } =
    useAiKeyStatus()

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 5000) }

  const refreshFiles = useCallback(async () => {
    try {
      const data = await ioExtractionService.listFiles(project.id)
      const list = data.files || []
      const vendors = list.filter((f) => f.documentType === 'vendor_db')
      setSlotInfo({
        pid: list.find((f) => f.documentType === 'pid_drawing') || null,
        iolist: list.find((f) => f.documentType === 'io_list') || null,
        vendorDcs: vendors.find((f) => f.vendorSystem === 'DCS') || null,
        vendorEsd: vendors.find((f) => f.vendorSystem === 'ESD') || null,
      })
    } catch { /* list is best-effort */ }
  }, [project.id])

  useEffect(() => { refreshFiles() }, [refreshFiles])
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  const refreshHistory = useCallback(async () => {
    try {
      const data = await ioExtractionService.listExtractions(project.id)
      setHistory(data.extractions || [])
    } catch { /* history is best-effort */ }
  }, [project.id])

  useEffect(() => { refreshHistory() }, [refreshHistory])

  const openExtraction = async (extId) => {
    setError('')
    try {
      const st = await ioExtractionService.getStatus(project.id, extId)
      if (st.status !== 'completed') { setError(st.error || 'This extraction is not complete.'); return }
      setExtraction({ id: extId, summary: st.summary })
      setActiveTab('io')
      setSheetFilter('')
      loadTab('io', extId, '')
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    }
  }

  const saveRowEdit = async (tag, updates) => {
    setError('')
    try {
      await ioExtractionService.patchRow(project.id, extraction.id, tag, updates)
      showToast(`Row ${tag} updated`)
      loadTab(activeTab)
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    }
  }

  // ── Stage logic ─────────────────────────────────────────────────────
  const stageDone = useMemo(() => ({
    1: !!slotInfo.pid && !!slotInfo.vendorDcs && !!slotInfo.vendorEsd
       && stageState['1'] === 'complete',
    2: stageState['2'] === 'complete',
    3: !!(docInfo.docNo && docInfo.revision) || stageState['3'] === 'complete',
    4: rulesOnly || !!keyInfo?.saved || !slotInfo.pid,
  }), [slotInfo, stageState, docInfo, rulesOnly, keyInfo])

  const unlocked = (n) => n === 1 || stageDone[n - 1]
  const ready = stageDone[1] && stageDone[2] && stageDone[3] && stageDone[4]

  const upload = async (kind, fileList) => {
    setError('')
    for (const file of fileList) {
      try {
        const summary = await ioExtractionService.uploadFile(project.id, file)
        if (summary.error) { setError(summary.error); continue }
        if (summary.kind === 'vendor') {
          // The server detects DCS vs ESD from the sheet's column spelling —
          // the file lands in its own slot regardless of which slot was used.
          const slotKey = summary.vendorSystem === 'DCS' ? 'vendorDcs' : 'vendorEsd'
          setSlotInfo((s) => {
            if (s[slotKey] && s[slotKey].vendorSystem !== summary.vendorSystem) return s
            return { ...s, [slotKey]: summary }
          })
        }
        else if (summary.kind === 'pid') setSlotInfo((s) => ({ ...s, pid: summary }))
        else setSlotInfo((s) => ({ ...s, iolist: summary }))
      } catch (err) {
        setError(err.response?.data?.error || `Upload failed: ${err.message}`)
      }
    }
    refreshFiles()
  }

  const removeFile = async (docId) => {
    setError('')
    try {
      await ioListWorkflowService.deleteDocument(docId)
      await refreshFiles()
    } catch (err) {
      setError(err.response?.data?.error || `Remove failed: ${err.message}`)
    }
  }

  const saveDocInfo = async () => {
    await ioExtractionService.saveDocInfo(project.id, docInfo)
    setStageState((s) => ({ ...s, 3: 'complete' }))
    showToast('Stage 3 complete · Stage 4 unlocked')
  }

  const markLegendDone = async (legendId) => {
    setError('')
    try {
      await ioExtractionService.saveLegend(project.id, { legendId })
      setStageState((s) => ({ ...s, 2: 'complete' }))
      showToast('Stage 2 complete · Stage 3 unlocked')
    } catch (err) {
      setError(err.response?.data?.error || `Legend activation failed: ${err.message}`)
    }
  }

  const runExtraction = async () => {
    setExtracting(true)
    setError('')
    try {
      const { extractionId } = await ioExtractionService.startExtraction(project.id, keyInfo?.saved && !rulesOnly)
      pollRef.current = setInterval(async () => {
        try {
          const st = await ioExtractionService.getStatus(project.id, extractionId)
          if (st.status === 'completed' || st.status === 'failed') {
            clearInterval(pollRef.current)
            setExtracting(false)
            if (st.status === 'failed') { setError(st.error || 'Extraction failed'); return }
            setExtraction({ id: extractionId, summary: st.summary })
            const s = st.summary || {}
            showToast(`Extraction complete · ${s.tags || 0} tags · ${s.vendorCells || 0} vendor cells filled · ${s.aiTags || 0} rows to review`)
            loadTab('io', extractionId)
            refreshHistory()
          }
        } catch { /* keep polling */ }
      }, 2000)
    } catch (err) {
      setExtracting(false)
      setError(err.response?.data?.error || err.message)
    }
  }

  const loadTab = async (tab, extId = extraction?.id, sheet = sheetFilter) => {
    if (!extId) return
    setTabData(null)
    try {
      const data = await ioExtractionService.getExtraction(project.id, extId, { tab, sheet: sheet || undefined })
      setTabData(data)
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    }
  }

  useEffect(() => { if (extraction) loadTab(activeTab) }, [activeTab, sheetFilter]) // eslint-disable-line

  const decide = async (tag, decision) => {
    await ioExtractionService.postDecisions(project.id, extraction.id, [{ tag, decision }])
    loadTab(activeTab)
  }

  const askAi = async (loopKey) => {
    try {
      await ioExtractionService.askAi(project.id, extraction.id, loopKey)
      showToast(`AI suggestion ready for ${loopKey}`)
      loadTab(activeTab)
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    }
  }

  const summary = extraction?.summary || {}

  return (
    <div className="space-y-4">
      {/* Toasts */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-white dark:bg-slate-800 border-l-4 border-green-500 shadow-lg rounded px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
          {toast}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded px-3 py-2 text-sm">
          <AlertTriangle className="w-4 h-4" /> <span className="flex-1">{error}</span>
          <button onClick={() => setError('')}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Engineering / 1.3 Instrument / IO List / {project.project_name}
          </div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            Instrument I/O List
            <Pill>Project {project.project_name}</Pill>
            {extraction
              ? <Pill tone="green">Extracted · {summary.sheets || 0} P&ID sheets</Pill>
              : <Pill tone="amber">Draft</Pill>}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Build the IO list from P&amp;IDs, fill automation details from the vendor IO
            databases, and review only what the rules could not settle.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="rd-btn text-sm flex items-center gap-1">
            <ChevronLeft className="w-4 h-4" /> Back to projects
          </button>
          {extraction && (
            <a className="rd-btn text-sm flex items-center gap-1"
               href={ioExtractionService.exportUrl(project.id, extraction.id, 'iolist')}>
              <Download className="w-4 h-4" /> Export
            </a>
          )}
        </div>
      </div>

      {/* Page tabs */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
        <button
          className={`px-3 py-2 text-sm ${!extraction ? 'border-b-2 border-blue-600 text-blue-600 font-medium' : 'text-slate-500'}`}
          onClick={() => setExtraction(null)}>
          New extraction
        </button>
        <button
          className={`px-3 py-2 text-sm ${extraction ? 'border-b-2 border-blue-600 text-blue-600 font-medium' : 'text-slate-400 cursor-not-allowed'}`}
          disabled={!extraction}>
          Results {summary.aiTags ? <Pill tone="amber">{summary.aiTags} to review</Pill> : null}
        </button>
      </div>

      {!extraction ? (
        <>
          {/* Stepper */}
          <div className="rd-card p-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Set up extraction</h3>
            <p className="text-xs text-slate-500 mb-4">
              Complete each stage in order. A stage unlocks only when the previous one is
              complete. Your key and the project legend are remembered.
            </p>
            <div className="space-y-3">
              {STAGES.map(({ n, title }) => {
                const done = stageDone[n]
                const open = unlocked(n)
                return (
                  <div key={n} className={`flex items-start gap-3 rounded border p-3 ${open ? 'border-slate-200 dark:border-slate-700' : 'border-slate-100 dark:border-slate-800 opacity-60'}`}>
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${done ? 'bg-green-500 text-white' : open ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                      {done ? <Check className="w-3.5 h-3.5" /> : open ? n : <Lock className="w-3 h-3" />}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Stage {n} · {title}</span>
                        <Pill tone={done ? 'green' : open ? 'amber' : 'slate'}>
                          {done ? 'Complete' : open ? 'In progress' : 'Locked'}
                        </Pill>
                      </div>

                      {/* Stage bodies */}
                      {open && n === 1 && (
                        <StageUpload slotInfo={slotInfo} upload={upload} onRemoveFile={removeFile} onContinue={() => setStageState((s) => ({ ...s, 1: 'complete' }))} />
                      )}
                      {open && n === 2 && (
                        <div className="mt-2 text-xs text-slate-600 dark:text-slate-300 space-y-2">
                          <p>Symbol and tag rules used to read each bubble before it becomes an IO row.</p>
                          <div className="overflow-x-auto rounded border border-slate-200 dark:border-slate-700">
                            <table className="min-w-full">
                              <thead>
                                <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-700">
                                  <th className="px-2 py-1 font-medium">Rule</th>
                                  <th className="px-2 py-1 font-medium">From legend</th>
                                  <th className="px-2 py-1 font-medium">Used for</th>
                                </tr>
                              </thead>
                              <tbody className="text-slate-600 dark:text-slate-300">
                                <tr className="border-b border-slate-100 dark:border-slate-800"><td className="px-2 py-1">Tag format</td><td className="px-2 py-1">2-digit unit · function letters · loop no. · suffix → 13-LT-7201A</td><td className="px-2 py-1">Tag</td></tr>
                                <tr className="border-b border-slate-100 dark:border-slate-800"><td className="px-2 py-1">Letter under bubble</td><td className="px-2 py-1">I DCS · S ESD · P/PX package PLC · M MCC · K F&amp;G · H hardwired</td><td className="px-2 py-1">System</td></tr>
                                <tr className="border-b border-slate-100 dark:border-slate-800"><td className="px-2 py-1">Bubble shape</td><td className="px-2 py-1">plain circle = field device · square frame = DCS function · centre bar = panel · dashed = other P&amp;ID</td><td className="px-2 py-1">field I/O vs software</td></tr>
                                <tr className="border-b border-slate-100 dark:border-slate-800"><td className="px-2 py-1">Alarm letters</td><td className="px-2 py-1">SHH HH H SH L SL LL SLL beside the bubble</td><td className="px-2 py-1">alarm columns</td></tr>
                                <tr className="border-b border-slate-100 dark:border-slate-800"><td className="px-2 py-1">Line number</td><td className="px-2 py-1">size&quot;-unit-service-serial-class[-insulation]</td><td className="px-2 py-1">Line ↔ tag</td></tr>
                                <tr><td className="px-2 py-1">Service templates</td><td className="px-2 py-1">HS …C ESD RESET · …T ESD TEST RUN/OK · ZSH OPEN · ZSL CLOSE · ZT LIFT · ZI POSITION · Y SOV</td><td className="px-2 py-1">Service</td></tr>
                              </tbody>
                            </table>
                          </div>
                          <div className="flex gap-2">
                            {onManageLegends && (
                              <button className="rd-btn text-xs" onClick={onManageLegends}>Manage legends</button>
                            )}
                            <button className="rd-btn text-xs bg-blue-600 text-white" onClick={() => markLegendDone('project')}>
                              Activate legend for this project
                            </button>
                          </div>
                        </div>
                      )}
                      {open && n === 3 && (
                        <div className="mt-2 flex flex-wrap items-end gap-2 text-xs">
                          <label className="flex flex-col gap-0.5">
                            <span className="text-slate-500">Document number *</span>
                            <input className="rd-input" value={docInfo.docNo}
                                   onChange={(e) => setDocInfo((d) => ({ ...d, docNo: e.target.value }))}
                                   placeholder={slotInfo.iolist?.document || '13-IE-363-70001'} />
                          </label>
                          <label className="flex flex-col gap-0.5">
                            <span className="text-slate-500">Revision *</span>
                            <input className="rd-input w-20" value={docInfo.revision}
                                   onChange={(e) => setDocInfo((d) => ({ ...d, revision: e.target.value }))}
                                   placeholder={slotInfo.iolist?.revision || 'Q1'} />
                          </label>
                          <label className="flex flex-col gap-0.5">
                            <span className="text-slate-500">Rejlers number</span>
                            <input className="rd-input" value={docInfo.rejlersNumber}
                                   onChange={(e) => setDocInfo((d) => ({ ...d, rejlersNumber: e.target.value }))} />
                          </label>
                          <button className="rd-btn bg-blue-600 text-white text-xs" disabled={!docInfo.docNo || !docInfo.revision}
                                  onClick={saveDocInfo}>
                            Save and continue
                          </button>
                        </div>
                      )}
                      {open && n === 4 && (
                        <StageByok
                          keyInfo={keyInfo} rulesOnly={rulesOnly} noPid={!slotInfo.pid}
                          onRulesOnly={() => { setRulesOnly(true); setStageState((s) => ({ ...s, 4: 'complete' })) }}
                          onConnect={() => setModal(true)}
                          onRemoveKey={onRemoveKey}
                          aiEstimate={summary.aiEstimate}
                        />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Readiness + CTA */}
            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex gap-3 text-xs text-slate-500">
                <Ready ok={stageDone[1]} label="P&ID + DCS + ESD uploaded" />
                <Ready ok={stageDone[2]} label="Legend cross-check addressed" />
                <Ready ok={stageDone[3]} label="Document number & revision filled" />
                <Ready ok={stageDone[4]} label="AI key choice confirmed (BYOK tested or rules only)" />
              </div>
              <button
                className="rd-btn bg-blue-600 text-white text-sm disabled:opacity-50"
                disabled={!ready || extracting}
                title={ready ? '' : `Complete Stage ${[1, 2, 3, 4].find((n) => !stageDone[n])} first`}
                onClick={runExtraction}>
                {extracting ? <><Loader2 className="w-4 h-4 animate-spin" /> Extracting…</> : <><Upload className="w-4 h-4" /> Upload & extract</>}
              </button>
            </div>
          </div>
        </>
      ) : (
        <ResultsView
          summary={summary} activeTab={activeTab} setActiveTab={setActiveTab}
          tabData={tabData} sheetFilter={sheetFilter} setSheetFilter={setSheetFilter}
          onDecide={decide} onAskAi={askAi} onEditRow={saveRowEdit}
          exportUrl={(fmt) => ioExtractionService.exportUrl(project.id, extraction.id, fmt)}
        />
      )}

      {/* Extraction history — past runs stay reopenable */}
      {!extraction && history.length > 0 && (
        <div className="rd-card p-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Previous extractions</h3>
          <div className="space-y-1">
            {history.map((h) => (
              <div key={h.id} className="flex items-center gap-3 text-xs border-b border-slate-100 dark:border-slate-800 last:border-0 py-1.5">
                <Pill tone={h.status === 'completed' ? 'green' : h.status === 'failed' ? 'red' : 'amber'}>
                  {h.status}{h.isOutdated ? ' · outdated' : ''}
                </Pill>
                <span className="text-slate-500">{new Date(h.createdAt).toLocaleString()}</span>
                <span className="text-slate-400">{h.createdBy}</span>
                <span className="text-slate-600 dark:text-slate-300">
                  {h.summary?.tags ?? '—'} tags · {h.summary?.fieldIO ?? '—'} field I/O · {h.summary?.vendorCells ?? '—'} vendor cells
                </span>
                <button className="rd-btn text-xs ml-auto" disabled={h.status !== 'completed'}
                        onClick={() => openExtraction(h.id)}>
                  Open results
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BYOK modal */}
      {modal && (
        <ConnectKeyModal
          onClose={() => setModal(false)}
          onTest={onTestKey}
          onSave={onSaveKey}
          testState={testState}
        />
      )}
    </div>
  )
}

function Ready({ ok, label }) {
  return (
    <span className={`flex items-center gap-1 ${ok ? 'text-green-600' : ''}`}>
      {ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span className="w-3.5 h-3.5 rounded-full border border-slate-300 inline-block" />}
      {label}
    </span>
  )
}

/* Stage 1 — four upload slots: P&ID, IO list baseline (optional), and the
   two compulsory vendor databases (DCS and ESD are different files). */
function StageUpload({ slotInfo, upload, onContinue, onRemoveFile }) {
  const slots = [
    { key: 'pid', title: 'P&ID drawings (PDF) *', accept: '.pdf', multiple: true, info: slotInfo.pid,
      help: 'One or more P&ID sheets as PDF.' },
    { key: 'iolist', title: 'IO list baseline (optional)', accept: '.xlsx,.pdf', multiple: false, info: slotInfo.iolist,
      help: 'One workbook or PDF — switches on comparison.' },
    { key: 'vendor-dcs', title: 'Vendor DCS database *', accept: '.xlsx', multiple: false, info: slotInfo.vendorDcs,
      help: 'The DCS IO assignment workbook (.xlsx).' },
    { key: 'vendor-esd', title: 'Vendor ESD database *', accept: '.xlsx', multiple: false, info: slotInfo.vendorEsd,
      help: 'The ESD IO assignment workbook (.xlsx) — a different file from the DCS one.' },
  ]
  const ready = slotInfo.pid && slotInfo.vendorDcs && slotInfo.vendorEsd
  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs text-slate-500">
        P&amp;ID drawings and the two vendor databases (DCS and ESD — two separate files)
        are required. The IO list baseline is optional and switches on comparison.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
        {slots.map((slot) => (
          <label key={slot.key}
                 className={`rounded border-2 border-dashed p-3 text-xs cursor-pointer transition-colors ${slot.info ? 'border-green-400 bg-green-50/50 dark:bg-green-900/10' : 'border-slate-300 dark:border-slate-600 hover:border-blue-400'}`}>
            <input type="file" className="hidden" accept={slot.accept} multiple={slot.multiple}
                   onChange={(e) => { if (e.target.files?.length) upload(slot.key, [...e.target.files]); e.target.value = '' }} />
            <div className="font-medium text-slate-700 dark:text-slate-200 mb-1">{slot.title}</div>
            {slot.info
              ? <SlotSummary info={slot.info} onRemove={onRemoveFile} />
              : <span className="text-slate-400 flex items-center gap-1"><Upload className="w-3.5 h-3.5" /> {slot.help}</span>}
          </label>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button className="rd-btn bg-blue-600 text-white text-xs" disabled={!ready}
                title={ready ? '' : 'Upload the P&ID and both vendor databases (DCS and ESD) first'}
                onClick={onContinue}>
          Confirm files and continue
        </button>
        {!ready && (
          <span className="text-[11px] text-slate-400">
            Missing: {[
              !slotInfo.pid && 'P&ID',
              !slotInfo.vendorDcs && 'DCS database',
              !slotInfo.vendorEsd && 'ESD database',
            ].filter(Boolean).join(' · ')}
          </span>
        )}
      </div>
    </div>
  )
}

function SlotSummary({ info, onRemove }) {
  const rows = []
  if (info.name) rows.push(['File', info.name])
  if (info.sheets) rows.push(['Sheets', info.sheets])
  if (info.drawings?.length) rows.push(['Drawings', info.drawings.join(' · ')])
  if (info.pdfType) rows.push(['PDF type', info.pdfType])
  if (info.smartTags) rows.push(['Smart tags', `${info.smartTags.instrument} instrument (IN#) · ${info.smartTags.equipment} equipment (EQ#)`])
  if (info.rows) rows.push(['Rows', `${info.rows} · ${info.columns} columns`])
  if (info.systems) rows.push(['Systems', Object.entries(info.systems).map(([k, v]) => `${k} ${v}`).join(' · ')])
  if (info.liveTags) rows.push(['Live tags', info.liveTags])
  if (info.vendorSystem) rows.push(['Database', info.vendorSystem])
  return (
    <div className="space-y-0.5 text-slate-600 dark:text-slate-300">
      {rows.map(([k, v]) => (
        <div key={k} className="flex gap-2"><span className="text-slate-400 w-20 shrink-0">{k}</span><span className="break-all">{String(v)}</span></div>
      ))}
      {onRemove && info.id && (
        <button type="button" className="text-red-500 hover:text-red-600 mt-0.5"
                onClick={(e) => { e.preventDefault(); onRemove(info.id) }}>
          Remove
        </button>
      )}
    </div>
  )
}

/* Stage 4 — BYOK */
function StageByok({ keyInfo, rulesOnly, noPid, onRulesOnly, onConnect, onRemoveKey, aiEstimate }) {
  if (noPid) {
    return <p className="mt-2 text-xs text-slate-500">Not needed — no P&amp;ID uploaded</p>
  }
  if (keyInfo?.saved) {
    return (
      <div className="mt-2 space-y-2 text-xs">
        <div className="flex items-center gap-2">
          <Pill tone="violet">Using your key ••••{keyInfo.last4} · tested {keyInfo.testedAt || ''}</Pill>
        </div>
        <div className="rounded border border-[#4F2BF5]/30 bg-[#4F2BF5]/5 p-2 text-[#4F2BF5]">
          What goes to the AI step on this run — rows below 0.6 confidence, one cropped
          image per loop. Rows from the AI stay Suggested until you accept them.
        </div>
        <div className="flex gap-2">
          <button className="rd-btn text-xs text-red-600" onClick={onRemoveKey}><Trash2 className="w-3.5 h-3.5" /> Remove key</button>
        </div>
      </div>
    )
  }
  return (
    <div className="mt-2 space-y-2 text-xs">
      <p className="text-slate-500">
        The drawing rules run first and cost nothing. Your own key is used only for rows
        the rules could not settle, with a cropped image of that loop.
      </p>
      {!rulesOnly && (
        <div className="rounded border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-2 text-blue-700 dark:text-blue-300">
          Connect your key to send low-confidence loops to the AI step, or continue with
          drawing rules only.
        </div>
      )}
      <div className="flex gap-2">
        <button className="rd-btn text-xs" onClick={onRulesOnly} disabled={rulesOnly}>
          {rulesOnly ? <Check className="w-3.5 h-3.5 text-green-600" /> : null} Use drawing rules only
        </button>
        <button className="rd-btn text-xs text-white" style={{ background: VIOLET }} onClick={onConnect}>
          <Sparkles className="w-3.5 h-3.5" /> Connect key
        </button>
      </div>
    </div>
  )
}

/* Connect-key modal */
function ConnectKeyModal({ onClose, onTest, onSave, testState }) {
  const [provider, setProvider] = useState('claude')
  const [apiKey, setApiKey] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md">
        <div className="px-4 py-3 rounded-t-lg bg-blue-600 text-white">
          <div className="font-medium">Connect your key</div>
          <div className="text-xs opacity-90">Used only for P&amp;ID rows the drawing rules cannot settle.</div>
        </div>
        <div className="p-4 space-y-3 text-sm">
          <label className="block">
            <span className="text-xs text-slate-500">Provider</span>
            <select className="rd-input w-full" value={provider} onChange={(e) => setProvider(e.target.value)}>
              <option value="claude">Anthropic (Claude)</option>
              <option value="openai">OpenAI</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-slate-500">API key</span>
            <input type="password" className="rd-input w-full" value={apiKey}
                   onChange={(e) => setApiKey(e.target.value)} autoComplete="off" />
          </label>
          <p className="text-xs text-slate-400">
            Sent only to the RADAI server and stored encrypted against your user. It is
            never shown again, stored in the browser, or written to logs.
          </p>
          {testState?.message && (
            <p className={`text-xs ${testState.ok ? 'text-green-600' : 'text-red-600'}`}>{testState.message}</p>
          )}
        </div>
        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
          <button className="rd-btn text-sm" onClick={onClose}>Cancel</button>
          <button className="rd-btn text-sm" disabled={!apiKey || testState?.testing}
                  onClick={() => onTest(provider, apiKey)}>
            {testState?.testing ? 'Testing…' : 'Test key'}
          </button>
          <button className="rd-btn text-sm bg-blue-600 text-white disabled:opacity-50"
                  disabled={!testState?.ok} onClick={() => onSave(provider, apiKey)}>
            Save key
          </button>
        </div>
      </div>
    </div>
  )
}

/* Results */
function ResultsView({ summary, activeTab, setActiveTab, tabData, sheetFilter, setSheetFilter, onDecide, onAskAi, onEditRow, exportUrl }) {
  const kpis = [
    ['Tags read', summary.tags, `${summary.confirmed || 0} confirmed by smart tags · ${summary.sheets || 0} sheets`],
    ['Field I/O rows', summary.fieldIO, summary.derived ? `+${summary.derived} derived from valve typical` : ''],
    ['Tags with line number', summary.withLine, ''],
    ['Set points from P&ID', summary.setpoints, 'rest from C&E'],
    ['Vendor cells filled', summary.vendorCells, `${summary.vendorMatched || 0} rows matched`],
    ['Vendor conflicts', summary.vendorConflicts, ''],
  ]
  return (
    <div className="space-y-4">
      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
        {kpis.map(([label, value, sub]) => (
          <div key={label} className="rd-card p-3">
            <div className="text-xs text-slate-500">{label}</div>
            <div className="text-xl font-semibold text-slate-800 dark:text-slate-100">{value ?? '—'}</div>
            {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
          </div>
        ))}
      </div>

      {/* Review banner */}
      {(summary.aiTags > 0 || summary.vendorConflicts > 0) && (
        <div className="rd-card border-l-4 border-amber-400 p-3 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <div className="flex-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">Review before issue</span>
            <span className="text-slate-500"> — rows below 0.6 confidence, services that differ from the IO list, and vendor values that disagree.</span>
          </div>
          <button className="rd-btn text-xs" onClick={() => setActiveTab('service')}>Open service review →</button>
        </div>
      )}

      {/* Result tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
        <div className="flex gap-1 flex-wrap">
          {RESULT_TABS.map((t) => (
            <button key={t.key}
                    className={`px-3 py-2 text-sm ${activeTab === t.key ? 'border-b-2 border-blue-600 text-blue-600 font-medium' : 'text-slate-500'}`}
                    onClick={() => setActiveTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 pb-1">
          <select className="rd-input text-xs" value={sheetFilter} onChange={(e) => setSheetFilter(e.target.value)}>
            <option value="">All sheets</option>
            {[...Array(summary.sheets || 0)].map((_, i) => <option key={i + 1} value={i + 1}>Sheet {i + 1}</option>)}
          </select>
          <a className="rd-btn text-xs flex items-center gap-1" href={exportUrl('review')}>
            <Download className="w-3.5 h-3.5" /> Review workbook
          </a>
        </div>
      </div>

      {!tabData ? (
        <div className="p-6 text-center text-slate-400 text-sm"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
      ) : (
        <ResultTable tab={activeTab} data={tabData} onDecide={onDecide} onAskAi={onAskAi} onEditRow={onEditRow} />
      )}
    </div>
  )
}

/* Inline-editable text cell — click to edit, Enter/blur saves */
function EditableCell({ value, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value || '')
  if (!editing) {
    return (
      <button type="button" className="text-left w-full hover:bg-blue-50 dark:hover:bg-slate-700 rounded px-1"
              title="Click to edit" onClick={() => { setDraft(value || ''); setEditing(true) }}>
        {value || <span className="text-slate-400">—</span>}
      </button>
    )
  }
  const commit = () => { setEditing(false); if (draft !== (value || '')) onSave(draft) }
  return (
    <input autoFocus className="rd-input text-xs w-full" value={draft}
           onChange={(e) => setDraft(e.target.value)}
           onBlur={commit}
           onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }} />
  )
}

function ResultTable({ tab, data, onDecide, onAskAi, onEditRow }) {
  const rows = data.rows || []
  if (tab === 'io') {
    return (
      <DataTable
        cols={['Tag', 'System', 'Service', 'Confidence', 'Line number', 'Set point', 'IO type', 'Review']}
        rows={rows.map((t) => [
          <span className="text-blue-600 font-medium">{t.tag}{t.editedBy ? <span className="text-[10px] text-green-600"> edited</span> : null}</span>,
          t.system || '—',
          <EditableCell value={t.service} onSave={(v) => onEditRow(t.tag, { service: v })} />,
          <Pill tone={t.serviceConfidence >= 0.85 ? 'green' : t.serviceConfidence >= 0.6 ? 'amber' : 'violet'}>
            {t.serviceConfidence >= 0.85 ? 'High' : t.serviceConfidence >= 0.6 ? 'Review' : 'AI step'}
          </Pill>,
          <EditableCell value={t.line} onSave={(v) => onEditRow(t.tag, { line: v })} />,
          '',
          t.ioType || '',
          t.decision
            ? <Pill tone="green">{t.decision}</Pill>
            : <button className="rd-btn text-[11px]" onClick={() => onDecide(t.tag, 'confirm')}>Confirm</button>,
        ])}
        empty="No field IO rows on this sheet."
      />
    )
  }
  if (tab === 'service') {
    return (
      <DataTable
        cols={['Sheet', 'Tag', 'Generated from drawing', 'Result', 'Why', 'Decision']}
        rows={rows.filter((t) => t.service || t.serviceConfidence < 0.6).map((t) => [
          t.page + 1,
          t.tag,
          t.service || '(not generated)',
          t.serviceConfidence >= 0.85 ? <Pill tone="green">Exact</Pill>
            : t.service ? <Pill tone="amber">Review</Pill> : <Pill tone="red">Not generated</Pill>,
          <span className="text-xs text-slate-500">{t.serviceEvidence}{t.serviceAlt ? ` · ${t.serviceAlt}` : ''}</span>,
          t.decision
            ? <Pill tone="green">{t.decision}</Pill>
            : (
              <span className="flex gap-1">
                <button className="rd-btn text-[11px]" onClick={() => onDecide(t.tag, 'use-generated')}>Use generated</button>
                <button className="rd-btn text-[11px]" style={{ color: VIOLET }} onClick={() => onAskAi(t.loopKey)}>
                  <Sparkles className="w-3 h-3" /> Ask AI
                </button>
              </span>
            ),
        ])}
        empty="Nothing to review."
      />
    )
  }
  if (tab === 'lines') {
    return (
      <DataTable
        cols={['Sheet', 'Line number', 'Label anchored by', 'Tags tapped on the line', 'Loop members (inherited)']}
        rows={rows.map((l) => [l.sheet, l.line, l.anchoredBy, l.tagsOwn?.join(', '), l.tagsLoop?.join(', ')])}
        empty="No line labels anchored."
      />
    )
  }
  if (tab === 'setpoints') {
    return (
      <DataTable
        cols={['Sheet', 'Tag', 'Point', 'Set point (P&ID)', 'Scale label', 'IO list column']}
        rows={rows.map((s) => [
          s.sheet, s.tag, s.point,
          <EditableCell
            value={s.value ? `${s.value} ${s.unit}` : ''}
            onSave={(v) => onEditRow(s.tag, { setpoint: { point: s.point, value: v.replace(/[^\d.+-]/g, ''), unit: s.unit, column: s.column } })}
          />,
          s.label, s.column,
        ])}
        empty="No set points read from the drawing."
      />
    )
  }
  if (tab === 'untagged') {
    return (
      <DataTable
        cols={['Sheet', 'Text in bubble', 'Classified as', 'Nearest tagged bubble', 'Distance', 'IO row']}
        rows={rows.map((u) => [u.sheet, u.text, u.kind, u.nearestTag, `${u.distancePt} pt`, 'Not created'])}
        empty="No untagged symbols."
      />
    )
  }
  if (tab === 'vendor') {
    const b = data.baseline || {}
    return (
      <div className="space-y-3 text-sm">
        <div className="rd-card p-3 text-xs text-slate-600 dark:text-slate-300">
          Baseline {b.doc_no || '—'} Rev {b.revision || '—'} · sheet {b.sheet_name || '—'} ·
          matched {data.fills ? Object.keys(data.fills).length : 0} rows ·
          no vendor record: {(data.noRecord || []).length}
        </div>
        <DataTable
          cols={['Tag (no vendor record)']}
          rows={(data.noRecord || []).map((t) => [t])}
          empty="Every row matched a vendor record."
        />
      </div>
    )
  }
  if (tab === 'conflicts') {
    return (
      <DataTable
        cols={['Tag', 'Field', 'IO List Rev Q1', 'Vendor database', 'Type']}
        rows={rows.map((c) => [
          c.tag, c.field, c.io_list, c.vendor,
          c.type === 'engineering'
            ? <Pill tone="amber">Engineering check</Pill>
            : <Pill tone="slate">Text drift</Pill>,
        ])}
        empty="No conflicts."
      />
    )
  }
  return null
}

function DataTable({ cols, rows, empty }) {
  if (!rows.length) return <div className="p-6 text-center text-slate-400 text-sm">{empty}</div>
  return (
    <div className="overflow-x-auto rd-card">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-500 border-b border-slate-200 dark:border-slate-700">
            {cols.map((c) => <th key={c} className="px-3 py-2 font-medium">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
              {r.map((cell, j) => <td key={j} className="px-3 py-2 align-top">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
