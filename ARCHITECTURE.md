# NGS Immersion — Architecture

*Last updated: June 2026 · Design session + audit v2 · Phase 14 (Next.js same-origin auth migration)*

---

## What This App Does

NGS Immersion is a comprehensible input (CI) platform for NextGen Scholars program participants. Scholars watch YouTube videos in their target language. The app tracks cumulative listening hours accurately — only counting seconds when the video is actively playing — and displays progress toward DS-style level milestones (Super Beginner → Beginner → Intermediate → Advanced).

Admins (John) manage the video library, set program goals and per-scholar start dates, and monitor all scholars. Scholars see only their own data.

---

## System Overview

```
┌──────────────────────────────────────────────────────────────┐
│                  Vercel Hosting — Next.js 16                   │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  BROWSER — React SPA (HashRouter) inside the Next shell   │ │
│  │  app/page.jsx → next/dynamic(App, { ssr:false })          │ │
│  │  Scholar/Admin pages · YouTube IFrame · useWatchSession   │ │
│  │  Calls OWN same-origin endpoints — never 3rd-party APIs   │ │
│  └──────────┬───────────────────────────────┬───────────────┘ │
│             │ (Bearer: Neon Auth JWT)        │ (cookie)        │
│  ┌──────────▼─────────────────┐  ┌───────────▼──────────────┐ │
│  │  pages/api/* functions      │  │ app/api/auth/[...path]   │ │
│  │  SECRET KEYS LIVE HERE      │  │ Neon same-origin auth    │ │
│  │  tag-channel · tag-video    │  │ proxy (createNeonAuth)   │ │
│  │  youtube-search/-import     │  │ → FIRST-PARTY cookie     │ │
│  │  flush-session · progress   │  │   on the app origin      │ │
│  │  videos · me · scholars …   │  └───────────┬──────────────┘ │
│  └──────┬──────────┬──────────┬┘              │                │
└─────────┼──────────┼──────────┼───────────────┼────────────────┘
          │          │          │               │
   ┌──────▼────┐ ┌───▼──────┐ ┌─▼─────────┐ ┌───▼──────────┐
   │   Neon    │ │ YouTube  │ │ Anthropic │ │  Neon Auth   │
   │ Postgres  │ │ Data API │ │ haiku-4-5 │ │ (Better Auth)│
   │           │ │   v3     │ │ (tagging) │ │  + JWKS      │
   └───────────┘ └──────────┘ └───────────┘ └──────────────┘
```

**Security boundary:** The browser only ever talks to the app's own same-origin endpoints (`/api/*` for data, `/api/auth/*` for auth). All secret keys (Anthropic, Neon connection, YouTube, the auth cookie secret) live exclusively server-side. This is the single most important architectural constraint.

**Auth boundary (Phase 14):** Login no longer goes browser→neon.tech directly. The browser hits the same-origin `/api/auth/*` proxy (`createNeonAuth().handler()`), which forwards to Neon server-side and sets a **first-party** session cookie on the app's own origin — so the session survives a page refresh. See *Authentication* below.

---

## Database Schema

### users
Admin-provisioned (no self-signup). `id` is the **Neon Auth subject** (`sub`), supplied on insert — the gen_random_uuid() default is a fallback. One login screen; `role` drives the UI.
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()  -- = Neon Auth sub
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
client_flush_id uuid UNIQUE                      -- idempotency key — dedupes double flushes
seconds_watched integer NOT NULL DEFAULT 0
completed       boolean DEFAULT false            -- per-session ≥95% (NOT cumulative)
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
level_source     text DEFAULT 'ai'               -- 'ai' | 'channel' | 'admin'
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
level              text  -- super_beginner|beginner|intermediate|advanced — set by Haiku on add
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
today            = current date in Asia/Manila         (program timezone)

