import { getAdminDb } from '../../lib/api/_db.js';
import { verifyAdmin } from '../../lib/api/_auth.js';
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-haiku-4-5';

// Admin-only. On-demand analysis of everything a scholar watched (finished OR
// unfinished) within an admin-selected date range. Aggregates the watch_sessions
// in that window per video and asks Haiku to surface concrete topics/questions
// the coordinator can raise in a live conversation with the scholar. Results are
// range-specific and NOT cached — each range is a fresh query.
export default async function handler(req, res) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' });

  const sql = getAdminDb();
  const authUser = await verifyAdmin(req.headers.authorization, sql);
  if (!authUser) return res.status(403).json({ error: 'Forbidden' });

  const { userId, startDate, endDate } = req.body || {};
  if (!userId || !startDate || !endDate) {
    return res
      .status(400)
      .json({ error: 'userId, startDate and endDate required' });
  }
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRe.test(startDate) || !dateRe.test(endDate)) {
    return res
      .status(400)
      .json({ error: 'Invalid date format (expected YYYY-MM-DD)' });
  }
  if (startDate > endDate) {
    return res
      .status(400)
      .json({ error: 'startDate must be on or before endDate' });
  }

  const [userRow] =
    await sql`SELECT scholar_name, language FROM users WHERE id = ${userId}`;
  if (!userRow) return res.status(404).json({ error: 'Scholar not found' });
  const scholarName = userRow.scholar_name || 'the scholar';
  const language = userRow.language || 'english';

  // One row per video watched in the window, with total time and whether ANY
  // session in the window completed it. Manila-day boundaries match the rest of
  // the app's date math (see CLAUDE.md goal-clock rule).
  const rows = await sql`
    SELECT
      v.title,
      v.channel_name,
      v.level,
      v.topic_primary,
      v.topic_secondary,
      v.oet_relevance,
      SUM(ws.seconds_watched)::int              AS seconds_watched,
      bool_or(ws.completed)                      AS completed,
      COUNT(*)::int                              AS session_count
    FROM watch_sessions ws
    JOIN videos v ON v.id = ws.video_id
    WHERE ws.user_id = ${userId}
      AND ws.language = ${language}
      AND (ws.started_at AT TIME ZONE 'Asia/Manila')::date >= ${startDate}::date
      AND (ws.started_at AT TIME ZONE 'Asia/Manila')::date <= ${endDate}::date
    GROUP BY v.id, v.title, v.channel_name, v.level, v.topic_primary, v.topic_secondary, v.oet_relevance
    ORDER BY seconds_watched DESC
  `;

  const totalSeconds = rows.reduce((s, r) => s + (r.seconds_watched || 0), 0);
  const stats = {
    range: { start: startDate, end: endDate },
    videos_count: rows.length,
    total_minutes: Math.round(totalSeconds / 60),
    completed_count: rows.filter((r) => r.completed).length,
    videos: rows.map((r) => ({
      title: r.title,
      channel_name: r.channel_name,
      level: r.level,
      topic_primary: r.topic_primary,
      topic_secondary: r.topic_secondary,
      minutes_watched: Math.round((r.seconds_watched || 0) / 60),
      completed: r.completed,
    })),
  };

  if (rows.length === 0) {
    return res.status(200).json({
      stats,
      message: `${scholarName} has no watch history between ${startDate} and ${endDate}. Pick a wider range or a different window.`,
      generated_at: new Date().toISOString(),
    });
  }

  const videoLines = rows.map((r) => {
    const mins = Math.round((r.seconds_watched || 0) / 60);
    const topics =
      [r.topic_primary, r.topic_secondary].filter(Boolean).join(' / ') ||
      'untagged';
    const status = r.completed ? 'finished' : 'partial';
    const oet = r.oet_relevance ? ` · OET relevance ${r.oet_relevance}/5` : '';
    return `- "${r.title}" (${r.channel_name || 'unknown channel'}) — ${topics} · ${r.level || 'level n/a'} · ${mins} min · ${status}${oet}`;
  });

  const prompt = `You are helping a language-immersion program coordinator prepare for a live conversation with their scholar, ${scholarName}. The scholar is learning ${language} through comprehensible input (watching native-audience videos).

Below is EVERYTHING ${scholarName} watched between ${startDate} and ${endDate} (both finished and partially-watched videos). Each line shows the video, its topic(s), level, minutes watched, and whether it was finished:

${videoLines.join('\n')}

Total: ${rows.length} videos, ~${Math.round(totalSeconds / 60)} minutes.

Based ONLY on what they actually watched, write a short briefing the coordinator can use in a 1-on-1 with ${scholarName}. Use these sections with these exact markdown headings:

## What they've been watching
2-3 sentences on the themes, topics, and levels in this window — note what they gravitated to and anything they started but didn't finish.

## Topics to discuss
4-6 concrete, specific talking points or questions the coordinator can raise, each grounded in a video above. Make them conversational prompts that get the scholar producing language (e.g. "Ask about ..."), not generic advice. Format as a markdown bullet list.

## Suggested focus
1-2 sentences on where to steer next (a topic to lean into, a gap to fill, or something they seem to be avoiding).

Be warm, specific, and practical. Do not invent videos or facts not in the list above.`;

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 900,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = message.content[0]?.text?.trim() || '';
    if (!text)
      return res.status(500).json({ error: 'AI returned empty response' });

    return res
      .status(200)
      .json({ stats, message: text, generated_at: new Date().toISOString() });
  } catch {
    return res.status(500).json({ error: 'AI error' });
  }
}
