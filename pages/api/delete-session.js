import { getDb, getAdminDb } from '../../lib/api/_db.js'
import { verifySession } from '../../lib/api/_auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const authUser = await verifySession(req.headers.authorization)
  if (!authUser) return res.status(401).json({ error: 'Unauthorized' })

  const sql = getDb()
  const userRows = await sql`SELECT role FROM users WHERE id = ${authUser.id}`
  if (!userRows.length) return res.status(403).json({ error: 'Forbidden' })
  const isAdmin = userRows[0].role === 'admin'
  if (!isAdmin && userRows[0].role !== 'scholar') {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const { sessionType, sessionId } = req.body
  if (!sessionType || !sessionId) {
    return res.status(400).json({ error: 'sessionType and sessionId required' })
  }
  if (!['watch', 'external'].includes(sessionType)) {
    return res.status(400).json({ error: 'sessionType must be watch or external' })
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
    return res.status(400).json({ error: 'Invalid sessionId' })
  }

  const querySql = isAdmin ? getAdminDb() : sql

  if (sessionType === 'watch') {
    const result = isAdmin
      ? await querySql`DELETE FROM watch_sessions WHERE id = ${sessionId} RETURNING id`
      : await querySql`DELETE FROM watch_sessions WHERE id = ${sessionId} AND user_id = ${authUser.id} RETURNING id`
    if (!result.length) return res.status(404).json({ error: 'Session not found' })
  } else {
    const result = isAdmin
      ? await querySql`DELETE FROM external_sessions WHERE id = ${sessionId} RETURNING id`
      : await querySql`DELETE FROM external_sessions WHERE id = ${sessionId} AND user_id = ${authUser.id} RETURNING id`
    if (!result.length) return res.status(404).json({ error: 'Session not found' })
  }

  return res.status(200).json({ deleted: 1 })
}
