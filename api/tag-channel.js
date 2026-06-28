import { getDb } from "./_db.js"
import { verifyAdmin } from "./_auth.js"
import { classifyChannelLevel } from "./_tag.js"

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const sql = getDb()
  const authUser = await verifyAdmin(req.headers.authorization, sql)
  if (!authUser) return res.status(403).json({ error: 'Forbidden' })

  const { channelId, channelName, description = '', sampleTitles = [] } = req.body || {}
  if (!channelId || !channelName) {
    return res.status(400).json({ error: 'channelId and channelName required' })
  }

  const level = await classifyChannelLevel({ channelName, description, sampleTitles })

  // Update the channel row
  await sql`
    UPDATE channels SET level = ${level} WHERE id = ${channelId}
  `

  // Re-stamp all videos from this channel — preserve admin overrides
  const updated = await sql`
    UPDATE videos
    SET level = ${level}, level_source = 'channel'
    WHERE channel_id = ${channelId} AND level_source != 'admin'
    RETURNING id
  `

  return res.status(200).json({ level, channelId, videosUpdated: updated.length })
}
