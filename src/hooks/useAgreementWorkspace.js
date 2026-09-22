import { useCallback, useEffect, useRef, useState } from 'react'
import { agreementError, agreementWorkspaceService as api } from '../services/agreementWorkspace.service'

const active = job => ['queued', 'running'].includes(job?.status)
const isCancelled = error => error?.name === 'CanceledError' || error?.name === 'AbortError' || error?.code === 'ERR_CANCELED'
const belongsTo = (data, id) => data && String(data.enterprise_project_id) === String(id)

// Read the durable server workspace to resume a background run after navigation.
// Failed POSTs are never retried implicitly: checking progress is always a GET.
export default function useAgreementWorkspace(projectId, onAccepted) {
  const [state, setState] = useState({ projectId, data: null, loading: false, error: '', busy: '' })
  const [refresh, setRefresh] = useState(0)
  const generation = useRef(0)
  const mutation = useRef(null)
  const alive = useRef(true)
  const accepted = useRef(onAccepted)
  accepted.current = onAccepted
  const reload = useCallback(() => setRefresh(value => value + 1), [])
  const current = String(state.projectId) === String(projectId) ? state : { projectId, data: null, loading: Boolean(projectId), error: '', busy: '' }

  useEffect(() => {
    alive.current = true
    return () => { alive.current = false; mutation.current?.abort() }
  }, [])

  useEffect(() => {
    const revision = ++generation.current
    mutation.current?.abort()
    mutation.current = null
    if (!projectId) { setState({ projectId, data: null, loading: false, error: '', busy: '' }); return undefined }
    const controller = new AbortController()
    let timer
    let disposed = false
    setState(previous => ({ projectId, data: String(previous.projectId) === String(projectId) ? previous.data : null, loading: true, error: '', busy: '' }))
    const read = async () => {
      try {
        const data = await api.get(projectId, controller.signal)
        if (disposed || revision !== generation.current) return
        if (!belongsTo(data, projectId)) throw new Error('The agreement response belongs to a different project. Reload this workspace.')
        setState(previous => ({ ...previous, projectId, data, loading: false, error: '' }))
        if (active(data.active_job)) timer = window.setTimeout(read, 1500)
      } catch (error) {
        if (!disposed && !isCancelled(error) && revision === generation.current) setState(previous => ({ ...previous, loading: false, error: agreementError(error) }))
      }
    }
    read()
    return () => { disposed = true; controller.abort(); window.clearTimeout(timer) }
  }, [projectId, refresh])

  const run = useCallback(async (kind, action) => {
    if (!projectId || mutation.current || current.loading || active(current.data?.active_job)) return false
    const controller = new AbortController()
    const revision = generation.current
    mutation.current = controller
    setState(previous => ({ ...previous, busy: kind, error: '' }))
    try {
      await action(controller.signal)
      if (!alive.current || controller.signal.aborted || revision !== generation.current) return false
      if (kind === 'accept') accepted.current?.()
      reload()
      return true
    } catch (error) {
      if (!isCancelled(error) && alive.current && revision === generation.current) setState(previous => ({ ...previous, error: `${agreementError(error)} Check progress before trying again.` }))
      return false
    } finally {
      if (mutation.current === controller) mutation.current = null
      if (alive.current && revision === generation.current) setState(previous => ({ ...previous, busy: '' }))
    }
  }, [projectId, current.loading, current.data?.active_job, reload])

  return {
    ...current, reload,
    running: active(current.data?.active_job),
    analyze: (file, requestId) => run('analyze', signal => api.analyze(projectId, file, requestId, signal)),
    accept: selection => current.data?.workspace ? run('accept', signal => api.accept(projectId, current.data.workspace, selection, signal)) : Promise.resolve(false),
  }
}
