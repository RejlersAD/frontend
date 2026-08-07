/** Public routes must render without waiting for authenticated account checks. */
export const PUBLIC_ROUTE_PATHS = [
  '/',
  '/home',
  '/login',
  '/enquiry',
  '/solutions',
  '/about',
  '/data-governance',
  '/security',
  '/terms-of-service',
  '/privacy-policy',
  '/setup-password',
  '/reset-password',
  '/request-password-reset',
  '/forgot-password',
  '/register',
  '/contact',
  '/contact-us',
]

export const PUBLIC_ROUTE_PREFIXES = [
  '/services/',
  '/finance/approve/',
]

export const isPublicPath = (pathname = '') => (
  PUBLIC_ROUTE_PATHS.includes(pathname)
  || PUBLIC_ROUTE_PREFIXES.some(prefix => pathname.startsWith(prefix))
)
