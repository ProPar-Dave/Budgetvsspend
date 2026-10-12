export const REVIEW_PROJECT_ID = 'snlklhpebjlrebkqsxyi'

// Shared by the Vite build and client: errors never include the configured value.
export function requireReviewBrowserKey(browserKey) {
  if (!browserKey) throw new Error('Review backend configuration is missing')
  let claims
  try {
    const parts = browserKey.split('.')
    if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) {
      throw new Error('Invalid browser key')
    }
    const decode = part => atob(part.replace(/-/g, '+').replace(/_/g, '/'))
    const header = JSON.parse(decode(parts[0]))
    // Legacy Supabase anon keys use HS256; the backend verifies the signature.
    if (header?.alg !== 'HS256' || header?.typ !== 'JWT' || decode(parts[2]).length !== 32) {
      throw new Error('Invalid legacy JWT structure')
    }
    claims = JSON.parse(decode(parts[1]))
  } catch {
    throw new Error('Review backend requires its browser-safe anon JWT')
  }
  if (claims?.role !== 'anon' || claims?.ref !== REVIEW_PROJECT_ID) {
    throw new Error('Review backend key must be anon and match P2P-Simulation')
  }
  return browserKey
}
