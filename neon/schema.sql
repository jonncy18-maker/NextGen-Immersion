-- NGS Immersion — Neon Database Schema (v2 — post-audit)
-- Project: ngs-immersion
-- Run once on fresh Neon project via Claude Code Neon MCP or neon SQL editor
-- Last updated: June 2026

-- ─── Extensions ──────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── updated_at trigger function ──────────────────────────────────────────────
-- Fixes audit Failure 4: updated_at columns now auto-maintained.

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── Users ───────────────────────────────────────────────────────────────────
-- PROVISIONING: Scholars and admins are ADMIN-PROVISIONED — there is no public
-- self-signup. id is the Neon Auth subject (the JWT `sub`), NOT a random uuid:
-- on account creation, insert the row with the Neon Auth user id as `id` so the
-- API layer can scope every query by the verified JWT `sub`. The gen_random_uuid()
-- default is a fallback only; production inserts supply the auth id explicitly.
-- One login screen for everyone; `role` (scholar|admin) drives what the app shows.

CREATE TABLE IF NOT EXISTS users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text UNIQUE NOT NULL,
  role            text NOT NULL DEFAULT 'scholar'
                  CHECK (role IN ('scholar', 'admin')),
  display_name    text,
  scholar_name    text,
  language        text NOT NULL DEFAULT 'english',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_role_idx  ON users (role);
CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);

DROP TRIGGER IF EXISTS users_set_updated_at ON users;
CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Channels ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS channels (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_channel_id  text UNIQUE NOT NULL,
  name                text NOT NULL,
  language            text NOT NULL DEFAULT 'english',
  level               text CHECK (level IN ('super_beginner','beginner','intermediate','advanced')),
  added_by            uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ─── Videos ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS videos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_id        text UNIQUE NOT NULL,
  title             text NOT NULL,
  channel_name      text,
  channel_id        uuid REFERENCES channels(id) ON DELETE SET NULL,
  description       text,
  thumbnail_url     text,
  duration_seconds  integer,
  language          text NOT NULL DEFAULT 'english',

  level             text NOT NULL
                    CHECK (level IN ('super_beginner','beginner','intermediate','advanced')),
  level_source      text NOT NULL DEFAULT 'ai'
                    CHECK (level_source IN ('ai','channel','admin')),

  topic_primary     text
                    CHECK (topic_primary IN (
                      'Medical & Nursing','Work & Career','Academic & Study',
                      'Daily Life','Travel & Places','Social & Relationships',
                      'Food & Cooking','Culture & Entertainment',
                      'Sports & Fitness','News & Events'
                    )),
  topic_secondary   text
                    CHECK (topic_secondary IS NULL OR topic_secondary IN (
                      'Medical & Nursing','Work & Career','Academic & Study',
                      'Daily Life','Travel & Places','Social & Relationships',
                      'Food & Cooking','Culture & Entertainment',
                      'Sports & Fitness','News & Events'
                    )),

  source            text NOT NULL DEFAULT 'library'
                    CHECK (source IN ('library','search')),

  is_available      boolean NOT NULL DEFAULT true,
  unavailable_since timestamptz,

  added_by          uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS videos_level_idx      ON videos (level);
CREATE INDEX IF NOT EXISTS videos_language_idx   ON videos (language);
CREATE INDEX IF NOT EXISTS videos_topic_idx      ON videos (topic_primary);
CREATE INDEX IF NOT EXISTS videos_available_idx  ON videos (is_available);
CREATE INDEX IF NOT EXISTS videos_youtube_id_idx ON videos (youtube_id);

DROP TRIGGER IF EXISTS videos_set_updated_at ON videos;
CREATE TRIGGER videos_set_updated_at
  BEFORE UPDATE ON videos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Watch Sessions ───────────────────────────────────────────────────────────

-- completed = true ONLY when a SINGLE session reaches >=95% of duration_seconds.
-- It is per-session and NOT cumulative: watching 50% of a video twice does NOT
-- mark it complete (two sub-95% sessions). Hours/minutes from EVERY session are
-- always counted toward cumulative input regardless of completion.
--
-- client_flush_id is a client-generated UUID per flush. flush-session.js upserts
-- ON CONFLICT (client_flush_id) DO NOTHING so the same buffered seconds flushed
-- twice (e.g. reconnect flush + app-load flush, or sendBeacon + pause flush)
-- are written once. This is the core guard against inflated cumulative hours.

CREATE TABLE IF NOT EXISTS watch_sessions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_id          uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  client_flush_id   uuid UNIQUE,                   -- idempotency key; dedupes double flushes
  seconds_watched   integer NOT NULL DEFAULT 0 CHECK (seconds_watched >= 0),
  completed         boolean NOT NULL DEFAULT false,
  language          text NOT NULL DEFAULT 'english',
  started_at        timestamptz NOT NULL DEFAULT now(),
  ended_at          timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sessions_user_idx     ON watch_sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_video_idx    ON watch_sessions (video_id);
CREATE INDEX IF NOT EXISTS sessions_language_idx ON watch_sessions (language);
CREATE INDEX IF NOT EXISTS sessions_started_idx  ON watch_sessions (started_at DESC);

-- ─── Program Goals ───────────────────────────────────────────────────────────
-- The program-wide target. One active per language.

CREATE TABLE IF NOT EXISTS program_goals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_level    text NOT NULL
                  CHECK (target_level IN ('beginner','intermediate','advanced')),
  target_hours    integer NOT NULL CHECK (target_hours > 0),
  target_date     date NOT NULL,
  language        text NOT NULL DEFAULT 'english',
  is_active       boolean NOT NULL DEFAULT true,
  created_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_goal_per_language
  ON program_goals (language) WHERE is_active = true;

-- ─── Scholar Goals ───────────────────────────────────────────────────────────
-- NEW in v2 — fixes audit Failure 2 (missing program_start_date).
-- Assigns a program goal to a scholar with an ADMIN-SET start_date.
-- start_date NULL  → PENDING (no pace calc)
-- start_date future → PENDING until that date
-- start_date past  → active pace calculation

CREATE TABLE IF NOT EXISTS scholar_goals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  program_goal_id uuid NOT NULL REFERENCES program_goals(id) ON DELETE CASCADE,
  start_date      date,                          -- admin-set; NULL = not started
  target_level    text CHECK (target_level IN ('beginner','intermediate','advanced')),
  target_hours    integer CHECK (target_hours IS NULL OR target_hours > 0),
  target_date     date,
  language        text NOT NULL DEFAULT 'english',
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- One active goal assignment per scholar per language
CREATE UNIQUE INDEX IF NOT EXISTS one_goal_per_scholar_language
  ON scholar_goals (user_id, language);

CREATE INDEX IF NOT EXISTS scholar_goals_user_idx ON scholar_goals (user_id);

-- Manual watched/unwatched overrides (per scholar per video). Separate from
-- watch_sessions so marking a video does NOT touch cumulative-hours data.
-- Surfaced watched state = COALESCE(video_marks.watched, completed-from-sessions,
-- false): a manual mark always wins over auto-detected completion.
CREATE TABLE IF NOT EXISTS video_marks (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_id   uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  watched    boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, video_id)
);

