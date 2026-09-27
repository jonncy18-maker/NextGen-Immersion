import { jwtVerify, createRemoteJWKSet } from "jose"
import { getAdminDb } from "./_db.js"

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

// The MCP server (app/api/mcp) is a single always-on connector, not a
// per-scholar login — so it authenticates to THIS app's own routes with one
// shared secret instead of a Neon Auth JWT. A bare `Bearer <secret>` resolves
// to a real admin row (so routes that manually inline `role !== 'admin'`
// keep working unmodified); `Bearer <secret>:<userId>` impersonates that
// scholar for the handful of routes with no admin/cross-scholar variant
// (mark-video, watch-later, next-video, ...) — this is how the MCP acts "as"
// a scholar for those, the exact same way an admin manually driving the UI
// on a scholar's behalf would have to be that scholar. Never exposed
// externally: the MCP transport's own bearer gate (lib/mcp-server.js) only
// ever accepts the bare secret from an external client — this format is
// constructed server-side, inside lib/mcp-tools.js, for the internal
// same-origin fetch back into these routes.
function parseMcpToken(token) {
  const secret = process.env.IMMERSION_MCP_TOKEN
  if (!secret || !token) return null
  if (token === secret) return { userId: null }
  const prefix = `${secret}:`
  if (token.startsWith(prefix)) {
    const userId = token.slice(prefix.length)
    return userId ? { userId } : null
  }
  return null
}

/**
 * Verify a Neon Auth JWT from an Authorization header, OR the MCP server's
 * own shared secret (see parseMcpToken above).
 * Returns { id, email, name } (id = JWT `sub` = users.id) or null if invalid.
 */
export async function verifySession(authHeader) {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null

  const mcp = parseMcpToken(token)
  if (mcp) {
    if (mcp.userId) return { id: mcp.userId, email: null, name: null, mcp: true }
    const [row] = await getAdminDb()`
      SELECT id, email, display_name AS name FROM users
      WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1
    `
    return row ? { ...row, mcp: true } : null
  }

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
