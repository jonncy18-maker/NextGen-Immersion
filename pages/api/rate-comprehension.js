import { getDb } from '../../lib/api/_db.js'
import { verifySession } from '../../lib/api/_auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authUser = await verifySession(req.headers.authorization)
  if (!authUser) return res.status(401).json({ error: 'Unauthorized' })

  const { videoId, rating } = req.body || {}
  if (!videoId || typeof rating !== 'number' || rating < 1 || rating > 3) {
    return res.status(400).json({ error: 'videoId and rating (1–3) required' })
  }

  const sql = getDb()
  try {
    await sql`
      INSERT INTO comprehension_ratings (user_id, video_id, rating)
      VALUES (${authUser.id}, ${videoId}, ${rating})
    `
    return res.status(200).json({ ok: true })
  } catch {
    return res.status(500).json({ error: 'Database error' })
  }
}
