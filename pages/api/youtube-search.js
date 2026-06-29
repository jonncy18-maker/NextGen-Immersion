import { verifySession } from '../../lib/api/_auth.js'
import { getDb } from '../../lib/api/_db.js'

const MUSIC_CATEGORY_ID = '10'
const YT_API = 'https://www.googleapis.com/youtube/v3'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authUser = await verifySession(req.headers.authorization)
  if (!authUser) return res.status(401).json({ error: 'Unauthorized' })

  const { q, maxResults = '10', language } = req.query || {}
  if (!q) return res.status(400).json({ error: 'q parameter required' })

  const limit = Math.min(parseInt(maxResults, 10) || 10, 25)
  // Fetch extra results to account for music videos that will be filtered out
  const fetchCount = Math.min(limit + 5, 25)

  const searchParams = new URLSearchParams({
    part: 'snippet',
    q,
    type: 'video',
    maxResults: String(fetchCount),
    key: process.env.YOUTUBE_API_KEY,
    ...(language ? { relevanceLanguage: language } : {}),
  })

  try {
    const ytRes = await fetch(`${YT_API}/search?${searchParams}`)
    if (!ytRes.ok) {
      const err = await ytRes.json().catch(() => ({}))
      const isQuota = err?.error?.errors?.[0]?.reason === 'quotaExceeded'
      if (isQuota) {
        return res.status(429).json({ error: 'YouTube quota exceeded — try again tomorrow' })
      }
      return res.status(502).json({ error: 'YouTube API error', details: err?.error?.message })
    }
    const data = await ytRes.json()
    const rawItems = data.items || []

    // Fetch categoryId for all results to filter out music (category 10)
    const videoIds = rawItems.map((i) => i.id?.videoId).filter(Boolean)
    let categoryMap = {}
    if (videoIds.length > 0) {
      const detailParams = new URLSearchParams({
        part: 'snippet',
        id: videoIds.join(','),
        key: process.env.YOUTUBE_API_KEY,
      })
      const detailRes = await fetch(`${YT_API}/videos?${detailParams}`)
      if (detailRes.ok) {
        const detailData = await detailRes.json()
        for (const v of detailData.items || []) {
          categoryMap[v.id] = v.snippet?.categoryId
        }
      }
    }

    const items = rawItems
      .filter((item) => {
        const vid = item.id?.videoId
        return vid && categoryMap[vid] !== MUSIC_CATEGORY_ID
      })
      .slice(0, limit)
      .map((item) => ({
        youtubeId: item.id?.videoId,
        title: item.snippet?.title,
        channelName: item.snippet?.channelTitle,
        channelId: item.snippet?.channelId,
        description: item.snippet?.description?.slice(0, 500),
        thumbnail_url:
          item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url,
        publishedAt: item.snippet?.publishedAt,
      }))

    // Check which returned IDs are already in the library
    const returnedIds = items.map((i) => i.youtubeId)
    let librarySet = new Set()
    if (returnedIds.length > 0) {
      try {
        const db = getDb()
        const existing = await db`
          SELECT youtube_id FROM videos
          WHERE youtube_id = ANY(${returnedIds}) AND is_available = true
        `
        for (const row of existing) librarySet.add(row.youtube_id)
      } catch {
        // non-fatal: if the DB check fails, items just won't be pre-marked
      }
    }

    const annotatedItems = items.map((item) => ({
      ...item,
      in_library: librarySet.has(item.youtubeId),
    }))

    return res.status(200).json({ items: annotatedItems, totalResults: data.pageInfo?.totalResults })
  } catch (err) {
    return res.status(502).json({ error: 'Failed to reach YouTube API' })
  }
}
