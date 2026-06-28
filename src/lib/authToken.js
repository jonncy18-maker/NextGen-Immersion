import { authClient } from './auth.js'

// Returns a fresh Neon Auth JWT (EdDSA, ~15 min expiry) for the current
// session, or null if not signed in. This JWT — not the opaque session token —
// is what every backend /api/* function verifies against the JWKS endpoint.
// Used by every authed fetch so there is one source of truth for the token.
export async function getAuthToken() {
  try {
    const { data } = await authClient.token()
    return data?.token ?? null
  } catch {
    return null
  }
}
