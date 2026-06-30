import { getDb } from '../../lib/api/_db.js'
import { verifySession } from '../../lib/api/_auth.js'
import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-haiku-4-5'

const LEVEL_NAMES = {
  a1: 'A1 Starter', a2: 'A2 Elementary',
  b1: 'B1 Pre-Intermediate', b2: 'B2 Upper Intermediate',
  c1: 'C1 Advanced', c2: 'C2 Mastery',
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authUser = await verifySession(req.headers.authorization)
  if (!authUser) return res.status(401).json({ error: 'Unauthorized' })

  const sql = getDb()

  // Check 24h cache
  const [cached] = await sql`
    SELECT message, generated_at FROM progress_coaching
    WHERE user_id = ${authUser.id}
      AND generated_at > now() - interval '24 hours'
  `
  if (cached) {
    return res.status(200).json({ message: cached.message })
  }

  // Fetch progress data for this scholar
  const [pace] = await sql`
    SELECT sp.current_hours, sp.expected_hours, sp.target_hours,
           sp.target_date, sp.target_level, sp.status,
           sp.hours_this_week, sp.start_date,
           u.scholar_name
    FROM scholar_pace sp
    JOIN users u ON u.id = sp.user_id
    WHERE sp.user_id = ${authUser.id}
  `

  if (!pace || pace.status === 'PENDING') {
    return res.status(200).json({ message: null })
  }

  const currentHours = Number(pace.current_hours ?? 0)
  const expectedHours = Number(pace.expected_hours ?? 0)
  const targetHours = Number(pace.target_hours ?? 0)
  const hoursThisWeek = Number(pace.hours_this_week ?? 0)
  const delta = currentHours - expectedHours
  const levelName = LEVEL_NAMES[pace.target_level] ?? pace.target_level

  const targetDateStr = pace.target_date
    ? new Date(pace.target_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null

  const prompt = `You are a warm, encouraging English language coach for a nursing student learning English for the OET exam.

Scholar: ${pace.scholar_name || 'Scholar'}
Goal: Reach ${levelName} (${targetHours} hours of comprehensible input)${targetDateStr ? ` by ${targetDateStr}` : ''}
Current hours: ${currentHours.toFixed(1)}h
Expected by now: ${expectedHours.toFixed(1)}h
Status: ${pace.status === 'ON_TRACK' ? 'ON TRACK' : 'BEHIND PACE'}
Hours this week: ${hoursThisWeek.toFixed(1)}h
${delta >= 0 ? `Ahead by ${delta.toFixed(1)}h` : `Behind by ${Math.abs(delta).toFixed(1)}h`}

Write a 2–3 sentence personal coaching message. Be warm, specific, and motivating. Reference their actual numbers. If they are behind, gently encourage without alarming. If ahead, celebrate and encourage consistency.`

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = message.content[0]?.text?.trim() || ''
    if (!text) return res.status(200).json({ message: null })

    // Cache it
    await sql`
      INSERT INTO progress_coaching (user_id, message)
      VALUES (${authUser.id}, ${text})
      ON CONFLICT (user_id) DO UPDATE SET message = EXCLUDED.message, generated_at = now()
    `

    return res.status(200).json({ message: text })
  } catch {
    return res.status(500).json({ error: 'AI error' })
  }
}
