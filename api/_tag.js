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
const CEFR_MAP = `super_beginner=A1-A2, beginner=A2-B1, intermediate=B1-B2, advanced=B2-C1`

const LEVELS = ['super_beginner', 'beginner', 'intermediate', 'advanced']

/**
 * Classify a YouTube channel's CEFR level using channel metadata.
 * Returns one of: 'super_beginner' | 'beginner' | 'intermediate' | 'advanced'
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
Level must be exactly one of: super_beginner, beginner, intermediate, advanced`

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 64,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0]?.text?.trim() || ''
  try {
    const parsed = JSON.parse(text)
    if (LEVELS.includes(parsed.level)) return parsed.level
  } catch {}
  // Fallback: scan text for a level keyword
  for (const lvl of LEVELS) {
    if (text.includes(lvl)) return lvl
  }
  return 'beginner' // safe default
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
- level must be exactly one of: super_beginner, beginner, intermediate, advanced
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
    const level = LEVELS.includes(parsed.level) ? parsed.level : 'beginner'
    const topic_primary = TOPIC_TAGS.includes(parsed.topic_primary) ? parsed.topic_primary : 'Daily Life'
    const topic_secondary = TOPIC_TAGS.includes(parsed.topic_secondary) ? parsed.topic_secondary : null
    return { level, topic_primary, topic_secondary }
  } catch {
    return { level: 'beginner', topic_primary: 'Daily Life', topic_secondary: null }
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
