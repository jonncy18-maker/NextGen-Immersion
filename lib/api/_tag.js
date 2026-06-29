import Anthropic from "@anthropic-ai/sdk"

const MODEL = "claude-haiku-4-5"

export const TOPIC_TAGS = [
  'Medical & Nursing',
  'Work & Career',
  'Academic & Study',
  'Daily Life',
  'Travel & Places',
  'Social & Relationships',
  'Food & Cooking',
  'Culture & Entertainment',
  'Sports & Fitness',
  'News & Events',
]

// CEFR mapping — used in prompts only; no qualitative descriptions
const CEFR_MAP = `a1=A1, a2=A2, b1=B1, b2=B2, c1=C1, c2=C2`

const LEVELS = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2']

/**
 * Classify a YouTube channel's CEFR level using channel metadata.
 * Returns one of: 'a1' | 'a2' | 'b1' | 'b2' | 'c1' | 'c2'
 */
export async function classifyChannelLevel({ channelName, description = '', sampleTitles = [] }) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const titlesText = sampleTitles.slice(0, 10).map((t, i) => `${i + 1}. ${t}`).join('\n')

  const prompt = `You are classifying a YouTube channel's English language difficulty level for a comprehensible input (CI) language learning platform.

CEFR level mapping: ${CEFR_MAP}

Channel name: ${channelName}
Channel description: ${description.slice(0, 500)}
Sample video titles:
${titlesText}

Based ONLY on the CEFR level mapping above, classify this channel's primary English difficulty level.
Respond with a JSON object: {"level": "<level>"}
Level must be exactly one of: a1, a2, b1, b2, c1, c2`

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 64,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0]?.text?.trim() || ''
  try {
    const parsed = JSON.parse(text)
    const lvl = typeof parsed.level === 'string' ? parsed.level.toLowerCase() : ''
    if (LEVELS.includes(lvl)) return lvl
  } catch {}
  // Fallback: scan text case-insensitively for a level keyword
  const textLower = text.toLowerCase()
  for (const lvl of LEVELS) {
    if (textLower.includes(lvl)) return lvl
  }
  return 'a2' // safe default
}

/**
 * Classify a single video's level AND topics.
 * Returns { level, topic_primary, topic_secondary }
 */
export async function classifyVideo({ title, description = '', language = 'english' }) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const prompt = `You are tagging a YouTube video for a comprehensible input (CI) language learning platform.

CEFR level mapping: ${CEFR_MAP}

Available topic tags: ${TOPIC_TAGS.join(', ')}

Video title: ${title}
Video description: ${description.slice(0, 500)}

Classify the video. Respond with a JSON object:
{"level": "<level>", "topic_primary": "<tag>", "topic_secondary": "<tag or null>"}

Rules:
- level must be exactly one of: a1, a2, b1, b2, c1, c2
- topic_primary must be exactly one of the available topic tags
- topic_secondary must be exactly one of the available topic tags OR null (only if a clear second topic applies)
- Use ONLY the CEFR level codes above — no other descriptions`

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 128,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0]?.text?.trim() || ''
  try {
    const parsed = JSON.parse(text)
    const rawLevel = typeof parsed.level === 'string' ? parsed.level.toLowerCase() : ''
    const level = LEVELS.includes(rawLevel) ? rawLevel : 'a2'
    const topic_primary = TOPIC_TAGS.includes(parsed.topic_primary) ? parsed.topic_primary : 'Daily Life'
    const topic_secondary = TOPIC_TAGS.includes(parsed.topic_secondary) ? parsed.topic_secondary : null
    return { level, topic_primary, topic_secondary }
  } catch {
    return { level: 'a2', topic_primary: 'Daily Life', topic_secondary: null }
  }
}

/**
 * Classify topics only (for channel imports where level is already known).
 * Returns { topic_primary, topic_secondary }
 */
export async function classifyVideoTopics({ title, description = '' }) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const prompt = `You are tagging a YouTube video for a comprehensible input (CI) language learning platform.

Available topic tags: ${TOPIC_TAGS.join(', ')}

Video title: ${title}
Video description: ${description.slice(0, 300)}

Pick 1-2 topic tags. Respond with JSON: {"topic_primary": "<tag>", "topic_secondary": "<tag or null>"}
Both values must be exactly one of the available topic tags, or null for topic_secondary.`

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 64,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0]?.text?.trim() || ''
  try {
    const parsed = JSON.parse(text)
    const topic_primary = TOPIC_TAGS.includes(parsed.topic_primary) ? parsed.topic_primary : 'Daily Life'
    const topic_secondary = TOPIC_TAGS.includes(parsed.topic_secondary) ? parsed.topic_secondary : null
    return { topic_primary, topic_secondary }
  } catch {
    return { topic_primary: 'Daily Life', topic_secondary: null }
  }
}
