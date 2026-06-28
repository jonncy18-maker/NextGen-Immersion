/**
 * Verify a Better Auth session token by calling the Neon Auth /get-session endpoint.
 * Returns the Better Auth user object { id, email, name } or null if invalid.
 */
export async function verifySession(authHeader) {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null
  try {
    const res = await fetch(`${process.env.NEON_AUTH_BASE_URL}/get-session`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    const data = await res.json()
    return data?.user?.id ? data.user : null
  } catch {
    return null
  }
}

/**
 * Verify session AND check that the user's role in public.users is 'admin'.
 * Returns { authUser, role } or null if not authenticated / not admin.
 * Uses the regular (non-admin) DB connection for the role lookup.
 */
export async function verifyAdmin(authHeader, sql) {
  const authUser = await verifySession(authHeader)
  if (!authUser) return null
  const rows = await sql`SELECT role FROM users WHERE id = ${authUser.id}`
  if (!rows.length || rows[0].role !== 'admin') return null
  return authUser
}
