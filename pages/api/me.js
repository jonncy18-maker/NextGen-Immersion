import { getDb } from '../../lib/api/_db.js'
import { verifySession } from '../../lib/api/_auth.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authUser = await verifySession(req.headers.authorization)
  if (!authUser) return res.status(401).json({ error: 'Unauthorized' })

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
