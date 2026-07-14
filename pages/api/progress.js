import { getDb } from '../../lib/api/_db.js'
import { verifySession } from '../../lib/api/_auth.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authUser = await verifySession(req.headers.authorization)
  if (!authUser) return res.status(401).json({ error: 'Unauthorized' })

  const sql = getDb()

  const [rows, videoRows, externalRows, libraryTotals, externalTotals, categoryTargets, todayRows, monthRows, watchedRows] =
    await Promise.all([
      sql`
        SELECT
          user_id, scholar_name, language,
          start_date, target_hours, target_date, target_level,
          current_hours, hours_this_week, last_session_at,
          status, expected_hours
        FROM scholar_pace
        WHERE user_id = ${authUser.id}
      `,
      sql`
        SELECT ROUND(SUM(seconds_watched)::numeric / 3600, 1) AS video_hours_this_week
        FROM watch_sessions
        WHERE user_id = ${authUser.id}
          AND (started_at AT TIME ZONE 'Asia/Manila')
              >= date_trunc('week', now() AT TIME ZONE 'Asia/Manila')
      `,
      sql`
        SELECT ROUND(SUM(duration_seconds)::numeric / 3600, 1) AS external_hours_this_week
        FROM external_sessions
        WHERE user_id = ${authUser.id}
          AND (session_date::timestamptz AT TIME ZONE 'Asia/Manila')
              >= date_trunc('week', now() AT TIME ZONE 'Asia/Manila')
      `,
      // Total library hours (watch_sessions only, for Video category)
      sql`
        SELECT ROUND(SUM(seconds_watched)::numeric / 3600, 1) AS library_hours
        FROM watch_sessions
        WHERE user_id = ${authUser.id}
      `,
      // Per-type totals from external_sessions
      sql`
        SELECT
          ROUND(SUM(CASE WHEN session_type = 'video_external'       THEN duration_seconds ELSE 0 END)::numeric / 3600, 1) AS video_external_hours,
          ROUND(SUM(CASE WHEN session_type = 'chatgpt_conversation' THEN duration_seconds ELSE 0 END)::numeric / 3600, 1) AS chatgpt_hours,
          ROUND(SUM(CASE WHEN session_type = 'mentor_call'          THEN duration_seconds ELSE 0 END)::numeric / 3600, 1) AS mentor_hours
        FROM external_sessions
        WHERE user_id = ${authUser.id}
      `,
      // Per-category targets from scholar_goals (joined to get the right language)
      sql`
        SELECT sg.target_video_hours, sg.target_chatgpt_hours, sg.target_mentor_hours
        FROM scholar_goals sg
        JOIN users u ON sg.user_id = u.id AND sg.language = u.language
        WHERE sg.user_id = ${authUser.id}
      `,
      // Hours watched today (Manila timezone)
      sql`
        SELECT ROUND(SUM(seconds_watched)::numeric / 3600, 2) AS hours_today
        FROM watch_sessions
        WHERE user_id = ${authUser.id}
          AND (started_at AT TIME ZONE 'Asia/Manila')
              >= date_trunc('day', now() AT TIME ZONE 'Asia/Manila')
      `,
      // Month-to-date hours (Manila timezone) — matches the video+external
      // combined semantics of current_hours/hours_this_week (see user_total_hours).
      sql`
        SELECT ROUND(SUM(seconds)::numeric / 3600, 1) AS hours_this_month
        FROM (
          SELECT seconds_watched AS seconds, started_at AS session_ts
          FROM watch_sessions
          WHERE user_id = ${authUser.id}
          UNION ALL
          SELECT duration_seconds AS seconds, (session_date::timestamptz) AS session_ts
          FROM external_sessions
          WHERE user_id = ${authUser.id}
        ) all_sessions
        WHERE (session_ts AT TIME ZONE 'Asia/Manila')
              >= date_trunc('month', now() AT TIME ZONE 'Asia/Manila')
      `,
      // Distinct videos watched (manual mark wins over auto-detected completion,
      // same COALESCE semantics as api/videos.js).
      sql`
        SELECT COUNT(*) AS videos_watched
        FROM (
          SELECT v.id
          FROM videos v
          LEFT JOIN user_video_status uvs
            ON uvs.video_id = v.id AND uvs.user_id = ${authUser.id}
          LEFT JOIN video_marks vm
            ON vm.video_id = v.id AND vm.user_id = ${authUser.id}
          WHERE COALESCE(vm.watched, uvs.completed, false) = true
        ) watched_videos
      `,
    ])

  const hoursToday = Number(todayRows[0]?.hours_today ?? 0)
  const hoursThisMonth = Number(monthRows[0]?.hours_this_month ?? 0)
  const videosWatched = Number(watchedRows[0]?.videos_watched ?? 0)
  const videoHoursThisWeek = Number(videoRows[0]?.video_hours_this_week ?? 0)
  const externalHours = Number(externalRows[0]?.external_hours_this_week ?? 0)

  const libraryHours = Number(libraryTotals[0]?.library_hours ?? 0)
  const videoExternalHours = Number(externalTotals[0]?.video_external_hours ?? 0)
  const chatgptHours = Number(externalTotals[0]?.chatgpt_hours ?? 0)
  const mentorHours = Number(externalTotals[0]?.mentor_hours ?? 0)
  const videoHours = libraryHours + videoExternalHours

  const catTargets = categoryTargets[0] || {}
  const targetVideoHours = catTargets.target_video_hours != null ? Number(catTargets.target_video_hours) : null
  const targetChatgptHours = catTargets.target_chatgpt_hours != null ? Number(catTargets.target_chatgpt_hours) : null
  const targetMentorHours = catTargets.target_mentor_hours != null ? Number(catTargets.target_mentor_hours) : null

  if (rows.length === 0) {
    return res.status(200).json({
      user_id: authUser.id,
      current_hours: 0,
      hours_this_week: 0,
      video_hours_this_week: 0,
      external_hours_this_week: 0,
      status: 'PENDING',
      expected_hours: 0,
      target_hours: null,
      target_date: null,
      target_level: null,
      start_date: null,
      last_session_at: null,
      video_hours: videoHours,
      library_hours: libraryHours,
      video_external_hours: videoExternalHours,
      chatgpt_hours: chatgptHours,
      mentor_hours: mentorHours,
      target_video_hours: targetVideoHours,
      target_chatgpt_hours: targetChatgptHours,
      target_mentor_hours: targetMentorHours,
      hours_today: hoursToday,
      hours_this_month: hoursThisMonth,
      videos_watched: videosWatched,
    })
  }

  const row = rows[0]
  const currentHours = Number(row.current_hours ?? 0)
  const expectedHours = Number(row.expected_hours ?? 0)
  return res.status(200).json({
    ...row,
    user_id: authUser.id,
    current_hours: currentHours,
    hours_this_week: Number(row.hours_this_week ?? 0),
    expected_hours: expectedHours,
    delta: expectedHours - currentHours,
    video_hours_this_week: videoHoursThisWeek,
    external_hours_this_week: externalHours,
    video_hours: videoHours,
    library_hours: libraryHours,
    video_external_hours: videoExternalHours,
    chatgpt_hours: chatgptHours,
    mentor_hours: mentorHours,
    target_video_hours: targetVideoHours,
    target_chatgpt_hours: targetChatgptHours,
    target_mentor_hours: targetMentorHours,
    hours_today: hoursToday,
    hours_this_month: hoursThisMonth,
    videos_watched: videosWatched,
  })
}
