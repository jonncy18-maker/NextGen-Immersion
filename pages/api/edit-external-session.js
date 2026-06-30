import { getDb, getAdminDb } from '../../lib/api/_db.js'
import { verifySession } from '../../lib/api/_auth.js'

const VALID_TYPES = ['chatgpt_conversation', 'mentor_call', 'video_external']

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const authUser = await verifySession(req.headers.authorization)
  if (!authUser) return res.status(401).json({ error: 'Unauthorized' })

  const sql = getDb()
  const userRows = await sql`SELECT role FROM users WHERE id = ${authUser.id}`
  if (!userRows.length || userRows[0].role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const { sessionId, durationMinutes, notes, sessionType } = req.body

  if (!sessionId) return res.status(400).json({ error: 'sessionId required' })
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
    return res.status(400).json({ error: 'Invalid sessionId' })
  }

  const mins = Number(durationMinutes)
  if (!durationMinutes || isNaN(mins) || mins <= 0) {
    return res.status(400).json({ error: 'durationMinutes must be a positive number' })
  }
  if (sessionType && !VALID_TYPES.includes(sessionType)) {
    return res.status(400).json({ error: 'Invalid sessionType' })
  }

  const adminSql = getAdminDb()

  const rows = await adminSql`SELECT id, session_type, duration_seconds, notes FROM external_sessions WHERE id = ${sessionId}`
  if (!rows.length) return res.status(404).json({ error: 'Session not found' })

  const existing = rows[0]
  const newDurationSeconds = Math.round(mins * 60)
  const newNotes = notes !== undefined ? (notes ? String(notes).trim().slice(0, 500) : null) : existing.notes
  const newSessionType = sessionType || existing.session_type

  const [updated] = await adminSql`
    UPDATE external_sessions SET
      duration_seconds = ${newDurationSeconds},
      notes            = ${newNotes},
      session_type     = ${newSessionType}
    WHERE id = ${sessionId}
    RETURNING id, session_type, duration_seconds, notes
  `

  return res.status(200).json(updated)
}