elapsed_ratio    = clamp((today - start_date) / (target_date - start_date), 0, 1)
expected_hours   = target_hours × elapsed_ratio        (capped at target_hours)
current_hours    = SUM(seconds_watched) / 3600 FROM watch_sessions WHERE user_id = $1
delta            = current_hours - expected_hours

status           = current_hours >= expected_hours ? 'ON_TRACK' : 'AT_RISK'
```

**Timezone:** "today" and "this week" are computed in **Asia/Manila** (UTC+8), the program timezone — Claire and launch scholars are in the Philippines while Neon runs UTC. Anchoring the math to Manila local time keeps daily/weekly boundaries correct.

**Past the target date:** `elapsed_ratio` is clamped to 1.0, so `expected_hours` never exceeds `target_hours`. After the deadline a scholar is ON_TRACK only if they reached the full target, otherwise AT_RISK — there is no negative `required_weekly` or runaway expected value.

**"Reach level X" convention:** `program_goals.target_hours` is the hour count at which the target level *begins* (e.g. Intermediate = 300h, the Super Beginner→Beginner→Intermediate thresholds from the Level System). Goals are entered against the entry threshold, not the level's upper bound.

Implemented in `src/utils/pace.js`, fed by `api/scholars.js` (admin) and `api/progress.js` (scholar). A scholar whose `start_date` is in the future is PENDING until that date arrives.

---

## API Layer (pages/api/)

All secret-key operations. The browser calls these; these call the third-party APIs. They are Next.js **Pages Router** API routes — classic `(req, res)` handlers (the Phase-14 migration relocated them from the old top-level `api/` verbatim; logic unchanged). Shared helpers live in `lib/api/` (outside `pages/` so Next doesn't expose them as routes).

| Endpoint | Method | Purpose | Secret used |
|---|---|---|---|
| `pages/api/tag-channel.js` | POST | Classify a channel's level via Haiku → stored on channel row; all its videos inherit `level_source: 'channel'` | ANTHROPIC_API_KEY |
| `pages/api/tag-video.js` | POST | Tag one video via Haiku → level + topics (fallback for channelless imports only) | ANTHROPIC_API_KEY |
| `pages/api/youtube-search.js` | GET | Search YouTube + filter out music (category 10); quota→429 | YOUTUBE_API_KEY |
| `pages/api/youtube-import.js` | POST | Batch import playlist/channel + tag all (`maxDuration: 30`) | YOUTUBE_API_KEY + ANTHROPIC_API_KEY |
| `pages/api/add-video.js` | POST | Admin: save one searched video with pre-computed tags (`ON CONFLICT DO NOTHING`) | NEON_DATABASE_URL |
| `pages/api/flush-session.js` | POST | Write watch_session row (sendBeacon target) | NEON_DATABASE_URL |
| `pages/api/progress.js` | GET | Scholar's own cumulative hours + pace + month-to-date hours + videos-watched count (all NUMERIC columns coerced with `Number()`) | NEON_DATABASE_URL |
| `pages/api/streak.js` | GET | Current + longest consecutive-day watch streak, computed from `watch_sessions.started_at` (distinct Asia/Manila calendar days, gaps-and-islands SQL), JWT-scoped | NEON_DATABASE_URL |
| `pages/api/videos.js` | GET | Library list + per-video watched state (JWT-scoped) | NEON_DATABASE_URL |
| `pages/api/mark-video.js` | POST | Manual watched/unwatched toggle | NEON_DATABASE_URL |
| `pages/api/me.js` | GET | Current user role/profile (JWT `sub` → public.users) | NEON_DATABASE_URL |
| `pages/api/scholars.js` | GET | Admin: all scholars' progress | NEON_DATABASE_URL_ADMIN |
| `pages/api/program-goal.js` | GET/POST | Admin: read active program goal; POST updates it **in place** (preserves `scholar_goals` FK links — no orphan-to-PENDING) | NEON_DATABASE_URL(_ADMIN) |
| `pages/api/scholar-goal.js` | POST | Admin: upsert a scholar's goal-clock `start_date` (`ON CONFLICT (user_id, language)`); NULL = PENDING | NEON_DATABASE_URL_ADMIN |
| `lib/api/_db.js` | — | Shared Neon connection helper (`getDb`/`getAdminDb`) | NEON_DATABASE_URL |
| `lib/api/_auth.js` | — | `verifySession`/`verifyAdmin` — JWKS-verify the Neon JWT | NEON_AUTH_BASE_URL |
| `lib/api/_tag.js` | — | Shared Haiku prompt + CEFR/topic taxonomy | ANTHROPIC_API_KEY |

**Auth enforcement:** Each scholar-facing endpoint verifies the Neon Auth JWT (Bearer, JWKS-verified in `lib/api/_auth.js`) and scopes queries to that user's `user_id` (the JWT `sub`). The browser cannot request another scholar's data — the server ignores any client-supplied user_id and uses the JWT identity. `pages/api/scholars.js` checks `role = 'admin'` before using the service-role connection.

---

## Authentication (same-origin, first-party cookie)

Phase 14 replaced the browser-direct-to-Neon SPA auth with Neon's official same-origin handler.

**Why:** In the Vite SPA model the browser talked to Neon Auth on `*.neon.tech` while the app was on `*.vercel.app`. The session cookie was therefore *third-party* (`SameSite=None`), which modern browsers block — so every cold load / refresh lost the session and bounced to `/login`. Neon hosts its auth server, so its cookie can't be reconfigured. A hand-rolled proxy was tried and broke login (PRs #22–#24). The durable fix is to run auth **same-origin**, which Neon documents only for Next.js — hence the migration.

**How it works now:**
- **Server:** `lib/auth/server.js` → `createNeonAuth({ baseUrl: NEON_AUTH_BASE_URL, cookies: { secret: NEON_AUTH_COOKIE_SECRET, sameSite: 'lax' } })`. Exposed at `app/api/auth/[...path]/route.js` via `export const { GET, POST } = auth.handler()`. This proxy forwards to Neon server-side and issues a **first-party** signed session cookie on the app's own origin → persists across refresh.
- **Client:** `src/lib/auth.js` = no-arg `createAuthClient()` from `@neondatabase/auth/next`, which targets the same-origin `/api/auth/*`. Same client surface as before (`useSession`/`signIn`/`signOut`/`token`).
- **API authorization (unchanged in spirit):** the app's own `/api/*` functions still authorize via a JWT. `src/lib/authToken.js` `getAuthToken()` fetches a real EdDSA JWT from `GET /api/auth/token` (minted from the first-party cookie), and `lib/api/_auth.js` JWKS-verifies it. (The SDK's cached token is the opaque session token in this model — not a JWT — so we fetch `/api/auth/token` explicitly.)
- **Race guards:** the route guard must treat "session present but user not yet fetched" as *loading*, or it redirects to `/login` before auth settles. `AuthContext` initializes `roleLoading = true`; `Login` navigates from an effect once `user` is set (not optimistically after `signIn`). Both were real bugs (refresh logout + first-attempt-login failure) fixed in Phase 14.

**Operational notes:** `NEON_AUTH_COOKIE_SECRET` (32+ chars) and `NEON_DATABASE_URL` must be set for **both Production and Preview** in Vercel. Each preview deploy's unique URL must be added to Neon Auth `trusted_origins` to sign in there. Vercel Framework Preset must be **Next.js**.

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
**Completion:** `completed = true` when `secondsWatched / duration_seconds >= 0.95` **within a single session**. Completion is NOT cumulative — watching 50% of a video twice does not mark it complete. Hours from every session always count toward cumulative input regardless of completion.

**Idempotency (no double-counting):** Hours are *the* metric, and three triggers can flush overlapping data — pause/end, `beforeunload` sendBeacon, and reconnect/app-load. Each flush carries a client-generated `client_flush_id` (UUID). `flush-session.js` writes with `ON CONFLICT (client_flush_id) DO NOTHING`, so the same buffered seconds flushed twice are written once. The localStorage buffer is cleared only after a flush is confirmed written, and a buffered segment keeps its id across retries. This is the primary guard against inflated cumulative hours.

---

## AI Tagging

Two-tier tagging via `claude-haiku-4-5` (server-side — key never exposed). All results cached forever; never re-fetched.

**Channel classification — primary path (`api/tag-channel.js`):**
When a channel is added or imported, Haiku classifies it once using the channel name, description, and a sample of video titles. The level is stored on the `channels` row. All videos imported from that channel inherit the channel's **level** with `level_source: 'channel'`. This is the fast path for bulk library growth — one Haiku call sets the level for every video from that channel.

**Topics are still per-video, even for channel imports.** Channel classification covers *level* only. Topic varies video-to-video within one channel (a general channel spans Daily Life, News, Culture…), so each imported video still gets a lightweight Haiku topic pass for `topic_primary` / `topic_secondary`. Channel import = one level call + one cheap topic call per video.

**Per-video classification — fallback (`api/tag-video.js`):**
Used for individual videos with no associated channel (e.g. one-off YouTube search results) — assigns both level and topics. Input: title + description + YouTube keyword tags. Output JSON: level + topic_primary + topic_secondary.

**Shared tagging logic:** The CEFR prompt and topic taxonomy live in one server-side module imported by both endpoints (single source of truth — no drift). The scholar Browse search path requires server-side tagging, so this logic stays in `api/`; any future admin bulk-seed script in Claude Code imports the same module rather than re-implementing the prompt.

**CEFR level mapping (used in prompt — no qualitative descriptions):**
```
super_beginner → A1–A2
beginner       → A2–B1
intermediate   → B1–B2
advanced       → B2–C1
```

**Edge cases:** Some channels span multiple levels; this is uncommon and not engineered around. Students skip videos that feel too hard — expected CI behavior. Admin can override any tag with `level_source: 'admin'`.

**Re-classification propagates:** If an admin re-classifies a channel later, the new level re-stamps existing videos from that channel that are still `level_source: 'channel'`. Videos an admin has manually overridden (`level_source: 'admin'`) are preserved and not touched.

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

Client-side `HashRouter` (React Router v6) running inside the Next.js shell (`app/page.jsx`, `ssr:false`). `next.config.js` rewrites non-API paths to `/` so deep links / hard refreshes serve the SPA shell, then HashRouter resolves the hash. Next owns `/api/*` (Pages Router functions) and `/api/auth/*` (App Router auth handler); those are excluded from the SPA rewrite.

```
#/               → Home dashboard (goal ring, recommended, journey stats, topics)
#/watch          → Watch page — player + curated browse
#/progress       → Progress — hours counter + milestones
#/browse         → Full browse + YouTube search
#/admin          → Admin shell (admin role only)
#/admin/progress → Scholar cards + drill-down
#/admin/videos   → Video library + AI-assisted add
#/admin/goals    → Program goal + per-scholar start dates
```

`/` previously redirected to `/watch`; as of the Jul 2026 Home redesign it renders `src/pages/Home.jsx` directly. `/watch` is unchanged — still the player + curated browse experience, and now sources its video list and daily-goal calculation from shared hooks (`useVideoLibrary`, `useDailyGoal`) also used by Home.

---

## Design System

**Color tokens (--ngsi-* prefix)** — each has a light (`:root`) and dark (`:root[data-theme="dark"]`) value in `src/styles/tokens.css`:
```css
--ngsi-navy:         #162040   /* dark mode: stays dark (#2b3860) — used as chrome background */
--ngsi-navy-light:   #1e2d52   /* dark mode: #3c4c80 */
--ngsi-navy-deep:    #0e1628   /* dark mode: #10162c */
--ngsi-gold:         #C9A84C   /* dark mode: unchanged (#d9bc6a) — shared across navy-chrome text/border uses */
--ngsi-cream:        #F5F0E8   /* dark mode: lightened-but-muted (#bcc2d0) — serves both as page bg and as text-on-navy */
--ngsi-cream-dark:   #ede7d9   /* dark mode: #6b7488 */
--ngsi-surface:      #ffffff   /* new — elevated card backgrounds; dark mode: #e8ebf0 */
--ngsi-text-muted:   #8a8f99   /* new — secondary/caption text; dark mode: #4a5266 */
--ngsi-cat-oet:      #378ADD
--ngsi-cat-life:     #1D9E75
```

**Dark mode:** `data-theme="light"|"dark"` attribute on `<html>`, set by a pre-paint inline script in `app/layout.jsx` (reads `localStorage['ngsi-theme']`, falls back to `prefers-color-scheme`) to avoid flash-of-wrong-theme. Toggled via `ThemeToggle.jsx` in the Navbar, persisted to `localStorage`. All components must reference `var(--ngsi-*)` tokens, never hardcoded hex, or the toggle won't work for them.

**Contrast note:** `--ngsi-navy` and `--ngsi-cream` are dual-purpose tokens (both background and text color depending on context) — their dark-mode values were tuned to satisfy WCAG AA (≥4.5:1) for the text-on-navy pairing (Navbar display name, Home hero) while `--ngsi-navy` itself stays dark enough to still read as chrome. `--ngsi-gold`'s dark-mode value is unchanged from light mode because it's shared across several navy-chrome text/border uses that already clear ~4.5–6:1 there — do not use `--ngsi-gold` as a stroke/accent directly on `--ngsi-surface` or other light backgrounds in dark mode (only ~1.55:1); use `--ngsi-navy` instead for that role (see Home.jsx's goal-ring stroke). Known pre-existing gap (not introduced by the Home redesign, not yet fixed): `--ngsi-gold` on `--ngsi-cream-dark` is ~2.54:1 in dark mode (Sidebar active-link border, Placeholder card border) — worth a follow-up pass.

**Typography:** Serif (Georgia) for numbers + italic accents. Sans for UI. Matches NGS Scholars site.

**Responsive:** mobile-first base; 640px tablet; 1024px desktop sidebar; 1280px widescreen max-width.

**Brand mark:** `public/icons/icon-512.png` (globe + "Talk" speech-bubble mark, navy background baked in) is the only brand image asset — used at small size (~30px) in `Navbar.jsx` next to the "NGS Immersion" text wordmark. There is no separate crest/shield logo.

---

## Video Discovery UX

**Interest-first principle:** Topic interest is the primary filter; level is a secondary constraint. Comprehensible input only works when the student is engaged — a video Claire finds genuinely interesting at slightly above her level beats a perfectly-leveled video she finds boring. The browse UI surfaces interest-matched content first; level filters narrow the pool. Students skip videos that feel too hard; this is expected and by design.

**Scholar browse (Watch):** videos at current level first + some above · 3-row color-coded topic filters · level filters · watched/unwatched toggle (defaults unwatched) · search within library.

**Scholar open search (Browse):** YouTube search via `api/youtube-search.js` · AI tags in progress · hours track regardless of source.

**Admin add:** scholar context card (level + interests) · AI-assisted search generating optimized queries from scholar profile · suggested query chips · paste URL/channel/playlist · batch import ≤50 videos, rate-limited. Adding a channel triggers `api/tag-channel.js` to classify level once for all its videos.

---

## Data Isolation (server-enforced, not RLS-only)

**Provisioning & login:** Accounts are **admin-provisioned** — there is no public self-signup. `users.id` is the **Neon Auth subject** (`sub`) assigned at account creation, not a random uuid; the API layer scopes every query by the verified JWT `sub`, which only works if the row id equals that subject. There is **one login screen** for everyone; the `role` field (`scholar` | `admin`) determines what the app renders and which routes are reachable — admins see the Admin nav and `#/admin/*`, scholars do not.

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
