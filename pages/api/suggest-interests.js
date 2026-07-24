import { getAdminDb } from '../../lib/api/_db.js';
import { verifyAdmin } from '../../lib/api/_auth.js';
import { TOPIC_TAGS } from '../../lib/api/_tag.js';
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-haiku-4-5';
const LEVEL_LABELS = {
  a1: 'A1',
  a2: 'A2',
  b1: 'B1',
  b2: 'B2',
  c1: 'C1',
  c2: 'C2',
};

// Minimum actual watch time (seconds) for a video to count as "watched" for
// interest-profiling. Filters out incidental / accidental opens so the profile
// reflects genuine engagement, not every click.
const MIN_WATCH_SECONDS = 120;

// Admin-only. Unlike suggest-topics (which fills library GAPS irrespective of
// any scholar), this reads ONE scholar's actual watch history and builds a
// revealed-interest profile from it, then asks Haiku to phrase concrete
// native-content search queries that would surface MORE of what the scholar
// already gravitates toward. Interest is weighted by TIME WATCHED (revealed
// preference), not click count — a video half-watched twice outweighs ten
// videos opened for ten seconds.
export default async function handler(req, res) {
  if (req.method !== 'GET')
    return res.status(405).json({ error: 'Method not allowed' });

  const sql = getAdminDb();
  const authUser = await verifyAdmin(req.headers.authorization, sql);
  if (!authUser) return res.status(403).json({ error: 'Forbidden' });

  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const [userRow] =
    await sql`SELECT scholar_name, language FROM users WHERE id = ${userId}`;
  if (!userRow) return res.status(404).json({ error: 'Scholar not found' });
  const language = userRow.language || 'english';
  const scholarName = userRow.scholar_name || 'this scholar';

  // Per-video engagement for the scholar: total seconds actually watched, joined
  // to the video's tags. Only available videos in the scholar's target language.
  const watched = await sql`
    SELECT
      v.title,
      v.channel_name,
      v.topic_primary,
      v.topic_secondary,
      v.level,
      SUM(ws.seconds_watched)::int AS secs
    FROM watch_sessions ws
    JOIN videos v ON v.id = ws.video_id
    WHERE ws.user_id = ${userId}
      AND v.language = ${language}
    GROUP BY v.id, v.title, v.channel_name, v.topic_primary, v.topic_secondary, v.level
    HAVING SUM(ws.seconds_watched) >= ${MIN_WATCH_SECONDS}
    ORDER BY secs DESC
  `;

  // Need a real watch footprint before a revealed-interest read is meaningful.
  if (watched.length < 3) {
    return res.status(200).json({
      suggestions: [],
      profile: null,
      reason: 'not_enough_history',
      scholarName,
    });
  }

  // Aggregate watched seconds by topic (primary counts full, secondary half —
  // secondary is a weaker signal of what the video is actually about).
  const topicSecs = new Map();
  const channelSecs = new Map();
  for (const r of watched) {
    if (r.topic_primary)
      topicSecs.set(
        r.topic_primary,
        (topicSecs.get(r.topic_primary) || 0) + r.secs
      );
    if (r.topic_secondary)
      topicSecs.set(
        r.topic_secondary,
        (topicSecs.get(r.topic_secondary) || 0) + r.secs * 0.5
      );
    if (r.channel_name)
      channelSecs.set(
        r.channel_name,
        (channelSecs.get(r.channel_name) || 0) + r.secs
      );
  }

  const topTopics = [...topicSecs.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const topChannels = [...channelSecs.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  // Representative watched titles — highest-engagement first, capped so the
  // prompt stays small and the strongest signal dominates.
  const topTitles = watched.slice(0, 12);

  // Most common level among watched videos — anchors the suggested content's
  // difficulty to where the scholar actually is.
  const levelSecs = new Map();
  for (const r of watched)
    if (r.level) levelSecs.set(r.level, (levelSecs.get(r.level) || 0) + r.secs);
  const dominantLevel =
    [...levelSecs.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  const fmtMin = (s) => Math.round(s / 60);
  const topicLines = topTopics
    .map(([t, s]) => `- ${t} (~${fmtMin(s)} min watched)`)
    .join('\n');
  const channelLines = topChannels
    .map(([c, s]) => `- ${c} (~${fmtMin(s)} min watched)`)
    .join('\n');
  const titleLines = topTitles
    .map(
      (r, i) =>
        `${i + 1}. "${r.title}" — ${r.channel_name || 'unknown channel'}`
    )
    .join('\n');

  const N = Math.min(6, Math.max(4, topTitles.length));
  const topicList = TOPIC_TAGS.join(', ');

  const prompt = `You are helping an admin grow a language-immersion video library around what a scholar actually enjoys watching. Below is ${scholarName}'s revealed interest profile, built from their real watch history (weighted by time watched).

TOP TOPICS BY WATCH TIME:
${topicLines || '- (none tagged)'}

FAVORITE CHANNELS BY WATCH TIME:
${channelLines || '- (none)'}

VIDEOS THEY ACTUALLY WATCHED (highest engagement first):
${titleLines}

${dominantLevel ? `Their content sits mostly at CEFR level ${LEVEL_LABELS[dominantLevel]}.` : ''}

Suggest ${N} new YouTube search queries that would surface MORE native-audience content (vlogs, storytime, podcasts, documentaries, interviews) matching these revealed interests — the goal is more of what this scholar clearly gravitates toward, with enough variety to keep the library fresh. The query must NOT contain the word "English" or any CEFR code (A1/A2/B1/B2/C1/C2). Keep each query short (4-8 words) and specific enough to return real results.

For each query, also pick the single closest matching topic from this exact list: ${topicList}. And write a short (max 12 words) reason tying it to the scholar's history.

Respond with ONLY this JSON, no other text:
{"suggestions": [{"query": "<query text>", "topic": "<one topic from the list>", "reason": "<why it fits>"}, ...]} (exactly ${N} items)`;

  // Fallback: build simple "<top channel/topic> vlog"-style queries so the
  // feature still returns something useful if the AI call fails.
  const fallbackTopics = topTopics.map(([t]) => t);
  let suggestions = fallbackTopics.slice(0, N).map((t) => ({
    query: `${t.toLowerCase()} vlog`,
    topic: TOPIC_TAGS.includes(t) ? t : '',
    reason: `Matches a topic ${scholarName} watches often.`,
  }));

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = message.content[0]?.text?.trim() || '';
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) : null;
    const list = parsed?.suggestions;
    if (Array.isArray(list) && list.length > 0) {
      suggestions = list
        .filter((s) => typeof s?.query === 'string' && s.query.trim())
        .map((s) => {
          const topic =
            typeof s.topic === 'string' && TOPIC_TAGS.includes(s.topic)
              ? s.topic
              : '';
          return {
            query: s.query.trim(),
            topic,
            reason: typeof s.reason === 'string' ? s.reason.trim() : '',
            label: topic || 'Interest',
          };
        });
    }
  } catch {
    // Keep the fallback suggestions built above.
  }

  // Ensure every suggestion carries a display label even on the fallback path.
  suggestions = suggestions.map((s) => ({
    ...s,
    label: s.label || s.topic || 'Interest',
  }));

  const profile = {
    topTopics: topTopics.map(([topic, secs]) => ({
      topic,
      minutes: fmtMin(secs),
    })),
    topChannels: topChannels.map(([channel, secs]) => ({
      channel,
      minutes: fmtMin(secs),
    })),
    videosWatched: watched.length,
    dominantLevel,
  };

  return res.status(200).json({ suggestions, profile, scholarName });
}
