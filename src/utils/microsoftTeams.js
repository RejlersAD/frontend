const REJLERS_EMAIL_PATTERN = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@rejlers\.ae$/i

export const normalizeRejlersEmail = (value) => String(value || '').trim().toLowerCase()

export const isValidRejlersEmail = (value) => REJLERS_EMAIL_PATTERN.test(normalizeRejlersEmail(value))

/**
 * Open the installed Microsoft Teams desktop client directly for an audio call.
 * Teams resolves the Rejlers email as the employee's Microsoft Entra UPN.
 */
export const microsoftTeamsAudioCallUrl = (email) => {
  const normalizedEmail = normalizeRejlersEmail(email)
  if (!isValidRejlersEmail(normalizedEmail)) return null
  return `msteams:/l/call/0/0?users=${encodeURIComponent(normalizedEmail)}&source=radai`
}

