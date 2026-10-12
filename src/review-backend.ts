// The external review surface uses the existing synthetic P2P-Simulation backend.
// Vercel supplies browser-safe configuration without copying credentials into source.
const backendUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const browserKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const expectedHost = 'snlklhpebjlrebkqsxyi.supabase.co'

if (!backendUrl || !browserKey) {
  throw new Error('Review backend configuration is missing')
}
const parsedUrl = new URL(backendUrl)
if (parsedUrl.protocol !== 'https:' || parsedUrl.hostname !== expectedHost ||
    parsedUrl.username || parsedUrl.password || parsedUrl.search || parsedUrl.hash ||
    (parsedUrl.pathname !== '/' && parsedUrl.pathname !== '')) {
  throw new Error('Review backend must be the registered P2P-Simulation project')
}

// The existing Edge Function verifies legacy JWTs. Reject privileged or mismatched keys.
let keyClaims: { role?: string; ref?: string }
try {
  const parts = browserKey.split('.')
  if (parts.length !== 3) throw new Error('Invalid browser key')
  keyClaims = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
} catch {
  throw new Error('Review backend requires its browser-safe anon JWT')
}
if (keyClaims.role !== 'anon' || keyClaims.ref !== 'snlklhpebjlrebkqsxyi') {
  throw new Error('Review backend key must be anon and match P2P-Simulation')
}

export const projectId = 'snlklhpebjlrebkqsxyi'
export const publicAnonKey = browserKey
