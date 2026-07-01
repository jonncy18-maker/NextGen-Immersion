import { getDb } from '../../lib/api/_db.js'
import { verifyAdmin } from '../../lib/api/_auth.js'
import { TOPIC_TAGS } from '../../lib/api/_tag.js'
import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-haiku-4-5'
const LEVELS = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2']
const LEVEL_LABELS = { a1: 'A1', a2: 'A2', b1: 'B1', b2: 'B2', c1: 'C1', c2: 'C2' }

// Admin-only. Surfaces genuinely under-represented (topic, level) combos from
// the live library and asks Haiku to phrase each as a concrete native-content
// search query — the point is topic VARIETY, so it deliberately samples from
// the thin end of the distribution rather than always the single thinnest
// cell, and randomizes which of the thinnest cells get suggested each call.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const sql = getDb()
  const authUser = await verifyAdmin(req.headers.authorization, sql)
  if (!authUser) return res.status(403).json({ error: 'Forbidden' })

  const counts = await sql`
    SELECT topic_primary, level, COUNT(*)::int AS n
    FROM videos
    WHERE is_available = true AND language = 'english'
    GROUP BY topic_primary, level
  `
  const countMap = new Map(counts.map(r => [`${r.topic_primary}|${r.level}`, r.n]))

  const grid = []
  for (const topic of TOPIC_TAGS) {
    for (const level of LEVELS) {
      grid.push({ topic, level, count: countMap.get(`${topic}|${level}`) || 0 })
    }
  }
  grid.sort((a, b) => a.count - b.count)

  // Sample 5 from the 12 thinnest cells (shuffled) so repeated clicks surface
  // different gaps rather than the identical suggestions every time.
  const pool = grid.slice(0, 12)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  const picked = pool.slice(0, 5)

  const cellList = picked
    .map((c, i) => `${i + 1}. Topic: ${c.topic} | Level: ${LEVEL_LABELS[c.level]} | Current library count: ${c.count}`)
    .join('\n')

  const prompt = `You are helping an admin diversify a language-immersion video library. These (topic, level) combinations are under-represented and need more content:

${cellList}

For EACH one, write a concrete YouTube search query that would find NATIVE-AUDIENCE content (vlogs, storytime, podcasts, documentaries, interviews) — NOT "learn English" or ESL-teaching channels. The query must NOT contain the word "English" or any CEFR code (A1/A2/B1/B2/C1/C2). Keep each query short (4-8 words) and specific enough to return real results, not generic.

Respond with ONLY this JSON, no other text:
{"suggestions": [{"query": "<query text>"}, ...]}  (exactly ${picked.length} items, same order as the list above)`

  let queries = picked.map(c => `${c.topic.toLowerCase()} vlog`)
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = message.content[0]?.text?.trim() || ''
    const match = text.match(/\{[\s\S]*\}/)
    const parsed = match ? JSON.parse(match[0]) : null
    const list = parsed?.suggestions
    if (Array.isArray(list) && list.length === picked.length) {
      queries = list.map((s, i) =>
        typeof s?.query === 'string' && s.query.trim() ? s.query.trim() : queries[i],
      )
    }
  } catch {
    // Fall back to the generic "<topic> vlog" queries built above
  }

  const suggestions = picked.map((c, i) => ({
    topic: c.topic,
    level: c.level,
    count: c.count,
    query: queries[i],
    label: `${c.topic} · ${LEVEL_LABELS[c.level]}`,
  }))

  return res.status(200).json({ suggestions })
}
