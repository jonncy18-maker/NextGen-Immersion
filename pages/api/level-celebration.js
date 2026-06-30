import { getDb } from '../../lib/api/_db.js'
import { verifySession } from '../../lib/api/_auth.js'
import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-haiku-4-5'

// Mirrors src/utils/levels.js — must stay in sync
const LEVELS = [
  { id: 'a1', name: 'A1 Starter',           minHours: 0    },
  { id: 'a2', name: 'A2 Elementary',        minHours: 150  },
  { id: 'b1', name: 'B1 Pre-Intermediate',  minHours: 300  },
  { id: 'b2', name: 'B2 Upper Intermediate',minHours: 600  },
  { id: 'c1', name: 'C1 Advanced',          minHours: 1000 },
  { id: 'c2', name: 'C2 Mastery',           minHours: 1500 },
]

function getLevelForHours(hours) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (hours >= LEVELS[i].minHours) return LEVELS[i]
  }
  return LEVELS[0]
}

export default async function handler(req, res) {
  const authUser = await verifySession(req.headers.authorization)
  if (!authUser) return res.status(401).json({ error: 'Unauthorized' })

  const sql = getDb()

  if (req.method === 'POST') {
    // Dismiss a celebration
    const { level } = req.body || {}
    if (!level) return res.status(400).json({ error: 'level required' })
    try {
      await sql`
        UPDATE level_celebrations SET dismissed = true
        WHERE user_id = ${authUser.id} AND level = ${level}
      `
      return res.status(200).json({ ok: true })
    } catch {
      return res.status(500).json({ error: 'Database error' })
    }
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Get user's current hours
  const [hoursRow] = await sql`
    SELECT total_hours, language FROM user_total_hours
    WHERE user_id = ${authUser.id}
  `
  const currentHours = Number(hoursRow?.total_hours ?? 0)
  const currentLevel = getLevelForHours(currentHours)

  // A1 is the starting level — don't celebrate it
  if (currentLevel.id === 'a1') {
    return res.status(200).json({ level: null, message: null })
  }

  // Check for existing celebration for this level
  const [existing] = await sql`
    SELECT dismissed, message FROM level_celebrations
    WHERE user_id = ${authUser.id} AND level = ${currentLevel.id}
  `

  if (existing?.dismissed) {
    return res.status(200).json({ level: null, message: null })
  }

  if (existing && !existing.dismissed) {
    return res.status(200).json({
      level: currentLevel.id,
      level_name: currentLevel.name,
      message: existing.message,
    })
  }

  // No row yet — generate a celebration message
  const [userRow] = await sql`SELECT scholar_name FROM users WHERE id = ${authUser.id}`
  const name = userRow?.scholar_name || 'Scholar'

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const prompt = `Write a joyful, warm 2-sentence celebration message for ${name}, a nursing student who just reached ${currentLevel.name} English level (${currentHours.toFixed(0)} hours of listening). Make it personal and mention this is a real milestone on their journey to OET nursing certification. Be enthusiastic but not over the top.`

    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 192,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = message.content[0]?.text?.trim() || ''
    if (!text) return res.status(200).json({ level: null, message: null })

    await sql`
      INSERT INTO level_celebrations (user_id, level, message)
      VALUES (${authUser.id}, ${currentLevel.id}, ${text})
      ON CONFLICT (user_id, level) DO NOTHING
    `

    return res.status(200).json({
      level: currentLevel.id,
      level_name: currentLevel.name,
      message: text,
    })
  } catch {
    return res.status(500).json({ error: 'AI error' })
  }
}
