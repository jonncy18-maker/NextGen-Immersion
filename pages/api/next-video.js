import { getDb } from '../../lib/api/_db.js'
import { verifySession } from '../../lib/api/_auth.js'
import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-haiku-4-5'

// Batch import + Haiku calls may take a while
export const config = { maxDuration: 20 }

const ALL_LEVELS = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2']

function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try { return JSON.parse(match[0]) } catch { return null }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authUser = await verifySession(req.headers.authorization)
  if (!authUser) return res.status(401).json({ error: 'Unauthorized' })

  const { videoId, comprehensionRating } = req.body || {}
  if (!videoId || !comprehensionRating || comprehensionRating < 1 || comprehensionRating > 3) {
    return res.status(400).json({ error: 'videoId and comprehensionRating (1–3) required' })
  }

  const sql = getDb()

  // Get current video
  const [currentVideo] = await sql`
    SELECT id, title, level, topic_primary, topic_secondary, oet_relevance, language
    FROM videos WHERE id = ${videoId}
  `
  if (!currentVideo) return res.status(404).json({ error: 'Video not found' })

  // Check global cache (shared across users, keyed by video + rating)
  const [cached] = await sql`
    SELECT suggested_video_ids FROM next_video_suggestions
    WHERE video_id = ${videoId} AND comprehension_rating = ${comprehensionRating}
      AND generated_at > now() - interval '7 days'
  `

  let suggestedIds
  if (cached?.suggested_video_ids?.length > 0) {
    suggestedIds = cached.suggested_video_ids
  } else {
    // Determine target levels based on comprehension
    const currentIdx = ALL_LEVELS.indexOf(currentVideo.level)
    let targetLevels
    if (comprehensionRating === 1) {
      // Struggled: same level only
      targetLevels = [currentVideo.level]
    } else if (comprehensionRating === 2) {
      // Some understanding: same + one below
      targetLevels = currentIdx > 0
        ? [ALL_LEVELS[currentIdx - 1], currentVideo.level]
        : [currentVideo.level]
    } else {
      // Good understanding: same + one above
      targetLevels = currentIdx < ALL_LEVELS.length - 1
        ? [currentVideo.level, ALL_LEVELS[currentIdx + 1]]
        : [currentVideo.level]
    }

    // Fetch candidates: all available videos in correct language, filter in JS for level
    const allCandidates = await sql`
      SELECT id, title, level, topic_primary, topic_secondary, oet_relevance
      FROM videos
      WHERE is_available = true
        AND language = ${currentVideo.language}
        AND id != ${videoId}
      ORDER BY oet_relevance DESC NULLS LAST, created_at DESC
      LIMIT 100
    `

    const candidates = allCandidates
      .filter(c => targetLevels.includes(c.level))
      .slice(0, 30)

    if (candidates.length === 0) {
      return res.status(200).json({ suggestions: [] })
    }

    const ratingLabel =
      comprehensionRating === 1 ? 'struggled — needs more practice at this level'
      : comprehensionRating === 2 ? 'understood some — ready for similar content'
      : 'understood well — ready for a step up'

    const candidateList = candidates
      .map((c, i) =>
        `${i + 1}. [${c.id}] "${c.title}" | Level: ${c.level.toUpperCase()} | Topic: ${c.topic_primary}${c.oet_relevance >= 4 ? ' | OET relevant' : ''}`
      )
      .join('\n')

    const prompt = `A language learner just watched: "${currentVideo.title}" (Level: ${currentVideo.level.toUpperCase()}, Topic: ${currentVideo.topic_primary}).
Their comprehension: ${ratingLabel}.

Choose the 3 BEST next videos from these candidates. Prioritise appropriate difficulty level, topic variety or continuity, and OET nursing relevance when high.

Candidates:
${candidateList}

Respond with ONLY this JSON, no other text:
{"suggested_ids": ["<uuid>", "<uuid>", "<uuid>"]}`

    try {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 128,
        messages: [{ role: 'user', content: prompt }],
      })

      const text = message.content[0]?.text?.trim() || ''
      const parsed = extractJson(text)
      const validIds = new Set(candidates.map(c => c.id))

      suggestedIds = (parsed?.suggested_ids || [])
        .filter(id => typeof id === 'string' && validIds.has(id))
        .slice(0, 3)

      if (suggestedIds.length === 0) {
        suggestedIds = candidates.slice(0, 3).map(c => c.id)
      }
    } catch {
      // Fallback to first 3 candidates
      suggestedIds = candidates.slice(0, 3).map(c => c.id)
    }

    // Cache suggestions globally
    try {
      await sql`
        INSERT INTO next_video_suggestions (video_id, comprehension_rating, suggested_video_ids)
        VALUES (${videoId}, ${comprehensionRating}, ${suggestedIds})
        ON CONFLICT (video_id, comprehension_rating)
        DO UPDATE SET suggested_video_ids = EXCLUDED.suggested_video_ids, generated_at = now()
      `
    } catch {
      // Cache write failure is non-fatal
    }
  }

  // Fetch full details for suggested videos (3 individual queries — safe, no array param needed)
  const suggestionRows = await Promise.all(
    suggestedIds.map(id =>
      sql`
        SELECT id, youtube_id, title, channel_name, thumbnail_url,
               level, topic_primary, topic_secondary, oet_relevance, duration_seconds
        FROM videos WHERE id = ${id} AND is_available = true
      `.then(rows => rows[0] || null)
    )
  )

  return res.status(200).json({ suggestions: suggestionRows.filter(Boolean) })
}
