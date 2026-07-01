import { getDb } from '../../lib/api/_db.js'
import { verifySession } from '../../lib/api/_auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authUser = await verifySession(req.headers.authorization)
  if (!authUser) return res.status(401).json({ error: 'Unauthorized' })

  // Parse body — sendBeacon sends text/plain, fetch sends application/json
  let body = req.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { return res.status(400).json({ error: 'Invalid body' }) }
  }

  const { videoId, clientFlushId, secondsWatched, completed, startedAt, endedAt, language = 'english' } = body || {}

  if (!videoId || !clientFlushId || typeof secondsWatched !== 'number') {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  // Minimum flush filter — ignore accidental clicks
  if (secondsWatched < 10) {
    return res.status(200).json({ skipped: true, reason: 'below_minimum' })
  }

  const sql = getDb()

  // Cap seconds_watched at the video's own duration (plus buffering slack) so a
  // single session can't inflate cumulative hours past what the video allows.
  const FALLBACK_MAX_SECONDS = 4 * 3600
  const BUFFER_SECONDS = 60
  const [video] = await sql`SELECT duration_seconds FROM videos WHERE id = ${videoId}`
  if (!video) return res.status(404).json({ error: 'Video not found' })
  const maxSeconds = video.duration_seconds
    ? video.duration_seconds + BUFFER_SECONDS
    : FALLBACK_MAX_SECONDS
  const cappedSecondsWatched = Math.min(secondsWatched, maxSeconds)

  await sql`
    INSERT INTO watch_sessions
      (user_id, video_id, client_flush_id, seconds_watched, completed, language, started_at, ended_at)
    VALUES
      (${authUser.id}, ${videoId}, ${clientFlushId}, ${cappedSecondsWatched}, ${!!completed},
       ${language}, ${startedAt || new Date().toISOString()}, ${endedAt || null})
    ON CONFLICT (client_flush_id) DO NOTHING
  `

  return res.status(200).json({ ok: true })
}
