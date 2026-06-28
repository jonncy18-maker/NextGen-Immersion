import { getDb } from "./_db.js"

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return res.status(401).json({ error: 'No token' })

  // Verify session with Neon Auth (Better Auth)
  const authBaseUrl = process.env.NEON_AUTH_BASE_URL
  let authUser
  try {
    const sessionRes = await fetch(`${authBaseUrl}/get-session`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!sessionRes.ok) return res.status(401).json({ error: 'Invalid session' })
    const sessionData = await sessionRes.json()
    authUser = sessionData?.user
    if (!authUser?.id) return res.status(401).json({ error: 'Invalid session' })
  } catch {
    return res.status(401).json({ error: 'Session verification failed' })
  }

  // Fetch role from public.users
  const sql = getDb()
  const rows = await sql`
    SELECT role, display_name, email FROM users WHERE id = ${authUser.id}
  `
  if (rows.length === 0) {
    return res.status(404).json({ error: 'not_provisioned' })
  }
  const { role, display_name, email } = rows[0]
  return res.status(200).json({ role, display_name, email })
}
