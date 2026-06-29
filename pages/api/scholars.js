import { getDb, getAdminDb } from '../../lib/api/_db.js'
import { verifySession } from '../../lib/api/_auth.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authUser = await verifySession(req.headers.authorization)
  if (!authUser) return res.status(401).json({ error: 'Unauthorized' })

  const sql = getDb()
  const userRows = await sql`SELECT role FROM users WHERE id = ${authUser.id}`
  if (!userRows.length || userRows[0].role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const adminSql = getAdminDb()

  const [scholars, externalRows, libraryRows, goalRows] = await Promise.all([
    adminSql`
      SELECT
        user_id, scholar_name, language,
        start_date, target_hours, target_date, target_level,
        current_hours, hours_this_week, last_session_at,
        status, expected_hours
      FROM scholar_pace
      ORDER BY status ASC, current_hours DESC
    `,
    adminSql`
      SELECT
        user_id,
        ROUND(SUM(CASE WHEN session_type = 'video_external'       THEN duration_seconds ELSE 0 END)::numeric / 3600, 1) AS video_external_hours,
        ROUND(SUM(CASE WHEN session_type = 'chatgpt_conversation' THEN duration_seconds ELSE 0 END)::numeric / 3600, 1) AS chatgpt_hours,
        ROUND(SUM(CASE WHEN session_type = 'mentor_call'          THEN duration_seconds ELSE 0 END)::numeric / 3600, 1) AS mentor_hours
      FROM external_sessions
      GROUP BY user_id
    `,
    adminSql`
      SELECT user_id,
             ROUND(SUM(seconds_watched)::numeric / 3600, 1) AS library_hours
      FROM watch_sessions
      GROUP BY user_id
    `,
    adminSql`
      SELECT user_id, target_video_hours, target_chatgpt_hours, target_mentor_hours
      FROM scholar_goals
    `,
  ])

  const externalMap = Object.fromEntries(externalRows.map(r => [r.user_id, r]))
  const libraryMap  = Object.fromEntries(libraryRows.map(r => [r.user_id, r]))
  const goalMap     = Object.fromEntries(goalRows.map(r => [r.user_id, r]))

  return res.status(200).json(
    scholars.map(s => {
      const currentHours = Number(s.current_hours ?? 0)
      const expectedHours = Number(s.expected_hours ?? 0)

      const ext = externalMap[s.user_id] || {}
      const lib = libraryMap[s.user_id] || {}
      const goal = goalMap[s.user_id] || {}

      const libraryHours = Number(lib.library_hours ?? 0)
      const videoExternalHours = Number(ext.video_external_hours ?? 0)

      return {
        ...s,
        current_hours: currentHours,
        expected_hours: expectedHours,
        delta: expectedHours - currentHours,
        video_hours: libraryHours + videoExternalHours,
        library_hours: libraryHours,
        video_external_hours: videoExternalHours,
        chatgpt_hours: Number(ext.chatgpt_hours ?? 0),
        mentor_hours: Number(ext.mentor_hours ?? 0),
        target_video_hours:   goal.target_video_hours   != null ? Number(goal.target_video_hours)   : null,
        target_chatgpt_hours: goal.target_chatgpt_hours != null ? Number(goal.target_chatgpt_hours) : null,
        target_mentor_hours:  goal.target_mentor_hours  != null ? Number(goal.target_mentor_hours)  : null,
      }
    })
  )
}
