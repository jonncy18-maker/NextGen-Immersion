import { getDb } from '../../lib/api/_db.js'
import { verifyAdmin } from '../../lib/api/_auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const sql = getDb()
  const authUser = await verifyAdmin(req.headers.authorization, sql)
  if (!authUser) return res.status(403).json({ error: 'Forbidden' })

  const { videoIds } = req.body
  if (!Array.isArray(videoIds) || videoIds.length === 0) {
    return res.status(400).json({ error: 'videoIds must be a non-empty array' })
  }

  let deleted = 0
  for (const id of videoIds) {
    const result = await sql`
      UPDATE videos
      SET is_available = false, unavailable_since = now()
      WHERE id = ${id} AND is_available = true
    `
    deleted += result.count
  }

  return res.status(200).json({ deleted })
}
