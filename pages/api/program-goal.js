import { getDb, getAdminDb } from '../../lib/api/_db.js'
import { verifySession } from '../../lib/api/_auth.js'

// Admin-only. Reads and writes the single ACTIVE program goal per language.
//
// IMPORTANT: POST updates the existing active goal IN PLACE rather than
// inserting a new row. scholar_goals.program_goal_id references the goal, and
// scholar_pace only joins program_goals WHERE is_active = true — so inserting a
// new active goal (and deactivating the old one) would orphan every existing
// scholar to PENDING. Updating in place keeps all scholar links valid.

const TARGET_LEVELS = ['beginner', 'intermediate', 'advanced']

export default async function handler(req, res) {
  const authUser = await verifySession(req.headers.authorization)
  if (!authUser) return res.status(401).json({ error: 'Unauthorized' })

  const sql = getDb()
  const me = await sql`SELECT role FROM users WHERE id = ${authUser.id}`
  if (!me.length || me[0].role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const language = (
    req.body?.language ||
    req.query?.language ||
    'english'
  ).toLowerCase()

  if (req.method === 'GET') {
    const rows = await sql`
      SELECT id, target_level, target_hours, target_date, language
      FROM program_goals
      WHERE language = ${language} AND is_active = true
      ORDER BY created_at DESC
      LIMIT 1
    `
    return res.status(200).json(rows[0] || null)
  }

  if (req.method === 'POST') {
    // ── applyToAll: stamp current program goal onto every scholar_goals row ──
    if (req.body?.action === 'applyToAll') {
      const adminSql = getAdminDb()
      const pg = await adminSql`
        SELECT id, target_level, target_hours, target_date
        FROM program_goals
        WHERE language = ${language} AND is_active = true
        LIMIT 1
      `
      if (!pg.length) return res.status(400).json({ error: 'No active program goal to apply.' })
      const { target_level, target_hours, target_date } = pg[0]
      const result = await adminSql`
        UPDATE scholar_goals
        SET target_level = ${target_level},
            target_hours = ${target_hours},
            target_date  = ${target_date}
        WHERE language = ${language}
        RETURNING user_id
      `
      return res.status(200).json({ updated: result.length })
    }

    const { targetLevel, targetHours, targetDate } = req.body || {}

    if (!TARGET_LEVELS.includes(targetLevel)) {
      return res.status(400).json({ error: 'Invalid target level' })
    }
    const hours = Number(targetHours)
    if (!Number.isInteger(hours) || hours <= 0) {
      return res.status(400).json({ error: 'Invalid target hours' })
    }
    if (!targetDate || Number.isNaN(Date.parse(targetDate))) {
      return res.status(400).json({ error: 'Invalid target date' })
    }

    const adminSql = getAdminDb()
    const existing = await adminSql`
      SELECT id FROM program_goals
      WHERE language = ${language} AND is_active = true
      LIMIT 1
    `

    let goal
    if (existing.length) {
      const rows = await adminSql`
        UPDATE program_goals
        SET target_level = ${targetLevel},
            target_hours = ${hours},
            target_date  = ${targetDate}
        WHERE id = ${existing[0].id}
        RETURNING id, target_level, target_hours, target_date, language
      `
      goal = rows[0]
    } else {
      const rows = await adminSql`
        INSERT INTO program_goals
          (target_level, target_hours, target_date, language, is_active, created_by)
        VALUES
          (${targetLevel}, ${hours}, ${targetDate}, ${language}, true, ${authUser.id})
        RETURNING id, target_level, target_hours, target_date, language
      `
      goal = rows[0]
    }

    return res.status(200).json(goal)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
