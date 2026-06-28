import { getDb } from "./_db.js"
import { verifySession } from "./_auth.js"

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Parse body first — sendBeacon sends text/plain, fetch sends application/json
  let body = req.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { return res.status(400).json({ error: 'Invalid body' }) }
  }

  // sendBeacon cannot set Authorization headers — fall back to _token in body
  const authHeader = req.headers.authorization || (body?._token ? `Bearer ${body._token}` : null)
  const authUser = await verifySession(authHeader)
  if (!authUser) return res.status(401).json({ error: 'Unauthorized' })

  const { videoId, clientFlushId, secondsWatched, completed, startedAt, endedAt, language = 'english' } = body || {}

  if (!videoId || !clientFlushId || typeof secondsWatched !== 'number') {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  // Minimum flush filter — ignore accidental clicks
  if (secondsWatched < 10) {
    return res.status(200).json({ skipped: true, reason: 'below_minimum' })
  }

  const sql = getDb()

  await sql`
    INSERT INTO watch_sessions
      (user_id, video_id, client_flush_id, seconds_watched, completed, language, started_at, ended_at)
    VALUES
      (${authUser.id}, ${videoId}, ${clientFlushId}, ${secondsWatched}, ${!!completed},
       ${language}, ${startedAt || new Date().toISOString()}, ${endedAt || null})
    ON CONFLICT (client_flush_id) DO NOTHING
  `

  return res.status(200).json({ ok: true })
}
