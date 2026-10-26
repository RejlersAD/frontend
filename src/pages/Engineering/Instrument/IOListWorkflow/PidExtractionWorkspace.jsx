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
  const [slotInfo, setSlotInfo] = useState({ pid: null, iolist: null, vendor: [] })
  const [stageState, setStageState] = useState({})
  const [docInfo, setDocInfo] = useState({ docNo: '', revision: '', rejlersNumber: '' })
  const [rulesOnly, setRulesOnly] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [extraction, setExtraction] = useState(null)   // { id, status, summary }
  const [activeTab, setActiveTab] = useState('io')
  const [tabData, setTabData] = useState(null)
  const [sheetFilter, setSheetFilter] = useState('')
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')
  const pollRef = useRef(null)

  const { keyInfo, modal, setModal, testState, onTestKey, onSaveKey, onRemoveKey } =
    useAIDocumentStatus()

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 5000) }

  const refreshFiles = useCallback(async () => {
    try {
      const data = await ioExtractionService.listFiles(project.id)
      const list = data.files || []
      setSlotInfo({
        pid: list.find((f) => f.documentType === 'pid_drawing') || null,
        iolist: list.find((f) => f.documentType === 'io_list') || null,
        vendor: list.filter((f) => f.documentType === 'vendor_db'),
      })
    } catch { /* list is best-effort */ }
  }, [project.id])

  useEffect(() => { refreshFiles() }, [refreshFiles])
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  // ── Stage logic ─────────────────────────────────────────────────────
  const stageDone = useMemo(() => ({
    1: !!slotInfo.pid || !!slotInfo.iolist,
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
        if (summary.kind === 'vendor') setSlotInfo((s) => ({ ...s, vendor: [...s.vendor, summary] }))
        else if (summary.kind === 'pid') setSlotInfo((s) => ({ ...s, pid: summary }))
        else setSlotInfo((s) => ({ ...s, iolist: summary }))
      } catch (err) {
        setError(err.response?.data?.error || `Upload failed: ${err.message}`)
      }
    }
    refreshFiles()
  }

  const saveDocInfo = async () => {
    await ioExtractionService.saveDocInfo(project.id, docInfo)
    setStageState((s) => ({ ...s, 3: 'complete' }))
    showToast('Stage 3 complete · Stage 4 unlocked')
  }

  const markLegendDone = async (legendId) => {
    await ioExtractionService.saveLegend(project.id, { legendId })
    setStageState((s) => ({ ...s, 2: 'complete' }))
    showToast('Stage 2 complete · Stage 3 unlocked')
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
                        <StageUpload slotInfo={slotInfo} upload={upload} onContinue={() => setStageState((s) => ({ ...s, 1: 'complete' }))} />
                      )}
                      {open && n === 2 && (
                        <div className="mt-2 text-xs text-slate-600 dark:text-slate-300 space-y-2">
                          <p>Symbol and tag rules used to read each bubble before it becomes an IO row.</p>
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
                <Ready ok={stageDone[1]} label="P&ID uploaded" />
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
          onDecide={decide} onAskAi={askAi}
          exportUrl={(fmt) => ioExtractionService.exportUrl(project.id, extraction.id, fmt)}
        />
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

/* Stage 1 — three upload slots */
function StageUpload({ slotInfo, upload, onContinue }) {
  const slots = [
    { key: 'pid', title: 'P&ID drawings (PDF)', accept: '.pdf', multiple: true, info: slotInfo.pid },
    { key: 'iolist', title: 'IO list baseline (optional)', accept: '.xlsx,.pdf', multiple: false, info: slotInfo.iolist },
    { key: 'vendor', title: 'Vendor IO databases (optional)', accept: '.xlsx', multiple: true, info: null, list: slotInfo.vendor },
  ]
  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs text-slate-500">
        P&amp;ID drawings are required. The IO list and the vendor IO databases are
        optional and switch on comparison and auto-fill.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {slots.map((slot) => (
          <label key={slot.key}
                 className={`rounded border-2 border-dashed p-3 text-xs cursor-pointer transition-colors ${(slot.info || slot.list?.length) ? 'border-green-400 bg-green-50/50 dark:bg-green-900/10' : 'border-slate-300 dark:border-slate-600 hover:border-blue-400'}`}>
            <input type="file" className="hidden" accept={slot.accept} multiple={slot.multiple}
                   onChange={(e) => { if (e.target.files?.length) upload(slot.key, [...e.target.files]); e.target.value = '' }} />
            <div className="font-medium text-slate-700 dark:text-slate-200 mb-1">{slot.title}</div>
            {slot.info ? (
              <SlotSummary info={slot.info} />
            ) : slot.list?.length ? (
              <div className="space-y-1">{slot.list.map((v) => <SlotSummary key={v.id || v.name} info={v} />)}</div>
            ) : (
              <span className="text-slate-400 flex items-center gap-1"><Upload className="w-3.5 h-3.5" /> Drop or browse</span>
            )}
          </label>
        ))}
      </div>
      <button className="rd-btn bg-blue-600 text-white text-xs" disabled={!slotInfo.pid && !slotInfo.iolist}
              onClick={onContinue}>
        Confirm files and continue
      </button>
    </div>
  )
}

function SlotSummary({ info }) {
  const rows = []
  if (info.name) rows.push(['File', info.name])
  if (info.sheets) rows.push(['Sheets', info.sheets])
  if (info.drawings?.length) rows.push(['Drawings', info.drawings.join(' · ')])
  if (info.pdfType) rows.push(['PDF type', info.pdfType])
  if (info.smartTags) rows.push(['Smart tags', `${info.smartTags.instrument} instrument (IN#) · ${info.smartTags.equipment} equipment (EQ#)`])
  if (info.rows) rows.push(['Rows', `${info.rows} · ${info.columns} columns`])
  if (info.systems) rows.push(['Systems', Object.entries(info.systems).map(([k, v]) => `${k} ${v}`).join(' · ')])
  if (info.liveTags) rows.push(['Live tags', info.liveTags])
  return (
    <div className="space-y-0.5 text-slate-600 dark:text-slate-300">
      {rows.map(([k, v]) => (
        <div key={k} className="flex gap-2"><span className="text-slate-400 w-20 shrink-0">{k}</span><span className="break-all">{String(v)}</span></div>
      ))}
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
function ResultsView({ summary, activeTab, setActiveTab, tabData, sheetFilter, setSheetFilter, onDecide, onAskAi, exportUrl }) {
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
        <ResultTable tab={activeTab} data={tabData} onDecide={onDecide} onAskAi={onAskAi} />
      )}
    </div>
  )
}

function ResultTable({ tab, data, onDecide, onAskAi }) {
  const rows = data.rows || []
  if (tab === 'io') {
    return (
      <DataTable
        cols={['Tag', 'System', 'Service', 'Confidence', 'Line number', 'Set point', 'IO type']}
        rows={rows.map((t) => [
          <span className="text-blue-600 font-medium">{t.tag}</span>,
          t.system || '—',
          <ServiceCell tag={t} />,
          <Pill tone={t.serviceConfidence >= 0.85 ? 'green' : t.serviceConfidence >= 0.6 ? 'amber' : 'violet'}>
            {t.serviceConfidence >= 0.85 ? 'High' : t.serviceConfidence >= 0.6 ? 'Review' : 'AI step'}
          </Pill>,
          t.line || '—',
          '',
          t.ioType || '',
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
          s.value ? `${s.value} ${s.unit}` : 'Letter only — value comes from C&E / datasheet',
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

function ServiceCell({ tag }) {
  return (
    <div>
      <div>{tag.service || <span className="text-slate-400">—</span>}</div>
      {tag.serviceAlt && <div className="text-[11px] text-blue-500">{tag.serviceAlt}</div>}
    </div>
  )
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
