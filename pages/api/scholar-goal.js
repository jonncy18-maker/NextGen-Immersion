import { getDb, getAdminDb } from '../../lib/api/_db.js'
import { verifySession } from '../../lib/api/_auth.js'

// Admin-only. Sets (or clears) a scholar's goal-clock start_date.
//
// start_date drives the entire pace calculation (scholar_pace view):
//   NULL or future → PENDING (no pace calc)
//   past           → active ON_TRACK / AT_RISK calculation
//
// Upserts the scholar_goals row, linking it to the active program goal for the
// scholar's language. A program goal must exist first — provisioning normally
// creates the row, but this endpoint also creates it so an admin can start the
// clock for a SQL-seeded scholar (e.g. Claire) who has no scholar_goals row yet.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authUser = await verifySession(req.headers.authorization)
  if (!authUser) return res.status(401).json({ error: 'Unauthorized' })

  const sql = getDb()
  const me = await sql`SELECT role FROM users WHERE id = ${authUser.id}`
  if (!me.length || me[0].role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const { userId, startDate } = req.body || {}
  if (!userId) return res.status(400).json({ error: 'userId required' })

  let start = null
  if (startDate) {
    if (Number.isNaN(Date.parse(startDate))) {
      return res.status(400).json({ error: 'Invalid start date' })
    }
    start = startDate
  }

  const adminSql = getAdminDb()

  const target = await adminSql`
    SELECT id, role, language FROM users WHERE id = ${userId}
  `
  if (!target.length) return res.status(404).json({ error: 'Scholar not found' })
  if (target[0].role !== 'scholar') {
    return res.status(400).json({ error: 'User is not a scholar' })
  }
  const language = target[0].language

  const pg = await adminSql`
    SELECT id FROM program_goals
    WHERE language = ${language} AND is_active = true
    LIMIT 1
  `
  if (!pg.length) {
    return res
      .status(400)
      .json({ error: 'No active program goal — set the program goal first.' })
  }

  const rows = await adminSql`
    INSERT INTO scholar_goals (user_id, program_goal_id, start_date, language)
    VALUES (${userId}, ${pg[0].id}, ${start}, ${language})
    ON CONFLICT (user_id, language)
    DO UPDATE SET
      start_date      = EXCLUDED.start_date,
      program_goal_id = EXCLUDED.program_goal_id
    RETURNING user_id, start_date
  `

  return res.status(200).json(rows[0])
}
