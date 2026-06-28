import { jwtVerify, createRemoteJWKSet } from "jose"

/**
 * Neon Auth (Better Auth) sessions are HTTP-only cookies on the auth-server
 * domain. For a cross-domain backend (this app on Vercel, auth on neon.tech),
 * the documented verification path is the JWT plugin: the browser sends a
 * short-lived EdDSA JWT as a Bearer token, and we verify its signature against
 * the auth server's JWKS endpoint. The opaque session token is NOT accepted —
 * there is no server-side "verify session token" endpoint.
 *
 * https://neon.com/docs/auth/guides/plugins/jwt
 */

// Cache the remote JWKS across invocations (createRemoteJWKSet handles its own
// fetch + key caching). Lazily built so a missing env var fails per-request
// rather than at module load.
let _jwks = null
function getJwks() {
  if (!_jwks) {
    _jwks = createRemoteJWKSet(
      new URL(`${process.env.NEON_AUTH_BASE_URL}/.well-known/jwks.json`),
    )
  }
  return _jwks
}

/**
 * Verify a Neon Auth JWT from an Authorization header.
 * Returns { id, email, name } (id = JWT `sub` = users.id) or null if invalid.
 */
export async function verifySession(authHeader) {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null

  const baseUrl = process.env.NEON_AUTH_BASE_URL
  if (!baseUrl) {
    console.error('verifySession: NEON_AUTH_BASE_URL is not set')
    return null
  }

  try {
    const { payload } = await jwtVerify(token, getJwks(), {
      issuer: new URL(baseUrl).origin,
    })
    if (!payload?.sub) return null
    return { id: payload.sub, email: payload.email, name: payload.name }
  } catch (err) {
    console.error('verifySession: JWT verification failed:', err?.message)
    return null
  }
}

/**
 * Verify session AND check that the user's role in public.users is 'admin'.
 * Returns the auth user or null if not authenticated / not admin.
 * Uses the regular (non-admin) DB connection for the role lookup.
 */
export async function verifyAdmin(authHeader, sql) {
  const authUser = await verifySession(authHeader)
  if (!authUser) return null
  const rows = await sql`SELECT role FROM users WHERE id = ${authUser.id}`
  if (!rows.length || rows[0].role !== 'admin') return null
  return authUser
}
