import { getDb } from '../../lib/api/_db.js'
import { verifySession } from '../../lib/api/_auth.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const authUser = await verifySession(req.headers.authorization)
  if (!authUser) return res.status(401).json({ error: 'Unauthorized' })

  const sql = getDb()

  const [dayRows, paceRows] = await Promise.all([
    sql`
      SELECT
        day::text,
        ROUND(SUM(library_hours)::numeric, 2)        AS library_hours,
        ROUND(SUM(video_external_hours)::numeric, 2) AS video_external_hours,
        ROUND(SUM(chatgpt_hours)::numeric, 2)        AS chatgpt_hours,
        ROUND(SUM(mentor_hours)::numeric, 2)         AS mentor_hours
      FROM (
        SELECT
          (started_at AT TIME ZONE 'Asia/Manila')::date AS day,
          SUM(seconds_watched)::numeric / 3600 AS library_hours,
          0::numeric AS video_external_hours,
          0::numeric AS chatgpt_hours,
          0::numeric AS mentor_hours
        FROM watch_sessions
        WHERE user_id = ${authUser.id}
        GROUP BY day
        UNION ALL
        SELECT
          session_date AS day,
          0::numeric AS library_hours,
          SUM(CASE WHEN session_type = 'video_external'       THEN duration_seconds ELSE 0 END)::numeric / 3600 AS video_external_hours,
          SUM(CASE WHEN session_type = 'chatgpt_conversation' THEN duration_seconds ELSE 0 END)::numeric / 3600 AS chatgpt_hours,
          SUM(CASE WHEN session_type = 'mentor_call'          THEN duration_seconds ELSE 0 END)::numeric / 3600 AS mentor_hours
        FROM external_sessions
        WHERE user_id = ${authUser.id}
        GROUP BY day
      ) combined
      GROUP BY day
      ORDER BY day
    `,
    sql`
      SELECT
        start_date::text AS start_date,
        target_hours,
        target_date::text AS target_date
      FROM scholar_pace
      WHERE user_id = ${authUser.id}
    `,
  ])

  const pace = paceRows[0] || {}

  return res.status(200).json({
    days: dayRows.map(r => {
      const lib  = Number(r.library_hours        ?? 0)
      const vext = Number(r.video_external_hours ?? 0)
      const cgt  = Number(r.chatgpt_hours        ?? 0)
      const men  = Number(r.mentor_hours         ?? 0)
      return {
        date: r.day,
        hours: Math.round((lib + vext + cgt + men) * 100) / 100,
        library_hours:        lib,
        video_external_hours: vext,
        chatgpt_hours:        cgt,
        mentor_hours:         men,
      }
    }),
    start_date:   pace.start_date || null,
    target_hours: pace.target_hours != null ? Number(pace.target_hours) : null,
    target_date:  pace.target_date || null,
  })
}
