import { getDb } from '../../lib/api/_db.js'
import { verifyAdmin } from '../../lib/api/_auth.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const sql = getDb()
  const authUser = await verifyAdmin(req.headers.authorization, sql)
  if (!authUser) return res.status(403).json({ error: 'Forbidden' })

  const rows = await sql`
    SELECT level, COUNT(*)::int AS count
    FROM videos
    WHERE is_available = true
    GROUP BY level
  `

  const levels = { a1: 0, a2: 0, b1: 0, b2: 0, c1: 0, c2: 0 }
  for (const row of rows) {
    if (Object.prototype.hasOwnProperty.call(levels, row.level)) {
      levels[row.level] = row.count
    }
  }

  return res.status(200).json({ levels })
}
