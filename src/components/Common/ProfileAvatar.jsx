import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import useAuthenticatedPhoto from '../../hooks/useAuthenticatedPhoto'

const initialsOf = (name) => String(name || '?')
  .trim()
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0])
  .join('')
  .toUpperCase() || '?'

/** Consistent initials fallback with an authenticated retry for expired storage URLs. */
export default function ProfileAvatar({
  name,
  photoUrl,
  profileId,
  photoEndpoint,
  className = '',
  imageClassName = 'h-full w-full object-cover',
  fallbackClassName = '',
  alt = '',
  retryMissingPhoto = false,
}) {
  const [failedUrl, setFailedUrl] = useState('')
  const [forceRefresh, setForceRefresh] = useState(false)
  const source = String(photoUrl || '').trim()
  const shouldRetry = forceRefresh || (Boolean(source) && failedUrl === source) || (!source && retryMissingPhoto)
  const retryUrl = useAuthenticatedPhoto(
    shouldRetry && (photoEndpoint || profileId)
      ? (photoEndpoint || `/rbac/users/${profileId}/profile-photo/`)
      : null,
    `${profileId || ''}:${source}:${forceRefresh}`,
  )

  useEffect(() => {
    setFailedUrl('')
    setForceRefresh(false)
  }, [source, profileId])
  useEffect(() => {
    if (!profileId) return undefined
    const refreshUpdatedPhoto = (event) => {
      const updatedProfileId = event.detail?.profileId
      if (updatedProfileId && String(updatedProfileId) === String(profileId)) setForceRefresh(true)
    }
    window.addEventListener('radai:profile-photo-changed', refreshUpdatedPhoto)
    return () => window.removeEventListener('radai:profile-photo-changed', refreshUpdatedPhoto)
  }, [profileId])

  const image = shouldRetry ? retryUrl : source
  return (
    <span
      role="img"
      aria-label={alt || `${name || 'User'} profile picture`}
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden ${className}`}
    >
      {image ? (
        <img
          key={image}
          src={image}
          alt={alt}
          className={imageClassName}
          loading="lazy"
          decoding="async"
          onError={() => setFailedUrl(source)}
        />
      ) : (
        <span aria-hidden="true" className={fallbackClassName}>{initialsOf(name)}</span>
      )}
    </span>
  )
}

ProfileAvatar.propTypes = {
  name: PropTypes.string,
  photoUrl: PropTypes.string,
  profileId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  photoEndpoint: PropTypes.string,
  className: PropTypes.string,
  imageClassName: PropTypes.string,
  fallbackClassName: PropTypes.string,
  alt: PropTypes.string,
  retryMissingPhoto: PropTypes.bool,
}
