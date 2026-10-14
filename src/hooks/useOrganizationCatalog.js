import { useCallback, useEffect, useState } from 'react'
import { getOrganizationCatalog } from '../services/organizationCatalog.service'

export default function useOrganizationCatalog({ enabled = true } = {}) {
  const [catalog, setCatalog] = useState(null)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const reload = useCallback(() => setRevision(value => value + 1), [])

  useEffect(() => {
    if (!enabled) return undefined
    let active = true
    setLoading(true)
    setError('')
    getOrganizationCatalog()
      .then(data => { if (active) setCatalog(data) })
      .catch(() => { if (active) setError('Organization structure is unavailable. Please retry.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [enabled, revision])

  return { catalog, loading, error, reload }
}
