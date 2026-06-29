import { getDb } from '../../lib/api/_db.js'
import { verifyAdmin } from '../../lib/api/_auth.js'

export const config = { maxDuration: 30 }

const YT_API = 'https://www.googleapis.com/youtube/v3'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const sql = getDb()
  const authUser = await verifyAdmin(req.headers.authorization, sql)
  if (!authUser) return res.status(403).json({ error: 'Forbidden' })

  const videos = await sql`
    SELECT id, youtube_id, title
    FROM videos
    WHERE is_available = true
    ORDER BY created_at
  `

  if (videos.length === 0) {
    return res.status(200).json({ checked: 0, flagged: 0, flaggedTitles: [] })
  }

  const staleIds = []
  const staleTitles = []
  const BATCH = 50

  for (let i = 0; i < videos.length; i += BATCH) {
    const batch = videos.slice(i, i + BATCH)
    const ytIds = batch.map((v) => v.youtube_id).join(',')
    const params = new URLSearchParams({
      part: 'status',
      id: ytIds,
      key: process.env.YOUTUBE_API_KEY,
    })
    let ytData
    try {
      const ytRes = await fetch(`${YT_API}/videos?${params}`)
      if (!ytRes.ok) throw new Error('YouTube API error')
      ytData = await ytRes.json()
    } catch {
      // Skip batch on network/API error — avoid false-positive flagging
      continue
    }
    const foundMap = new Map((ytData.items || []).map((item) => [item.id, item]))
    for (const v of batch) {
      const found = foundMap.get(v.youtube_id)
      const isStale =
        !found ||
        found.status?.privacyStatus === 'private' ||
        found.status?.embeddable === false
      if (isStale) {
        staleIds.push(v.id)
        staleTitles.push(v.title)
      }
    }
  }

  for (const id of staleIds) {
    await sql`
      UPDATE videos
      SET is_available = false, unavailable_since = now()
      WHERE id = ${id}
    `
  }

  return res.status(200).json({
    checked: videos.length,
    flagged: staleIds.length,
    flaggedTitles: staleTitles.slice(0, 5),
  })
}
