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
    SELECT v.id, v.youtube_id, v.title, v.channel_name, v.duration_seconds,
           v.level, v.topic_primary, v.topic_secondary, v.thumbnail_url,
           COALESCE(vm.watched, uvs.completed, false) AS watched,
           uvs.last_watched_at
    FROM videos v
    LEFT JOIN user_video_status uvs
      ON uvs.video_id = v.id AND uvs.user_id = ${authUser.id}
    LEFT JOIN video_marks vm
      ON vm.video_id = v.id AND vm.user_id = ${authUser.id}
    WHERE v.is_available = true AND v.language = ${language}
    ORDER BY v.level, v.created_at DESC
    LIMIT 200
  `

  return res.status(200).json({ videos })
}
