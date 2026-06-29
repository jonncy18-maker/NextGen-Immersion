import { authClient } from './auth.js'

// Returns a fresh Neon Auth JWT (EdDSA, ~15 min expiry) for the current
// session, or null if not signed in. This JWT — not the opaque session token —
// is what every backend /api/* function verifies against the JWKS endpoint.
//
// Same-origin model: the JWT is minted by the Better Auth JWT plugin's /token
// endpoint from the first-party session cookie. We fetch it directly because
// the same-origin proxy doesn't surface the `set-auth-jwt` response header the
// client SDK normally caches into session.token — so the SDK's token()/session
// fall back to the OPAQUE session token, which fails JWKS verification with
// "Invalid Compact JWS". A direct GET /api/auth/token returns a real JWT.
export async function getAuthToken() {
  // Primary: mint a JWT from the first-party cookie via the same-origin proxy.
  try {
    const res = await fetch('/api/auth/token', {
      credentials: 'include',
      headers: { accept: 'application/json' },
    })
    if (res.ok) {
      const data = await res.json().catch(() => null)
      if (data?.token) return data.token
    }
  } catch {
    // fall through
  }
  // Fallback: SDK token() (this is what works in the direct-to-Neon SPA model).
  try {
    const res = await authClient.token()
    const t = res?.data?.token ?? res?.token ?? null
    if (t) return t
  } catch {
    // ignore
  }
  return null
}
