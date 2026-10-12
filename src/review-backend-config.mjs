export const REVIEW_PROJECT_ID = 'snlklhpebjlrebkqsxyi'

// Shared by the Vite build and client: errors never include the configured value.
export function requireReviewBrowserKey(browserKey) {
  if (!browserKey) throw new Error('Review backend configuration is missing')
  let claims
  try {
    const parts = browserKey.split('.')
    if (parts.length !== 3) throw new Error('Invalid browser key')
    claims = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
  } catch {
    throw new Error('Review backend requires its browser-safe anon JWT')
  }
  if (claims?.role !== 'anon' || claims?.ref !== REVIEW_PROJECT_ID) {
    throw new Error('Review backend key must be anon and match P2P-Simulation')
  }
  return browserKey
}
