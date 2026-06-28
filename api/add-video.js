import { getDb } from "./_db.js"
import { verifyAdmin } from "./_auth.js"

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const sql = getDb()
  const authUser = await verifyAdmin(req.headers.authorization, sql)
  if (!authUser) return res.status(403).json({ error: 'Forbidden' })

  const {
    youtubeId,
    title,
    channelName,
    channelId,
    thumbnailUrl,
    description,
    durationSeconds,
    language = 'english',
    level,
    topicPrimary,
    topicSecondary,
  } = req.body || {}

  if (!youtubeId || !title || !level || !topicPrimary) {
    return res.status(400).json({ error: 'youtubeId, title, level, topicPrimary required' })
  }

  try {
    const rows = await sql`
      INSERT INTO videos
        (youtube_id, title, channel_name, channel_id, description, thumbnail_url,
         duration_seconds, language, level, level_source, topic_primary, topic_secondary,
         source, added_by)
      VALUES
        (${youtubeId}, ${title}, ${channelName || null}, ${channelId || null},
         ${description || null}, ${thumbnailUrl || null}, ${durationSeconds || null},
         ${language}, ${level}, 'ai', ${topicPrimary}, ${topicSecondary || null},
         'library', ${authUser.id})
      ON CONFLICT (youtube_id) DO NOTHING
      RETURNING id
    `
    return res.status(200).json({ added: rows.length > 0, videoId: rows[0]?.id || null })
  } catch (err) {
    return res.status(500).json({ error: 'Database error' })
  }
}
