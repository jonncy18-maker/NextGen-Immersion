import { getAdminDb } from '../../lib/api/_db.js'
import { verifyAdmin } from '../../lib/api/_auth.js'
import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-haiku-4-5'

async function getTopicCounts(sql, userId, language) {
  return sql`
    SELECT
      v.topic_primary AS topic,
      COUNT(*) FILTER (WHERE COALESCE(vm.watched, uvs.completed, false))::int AS watched_count,
      COUNT(*)::int AS total_available
    FROM videos v
    LEFT JOIN user_video_status uvs
      ON uvs.video_id = v.id AND uvs.user_id = ${userId}
    LEFT JOIN video_marks vm
      ON vm.video_id = v.id AND vm.user_id = ${userId}
    WHERE v.is_available = true AND v.language = ${language} AND v.topic_primary IS NOT NULL
    GROUP BY v.topic_primary
    ORDER BY watched_count DESC
  `
}

export default async function handler(req, res) {
  const sql = getAdminDb()
  const authUser = await verifyAdmin(req.headers.authorization, sql)
  if (!authUser) return res.status(403).json({ error: 'Forbidden' })

  const userId = req.method === 'GET' ? req.query.userId : req.body?.userId
  if (!userId) return res.status(400).json({ error: 'userId required' })

  const [userRow] = await sql`SELECT language FROM users WHERE id = ${userId}`
  if (!userRow) return res.status(404).json({ error: 'Scholar not found' })
  const language = userRow.language || 'english'

  if (req.method === 'GET') {
    const topics = await getTopicCounts(sql, userId, language)

    const [cached] = await sql`
      SELECT message, generated_at FROM scholar_topic_insights
      WHERE user_id = ${userId} AND generated_at > now() - interval '24 hours'
    `
    if (cached) {
      return res.status(200).json({ topics, message: cached.message, generated_at: cached.generated_at })
    }
    const [stale] = await sql`
      SELECT message, generated_at FROM scholar_topic_insights WHERE user_id = ${userId}
    `
    return res.status(200).json({
      topics,
      message: stale?.message ?? null,
      generated_at: stale?.generated_at ?? null,
    })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const topics = await getTopicCounts(sql, userId, language)
  if (topics.length === 0) {
    return res.status(200).json({ topics, message: 'Not enough tagged videos yet to spot trends.', generated_at: null })
  }

  const lines = topics.map(t => {
    const unwatched = t.total_available - t.watched_count
    return `${t.topic}: watched ${t.watched_count}/${t.total_available} (${unwatched} unwatched left)`
  })

  const prompt = `You are an admin assistant helping a program coordinator decide what content to add to a scholar's video library.

Per-topic watch breakdown for this scholar (topic: watched/total available, unwatched remaining):
${lines.join('\n')}

Write a 3–4 sentence note that: (1) identifies which topics this scholar clearly gravitates toward, (2) flags any topics they avoid, and (3) calls out specific topics where the unwatched inventory is running low and more content should be added. Be factual and actionable for a coordinator.`

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = message.content[0]?.text?.trim() || ''
    if (!text) return res.status(500).json({ error: 'AI returned empty response' })

    await sql`
      INSERT INTO scholar_topic_insights (user_id, message)
      VALUES (${userId}, ${text})
      ON CONFLICT (user_id) DO UPDATE SET message = EXCLUDED.message, generated_at = now()
    `

    return res.status(200).json({ topics, message: text, generated_at: new Date().toISOString() })
  } catch {
    return res.status(500).json({ error: 'AI error' })
  }
}
