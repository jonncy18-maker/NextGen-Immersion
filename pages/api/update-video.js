import { getDb } from '../../lib/api/_db.js'
import { verifyAdmin } from '../../lib/api/_auth.js'
import { TOPIC_TAGS } from '../../lib/api/_tag.js'

const VALID_LEVELS = ['super_beginner', 'beginner', 'intermediate', 'advanced']

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const sql = getDb()
  const authUser = await verifyAdmin(req.headers.authorization, sql)
  if (!authUser) return res.status(403).json({ error: 'Forbidden' })

  const { videoIds, level, topic } = req.body
  if (!Array.isArray(videoIds) || videoIds.length === 0) {
    return res.status(400).json({ error: 'videoIds must be a non-empty array' })
  }
  if (!level && !topic) {
    return res.status(400).json({ error: 'At least one of level or topic is required' })
  }
  if (level && !VALID_LEVELS.includes(level)) {
    return res.status(400).json({ error: 'Invalid level' })
  }
  if (topic && !TOPIC_TAGS.includes(topic)) {
    return res.status(400).json({ error: 'Invalid topic' })
  }

  let updated = 0
  for (const id of videoIds) {
    if (level && topic) {
      const result = await sql`
        UPDATE videos
        SET level = ${level}, level_source = 'admin', topic_primary = ${topic}, updated_at = now()
        WHERE id = ${id}
      `
      updated += result.count
    } else if (level) {
      const result = await sql`
        UPDATE videos
        SET level = ${level}, level_source = 'admin', updated_at = now()
        WHERE id = ${id}
      `
      updated += result.count
    } else {
      const result = await sql`
        UPDATE videos
        SET topic_primary = ${topic}, updated_at = now()
        WHERE id = ${id}
      `
      updated += result.count
    }
  }

  return res.status(200).json({ updated })
}
