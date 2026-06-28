import { authClient } from './auth.js'

// Returns a fresh Neon Auth JWT (EdDSA, ~15 min expiry) for the current
// session, or null if not signed in. This JWT — not the opaque session token —
// is what every backend /api/* function verifies against the JWKS endpoint.
// Single source of truth for the token every authed fetch sends. Defensive
// about the SDK's response shape (token() vs the session's access_token).
export async function getAuthToken() {
  try {
    const res = await authClient.token()
    const t = res?.data?.token ?? res?.token ?? null
    if (t) return t
  } catch {
    // fall through to session-based lookup
  }
  try {
    const { data } = await authClient.getSession()
    return data?.session?.access_token ?? data?.session?.token ?? null
  } catch {
    return null
  }
}
