// MCP tool catalog for NGS Immersion — every tool is a thin wrapper around
// one of this app's own pages/api/* routes, called over a same-origin
// server-to-server fetch. No tool touches the Anthropic API, Neon, or the
// YouTube Data API directly (AGENTS.md's API key security rule) — the MCP
// server does exactly what the admin dashboard's UI does, through the same
// validation, idempotency and AI-tagging code paths.
//
// Auth model: this app has real per-scholar accounts (Neon Auth JWT), but
// the MCP connector is a single always-on integration, not a scholar
// logging in — so it authenticates to these routes with the MCP server's
// own shared secret (IMMERSION_MCP_TOKEN) instead of a JWT. See
// lib/api/_auth.js's parseMcpToken for the two forms this takes:
//   - A bare secret resolves to a real admin user row, so every admin-gated
//     route (verifyAdmin, or a manual `role !== 'admin'` inline check) just
//     works. Most tools below use this ("admin" tools).
//   - `secret:<userId>` impersonates that scholar, for the handful of
//     routes with no admin/cross-scholar variant at all (mark-video,
//     watch-later, next-video, level-celebration, progress-coaching,
//     rate-comprehension, and the one full per-scholar progress.js
//     endpoint). Tools that need this take an explicit `scholarId` input
//     and are marked `scholarAuth: true` below — executeTool folds it into
//     the Authorization header rather than forwarding it as a body/query
//     field, since the target route never expects a userId param (it reads
//     the caller's own JWT `sub`).
//
// Three real routes are deliberately NOT wrapped as tools:
//   - flush-session.js — real-time video-playback telemetry keyed by a
//     client-generated idempotency id; not a "thing an admin decides to do".
//   - daily-calendar.js / videos.js — scholar-self-JWT-scoped duplicates of
//     scholar-calendar.js / scholar-videos.js, which are strictly more
//     capable (no arbitrary result cap) and already cover the same data for
//     any scholar. Use get_scholar_calendar / get_scholar_videos instead.

