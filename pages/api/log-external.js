import { getDb, getAdminDb } from '../../lib/api/_db.js'
import { verifySession } from '../../lib/api/_auth.js'

const VALID_TYPES = ['chatgpt_conversation', 'mentor_call', 'video_external']

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authUser = await verifySession(req.headers.authorization)
  if (!authUser) return res.status(401).json({ error: 'Unauthorized' })

  const sql = getDb()
  const me = await sql`SELECT role FROM users WHERE id = ${authUser.id}`
  if (!me.length) return res.status(401).json({ error: 'Unauthorized' })

  const isAdmin = me[0].role === 'admin'
  const { userId: bodyUserId, sessionType, durationMinutes, sessionDate, notes } = req.body || {}

  // Scholars can only log for themselves
  const targetUserId = isAdmin ? (bodyUserId || authUser.id) : authUser.id

  // Validate sessionType
  if (!VALID_TYPES.includes(sessionType)) {
    return res.status(400).json({ error: 'Invalid session type. Must be chatgpt_conversation, mentor_call, or video_external.' })
  }

  // Validate durationMinutes
  const minutes = Number(durationMinutes)
  if (!minutes || minutes <= 0 || !Number.isFinite(minutes)) {
    return res.status(400).json({ error: 'durationMinutes must be a positive number.' })
  }
  const durationSeconds = Math.round(minutes * 60)

  // Validate sessionDate (optional)
  let date = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
  if (sessionDate) {
    if (Number.isNaN(Date.parse(sessionDate))) {
      return res.status(400).json({ error: 'Invalid session date.' })
    }
    date = sessionDate
  }

  // Validate notes (optional)
  let cleanNotes = null
  if (notes) {
    cleanNotes = String(notes).trim().slice(0, 500) || null
  }

  // Look up target scholar's language
  const adminSql = getAdminDb()
  const target = await adminSql`
    SELECT id, role, language FROM users WHERE id = ${targetUserId}
  `
  if (!target.length) return res.status(404).json({ error: 'User not found.' })
  if (target[0].role !== 'scholar') {
    return res.status(400).json({ error: 'Can only log hours for scholars.' })
  }
  const language = target[0].language

  const rows = await adminSql`
    INSERT INTO external_sessions
      (user_id, session_type, duration_seconds, session_date, language, notes)
    VALUES
      (${targetUserId}, ${sessionType}, ${durationSeconds}, ${date}, ${language}, ${cleanNotes})
    RETURNING id, session_type, duration_seconds, session_date
  `

  return res.status(200).json(rows[0])
}
