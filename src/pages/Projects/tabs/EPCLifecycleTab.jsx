/* eslint-disable react/prop-types */
import React, { useEffect, useState } from 'react'
import { Building2, ClipboardCheck, Layers, RefreshCw } from 'lucide-react'
import * as EPC from '../../../services/epcLifecycle.service'
import EPCSetupPanel from '../components/EPCSetupPanel'
import EPCBaselinePanel from '../components/EPCBaselinePanel'
import EPCExecutionPanel from '../components/EPCExecutionPanel'
import { EPCNotice, epcControlScope, epcError, epcRows } from '../components/EPCLifecycleCommon'
import '../EPCLifecycle.css'

const emptyData = () => ({ setup: null, links: null, requisitions: null, baseline: null, items: null, options: null })
async function loadItems(project, signal) {
  const rows = []
  for (let page = 1; page <= 100; page += 1) {
    const response = await EPC.listWorkItems(project, signal, page)
    rows.push(...epcRows(response))
    if (!response?.next) return rows
  }
  throw new Error('The execution register exceeds the supported page limit. Narrow the project scope before retrying.')
}

export default function EPCLifecycleTab({ project, refreshVersion = 0, onEdit, onProjectUpdated, onSelectView, onOpenSchedule, onOpenDocument }) {
  const [stage, setStage] = useState('setup'), [reloadToken, setReloadToken] = useState(0), [feedback, setFeedback] = useState(''), [selectedId, setSelectedId] = useState(null)
  const [state, setState] = useState({ loading: true, data: emptyData(), errors: [], loadedAt: null })
  const [detail, setDetail] = useState({ id: null, data: null, loading: false, error: '' })
  useEffect(() => {
    let current = true
    const controller = new AbortController()
    setState(previous => ({ ...previous, loading: true, errors: [] }))
    const requests = [['setup', 'Project setup', EPC.getSetup], ['links', 'Activity links', EPC.getLinks], ['requisitions', 'Requisition associations', EPC.getRequisitions], ['baseline', 'Baseline readiness', EPC.getBaselines], ['items', 'Execution register', loadItems], ['options', 'Execution options', EPC.getExecutionOptions]]
    Promise.allSettled(requests.map(([, , get]) => get(project.id, controller.signal))).then(results => {
      if (!current) return
      const data = emptyData(), errors = []
      results.forEach((result, index) => {
        const [key, label] = requests[index]
        if (result.status === 'fulfilled') data[key] = result.value
        else errors.push(`${label}: ${epcError(result.reason)}`)
      })
      setState({ loading: false, data, errors, loadedAt: new Date().toISOString() })
    })
    return () => { current = false; controller.abort() }
  }, [project.id, refreshVersion, reloadToken])
  const items = state.data.items || []
  const controlScope = epcControlScope(project, state.data.setup?.control_scope)
  const activeId = items.find(row => String(row.id) === String(selectedId))?.id || items[0]?.id || null
  useEffect(() => {
    let current = true
    const controller = new AbortController()
    if (!activeId) { setDetail({ id: null, data: null, loading: false, error: '' }); return undefined }
    setDetail(previous => ({ id: activeId, data: previous.id === activeId ? previous.data : null, loading: true, error: '' }))
    EPC.getWorkItem(activeId, controller.signal).then(data => { if (current) setDetail({ id: activeId, data, loading: false, error: '' }) }).catch(error => { if (current) setDetail({ id: activeId, data: null, loading: false, error: epcError(error) }) })
    return () => { current = false; controller.abort() }
  }, [activeId, reloadToken, refreshVersion])
  const reload = () => setReloadToken(value => value + 1)
  const saved = async (message, projectChanged = false, id = null) => {
    setFeedback(message)
    if (id !== null) setSelectedId(id)
    if (projectChanged && onProjectUpdated) await onProjectUpdated()
    reload()
  }
  const stages = [
    { key: 'setup', title: '1. Setup', detail: state.data.setup ? state.data.setup.ready ? 'Master data and phase WBS ready' : 'Complete project master data' : 'Setup not loaded', icon: Building2 },
    { key: 'baseline', title: '2. Baseline & links', detail: state.data.baseline ? `${state.data.baseline.results?.length || 0} integrated baseline captures` : 'Baseline records not loaded', icon: Layers },
    { key: 'execution', title: '3. Execution & acceptance', detail: state.data.items ? `${items.filter(row => row.status === 'accepted').length} accepted / ${items.length} work items` : 'Execution register not loaded', icon: ClipboardCheck },
  ]
  return <div className="epc-workspace"><nav className="epc-stage-nav" aria-label="EPC lifecycle stages">{stages.map(({ key, title, detail, icon: Icon }) => <button type="button" key={key} aria-current={stage === key ? 'step' : undefined} onClick={() => { setStage(key); setFeedback('') }}><Icon aria-hidden="true" /><span><strong>{title}</strong><small>{detail}</small></span></button>)}</nav>
    <div className="epc-toolbar"><p className="epc-note">Project setup → approved baseline and source links → evidence review → accepted activity progress.</p><button type="button" className="pp-button" disabled={state.loading} onClick={reload}><RefreshCw size={15} />Refresh lifecycle</button></div>
    <EPCNotice success>{feedback}</EPCNotice>
    {state.errors.length > 0 && <EPCNotice error><strong>Some lifecycle data could not be loaded.</strong><ul>{state.errors.map(error => <li key={error}>{error}</li>)}</ul><button type="button" className="pp-button" disabled={state.loading} onClick={reload}>Retry lifecycle data</button></EPCNotice>}
    {state.loading && <EPCNotice>Loading EPC lifecycle records…</EPCNotice>}
    {stage === 'setup' && state.data.setup && <EPCSetupPanel key={`${project.id}:${state.loadedAt}`} project={project} data={state.data.setup} onSaved={saved} onEditProject={onEdit} />}
    {stage === 'baseline' && <EPCBaselinePanel project={project} data={state.data.baseline} links={state.data.links} requisitions={state.data.requisitions} controlScope={controlScope} onSaved={saved} onOpenSchedule={onOpenSchedule} onSelectView={onSelectView} />}
    {stage === 'execution' && state.data.items !== null && <EPCExecutionPanel project={project} rows={items} options={state.data.options} controlScope={controlScope} selected={detail.id === activeId ? detail.data : null} loadingDetail={detail.loading} detailError={detail.error} onSelect={setSelectedId} onSaved={saved} onSelectView={onSelectView} onOpenDocument={onOpenDocument} />}
  </div>
}
