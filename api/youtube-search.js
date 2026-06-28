import { verifySession } from "./_auth.js"

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authUser = await verifySession(req.headers.authorization)
  if (!authUser) return res.status(401).json({ error: 'Unauthorized' })

  const { q, maxResults = '10', language } = req.query || {}
  if (!q) return res.status(400).json({ error: 'q parameter required' })

  const limit = Math.min(parseInt(maxResults, 10) || 10, 25)

  const params = new URLSearchParams({
    part: 'snippet',
    q,
    type: 'video',
    maxResults: String(limit),
    key: process.env.YOUTUBE_API_KEY,
    ...(language ? { relevanceLanguage: language } : {}),
  })

  try {
    const ytRes = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`)
    if (!ytRes.ok) {
      const err = await ytRes.json().catch(() => ({}))
      return res.status(502).json({ error: 'YouTube API error', details: err?.error?.message })
    }
    const data = await ytRes.json()
    const items = (data.items || []).map((item) => ({
      youtubeId: item.id?.videoId,
      title: item.snippet?.title,
      channelName: item.snippet?.channelTitle,
      channelId: item.snippet?.channelId,
      description: item.snippet?.description?.slice(0, 500),
      thumbnail_url: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url,
      publishedAt: item.snippet?.publishedAt,
    }))
    return res.status(200).json({ items, totalResults: data.pageInfo?.totalResults })
  } catch (err) {
    return res.status(502).json({ error: 'Failed to reach YouTube API' })
  }
}
