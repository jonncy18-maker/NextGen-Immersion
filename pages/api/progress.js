import { getDb } from '../../lib/api/_db.js'
import { verifySession } from '../../lib/api/_auth.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authUser = await verifySession(req.headers.authorization)
  if (!authUser) return res.status(401).json({ error: 'Unauthorized' })

  const sql = getDb()

  const [rows, videoRows, externalRows] = await Promise.all([
    sql`
      SELECT
        user_id, scholar_name, language,
        start_date, target_hours, target_date, target_level,
        current_hours, hours_this_week, last_session_at,
        status, expected_hours
      FROM scholar_pace
      WHERE user_id = ${authUser.id}
    `,
    sql`
      SELECT ROUND(SUM(seconds_watched)::numeric / 3600, 1) AS video_hours_this_week
      FROM watch_sessions
      WHERE user_id = ${authUser.id}
        AND (started_at AT TIME ZONE 'Asia/Manila')
            >= date_trunc('week', now() AT TIME ZONE 'Asia/Manila')
    `,
    sql`
      SELECT ROUND(SUM(duration_seconds)::numeric / 3600, 1) AS external_hours_this_week
      FROM external_sessions
      WHERE user_id = ${authUser.id}
        AND (session_date::timestamptz AT TIME ZONE 'Asia/Manila')
            >= date_trunc('week', now() AT TIME ZONE 'Asia/Manila')
    `,
  ])

  const videoHours = Number(videoRows[0]?.video_hours_this_week ?? 0)
  const externalHours = Number(externalRows[0]?.external_hours_this_week ?? 0)

  if (rows.length === 0) {
    return res.status(200).json({
      user_id: authUser.id,
      current_hours: 0,
      hours_this_week: 0,
      video_hours_this_week: 0,
      external_hours_this_week: 0,
      status: 'PENDING',
      expected_hours: 0,
      target_hours: null,
      target_date: null,
      target_level: null,
      start_date: null,
      last_session_at: null,
    })
  }

  const row = rows[0]
  const currentHours = Number(row.current_hours ?? 0)
  const expectedHours = Number(row.expected_hours ?? 0)
  return res.status(200).json({
    ...row,
    user_id: authUser.id,
    current_hours: currentHours,
    hours_this_week: Number(row.hours_this_week ?? 0),
    expected_hours: expectedHours,
    delta: expectedHours - currentHours,
    video_hours_this_week: videoHours,
    external_hours_this_week: externalHours,
  })
}
