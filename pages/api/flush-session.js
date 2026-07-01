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

  const {
    videoId, clientFlushId, secondsWatched, completed, startedAt, endedAt,
    language = 'english', positionSeconds,
  } = body || {}

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

  // position_seconds is distinct from seconds_watched: it's the absolute
  // playback timestamp at pause/stop (for resume), not seconds actively
  // watched (for hours). A completed video (>=95% single session) has nothing
  // to resume, so its position row is deleted rather than upserted.
  if (completed) {
    await sql`
      DELETE FROM video_resume_positions WHERE user_id = ${authUser.id} AND video_id = ${videoId}
    `
  } else if (typeof positionSeconds === 'number' && positionSeconds >= 0) {
    await sql`
      INSERT INTO video_resume_positions (user_id, video_id, position_seconds, updated_at)
      VALUES (${authUser.id}, ${videoId}, ${Math.floor(positionSeconds)}, now())
      ON CONFLICT (user_id, video_id)
      DO UPDATE SET position_seconds = EXCLUDED.position_seconds, updated_at = now()
    `
  }

  return res.status(200).json({ ok: true })
}
