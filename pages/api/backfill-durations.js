import { getDb } from '../../lib/api/_db.js'
import { verifyAdmin } from '../../lib/api/_auth.js'

export const config = { maxDuration: 30 }

const YT_API = 'https://www.googleapis.com/youtube/v3'

function parseDuration(iso) {
  if (!iso) return null
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return null
  return (parseInt(m[1] || 0) * 3600) + (parseInt(m[2] || 0) * 60) + parseInt(m[3] || 0)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const sql = getDb()
  const authUser = await verifyAdmin(req.headers.authorization, sql)
  if (!authUser) return res.status(403).json({ error: 'Forbidden' })

  const videos = await sql`
    SELECT id, youtube_id
    FROM videos
    WHERE is_available = true AND duration_seconds IS NULL
    ORDER BY created_at
  `

  if (videos.length === 0) {
    return res.status(200).json({ checked: 0, updated: 0, sessionsFixed: 0 })
  }

  let updated = 0
  let sessionsFixed = 0
  const BATCH = 50

  for (let i = 0; i < videos.length; i += BATCH) {
    const batch = videos.slice(i, i + BATCH)
    const ytIds = batch.map((v) => v.youtube_id).join(',')
    const params = new URLSearchParams({
      part: 'contentDetails',
      id: ytIds,
      key: process.env.YOUTUBE_API_KEY,
    })
    let ytData
    try {
      const ytRes = await fetch(`${YT_API}/videos?${params}`)
      if (!ytRes.ok) throw new Error('YouTube API error')
      ytData = await ytRes.json()
    } catch {
      // Skip batch on network/API error — leave duration_seconds null for retry later
      continue
    }
    const durationMap = new Map(
      (ytData.items || []).map((item) => [item.id, parseDuration(item.contentDetails?.duration)])
    )
    for (const v of batch) {
      const seconds = durationMap.get(v.youtube_id)
      if (seconds == null) continue
      await sql`UPDATE videos SET duration_seconds = ${seconds} WHERE id = ${v.id}`
      updated++

      // Retroactively flag sessions that actually crossed the ≥95% single-session
      // completion threshold, now that this video's true length is known.
      if (seconds > 0) {
        const fixedRows = await sql`
          UPDATE watch_sessions
          SET completed = true
          WHERE video_id = ${v.id}
            AND completed = false
            AND seconds_watched::numeric / ${seconds} >= 0.95
          RETURNING id
        `
        sessionsFixed += fixedRows.length
      }
    }
  }

  return res.status(200).json({ checked: videos.length, updated, sessionsFixed })
}
