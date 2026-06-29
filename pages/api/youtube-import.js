import { getDb } from '../../lib/api/_db.js'
import { verifyAdmin } from '../../lib/api/_auth.js'
import { classifyChannelLevel, classifyVideoTopics, classifyVideo } from '../../lib/api/_tag.js'

// Batch import + per-video Haiku tagging can exceed the default 10s limit.
export const config = { maxDuration: 30 }

const YT_API = 'https://www.googleapis.com/youtube/v3'

async function fetchPlaylistItems(playlistId, maxResults = 50) {
  const params = new URLSearchParams({
    part: 'snippet,contentDetails',
    playlistId,
    maxResults: String(Math.min(maxResults, 50)),
    key: process.env.YOUTUBE_API_KEY,
  })
  const res = await fetch(`${YT_API}/playlistItems?${params}`)
  if (!res.ok) throw new Error('YouTube playlistItems API error')
  const data = await res.json()
  return data.items || []
}

async function fetchVideoDetails(videoIds) {
  const params = new URLSearchParams({
    part: 'snippet,contentDetails',
    id: videoIds.join(','),
    key: process.env.YOUTUBE_API_KEY,
  })
  const res = await fetch(`${YT_API}/videos?${params}`)
  if (!res.ok) throw new Error('YouTube videos API error')
  const data = await res.json()
  return data.items || []
}

async function fetchChannelUploadsPlaylistId(channelId) {
  const params = new URLSearchParams({
    part: 'contentDetails',
    id: channelId,
    key: process.env.YOUTUBE_API_KEY,
  })
  const res = await fetch(`${YT_API}/channels?${params}`)
  if (!res.ok) throw new Error('YouTube channels API error')
  const data = await res.json()
  return data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
}

function parseDuration(iso) {
  if (!iso) return null
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return null
  return (parseInt(m[1] || 0) * 3600) + (parseInt(m[2] || 0) * 60) + parseInt(m[3] || 0)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const sql = getDb()
  const authUser = await verifyAdmin(req.headers.authorization, sql)
  if (!authUser) return res.status(403).json({ error: 'Forbidden' })

  const {
    type,           // 'playlist' | 'channel' | 'video'
    youtubeId,      // playlist ID, channel ID, or video ID
    language = 'english',
    channelDbId,    // optional: existing channel row UUID (for channel imports)
  } = req.body || {}

  if (!type || !youtubeId) {
    return res.status(400).json({ error: 'type and youtubeId required' })
  }

  let videoItems = []  // Array of YouTube video API response items
  let channelLevel = null
  let channelName = null

  try {
    if (type === 'video') {
      const details = await fetchVideoDetails([youtubeId])
      videoItems = details
    } else if (type === 'playlist') {
      const playlistItems = await fetchPlaylistItems(youtubeId)
      const videoIds = playlistItems
        .map((i) => i.contentDetails?.videoId || i.snippet?.resourceId?.videoId)
        .filter(Boolean)
      if (videoIds.length > 0) {
        videoItems = await fetchVideoDetails(videoIds)
      }
    } else if (type === 'channel') {
      const uploadsId = await fetchChannelUploadsPlaylistId(youtubeId)
      if (!uploadsId) return res.status(400).json({ error: 'Channel uploads playlist not found' })
      const playlistItems = await fetchPlaylistItems(uploadsId)
      const videoIds = playlistItems
        .map((i) => i.contentDetails?.videoId || i.snippet?.resourceId?.videoId)
        .filter(Boolean)
      if (videoIds.length > 0) {
        videoItems = await fetchVideoDetails(videoIds)
        // Classify channel level once using channel metadata + sample titles
        const sample = videoItems.slice(0, 10).map((v) => v.snippet?.title || '')
        const firstVideo = videoItems[0]
        channelName = firstVideo?.snippet?.channelTitle || ''
        channelLevel = await classifyChannelLevel({
          channelName,
          description: '',
          sampleTitles: sample,
        })
        // If channelDbId provided, update channel row and re-stamp existing videos
        if (channelDbId) {
          await sql`UPDATE channels SET level = ${channelLevel} WHERE id = ${channelDbId}`
          await sql`
            UPDATE videos SET level = ${channelLevel}, level_source = 'channel'
            WHERE channel_id = ${channelDbId} AND level_source != 'admin'
          `
        }
      }
    } else {
      return res.status(400).json({ error: 'type must be playlist, channel, or video' })
    }
  } catch (err) {
    return res.status(502).json({ error: err.message || 'YouTube API error' })
  }

  if (videoItems.length === 0) {
    return res.status(200).json({ imported: 0, skipped: 0, videos: [] })
  }

  let imported = 0
  let skipped = 0
  const results = []

  for (const item of videoItems) {
    const ytId = item.id
    const snippet = item.snippet || {}
    const title = snippet.title || ''
    const description = (snippet.description || '').slice(0, 500)
    const thumbUrl = snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || null
    const itemChannelName = snippet.channelTitle || channelName || null
    const durationSeconds = parseDuration(item.contentDetails?.duration)

    let level, topic_primary, topic_secondary, level_source

    if (channelLevel) {
      // Channel import: level from channel, topics per-video
      level = channelLevel
      level_source = 'channel'
      const topics = await classifyVideoTopics({ title, description })
      topic_primary = topics.topic_primary
      topic_secondary = topics.topic_secondary
    } else {
      // Channelless import: classify everything per-video
      const tags = await classifyVideo({ title, description, language })
      level = tags.level
      topic_primary = tags.topic_primary
      topic_secondary = tags.topic_secondary
      level_source = 'ai'
    }

    try {
      const rows = await sql`
        INSERT INTO videos
          (youtube_id, title, channel_name, channel_id, description, thumbnail_url,
           duration_seconds, language, level, level_source, topic_primary, topic_secondary,
           source, added_by)
        VALUES
          (${ytId}, ${title}, ${itemChannelName}, ${channelDbId || null}, ${description},
           ${thumbUrl}, ${durationSeconds}, ${language}, ${level}, ${level_source},
           ${topic_primary}, ${topic_secondary || null}, 'library', ${authUser.id})
        ON CONFLICT (youtube_id) DO NOTHING
        RETURNING id, youtube_id, title, level, topic_primary, topic_secondary
      `
      if (rows.length > 0) {
        imported++
        results.push(rows[0])
      } else {
        skipped++
      }
    } catch {
      skipped++
    }
  }

  return res.status(200).json({ imported, skipped, videos: results })
}