-- ─── Helper Views ─────────────────────────────────────────────────────────────
--
-- TIMEZONE: All "this week" / "today" boundaries use Asia/Manila (the program
-- timezone — Claire and launch scholars are in the Philippines, UTC+8). Neon
-- runs UTC, so week/day math is anchored to Manila local time explicitly.
-- Add a future timezone column to users/scholar_goals if scholars span zones.

-- Total hours per user per language
CREATE OR REPLACE VIEW user_total_hours AS
  SELECT
    user_id,
    language,
    ROUND(SUM(seconds_watched)::numeric / 3600, 1) AS total_hours,
    COUNT(*) AS total_sessions,
    MAX(started_at) AS last_session_at,
    ROUND(
      SUM(CASE
            WHEN (started_at AT TIME ZONE 'Asia/Manila')
                 >= date_trunc('week', now() AT TIME ZONE 'Asia/Manila')
            THEN seconds_watched ELSE 0 END)::numeric / 3600, 1
    ) AS hours_this_week
  FROM watch_sessions
  GROUP BY user_id, language;

-- Watched/unwatched status per user per video.
-- completed = a scholar finished the video in a single session (>=95%). It is
-- intentionally NOT cumulative — bool_or over per-session completion. total_seconds
-- is the cumulative input from all sessions (always counted, completion aside).
CREATE OR REPLACE VIEW user_video_status AS
  SELECT
    user_id,
    video_id,
    bool_or(completed) AS completed,
    SUM(seconds_watched) AS total_seconds,
    MAX(started_at) AS last_watched_at
  FROM watch_sessions
  GROUP BY user_id, video_id;