const DATE = { type: 'string', description: 'YYYY-MM-DD' };
const ID = { type: 'string', description: 'Row id (uuid) exactly as returned by a list/get tool' };
const USER_ID = { type: 'string', description: "A scholar's users.id (uuid) — get it from list_scholars" };
const LEVEL = { type: 'string', enum: ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'] };
const TOPIC = {
  type: 'string',
  enum: [
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
  ],
};

function obj(properties, required = []) {
  return { type: 'object', properties, required };
}

// Every tool maps to one allowlisted pages/api endpoint. `path` may be a
// string or a function of the validated input (for GET query strings).
// `scholarAuth: true` means the tool's `scholarId` field is consumed into
// the impersonation header rather than forwarded to the route.
const CATALOG = [
  // ---- Scholar roster & goals ----
  {
    name: 'list_scholars',
    description:
      'Every scholar with their current pace: hours (video/library, video-external, ChatGPT, mentor-call), status (PENDING/ON_TRACK/AT_RISK), expected vs current hours, delta, and category targets. The main admin roster view.',
    method: 'GET',
    path: '/api/scholars',
    input_schema: obj({}),
  },
  {
    name: 'get_me',
    description: "The MCP's own admin identity (role, display_name, email) — a sanity check, not scholar data.",
    method: 'GET',
    path: '/api/me',
    input_schema: obj({}),
  },
  {
    name: 'get_program_goal',
    description: 'The single active program-wide goal (target level/hours/date) for a language.',
    method: 'GET',
    path: (i) => `/api/program-goal?language=${encodeURIComponent(i.language || 'english')}`,
    input_schema: obj({ language: { type: 'string', description: "default 'english'" } }),
  },
  {
    name: 'update_program_goal',
    description:
      "Update the active program-wide goal in place, or (with action:'applyToAll') stamp its current target_level/target_hours/target_date onto every scholar's individual goal for that language. Updates in place rather than replacing the active row, since scholar_pace only ever joins the currently-active program_goals row — replacing it would orphan every scholar to PENDING.",
    method: 'POST',
    path: '/api/program-goal',
    input_schema: obj({
      language: { type: 'string', description: "default 'english'" },
      action: { type: 'string', enum: ['applyToAll'] },
      targetLevel: LEVEL,
      targetHours: { type: 'integer' },
      targetDate: DATE,
    }),
  },
  {
    name: 'get_scholar_goal',
    description: "One scholar's individual goal-clock override (start_date, target level/hours/date, and per-category video/chatgpt/mentor hour targets) layered on top of the program goal.",
    method: 'GET',
    path: (i) => `/api/scholar-goal?userId=${encodeURIComponent(i.userId)}`,
    input_schema: obj({ userId: USER_ID }, ['userId']),
  },
  {
    name: 'set_scholar_goal',
    description:
      "Set a scholar's goal-clock start date and/or target overrides. Setting startDate is what flips a scholar from PENDING to ON_TRACK/AT_RISK — it does not happen automatically at account creation. targetDate must be strictly after startDate if both are given. If targetVideoHours, targetChatgptHours, targetMentorHours AND targetHours are ALL given together, they must sum exactly to targetHours (partial category updates skip this check). Requires an active program goal for the scholar's language to already exist (get_program_goal / update_program_goal first).",
    method: 'POST',
    path: '/api/scholar-goal',
    input_schema: obj(
      {
        userId: USER_ID,
        startDate: DATE,
        targetLevel: LEVEL,
        targetHours: { type: 'integer' },
        targetDate: DATE,
        targetVideoHours: { type: 'integer' },
        targetChatgptHours: { type: 'integer' },
        targetMentorHours: { type: 'integer' },
      },
      ['userId']
    ),
  },

  // ---- Scholar detail views (admin, cross-scholar) ----
  {
    name: 'get_scholar_calendar',
    description: 'Per-day hours breakdown (library/video-external/ChatGPT/mentor) for one scholar, Asia/Manila calendar days.',
    method: 'GET',
    path: (i) => `/api/scholar-calendar?userId=${encodeURIComponent(i.userId)}`,
    input_schema: obj({ userId: USER_ID }, ['userId']),
  },
  {
    name: 'get_scholar_day_detail',
    description: 'The individual watch/external sessions making up one scholar on one specific day (titles, channels, durations, completion).',
    method: 'GET',
    path: (i) => `/api/scholar-day-detail?userId=${encodeURIComponent(i.userId)}&date=${encodeURIComponent(i.date)}`,
    input_schema: obj({ userId: USER_ID, date: DATE }, ['userId', 'date']),
  },
  {
    name: 'get_scholar_videos',
    description: "One scholar's full video library with per-video watched state (no result cap, unlike the scholar's own in-app view).",
    method: 'GET',
    path: (i) => `/api/scholar-videos?userId=${encodeURIComponent(i.userId)}`,
    input_schema: obj({ userId: USER_ID }, ['userId']),
  },
  {
    name: 'get_scholar_digest',
    description: 'Cached AI-generated mentor digest for one scholar (pace + recent comprehension-rating patterns). Does NOT generate — returns null if none cached yet or if only a stale (>24h) one exists (still returned, with its timestamp).',
    method: 'GET',
    path: (i) => `/api/scholar-digest?userId=${encodeURIComponent(i.userId)}`,
    input_schema: obj({ userId: USER_ID }, ['userId']),
  },
  {
    name: 'generate_scholar_digest',
    description: 'Generate (or regenerate) the AI mentor digest for one scholar — a factual 3-4 sentence summary of pace and recent comprehension patterns, cached for future get_scholar_digest calls.',
    method: 'POST',
    path: '/api/scholar-digest',
    input_schema: obj({ userId: USER_ID }, ['userId']),
  },
  {
    name: 'get_scholar_topic_trends',
    description: 'Topic-by-topic watched/available counts for one scholar plus a cached AI note on gravitated/avoided topics and thin-inventory gaps. Does NOT generate the note — see generate_scholar_topic_trends.',
    method: 'GET',
    path: (i) => `/api/scholar-topic-trends?userId=${encodeURIComponent(i.userId)}`,
    input_schema: obj({ userId: USER_ID }, ['userId']),
  },
  {
    name: 'generate_scholar_topic_trends',
    description: 'Recompute topic counts and regenerate the AI topic-trends note for one scholar.',
    method: 'POST',
    path: '/api/scholar-topic-trends',
    input_schema: obj({ userId: USER_ID }, ['userId']),
  },
  {
    name: 'generate_scholar_video_analysis',
    description:
      "On-demand (never cached) AI coordinator briefing on what one scholar watched in a date range: '## What they've been watching', '## Topics to discuss', '## Suggested focus'. Use this before a mentor call.",
    method: 'POST',
    path: '/api/scholar-video-analysis',
    input_schema: obj({ userId: USER_ID, startDate: DATE, endDate: DATE }, ['userId', 'startDate', 'endDate']),
  },
  {
    name: 'suggest_interests',
    description:
      "New YouTube search-query ideas for one scholar based on their actual watch history (time-weighted topics/channels/level), not a click-count guess. Needs at least 3 videos with 2+ minutes watched each, else returns reason:'not_enough_history'.",
    method: 'GET',
    path: (i) => `/api/suggest-interests?userId=${encodeURIComponent(i.userId)}`,
    input_schema: obj({ userId: USER_ID }, ['userId']),
  },

  // ---- Library management ----
  {
    name: 'get_inventory_check',
    description: 'Count of available library videos per CEFR level (a1-c2) — the library-inventory report.',
    method: 'GET',
    path: '/api/inventory-check',
    input_schema: obj({}),
  },
  {
    name: 'suggest_topics',
    description: 'Library-gap-filling search-query ideas (not scholar-specific): the thinnest topic x level cells in the whole library, with one concrete AI-suggested YouTube search query per cell (5 per call, randomly sampled from the thinnest so repeated calls surface different gaps).',
    method: 'GET',
    path: '/api/suggest-topics',
    input_schema: obj({}),
  },
  {
    name: 'youtube_search',
    description: 'Search YouTube (server-side — the API key never reaches a client) for candidate videos to add, with duration and whether each is already in the library. Music-category results are filtered out automatically.',
    method: 'GET',
    path: (i) =>
      `/api/youtube-search?q=${encodeURIComponent(i.q)}${i.maxResults ? `&maxResults=${encodeURIComponent(i.maxResults)}` : ''}${i.language ? `&language=${encodeURIComponent(i.language)}` : ''}`,
    input_schema: obj(
      { q: { type: 'string' }, maxResults: { type: 'integer', description: 'default 10, capped at 25' }, language: { type: 'string' } },
      ['q']
    ),
  },
  {
    name: 'tag_video',
    description: "Classify one video's CEFR level + topics + OET relevance via the tagging model (Luna, or Haiku as fallback) WITHOUT writing to the database — pure classification, e.g. to preview a tag before calling add_video.",
    method: 'POST',
    path: '/api/tag-video',
    input_schema: obj(
      { title: { type: 'string' }, description: { type: 'string' }, language: { type: 'string', description: "default 'english'" } },
      ['title']
    ),
  },
  {
    name: 'add_video',
    description:
      "Save one already-searched/tagged video into the library (level_source is always 'ai' here — the level/tags came from AI classification upstream). If a soft-deleted video with the same YouTube id exists, it is restored in place instead of duplicated.",
    method: 'POST',
    path: '/api/add-video',
    input_schema: obj(
      {
        youtubeId: { type: 'string' },
        title: { type: 'string' },
        channelName: { type: 'string' },
        channelId: { type: 'string', description: 'YouTube channel id (not the internal channels.id uuid)' },
        thumbnailUrl: { type: 'string' },
        description: { type: 'string' },
        durationSeconds: { type: 'number' },
        language: { type: 'string', description: "default 'english'" },
        level: LEVEL,
        topicPrimary: TOPIC,
        topicSecondary: TOPIC,
        oetRelevance: { type: 'integer', description: '1-5' },
      },
      ['youtubeId', 'title', 'level', 'topicPrimary']
    ),
  },
  {
    name: 'youtube_import',
    description:
      "Batch-import and auto-tag videos from a whole YouTube playlist or channel, or a single video. type:'channel' classifies the CHANNEL level once and every video inherits it (level_source='channel', the primary tagging path — topics/OET are still tagged per-video); type:'playlist'/'video' classifies each video fully and independently (level_source='ai'). Duplicates (by youtube_id) are skipped, not re-imported. Heaviest AI usage of any tool here — one Haiku call per video.",
    method: 'POST',
    path: '/api/youtube-import',
    input_schema: obj(
      {
        type: { type: 'string', enum: ['playlist', 'channel', 'video'] },
        youtubeId: { type: 'string', description: 'playlist id / channel id / video id, matching type' },
        language: { type: 'string', description: "default 'english'" },
        channelDbId: { type: 'string', description: "type:'channel' only — an existing internal channels.id to re-stamp" },
      },
      ['type', 'youtubeId']
    ),
  },
  {
    name: 'tag_channel',
    description:
      "Classify a channel's CEFR level via the tagging model (Luna, or Haiku as fallback) and re-stamp every one of its videos to that level (level_source='channel'), except videos an admin has manually overridden (level_source='admin', preserved). This is the primary tagging path — set once per channel, inherited by all its videos.",
    method: 'POST',
    path: '/api/tag-channel',
    input_schema: obj(
      {
        channelId: { type: 'string', description: 'internal channels.id (uuid)' },
        channelName: { type: 'string' },
        description: { type: 'string' },
        sampleTitles: { type: 'array', items: { type: 'string' } },
      },
      ['channelId', 'channelName']
    ),
  },
  {
    name: 'update_video',
    description:
      "Manually override one or more videos' level and/or topic (level_source='admin' when level is set — this permanently protects it from a future tag_channel re-classification of that channel). At least one of level/topic is required.",
    method: 'POST',
    path: '/api/update-video',
    input_schema: obj({ videoIds: { type: 'array', items: { type: 'string' } }, level: LEVEL, topic: TOPIC }, ['videoIds']),
  },
  {
    name: 'delete_video',
    description:
      'Remove one or more videos from the library (soft delete — is_available=false; a later add_video with the same YouTube id restores it). Destructive — confirm with John before calling.',
    method: 'POST',
    path: '/api/delete-video',
    input_schema: obj({ videoIds: { type: 'array', items: { type: 'string' } } }, ['videoIds']),
  },
  {
    name: 'run_stale_check',
    description:
      'Batch job: checks every available video against the YouTube Data API and soft-deletes any that have gone private, been removed, or become non-embeddable. Consumes real YouTube quota (checks in batches of 50) — not something to run casually on every session.',
    method: 'POST',
    path: '/api/stale-check',
    input_schema: obj({}),
  },
  {
    name: 'run_backfill_durations',
    description:
      'Batch job: fills in duration_seconds for any available video missing it (via the YouTube Data API), then retroactively marks any watch session that actually crossed the 95% single-session completion threshold now that the true duration is known. Consumes YouTube quota in batches of 50.',
    method: 'POST',
    path: '/api/backfill-durations',
    input_schema: obj({}),
  },

  // ---- Sessions (admin, cross-scholar) ----
  {
    name: 'log_external_session',
    description:
      "Log a manual (non-library) hours entry for a scholar — a mentor call, a ChatGPT conversation practice session, or video watched outside the curated library. sessionDate defaults to today (Asia/Manila) if omitted.",
    method: 'POST',
    path: '/api/log-external',
    input_schema: obj(
      {
        userId: USER_ID,
        sessionType: { type: 'string', enum: ['chatgpt_conversation', 'mentor_call', 'video_external'] },
        durationMinutes: { type: 'number' },
        sessionDate: DATE,
        notes: { type: 'string' },
      },
      ['userId', 'sessionType', 'durationMinutes']
    ),
  },
  {
    name: 'edit_external_session',
    description: "Edit an existing external (non-library) session's duration/notes/type. Library video sessions (watch_sessions) cannot be edited this way — only deleted, via delete_session.",
    method: 'POST',
    path: '/api/edit-external-session',
    input_schema: obj(
      {
        sessionId: ID,
        durationMinutes: { type: 'number' },
        notes: { type: 'string' },
        sessionType: { type: 'string', enum: ['chatgpt_conversation', 'mentor_call', 'video_external'] },
      },
      ['sessionId', 'durationMinutes']
    ),
  },
  {
    name: 'delete_session',
    description:
      'Permanently delete one session row (a library watch_sessions row or an external_sessions row) — used to correct an erroneous manual entry or a bad auto-detected session. Hard delete, no undo. Destructive — confirm with John before calling.',
    method: 'POST',
    path: '/api/delete-session',
    input_schema: obj({ sessionType: { type: 'string', enum: ['watch', 'external'] }, sessionId: ID }, ['sessionType', 'sessionId']),
  },

  // ---- Acting as a scholar (impersonation — see file header) ----
  {
    name: 'get_scholar_progress',
    description:
      "One scholar's full progress dashboard exactly as they see it in-app: current/expected/target hours by category (video/ChatGPT/mentor), status, delta, today/this-week/this-month hours, and distinct videos watched. Note: here delta = expected_hours - current_hours (positive = behind pace) — the opposite sign from generate_scholar_video_analysis's internal math, so don't assume the sign carries across tools.",
    method: 'GET',
    path: '/api/progress',
    scholarAuth: true,
    input_schema: obj({ scholarId: USER_ID }, ['scholarId']),
  },
  {
    name: 'mark_video_watched',
    description: "Manually mark a video watched/unwatched for a scholar — the same override a scholar's own watched-toggle uses, which always wins over auto-detected completion.",
    method: 'POST',
    path: '/api/mark-video',
    scholarAuth: true,
    input_schema: obj({ scholarId: USER_ID, videoId: ID, watched: { type: 'boolean' } }, ['scholarId', 'videoId', 'watched']),
  },
  {
    name: 'get_watch_later',
    description: "A scholar's saved/bookmarked videos (newest first).",
    method: 'GET',
    path: '/api/watch-later',
    scholarAuth: true,
    input_schema: obj({ scholarId: USER_ID }, ['scholarId']),
  },
  {
    name: 'add_watch_later',
    description: "Bookmark a video into a scholar's watch-later list (idempotent — adding twice is a no-op).",
    method: 'POST',
    path: '/api/watch-later',
    scholarAuth: true,
    input_schema: obj({ scholarId: USER_ID, videoId: ID }, ['scholarId', 'videoId']),
  },
  {
    name: 'remove_watch_later',
    description: "Remove a video from a scholar's watch-later list.",
    method: 'DELETE',
    path: '/api/watch-later',
    scholarAuth: true,
    input_schema: obj({ scholarId: USER_ID, videoId: ID }, ['scholarId', 'videoId']),
  },
  {
    name: 'get_next_video_suggestions',
    description:
      "AI-suggested next videos for a scholar after finishing one, based on their self-reported comprehension rating (1=struggled, 2=some understanding, 3=understood well). Results are cached globally per video+rating combo for 7 days — not personalized beyond level targeting.",
    method: 'POST',
    path: '/api/next-video',
    scholarAuth: true,
    input_schema: obj({ scholarId: USER_ID, videoId: ID, comprehensionRating: { type: 'integer', description: '1-3' } }, ['scholarId', 'videoId', 'comprehensionRating']),
  },
  {
    name: 'rate_comprehension',
    description: "Record a scholar's self-reported comprehension rating (1-3) for a video — feeds get_next_video_suggestions and generate_scholar_digest. Multiple ratings per video are allowed (no upsert).",
    method: 'POST',
    path: '/api/rate-comprehension',
    scholarAuth: true,
    input_schema: obj({ scholarId: USER_ID, videoId: ID, rating: { type: 'integer', description: '1-3' } }, ['scholarId', 'videoId', 'rating']),
  },
  {
    name: 'get_level_celebration',
    description: "A scholar's pending level-up celebration message, if any (A1 is never celebrated). Generates and caches one via Haiku on first call for a newly-reached level; returns null once dismissed.",
    method: 'GET',
    path: '/api/level-celebration',
    scholarAuth: true,
    input_schema: obj({ scholarId: USER_ID }, ['scholarId']),
  },
  {
    name: 'dismiss_level_celebration',
    description: "Dismiss a scholar's level-up celebration so it stops reappearing.",
    method: 'POST',
    path: '/api/level-celebration',
    scholarAuth: true,
    input_schema: obj({ scholarId: USER_ID, level: LEVEL }, ['scholarId', 'level']),
  },
  {
    name: 'get_progress_coaching',
    description: "A scholar's cached warm AI coaching message referencing their actual pace numbers (24h cache; null if their goal clock hasn't started yet — status PENDING).",
    method: 'GET',
    path: '/api/progress-coaching',
    scholarAuth: true,
    input_schema: obj({ scholarId: USER_ID }, ['scholarId']),
  },
];

const RESULT_CHAR_CAP = 15000;

export const MCP_TOOLS = CATALOG.map(({ name, description, input_schema, method }) => ({
  name,
  description,
  inputSchema: input_schema,
  annotations:
    method === 'GET'
      ? { readOnlyHint: true }
      : { readOnlyHint: false, destructiveHint: method === 'POST' && (name === 'delete_video' || name === 'delete_session') },
}));

const TOOL_MAP = new Map(CATALOG.map((t) => [t.name, t]));

export async function callTool(name, input, { origin }) {
  const tool = TOOL_MAP.get(name);
  if (!tool) return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };

  const secret = process.env.IMMERSION_MCP_TOKEN;
  const rest = { ...input };
  let authToken = secret;
  if (tool.scholarAuth) {
    const scholarId = rest.scholarId;
    delete rest.scholarId;
    if (!scholarId) {
      return { content: [{ type: 'text', text: 'scholarId is required' }], isError: true };
    }
    authToken = `${secret}:${scholarId}`;
  }

  const path = typeof tool.path === 'function' ? tool.path(rest) : tool.path;
  const init = {
    method: tool.method,
    headers: { authorization: `Bearer ${authToken}` },
  };
  if (tool.method !== 'GET') {
    init.headers['content-type'] = 'application/json';
    init.body = JSON.stringify(rest);
  }

  try {
    const res = await fetch(origin + path, init);
    let text = await res.text();
    if (text.length > RESULT_CHAR_CAP) {
      text = text.slice(0, RESULT_CHAR_CAP) + '\n…[truncated]';
    }
    return { content: [{ type: 'text', text }], isError: !res.ok };
  } catch (err) {
    return { content: [{ type: 'text', text: `Request failed: ${err.message}` }], isError: true };
  }
}
