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
    oetRelevance,
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

    // Restore a previously soft-deleted video if one exists.
    const restored = await sql`
      UPDATE videos
      SET is_available = true,
          unavailable_since = null,
          title = ${title},
          channel_name = ${channelName || null},
          description = ${description || null},
          thumbnail_url = ${thumbnailUrl || null},
          duration_seconds = ${durationSeconds || null},
          level = ${level},
          level_source = 'ai',
          topic_primary = ${topicPrimary},
          topic_secondary = ${topicSecondary || null},
          oet_relevance = ${oetRelevance || null},
          added_by = ${authUser.id}
      WHERE youtube_id = ${youtubeId} AND is_available = false
      RETURNING id
    `
    if (restored.length > 0) {
      return res.status(200).json({ added: true, videoId: restored[0].id })
    }

    const rows = await sql`
      INSERT INTO videos
        (youtube_id, title, channel_name, channel_id, description, thumbnail_url,
         duration_seconds, language, level, level_source, topic_primary, topic_secondary,
         oet_relevance, source, added_by)
      VALUES
        (${youtubeId}, ${title}, ${channelName || null}, ${channelUuid},
         ${description || null}, ${thumbnailUrl || null}, ${durationSeconds || null},
         ${language}, ${level}, 'ai', ${topicPrimary}, ${topicSecondary || null},
         ${oetRelevance || null}, 'library', ${authUser.id})
      ON CONFLICT (youtube_id) DO NOTHING
      RETURNING id
    `
    return res.status(200).json({ added: rows.length > 0, videoId: rows[0]?.id || null })
  } catch (err) {
    return res.status(500).json({ error: 'Database error' })
  }
}
