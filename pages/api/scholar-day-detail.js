import { getDb, getAdminDb } from '../../lib/api/_db.js'
import { verifySession } from '../../lib/api/_auth.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const authUser = await verifySession(req.headers.authorization)
  if (!authUser) return res.status(401).json({ error: 'Unauthorized' })

  const sql = getDb()
  const userRows = await sql`SELECT role FROM users WHERE id = ${authUser.id}`
  if (!userRows.length) return res.status(403).json({ error: 'Forbidden' })
  const isAdmin = userRows[0].role === 'admin'

  const { userId, date } = req.query
  if (!userId || !date) return res.status(400).json({ error: 'userId and date required' })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date format' })
  }

  // Scholars may only view their own day detail
  if (!isAdmin && userId !== authUser.id) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const querySql = isAdmin ? getAdminDb() : sql
  const adminSql = querySql

  const [watchRows, externalRows] = await Promise.all([
    adminSql`
      SELECT
        ws.id,
        ws.seconds_watched,
        ws.completed,
        ws.started_at,
        v.title   AS video_title,
        v.channel_name,
        v.youtube_id,
        v.level
      FROM watch_sessions ws
      JOIN videos v ON v.id = ws.video_id
      WHERE ws.user_id = ${userId}
        AND (ws.started_at AT TIME ZONE 'Asia/Manila')::date = ${date}::date
      ORDER BY ws.started_at
    `,
    adminSql`
      SELECT id, session_type, duration_seconds, notes
      FROM external_sessions
      WHERE user_id = ${userId}
        AND session_date = ${date}::date
      ORDER BY created_at
    `,
  ])

  return res.status(200).json({
    date,
    watch_sessions: watchRows.map(r => ({
      id:              r.id,
      video_title:     r.video_title,
      channel_name:    r.channel_name,
      youtube_id:      r.youtube_id,
      level:           r.level,
      seconds_watched: r.seconds_watched,
      completed:       r.completed,
    })),
    external_sessions: externalRows.map(r => ({
      id:               r.id,
      session_type:     r.session_type,
      duration_seconds: r.duration_seconds,
      notes:            r.notes || null,
    })),
  })
}
