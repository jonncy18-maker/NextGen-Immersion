import { getDb, getAdminDb } from '../../lib/api/_db.js'
import { verifySession } from '../../lib/api/_auth.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const authUser = await verifySession(req.headers.authorization)
  if (!authUser) return res.status(401).json({ error: 'Unauthorized' })

  const sql = getDb()
  const userRows = await sql`SELECT role FROM users WHERE id = ${authUser.id}`
  if (!userRows.length || userRows[0].role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const { userId } = req.query
  if (!userId) return res.status(400).json({ error: 'userId required' })

  const adminSql = getAdminDb()

  const [dayRows, paceRows] = await Promise.all([
    adminSql`
      SELECT day::text, ROUND(SUM(hours)::numeric, 2) AS hours
      FROM (
        SELECT
          (started_at AT TIME ZONE 'Asia/Manila')::date AS day,
          SUM(seconds_watched)::numeric / 3600 AS hours
        FROM watch_sessions
        WHERE user_id = ${userId}
          AND started_at >= (now() AT TIME ZONE 'Asia/Manila') - interval '4 months'
        GROUP BY day
        UNION ALL
        SELECT
          session_date AS day,
          SUM(duration_seconds)::numeric / 3600 AS hours
        FROM external_sessions
        WHERE user_id = ${userId}
          AND session_date >= CURRENT_DATE - 120
        GROUP BY day
      ) combined
      GROUP BY day
      ORDER BY day
    `,
    adminSql`
      SELECT
        start_date::text AS start_date,
        target_hours,
        target_date::text AS target_date
      FROM scholar_pace
      WHERE user_id = ${userId}
    `,
  ])

  const pace = paceRows[0] || {}

  return res.status(200).json({
    days: dayRows.map(r => ({
      date: r.day,
      hours: Number(r.hours ?? 0),
    })),
    start_date: pace.start_date || null,
    target_hours: pace.target_hours != null ? Number(pace.target_hours) : null,
    target_date: pace.target_date || null,
  })
}
