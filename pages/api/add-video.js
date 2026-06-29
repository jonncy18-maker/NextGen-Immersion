import { getDb } from '../../lib/api/_db.js'
import { verifyAdmin } from '../../lib/api/_auth.js'

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
    // channelId from the client is the YouTube channel ID string (e.g. UCxxxxxx),
    // not the internal UUID. Look up the channels table to resolve it.
    let channelUuid = null
    if (channelId) {
      const ch = await sql`SELECT id FROM channels WHERE youtube_channel_id = ${channelId}`
      channelUuid = ch[0]?.id || null
    }

    const rows = await sql`
      INSERT INTO videos
        (youtube_id, title, channel_name, channel_id, description, thumbnail_url,
         duration_seconds, language, level, level_source, topic_primary, topic_secondary,
         source, added_by)
      VALUES
        (${youtubeId}, ${title}, ${channelName || null}, ${channelUuid},
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
