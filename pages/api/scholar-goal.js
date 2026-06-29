import { getDb, getAdminDb } from '../../lib/api/_db.js'
import { verifySession } from '../../lib/api/_auth.js'

// Admin-only. Reads and writes a scholar's goal-clock fields:
//   start_date    → flips PENDING → ON_TRACK / AT_RISK
//   target_level  → per-scholar override (COALESCE fallback to program_goals)
//   target_hours  → per-scholar override
//   target_date   → per-scholar override
//
// GET  ?userId=<id>   → returns the scholar_goals row (or null)
// POST { userId, startDate, targetLevel, targetHours, targetDate }
//      → upserts scholar_goals; all fields except userId are optional

const VALID_LEVELS = ['beginner', 'intermediate', 'advanced']

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authUser = await verifySession(req.headers.authorization)
  if (!authUser) return res.status(401).json({ error: 'Unauthorized' })

  const sql = getDb()
  const me = await sql`SELECT role FROM users WHERE id = ${authUser.id}`
  if (!me.length || me[0].role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const adminSql = getAdminDb()

  // ── GET ──────────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { userId } = req.query
    if (!userId) return res.status(400).json({ error: 'userId required' })

    const rows = await adminSql`
      SELECT user_id, start_date, target_level, target_hours, target_date, language
      FROM scholar_goals
      WHERE user_id = ${userId}
    `
    return res.status(200).json(rows[0] || null)
  }

  // ── POST ─────────────────────────────────────────────────────────────────────
  const { userId, startDate, targetLevel, targetHours, targetDate } = req.body || {}
  if (!userId) return res.status(400).json({ error: 'userId required' })

  // Validate start date
  let start = null
  if (startDate) {
    if (Number.isNaN(Date.parse(startDate))) {
      return res.status(400).json({ error: 'Invalid start date' })
    }
    start = startDate
  }

  // Validate targetLevel if provided
  let level = null
  if (targetLevel !== undefined && targetLevel !== null && targetLevel !== '') {
    if (!VALID_LEVELS.includes(targetLevel)) {
      return res.status(400).json({ error: 'Invalid target level' })
    }
    level = targetLevel
  }

  // Validate targetHours if provided
  let hours = null
  if (targetHours !== undefined && targetHours !== null && targetHours !== '') {
    const parsed = Number(targetHours)
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return res.status(400).json({ error: 'targetHours must be a positive integer' })
    }
    hours = parsed
  }

  // Validate targetDate if provided
  let tDate = null
  if (targetDate !== undefined && targetDate !== null && targetDate !== '') {
    if (Number.isNaN(Date.parse(targetDate))) {
      return res.status(400).json({ error: 'Invalid target date' })
    }
    tDate = targetDate
  }

  // Look up the scholar
  const target = await adminSql`
    SELECT id, role, language FROM users WHERE id = ${userId}
  `
  if (!target.length) return res.status(404).json({ error: 'Scholar not found' })
  if (target[0].role !== 'scholar') {
    return res.status(400).json({ error: 'User is not a scholar' })
  }
  const language = target[0].language

  // Active program goal is required as the COALESCE base
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
    INSERT INTO scholar_goals (user_id, program_goal_id, start_date, target_level, target_hours, target_date, language)
    VALUES (${userId}, ${pg[0].id}, ${start}, ${level}, ${hours}, ${tDate}, ${language})
    ON CONFLICT (user_id, language)
    DO UPDATE SET
      start_date      = EXCLUDED.start_date,
      program_goal_id = EXCLUDED.program_goal_id,
      target_level    = EXCLUDED.target_level,
      target_hours    = EXCLUDED.target_hours,
      target_date     = EXCLUDED.target_date
    RETURNING user_id, start_date, target_level, target_hours, target_date, language
  `

  return res.status(200).json(rows[0])
}