-- Scholar pace summary (admin dashboard) — joins goal + start_date + hours.
-- "Today" is Manila-local. The elapsed/total ratio is capped at 1.0 via LEAST,
-- so expected_hours never exceeds target_hours. PAST THE TARGET DATE this means:
-- expected = target_hours, so status is ON_TRACK only if the scholar reached the
-- full target, otherwise AT_RISK — no negative or runaway pace after the deadline.
-- Per-scholar target_level/target_hours/target_date COALESCE over the program goal,
-- so scholars can have individual overrides while falling back to the shared template.
CREATE OR REPLACE VIEW scholar_pace AS
  SELECT
    u.id            AS user_id,
    u.scholar_name,
    u.language,
    sg.start_date,
    COALESCE(sg.target_hours, pg.target_hours) AS target_hours,
    COALESCE(sg.target_date,  pg.target_date)  AS target_date,
    COALESCE(sg.target_level, pg.target_level) AS target_level,
    COALESCE(h.total_hours, 0)    AS current_hours,
    COALESCE(h.hours_this_week, 0) AS hours_this_week,
    h.last_session_at,
    CASE
      WHEN sg.start_date IS NULL
        OR sg.start_date > (now() AT TIME ZONE 'Asia/Manila')::date THEN 'PENDING'
      WHEN COALESCE(sg.target_hours, pg.target_hours) IS NULL
        OR COALESCE(sg.target_date, pg.target_date) IS NULL THEN 'PENDING'
      WHEN COALESCE(h.total_hours,0) >=
           COALESCE(sg.target_hours, pg.target_hours) *
           LEAST(1.0,
             GREATEST((now() AT TIME ZONE 'Asia/Manila')::date - sg.start_date, 0)::numeric /
             NULLIF(COALESCE(sg.target_date, pg.target_date) - sg.start_date, 0))
        THEN 'ON_TRACK'
      ELSE 'AT_RISK'
    END AS status,
    -- expected hours by now (capped at target_hours)
    CASE
      WHEN sg.start_date IS NULL
        OR sg.start_date > (now() AT TIME ZONE 'Asia/Manila')::date THEN 0
      WHEN COALESCE(sg.target_hours, pg.target_hours) IS NULL
        OR COALESCE(sg.target_date, pg.target_date) IS NULL THEN 0
      ELSE ROUND(
        COALESCE(sg.target_hours, pg.target_hours) *
        LEAST(1.0,
          GREATEST((now() AT TIME ZONE 'Asia/Manila')::date - sg.start_date, 0)::numeric /
          NULLIF(COALESCE(sg.target_date, pg.target_date) - sg.start_date, 0)), 1)
    END AS expected_hours
  FROM users u
  LEFT JOIN scholar_goals sg
    ON sg.user_id = u.id AND sg.language = u.language
  LEFT JOIN program_goals pg
    ON pg.id = sg.program_goal_id AND pg.is_active = true
  LEFT JOIN user_total_hours h
    ON h.user_id = u.id AND h.language = u.language
  WHERE u.role = 'scholar';

-- ─── Seed Data (uncomment + edit before running) ─────────────────────────────

-- 1. Admin user
-- INSERT INTO users (email, role, display_name, scholar_name)
-- VALUES ('YOUR_EMAIL@example.com', 'admin', 'John', 'John Shaw')
-- ON CONFLICT (email) DO NOTHING;

-- 2. Program goal — Intermediate (300h) by Dec 2027
-- INSERT INTO program_goals (target_level, target_hours, target_date, language, created_by)
-- VALUES ('intermediate', 300, '2027-12-31', 'english',
--         (SELECT id FROM users WHERE role = 'admin' LIMIT 1));

-- 3. Claire scholar account
-- INSERT INTO users (email, role, scholar_name, display_name)
-- VALUES ('CLAIRE_EMAIL@example.com', 'scholar', 'Claire Buenconsejo', 'Claire')
-- ON CONFLICT (email) DO NOTHING;

-- 4. Assign goal to Claire with admin-set start date
-- INSERT INTO scholar_goals (user_id, program_goal_id, start_date, language)
-- VALUES (
--   (SELECT id FROM users WHERE scholar_name = 'Claire Buenconsejo'),
--   (SELECT id FROM program_goals WHERE is_active = true AND language = 'english' LIMIT 1),
--   '2026-06-01',   -- admin-set start date
--   'english');

-- ─── Data Isolation Note ──────────────────────────────────────────────────────
-- Neon Auth does NOT expose auth.uid() the way Supabase does. Do NOT rely on
-- database RLS using auth.uid(). Enforce isolation in the Vercel API layer:
--   • Scholar endpoints derive user_id from the verified Neon Auth JWT and scope
--     every query to that id. Client-supplied user_id is ignored.
--   • Admin endpoints check role='admin' then use the service-role connection
--     (NEON_DATABASE_URL_ADMIN) for cross-scholar reads.
-- Database-level RLS may be added as defense-in-depth once Neon Auth's RLS
-- integration pattern is confirmed in their docs.

-- ─── Reference Queries ────────────────────────────────────────────────────────

-- Scholar's own total + week hours:
-- SELECT total_hours, hours_this_week FROM user_total_hours
-- WHERE user_id = $1 AND language = 'english';

-- Admin all-scholar dashboard (status, delta, pace):
-- SELECT scholar_name, current_hours, expected_hours,
--        ROUND(current_hours - expected_hours, 1) AS delta,
--        hours_this_week, status, last_session_at
-- FROM scholar_pace ORDER BY status, current_hours DESC;

-- Unwatched available videos at a level for a scholar:
-- SELECT v.* FROM videos v
-- WHERE v.level = $1 AND v.is_available = true
-- AND v.id NOT IN (SELECT video_id FROM watch_sessions WHERE user_id = $2);

-- Low-inventory check (< 20 unwatched per level for a scholar):
-- SELECT v.level, COUNT(*) AS unwatched
-- FROM videos v
-- WHERE v.is_available = true
-- AND v.id NOT IN (SELECT video_id FROM watch_sessions WHERE user_id = $1)
-- GROUP BY v.level HAVING COUNT(*) < 20;
