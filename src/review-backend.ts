// The external review surface uses the existing synthetic P2P-Simulation backend.
// Vercel supplies browser-safe configuration without copying credentials into source.
const browserKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!browserKey) {
  throw new Error('Review backend configuration is missing')
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
