import { getDb, getAdminDb } from '../../lib/api/_db.js'
import { verifySession } from '../../lib/api/_auth.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authUser = await verifySession(req.headers.authorization)
  if (!authUser) return res.status(401).json({ error: 'Unauthorized' })

  // Verify admin role using regular connection
  const sql = getDb()
  const userRows = await sql`SELECT role FROM users WHERE id = ${authUser.id}`
  if (!userRows.length || userRows[0].role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' })
  }

  // Use admin (service-role) connection for cross-scholar reads
  const adminSql = getAdminDb()
  const scholars = await adminSql`
    SELECT
      user_id, scholar_name, language,
      start_date, target_hours, target_date, target_level,
      current_hours, hours_this_week, last_session_at,
      status, expected_hours
    FROM scholar_pace
    ORDER BY status ASC, current_hours DESC
  `

  return res.status(200).json(scholars)
}
