import { getDb } from './_db.js'
import { verifySession } from './_auth.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authUser = await verifySession(req.headers.authorization)
  if (!authUser) return res.status(401).json({ error: 'Unauthorized' })

  const sql = getDb()

  // Look up the scholar's language so we serve the right video library
  const [userRow] = await sql`
    SELECT language FROM users WHERE id = ${authUser.id}
  `
  const language = userRow?.language || 'english'

  const videos = await sql`
    SELECT id, youtube_id, title, channel_name, duration_seconds,
           level, topic_primary, topic_secondary, thumbnail_url
    FROM videos
    WHERE is_available = true AND language = ${language}
    ORDER BY level, created_at DESC
    LIMIT 200
  `

  return res.status(200).json({ videos })
}
