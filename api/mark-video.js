import { getDb } from './_db.js'
import { verifySession } from './_auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authUser = await verifySession(req.headers.authorization)
  if (!authUser) return res.status(401).json({ error: 'Unauthorized' })

  let body = req.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { return res.status(400).json({ error: 'Invalid body' }) }
  }

  const { videoId, watched } = body || {}
  if (!videoId || typeof watched !== 'boolean') {
    return res.status(400).json({ error: 'videoId and boolean watched required' })
  }

  const sql = getDb()
  await sql`
    INSERT INTO video_marks (user_id, video_id, watched, updated_at)
    VALUES (${authUser.id}, ${videoId}, ${watched}, now())
    ON CONFLICT (user_id, video_id)
    DO UPDATE SET watched = EXCLUDED.watched, updated_at = now()
  `

  return res.status(200).json({ ok: true, videoId, watched })
}
