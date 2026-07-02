import { getAdminDb } from '../../lib/api/_db.js'
import { verifyAdmin } from '../../lib/api/_auth.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const sql = getAdminDb()
  const authUser = await verifyAdmin(req.headers.authorization, sql)
  if (!authUser) return res.status(403).json({ error: 'Forbidden' })

  const { userId } = req.query
  if (!userId) return res.status(400).json({ error: 'userId required' })

  const [userRow] = await sql`
    SELECT language FROM users WHERE id = ${userId}
  `
  if (!userRow) return res.status(404).json({ error: 'Scholar not found' })
  const language = userRow.language || 'english'

  const videos = await sql`
    SELECT v.id, v.youtube_id, v.title, v.channel_name, v.duration_seconds,
           v.level, v.topic_primary, v.topic_secondary, v.thumbnail_url, v.oet_relevance,
           COALESCE(vm.watched, uvs.completed, false) AS watched,
           uvs.last_watched_at
    FROM videos v
    LEFT JOIN user_video_status uvs
      ON uvs.video_id = v.id AND uvs.user_id = ${userId}
    LEFT JOIN video_marks vm
      ON vm.video_id = v.id AND vm.user_id = ${userId}
    WHERE v.is_available = true AND v.language = ${language}
    ORDER BY v.level, v.created_at DESC
  `

  return res.status(200).json({ videos })
}
