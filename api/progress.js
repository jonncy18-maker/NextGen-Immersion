import { getDb } from "./_db.js"
import { verifySession } from "./_auth.js"

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authUser = await verifySession(req.headers.authorization)
  if (!authUser) return res.status(401).json({ error: 'Unauthorized' })

  const sql = getDb()

  const rows = await sql`
    SELECT
      user_id, scholar_name, language,
      start_date, target_hours, target_date, target_level,
      current_hours, hours_this_week, last_session_at,
      status, expected_hours
    FROM scholar_pace
    WHERE user_id = ${authUser.id}
  `

  if (rows.length === 0) {
    // Scholar exists but has no goal assignment yet
    return res.status(200).json({
      current_hours: 0,
      hours_this_week: 0,
      status: 'PENDING',
      expected_hours: 0,
      target_hours: null,
      target_date: null,
      target_level: null,
      start_date: null,
      last_session_at: null,
    })
  }

  return res.status(200).json(rows[0])
}
