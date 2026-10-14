import { useEffect, useState } from 'react'
import apiClient from '../services/api.service'

export default function useAuthenticatedPhoto(endpoint, version) {
  const [photo, setPhoto] = useState(null)
  useEffect(() => {
    if (!endpoint) {
      setPhoto(null)
      return undefined
    }

    let active = true
    let objectUrl = null
    let loading = false
    let refreshQueued = false
    setPhoto(null)

    const refreshPhoto = async () => {
      if (!active || document.visibilityState === 'hidden') return
      if (loading) {
        refreshQueued = true
        return
      }
      loading = true
      try {
        const response = await apiClient.get(endpoint, {
          responseType: 'blob',
          silentTimeout: true,
        })
        if (!active || !response?.data || !String(response.data.type || '').startsWith('image/')) return
        const previousUrl = objectUrl
        objectUrl = URL.createObjectURL(response.data)
        setPhoto(objectUrl)
        if (previousUrl) URL.revokeObjectURL(previousUrl)
      } catch {
        // Retain the current photo during transient network failures.
      } finally {
        loading = false
        if (active && refreshQueued) {
          refreshQueued = false
          refreshPhoto()
        }
      }
    }
    refreshPhoto()
    window.addEventListener('focus', refreshPhoto)
    window.addEventListener('radai:profile-photo-changed', refreshPhoto)
    document.addEventListener('visibilitychange', refreshPhoto)

    return () => {
      active = false
      window.removeEventListener('focus', refreshPhoto)
      window.removeEventListener('radai:profile-photo-changed', refreshPhoto)
      document.removeEventListener('visibilitychange', refreshPhoto)
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }

  }, [endpoint, version])

  return photo
}
