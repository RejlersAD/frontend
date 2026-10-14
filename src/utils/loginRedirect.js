export const safeLoginReturnPath = value => {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return null
  try {
    const parsed = new URL(value, 'https://radai.invalid')
    if (parsed.origin !== 'https://radai.invalid' || parsed.pathname === '/login') return null
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch { return null }
}
