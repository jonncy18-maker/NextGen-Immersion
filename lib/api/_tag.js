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

// Ordered lowest→highest so the text-scan fallback matches the most specific level first
const LEVELS = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2']

const CEFR_DESCRIPTIONS = `
a1 = A1 (absolute beginner)
a2 = A2 (elementary)
b1 = B1 (pre-intermediate)
b2 = B2 (upper intermediate)
c1 = C1 (advanced)
c2 = C2 (mastery / native-speaker level)`.trim()

// Extract the first JSON object from a string that may contain preamble/postamble.
function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try { return JSON.parse(match[0]) } catch { return null }
}

// Scan text for the first CEFR level code (case-insensitive, exact token).
function scanLevel(text) {
  const lower = text.toLowerCase()
  // Check for quoted codes first (most specific: "c2" in JSON)
  for (const lvl of [...LEVELS].reverse()) {
    if (lower.includes(`"${lvl}"`)) return lvl
  }
  // Then bare codes
  for (const lvl of [...LEVELS].reverse()) {
    if (lower.includes(lvl)) return lvl
  }
  return null
}

/**
 * Classify a YouTube channel's CEFR level using channel metadata.
 * Returns one of: 'a1' | 'a2' | 'b1' | 'b2' | 'c1' | 'c2'
 */
export async function classifyChannelLevel({ channelName, description = '', sampleTitles = [] }) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const titlesText = sampleTitles.slice(0, 10).map((t, i) => `${i + 1}. ${t}`).join('\n')

  const prompt = `Classify the English difficulty level of this YouTube channel for a language learning app.

CEFR levels (respond using the lowercase code):
${CEFR_DESCRIPTIONS}

Channel name: ${channelName}
Channel description: ${description.slice(0, 500)}
Sample video titles:
${titlesText}

Respond with ONLY this JSON, no other text:
{"level": "<code>"}`

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 64,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0]?.text?.trim() || ''
  const parsed = extractJson(text)
  if (parsed) {
    const lvl = typeof parsed.level === 'string' ? parsed.level.toLowerCase() : ''
    if (LEVELS.includes(lvl)) return lvl
  }
  // Fallback: scan entire response text for a level code
  return scanLevel(text) || 'a2'
}

/**
 * Classify a single video's level AND topics AND OET relevance (parallel Haiku calls).
 * Returns { level, topic_primary, topic_secondary, oet_relevance }
 */
export async function classifyVideo({ title, description = '', language = 'english' }) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const levelTopicPrompt = `Tag this YouTube video for a language learning app.

CEFR levels (respond using the lowercase code):
${CEFR_DESCRIPTIONS}

Available topic tags: ${TOPIC_TAGS.join(', ')}

Video title: ${title}
Video description: ${description.slice(0, 500)}

Respond with ONLY this JSON, no other text:
{"level": "<code>", "topic_primary": "<tag>", "topic_secondary": "<tag or null>"}`

  const [levelTopicMsg, oetScore] = await Promise.all([
    client.messages.create({
      model: MODEL,
      max_tokens: 128,
      messages: [{ role: 'user', content: levelTopicPrompt }],
    }),
    classifyOetRelevance({ title, description }),
  ])

  const text = levelTopicMsg.content[0]?.text?.trim() || ''
  const parsed = extractJson(text)
  if (parsed) {
    const rawLevel = typeof parsed.level === 'string' ? parsed.level.toLowerCase() : ''
    const level = LEVELS.includes(rawLevel) ? rawLevel : (scanLevel(text) || 'a2')
    const topic_primary = TOPIC_TAGS.includes(parsed.topic_primary) ? parsed.topic_primary : 'Daily Life'
    const topic_secondary = TOPIC_TAGS.includes(parsed.topic_secondary) ? parsed.topic_secondary : null
    return { level, topic_primary, topic_secondary, oet_relevance: oetScore }
  }
  return { level: scanLevel(text) || 'a2', topic_primary: 'Daily Life', topic_secondary: null, oet_relevance: oetScore }
}

/**
 * Classify topics only (for channel imports where level is already known).
 * Returns { topic_primary, topic_secondary }
 */
export async function classifyVideoTopics({ title, description = '' }) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const prompt = `Tag this YouTube video for a language learning app.

Available topic tags: ${TOPIC_TAGS.join(', ')}

Video title: ${title}
Video description: ${description.slice(0, 300)}

Respond with ONLY this JSON, no other text:
{"topic_primary": "<tag>", "topic_secondary": "<tag or null>"}`

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 64,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0]?.text?.trim() || ''
  const parsed = extractJson(text)
  if (parsed) {
    const topic_primary = TOPIC_TAGS.includes(parsed.topic_primary) ? parsed.topic_primary : 'Daily Life'
    const topic_secondary = TOPIC_TAGS.includes(parsed.topic_secondary) ? parsed.topic_secondary : null
    return { topic_primary, topic_secondary }
  }
  return { topic_primary: 'Daily Life', topic_secondary: null }
}

/**
 * Rate a video's OET (Occupational English Test) nursing relevance on a 1–5 scale.
 * 5 = directly OET-useful (clinical, patient dialogues, medical English)
 * 1 = compelling interest only (travel, culture, entertainment)
 * Returns an integer 1–5.
 */
export async function classifyOetRelevance({ title, description = '' }) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const prompt = `Rate this YouTube video's relevance for OET (Occupational English Test) nursing exam preparation.

Video title: ${title}
Video description: ${description.slice(0, 300)}

Score 1-5:
5 = Directly OET-useful: clinical communication, patient scenarios, medical English, nurse-patient dialogues
4 = Highly relevant: healthcare, hospital, medical terminology, professional workplace English
3 = Somewhat relevant: general professional English, study skills, academic listening
2 = Indirectly relevant: everyday English that builds general listening ability
1 = Compelling interest only: entertainment, travel, culture — CI value but not OET-specific

Respond with ONLY this JSON, no other text:
{"oet_relevance": <integer 1-5>}`

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 32,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0]?.text?.trim() || ''
  const parsed = extractJson(text)
  const score = parsed?.oet_relevance
  if (typeof score === 'number' && score >= 1 && score <= 5) return Math.round(score)
  const m = text.match(/[1-5]/)
  return m ? parseInt(m[0]) : 3
}

/**
 * Classify topics + OET relevance in parallel (for channel imports where level is known).
 * Returns { topic_primary, topic_secondary, oet_relevance }
 */
export async function classifyVideoTopicsAndOet({ title, description = '' }) {
  const [topics, oet] = await Promise.all([
    classifyVideoTopics({ title, description }),
    classifyOetRelevance({ title, description }),
  ])
  return { ...topics, oet_relevance: oet }
}
