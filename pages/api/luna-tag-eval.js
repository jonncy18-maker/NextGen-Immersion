import { getDb } from '../../lib/api/_db.js'
import { verifyAdmin } from '../../lib/api/_auth.js'
import { buildLevelTopicPrompt, parseLevelTopic } from '../../lib/api/_tag.js'
import { callLuna } from '../../lib/api/_ai.js'

// TEMPORARY — delete this file and public/luna-eval.html once the wave 2
// agreement check has been read (ROADMAP.md, "Luna tagging agreement check").
//
// Admin-only and read-only: tags a batch of existing videos with Luna using the
// exact production level/topic prompt and parser, and returns the result next to
// the label already stored in Neon. Nothing is written, and Luna is called
// directly with no Haiku fallback, so a Luna failure counts against the result
// instead of being papered over.
//
//   ?part=admin                    the videos with an admin-overridden level
//   ?part=sample&offset=0&limit=34 a stable slice of the AI-tagged videos
export const config = { maxDuration: 60 }

const CONCURRENCY = 8

async function mapPool(items, fn) {
  const out = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  return out
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const sql = getDb()
  const authUser = await verifyAdmin(req.headers.authorization, sql)
  if (!authUser) return res.status(403).json({ error: 'Forbidden' })

  if (!process.env.OPENAI_API_KEY) {
    return res.status(400).json({ error: 'OPENAI_API_KEY is not set in this environment.' })
  }

  const part = req.query.part === 'admin' ? 'admin' : 'sample'
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 34, 1), 50)
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0)

  const videos =
    part === 'admin'
      ? await sql`
          SELECT id, title, description, level, topic_primary, level_source
          FROM videos WHERE level_source = 'admin' AND language = 'english'
          ORDER BY id`
      : await sql`
          SELECT id, title, description, level, topic_primary, level_source
          FROM videos WHERE level_source = 'ai' AND language = 'english'
          ORDER BY md5(id::text)
          LIMIT ${limit} OFFSET ${offset}`

  const rows = await mapPool(videos, async (v) => {
    const base = {
      id: v.id,
      title: v.title,
      source: v.level_source,
      stored_level: v.level,
      stored_topic: v.topic_primary,
    }
    try {
      const text = await callLuna({
        prompt: buildLevelTopicPrompt({ title: v.title, description: v.description || '' }),
        maxTokens: 128,
      })
      const t = parseLevelTopic(text)
      return { ...base, luna_level: t.level, luna_topic: t.topic_primary }
    } catch (err) {
      return { ...base, luna_level: null, luna_topic: null, error: String(err?.message || err) }
    }
  })

  return res.status(200).json({ part, rows })
}
