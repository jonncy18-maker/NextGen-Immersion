import { getDb } from '../../lib/api/_db.js'
import { verifySession } from '../../lib/api/_auth.js'

// Personal scholar bookmarking — no admin cross-scholar view. JWT-scoped to
// authUser.id on every query; client-supplied user ids are never trusted.
//
// GET             -> { items: [...] }  saved videos, newest first
// POST { videoId } -> { ok, videoId }  idempotent add
// DELETE { videoId } -> { ok, videoId }

export default async function handler(req, res) {
  const authUser = await verifySession(req.headers.authorization)
  if (!authUser) return res.status(401).json({ error: 'Unauthorized' })

  const sql = getDb()

  if (req.method === 'GET') {
    const items = await sql`
      SELECT v.id, v.youtube_id, v.title, v.channel_name, v.duration_seconds,
             v.level, v.topic_primary, v.topic_secondary, v.thumbnail_url, v.oet_relevance,
             COALESCE(vm.watched, uvs.completed, false) AS watched,
             wl.added_at,
             vrp.position_seconds AS resume_position_seconds
      FROM watch_later wl
      JOIN videos v ON v.id = wl.video_id
      LEFT JOIN user_video_status uvs
        ON uvs.video_id = v.id AND uvs.user_id = ${authUser.id}
      LEFT JOIN video_marks vm
        ON vm.video_id = v.id AND vm.user_id = ${authUser.id}
      LEFT JOIN video_resume_positions vrp
        ON vrp.video_id = v.id AND vrp.user_id = ${authUser.id}
      WHERE wl.user_id = ${authUser.id}
      ORDER BY wl.added_at DESC
    `
    return res.status(200).json({ items })
  }

  if (req.method === 'POST' || req.method === 'DELETE') {
    let body = req.body
    if (typeof body === 'string') {
      try { body = JSON.parse(body) } catch { return res.status(400).json({ error: 'Invalid body' }) }
    }
    const { videoId } = body || {}
    if (!videoId) return res.status(400).json({ error: 'videoId required' })

    if (req.method === 'POST') {
      await sql`
        INSERT INTO watch_later (user_id, video_id)
        VALUES (${authUser.id}, ${videoId})
        ON CONFLICT (user_id, video_id) DO NOTHING
      `
    } else {
      await sql`
        DELETE FROM watch_later WHERE user_id = ${authUser.id} AND video_id = ${videoId}
      `
    }
    return res.status(200).json({ ok: true, videoId })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
