# NGS Immersion — Architecture

*Last updated: June 2026 · Design session + audit v2*

---

## What This App Does

NGS Immersion is a comprehensible input (CI) platform for NextGen Scholars program participants. Scholars watch YouTube videos in their target language. The app tracks cumulative listening hours accurately — only counting seconds when the video is actively playing — and displays progress toward DS-style level milestones (Super Beginner → Beginner → Intermediate → Advanced).

Admins (John) manage the video library, set program goals and per-scholar start dates, and monitor all scholars. Scholars see only their own data.

---

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Vercel Hosting                       │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │          BROWSER — React + Vite (HashRouter)        │ │
│  │  Scholar pages · Admin pages · YouTube IFrame       │ │
│  │  useWatchSession (PLAYING-only timer + localStorage)│ │
│  │  Calls OWN /api/* endpoints — never 3rd-party APIs  │ │
│  └───────────────────────┬────────────────────────────┘ │
│                          │ (Neon Auth JWT)               │
│  ┌───────────────────────▼────────────────────────────┐ │
│  │       SERVER — Vercel serverless functions (api/)   │ │
│  │  SECRET KEYS LIVE HERE — never reach the browser    │ │
│  │  tag-video · youtube-search · flush-session         │ │
│  │  progress · scholars · youtube-import               │ │
│  └──────┬──────────────────┬──────────────────┬───────┘ │
└─────────┼──────────────────┼──────────────────┼─────────┘
          │                  │                  │
   ┌──────▼──────┐   ┌───────▼────────┐   ┌─────▼─────────┐
   │    Neon     │   │ YouTube Data   │   │   Anthropic   │
   │  Postgres   │   │    API v3      │   │ haiku-4-5     │
   │  Neon Auth  │   │                │   │ (tagging)     │
   └─────────────┘   └────────────────┘   └───────────────┘
```

**Security boundary:** The browser only ever talks to the app's own `/api/*` functions. All three secret keys (Anthropic, Neon connection, YouTube) live exclusively in the serverless layer. This is the single most important architectural constraint.

---

## Database Schema

### users
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
email           text UNIQUE NOT NULL
role            text NOT NULL DEFAULT 'scholar'  -- 'scholar' | 'admin'
display_name    text
scholar_name    text                             -- Full name for admin display
language        text NOT NULL DEFAULT 'english'
created_at      timestamptz DEFAULT now()
updated_at      timestamptz DEFAULT now()        -- maintained by trigger
```

### scholar_goals
**NEW in v2.** Resolves the missing program_start_date. Each scholar's goal clock starts on an admin-set `start_date`. The program-wide goal (target level/hours/date) lives in `program_goals`; this table assigns it to a scholar with a start date.
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id         uuid REFERENCES users(id) ON DELETE CASCADE
program_goal_id uuid REFERENCES program_goals(id) ON DELETE CASCADE
start_date      date                             -- admin-set; NULL = PENDING, no pace calc
created_at      timestamptz DEFAULT now()
-- One active goal assignment per scholar per language
```

### watch_sessions
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id         uuid REFERENCES users(id) ON DELETE CASCADE
video_id        uuid REFERENCES videos(id) ON DELETE CASCADE
seconds_watched integer NOT NULL DEFAULT 0
completed       boolean DEFAULT false            -- true if ≥95% watched
language        text NOT NULL DEFAULT 'english'
started_at      timestamptz DEFAULT now()
ended_at        timestamptz
created_at      timestamptz DEFAULT now()
```

### videos
```sql
id               uuid PRIMARY KEY DEFAULT gen_random_uuid()
youtube_id       text UNIQUE NOT NULL
title            text NOT NULL
channel_name     text
channel_id       uuid REFERENCES channels(id)
description      text                            -- truncated to 500 chars
thumbnail_url    text
duration_seconds integer
language         text NOT NULL DEFAULT 'english'
level            text NOT NULL                   -- super_beginner|beginner|intermediate|advanced
level_source     text DEFAULT 'ai'               -- 'ai' | 'admin'
topic_primary    text                            -- one of 10 fixed tags
topic_secondary  text                            -- one of 10 fixed tags or null
source           text DEFAULT 'library'          -- 'library' | 'search'
is_available     boolean DEFAULT true            -- false if YouTube 404
unavailable_since timestamptz
added_by         uuid REFERENCES users(id)
created_at       timestamptz DEFAULT now()
updated_at       timestamptz DEFAULT now()       -- maintained by trigger
```

### program_goals
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
target_level    text NOT NULL                   -- 'beginner' | 'intermediate' | 'advanced'
target_hours    integer NOT NULL                -- hours to reach target level
target_date     date NOT NULL
language        text NOT NULL DEFAULT 'english'
is_active       boolean DEFAULT true
created_by      uuid REFERENCES users(id)
created_at      timestamptz DEFAULT now()
```

### channels
```sql
id                 uuid PRIMARY KEY DEFAULT gen_random_uuid()
youtube_channel_id text UNIQUE NOT NULL
name               text
language           text NOT NULL DEFAULT 'english'
added_by           uuid REFERENCES users(id)
created_at         timestamptz DEFAULT now()
```

---

## Level System (DS-Style)

```
Super Beginner:   0 – 150 hours
Beginner:         150 – 300 hours
Intermediate:     300 – 600 hours
Advanced:         600+ hours
```

Implemented in `src/utils/levels.js`.

---

## AT RISK / ON TRACK Logic

Resolved in v2 — uses the per-scholar `scholar_goals.start_date`.

```
-- If scholar has no scholar_goals row OR start_date IS NULL → status = PENDING (no calc)

start_date       = scholar_goals.start_date           (admin-set)
target_date      = program_goals.target_date
target_hours     = program_goals.target_hours
today            = current_date

total_weeks      = (target_date - start_date) / 7
weeks_elapsed    = (today - start_date) / 7            (floored at 0)
weeks_remaining  = (target_date - today) / 7

expected_hours   = target_hours × (weeks_elapsed / total_weeks)
current_hours    = SUM(seconds_watched) / 3600 FROM watch_sessions WHERE user_id = $1
delta            = current_hours - expected_hours
required_weekly  = (target_hours - current_hours) / weeks_remaining

status           = delta >= 0 ? 'ON_TRACK' : 'AT_RISK'
```

Implemented in `src/utils/pace.js`, fed by `api/scholars.js` (admin) and `api/progress.js` (scholar). A scholar whose `start_date` is in the future is PENDING until that date arrives.

---

## Serverless API Layer (api/)

All secret-key operations. The browser calls these; these call the third-party APIs.

| Endpoint | Method | Purpose | Secret used |
|---|---|---|---|
| `api/tag-video.js` | POST | Tag one video via Haiku → return level + topics | ANTHROPIC_API_KEY |
| `api/youtube-search.js` | GET | Search YouTube, return results | YOUTUBE_API_KEY |
| `api/youtube-import.js` | POST | Batch import playlist/channel + tag all | YOUTUBE_API_KEY + ANTHROPIC_API_KEY |
| `api/flush-session.js` | POST | Write watch_session row (sendBeacon target) | NEON_DATABASE_URL |
| `api/progress.js` | GET | Scholar's own cumulative hours + pace | NEON_DATABASE_URL |
| `api/scholars.js` | GET | Admin: all scholars' progress | NEON_DATABASE_URL_ADMIN |
| `api/_db.js` | — | Shared Neon connection helper | NEON_DATABASE_URL |

**Auth enforcement:** Each scholar-facing endpoint verifies the Neon Auth JWT and scopes queries to that user's `user_id`. The browser cannot request another scholar's data — the server ignores any client-supplied user_id and uses the JWT identity. `api/scholars.js` checks `role = 'admin'` before using the service-role connection.

---

## Watch Time Tracking

Implemented in `src/hooks/useWatchSession.js`. The single most critical piece of engineering.

```javascript
player.addEventListener('onStateChange', (event) => {
  if (event.data === YT.PlayerState.PLAYING) {
    intervalId = setInterval(() => {
      secondsWatched++
      bufferSeconds(videoId, 1)            // localStorage offline buffer
    }, 1000)
  } else {
    clearInterval(intervalId)
    if (secondsWatched > 0) flushToApi()   // POST /api/flush-session
  }
})

window.addEventListener('beforeunload', () => {
  navigator.sendBeacon('/api/flush-session', JSON.stringify(payload))
})

document.addEventListener('visibilitychange', () => {
  if (document.hidden) clearInterval(intervalId)
  else if (playerState === PLAYING) restartInterval()
})
```

**Counts:** only `YT.PlayerState.PLAYING`
**Doesn't count:** paused, buffering, ended, background tab, closed tab
**Offline:** localStorage buffer flushes on reconnect + app load
**Min flush:** 10 seconds (filters accidental clicks)
**Completion:** `completed = true` when `secondsWatched / duration_seconds >= 0.95`

---

## AI Tagging

One `claude-haiku-4-5` call per video in `api/tag-video.js` (server-side — key never exposed). Input: title + channel + description (first 500 chars). Output JSON: level + topic_primary + topic_secondary. Cached in `videos` forever.

```
Level guide:
- super_beginner: very slow, simple vocab, A1-A2
- beginner: slow-normal, common vocab, A2-B1
- intermediate: normal pace, varied vocab, B1-B2
- advanced: natural pace, complex vocab, B2-C1
```

---

## Topic Taxonomy

10 fixed tags. AI picks 1–2 per video. Color-coded in UI:

| Tag | Category | UI Color |
|---|---|---|
| Medical & Nursing | OET/career | Blue `#378ADD` |
| Work & Career | OET/career | Blue `#378ADD` |
| Academic & Study | OET/career | Blue `#378ADD` |
| Daily Life | Daily life | Green `#1D9E75` |
| Travel & Places | Daily life | Green `#1D9E75` |
| Social & Relationships | Daily life | Green `#1D9E75` |
| Food & Cooking | Compelling | Gray/muted |
| Culture & Entertainment | Compelling | Gray/muted |
| Sports & Fitness | Compelling | Gray/muted |
| News & Events | Compelling | Gray/muted |

---

## Routing

```
#/               → Login (unauth) or redirect to #/watch
#/watch          → Watch page — player + curated browse
#/progress       → Progress — hours counter + milestones
#/browse         → Full browse + YouTube search
#/admin          → Admin shell (admin role only)
#/admin/progress → Scholar cards + drill-down
#/admin/videos   → Video library + AI-assisted add
#/admin/goals    → Program goal + per-scholar start dates
```

---

## Design System

**Color tokens (--ngsi-* prefix):**
```css
--ngsi-navy:        #162040
--ngsi-navy-light:  #1e2d52
--ngsi-navy-deep:   #0e1628
--ngsi-gold:        #C9A84C
--ngsi-cream:       #F5F0E8
--ngsi-cream-dark:  #ede7d9
--ngsi-cat-oet:     #378ADD
--ngsi-cat-life:    #1D9E75
```

**Typography:** Serif (Georgia) for numbers + italic accents. Sans for UI. Matches NGS Scholars site.

**Responsive:** mobile-first base; 640px tablet; 1024px desktop sidebar; 1280px widescreen max-width.

---

## Video Discovery UX

**Scholar browse (Watch):** videos at current level first + some above · 3-row color-coded topic filters · level filters · watched/unwatched toggle (defaults unwatched) · search within library.

**Scholar open search (Browse):** YouTube search via `api/youtube-search.js` · AI tags in progress · hours track regardless of source.

**Admin add:** scholar context card (level + interests) · AI-assisted search generating optimized queries from scholar profile · suggested query chips · paste URL/channel/playlist · batch import ≤50 videos, rate-limited.

---

## Data Isolation (server-enforced, not RLS-only)

Neon Auth's RLS integration differs from Supabase — do NOT rely on `auth.uid()` in database policies. Enforce isolation in the API layer:

- Scholar endpoints verify Neon Auth JWT, derive `user_id` from the token, ignore any client-supplied id.
- Admin endpoints check `role = 'admin'` then use `NEON_DATABASE_URL_ADMIN` (service role) for cross-scholar reads.
- Database-level RLS may be added as defense-in-depth once Neon Auth's RLS pattern is confirmed, but the API layer is the primary guard.

---

## Offline Resilience

Philippine mobile internet is inconsistent; Claire's primary device is a phone.

```javascript
// utils/offlineBuffer.js — localStorage queue
bufferSeconds(videoId, seconds)   // accumulate locally
flushBuffer()                     // POST batch to /api/flush-session

// Flush triggers:
// 1. App load (catch sessions from previous close)
// 2. Network 'online' reconnect event
// 3. beforeunload via sendBeacon
```

---

## Maintenance Policy

- **Cadence:** seed 150 videos at launch; 10–15/week top-up (~15 min with AI assist).
- **Low-inventory alert:** admin badge when any level has < 20 unwatched videos.
- **Stale videos:** weekly YouTube availability check; flag `is_available = false`, never delete. Watch history preserved.
- **Keep forever:** videos and watch history never deleted. Storage ~800 bytes/video, ~60 bytes/session — negligible vs Neon's 0.5GB free per project.
- **Shared library:** one library across all scholars; watch history per-scholar; interest filtering per-scholar.

---

## Future Considerations

**Per-scholar interest config:** topic tags currently optimized for Claire. Build an admin module to configure interest tags per scholar — drives AI search defaults and surfacing.

**Multiple languages:** `language` field present in all tables. Adding a language needs new videos + UI selector + filtered queries. No schema migration.

**NGH hospitality track:** same app, per-program topic taxonomy. Make taxonomy configurable per program when NGH scholars join.
