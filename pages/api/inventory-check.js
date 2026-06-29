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

  const levels = { super_beginner: 0, beginner: 0, intermediate: 0, advanced: 0 }
  for (const row of rows) {
    if (Object.prototype.hasOwnProperty.call(levels, row.level)) {
      levels[row.level] = row.count
    }
  }

  return res.status(200).json({ levels })
}
