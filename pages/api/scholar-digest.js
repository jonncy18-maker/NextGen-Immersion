import { getAdminDb } from '../../lib/api/_db.js'
import { verifyAdmin } from '../../lib/api/_auth.js'
import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-haiku-4-5'

const LEVEL_NAMES = {
  a1: 'A1', a2: 'A2', b1: 'B1', b2: 'B2', c1: 'C1', c2: 'C2',
}

export default async function handler(req, res) {
  const sql = getAdminDb()
  const authUser = await verifyAdmin(req.headers.authorization, sql)
  if (!authUser) return res.status(403).json({ error: 'Forbidden' })

  const userId = req.method === 'GET'
    ? req.query.userId
    : req.body?.userId

  if (!userId) return res.status(400).json({ error: 'userId required' })

  if (req.method === 'GET') {
    // Return cached digest if < 24h old
    const [cached] = await sql`
      SELECT message, generated_at FROM scholar_digests
      WHERE user_id = ${userId}
        AND generated_at > now() - interval '24 hours'
    `
    if (cached) {
      return res.status(200).json({
        message: cached.message,
        generated_at: cached.generated_at,
      })
    }
    // Return stale digest (no message: null — show stale data with timestamp)
    const [stale] = await sql`
      SELECT message, generated_at FROM scholar_digests WHERE user_id = ${userId}
    `
    if (stale) {
      return res.status(200).json({ message: stale.message, generated_at: stale.generated_at })
    }
    return res.status(200).json({ message: null, generated_at: null })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Fetch scholar data
  const [pace] = await sql`
    SELECT sp.*, u.scholar_name, u.language
    FROM scholar_pace sp
    JOIN users u ON u.id = sp.user_id
    WHERE sp.user_id = ${userId}
  `
  if (!pace) return res.status(404).json({ error: 'Scholar not found' })

  const currentHours = Number(pace.current_hours ?? 0)
  const expectedHours = Number(pace.expected_hours ?? 0)
  const targetHours = Number(pace.target_hours ?? 0)
  const hoursThisWeek = Number(pace.hours_this_week ?? 0)
  const delta = currentHours - expectedHours

  // Recent comprehension ratings (last 30 days)
  const ratings = await sql`
    SELECT cr.rating, v.topic_primary, v.level
    FROM comprehension_ratings cr
    JOIN videos v ON v.id = cr.video_id
    WHERE cr.user_id = ${userId}
      AND cr.rated_at > now() - interval '30 days'
    ORDER BY cr.rated_at DESC
    LIMIT 20
  `

  const avgRating = ratings.length > 0
    ? (ratings.reduce((s, r) => s + r.rating, 0) / ratings.length).toFixed(1)
    : null

  const topTopics = Object.entries(
    ratings.reduce((acc, r) => {
      acc[r.topic_primary] = (acc[r.topic_primary] || 0) + 1
      return acc
    }, {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t)

  const targetDateStr = pace.target_date
    ? new Date(pace.target_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'no target date set'

  const prompt = `You are an admin assistant helping a program coordinator understand a scholar's progress.

Scholar: ${pace.scholar_name}
Current level: ${LEVEL_NAMES[pace.target_level] ?? pace.target_level} goal (${targetHours}h target by ${targetDateStr})
Hours logged: ${currentHours.toFixed(1)}h / Expected: ${expectedHours.toFixed(1)}h
Status: ${pace.status === 'ON_TRACK' ? 'On Track' : pace.status === 'AT_RISK' ? 'At Risk' : 'Pending'}
${delta >= 0 ? `Ahead by ${delta.toFixed(1)}h` : `Behind by ${Math.abs(delta).toFixed(1)}h`}
This week: ${hoursThisWeek.toFixed(1)}h
${avgRating ? `Avg comprehension (last 30 days): ${avgRating}/3 (${ratings.length} ratings)` : 'No comprehension ratings yet'}
${topTopics.length > 0 ? `Favourite topics: ${topTopics.join(', ')}` : ''}

Write a 3–4 sentence admin digest that summarises this scholar's engagement pattern, pace, and any observations worth noting. Be factual and actionable for a coordinator.`

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
      INSERT INTO scholar_digests (user_id, message)
      VALUES (${userId}, ${text})
      ON CONFLICT (user_id) DO UPDATE SET message = EXCLUDED.message, generated_at = now()
    `

    return res.status(200).json({ message: text, generated_at: new Date().toISOString() })
  } catch {
    return res.status(500).json({ error: 'AI error' })
  }
}
