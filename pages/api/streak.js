import { getDb } from '../../lib/api/_db.js'
import { verifySession } from '../../lib/api/_auth.js'

// Current + longest consecutive-day streak for a scholar, computed from
// watch_sessions.started_at. A "day" is a calendar day in Asia/Manila (the
// project's program timezone — see CLAUDE.md "Goal clock"). Uses a
// gaps-and-islands approach: number the distinct days in order, subtract the
// row number (in days) from each day — days in the same consecutive run land
// on the same "island" value. The longest island is the longest streak; the
// island ending today-or-yesterday (Manila) is the current streak (0 if the
// most recent watch day is further in the past than yesterday).
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authUser = await verifySession(req.headers.authorization)
  if (!authUser) return res.status(401).json({ error: 'Unauthorized' })

  const sql = getDb()

  const rows = await sql`
    WITH days AS (
      SELECT DISTINCT (started_at AT TIME ZONE 'Asia/Manila')::date AS day
      FROM watch_sessions
      WHERE user_id = ${authUser.id}
    ),
    numbered AS (
      SELECT day, ROW_NUMBER() OVER (ORDER BY day) AS rn
      FROM days
    ),
    islands AS (
      SELECT day, (day - make_interval(days => rn::int))::date AS grp
      FROM numbered
    ),
    streaks AS (
      SELECT grp, COUNT(*)::int AS len, MAX(day) AS end_day
      FROM islands
      GROUP BY grp
    ),
    today AS (
      SELECT (date_trunc('day', now() AT TIME ZONE 'Asia/Manila'))::date AS d
    )
    SELECT
      COALESCE((SELECT MAX(len) FROM streaks), 0) AS longest_streak,
      COALESCE((
        SELECT s.len FROM streaks s, today
        WHERE s.end_day = today.d OR s.end_day = today.d - 1
        ORDER BY s.end_day DESC
        LIMIT 1
      ), 0) AS current_streak
  `

  const row = rows[0] || {}
  // Both columns are plain integer aggregates (COUNT/MAX of ints), but coerce
  // defensively per CLAUDE.md's Neon NUMERIC rule since they arrive through a
  // CTE with COALESCE/subqueries.
  return res.status(200).json({
    current_streak: Number(row.current_streak ?? 0),
    longest_streak: Number(row.longest_streak ?? 0),
  })
}
