# NGS Immersion — Roadmap

*Last updated: June 2026 · Design session + audit v2*

---

## Build Order

Features sequenced in dependency order. Each is a separate agentic loop goal run in Claude Code. Do not start a phase until the previous passes audit.

**v2 change:** Phase 4 (serverless API layer) added before the watch timer, because all secret-key operations must run server-side. Everything downstream calls these endpoints.

---

## Phase 1 — Project Scaffold

**Loop goal:** "Create the NGS Immersion Vite + React project scaffold with routing, CSS token system, and Vercel config. No features yet — just the skeleton."

Deliverables:
- `package.json` — React 18, Vite, React Router v6, Prettier, @neondatabase/serverless, @anthropic-ai/sdk
- `vite.config.js`, `vercel.json` (SPA rewrites + function config)
- `src/styles/tokens.css` with all `--ngsi-*` variables
- `src/styles/global.css`
- `src/App.jsx` with HashRouter and route placeholders
- `src/lib/apiClient.js` — fetch wrapper for own /api/* endpoints
- `src/context/AuthContext.jsx` shell
- `.env.example` (server vars unprefixed, client vars VITE_), `.gitignore`, `prettier.config.js`

Status: **DONE** (Jun 2026 — via agentic loop, 1 iteration, audit PASS). Adds `index.html`, `src/main.jsx`, and per-page placeholders under `src/pages/` (incl. admin sub-routes) sharing a `Placeholder.jsx`. `npm install` + `vite build` verified green; themed shell screenshotted.

---

## Phase 2 — Database Schema

**Loop goal:** "Run the NGS Immersion Neon schema. All tables, triggers, views, indexes per ARCHITECTURE.md. Verify with Neon MCP."

Deliverables:
- `neon/schema.sql` executed on ngs-immersion Neon project
- Tables: users, channels, videos, watch_sessions, program_goals, scholar_goals
- updated_at triggers on users + videos
- Views: user_total_hours, user_video_status, scholar_pace
- Verify: `SELECT * FROM information_schema.tables`

Status: **DONE** (Jun 2026 — via agentic loop, 1 iteration, audit PASS). Executed `neon/schema.sql` on project `silent-cherry-49841538` via Neon MCP. All 6 tables (users, channels, videos, watch_sessions, program_goals, scholar_goals), 3 views (user_total_hours, user_video_status, scholar_pace), 2 updated_at triggers, and 14 indexes verified present in `public` schema. Neon Auth system tables pre-existed in `neon_auth` schema (untouched).

---

## Phase 3 — Auth

**Loop goal:** "Implement Neon Auth login. Email/password. Two roles: scholar, admin. Redirect to /watch after login, /login if unauthenticated. Admin sees Admin nav, scholar does not."

Deliverables:
- `src/pages/Login.jsx` — NGS-branded
- `src/context/AuthContext.jsx` — useAuth with user + role + JWT
- Route guards; admin-only protection on `#/admin/*`
- Navbar avatar + admin pill for admin role

Status: **DONE** (Jun 2026 — via agentic loop, 1 iteration, audit PASS). Implemented Neon Auth (Better Auth) email/password login. `createAuthClient` + `useSession()` in `src/lib/auth.js` + `AuthContext.jsx`. NGS-branded Login page (navy/gold, Georgia serif). `Navbar.jsx` with avatar initial, admin pill, sign-out. `RequireAuth` + `RequireAdmin` guards in `App.jsx`. `api/_db.js` + `api/me.js` (Bearer token → Better Auth `/get-session` → `public.users` role lookup). Build passes 91 modules.

---

## Phase 4 — Serverless API Layer

**Loop goal:** "Build the Vercel serverless functions in api/. All secret-key operations live here. Each scholar endpoint verifies the Neon Auth JWT and scopes to that user_id. Admin endpoints check role=admin and use the service-role connection."

Deliverables:
- `api/_db.js` — shared Neon connection helper (reads NEON_DATABASE_URL)
- `api/flush-session.js` — POST, writes watch_sessions (sendBeacon target); idempotent via `client_flush_id` + `ON CONFLICT DO NOTHING`
- `api/progress.js` — GET, scholar's own hours + pace from scholar_pace view
- `api/scholars.js` — GET, admin-only, all-scholar progress via service role
- `api/tag-channel.js` — POST, Haiku channel-level classification; all videos from channel inherit `level_source: 'channel'`
- `api/tag-video.js` — POST, Haiku per-video tagging fallback for channelless imports
- `api/youtube-search.js` — GET, YouTube Data API (YOUTUBE_API_KEY server-side)
- `api/youtube-import.js` — POST, batch playlist import + tag
- JWT verification helper; admin role check helper
- **Audit focus:** confirm NO secret key is ever returned to the browser or VITE_-prefixed

Status: **DONE** (Jun 2026 — via agentic loop, 1 iteration, audit PASS). Built all 8 serverless functions + 3 shared helpers. `_auth.js` (verifySession/verifyAdmin via Better Auth), `_tag.js` (classifyChannelLevel/classifyVideo/classifyVideoTopics — haiku-4-5 only, shared CEFR map + topic taxonomy), `_db.js` (getDb + getAdminDb). Scholar endpoints JWT-scoped; admin endpoints role-checked + use service-role connection. flush-session idempotent via ON CONFLICT; youtube-import handles playlist/channel/video with channel-level classification once + per-video topics. Build PASS.

---

## Phase 5 — Watch Timer Core

**Loop goal:** "Implement YouTube IFrame player + watch session timer. Timer only counts seconds on PLAYING. Flushes to /api/flush-session on pause/end/beforeunload (sendBeacon). localStorage buffer for offline."

Deliverables:
- `src/components/player/VideoPlayer.jsx`
- `src/components/player/WatchTimer.jsx`
- `src/hooks/useWatchSession.js` — full play/pause/end/close state machine
- `src/utils/offlineBuffer.js` — localStorage queue (single source — no useLocalStorage hook)
- Test: play 30s, pause, verify watch_sessions row via Neon MCP

Status: **DONE** (Jun 2026 — via agentic loop, 1 iteration, audit PASS). YouTube IFrame API wrapper (`VideoPlayer.jsx`) with global single-load, stale-closure-safe refs, and cancelled flag on unmount. `useWatchSession.js` state machine: timer runs only on PLAYING, stops on PAUSED/BUFFERING/ENDED, no flush on BUFFERING. Each play segment gets its own `clientFlushId` (UUID) so ON CONFLICT idempotency correctly dedupes retries without silently dropping resumed-play seconds. Flush on PAUSED + ENDED; keepalive fetch on beforeunload (auth header preserved); localStorage buffer written synchronously before every network call, cleared only on res.ok. Cleanup effect flushes in-progress segment when user switches videos within the SPA. `WatchTimer.jsx` shows MM:SS + flush status chip. `api/videos.js` added (GET, JWT-auth, returns available library for scholar's language). `Watch.jsx` wired with video sidebar + player + timer. Build PASS (92 modules).

---

## Phase 6 — Hours Counter + Progress Display

**Loop goal:** "Build scholar hours counter, level badge, milestone bar, week stats. Data from /api/progress. DS-style levels. Pace via scholar_pace view."

Deliverables:
- `src/utils/levels.js`, `timeFormat.js`, `pace.js`
- `src/hooks/useProgress.js` — calls /api/progress
- `src/components/progress/HoursCounter.jsx`, `MilestoneBar.jsx`, `WeekStats.jsx`
- `src/pages/Progress.jsx`

Status: **DONE** (Jun 2026 — via agentic loop, 1 iteration, audit PASS). Built `src/utils/levels.js` (LEVELS array + getLevelForHours/getNextLevel/getLevelProgress), `src/utils/timeFormat.js` (formatHoursDisplay/formatHoursShort/formatRelativeDate/formatTargetDate), `src/utils/pace.js` (getPaceColor/getPaceLabel/getWeeklyTarget/formatDelta), `src/hooks/useProgress.js` (GET /api/progress with Bearer token, returns data/loading/error/refetch), `src/components/progress/HoursCounter.jsx` (large serif hours counter, gold level badge, target info, status pill), `src/components/progress/MilestoneBar.jsx` (labeled progress bar within current DS level, Advanced fallback), `src/components/progress/WeekStats.jsx` (three stat cards: This Week / Weekly Target / Last Session), `src/pages/Progress.jsx` (replaced placeholder; loading/error/PENDING/normal states, max-width 640px cream layout). Build PASS (99 modules).

---

## Phase 7 — Video Library + Filter UI

**Loop goal:** "Build video card, filter bar (topic + level + watched/unwatched), responsive grid. Color-coded topic chips. Watched state from user_video_status view."

Deliverables:
- `src/components/video/VideoCard.jsx`, `FilterBar.jsx`, `VideoGrid.jsx`
- `src/pages/Watch.jsx`, `Browse.jsx`
- Default sort: scholar's level first, one above
- Watched/unwatched toggle defaults unwatched

Status: **DONE** (Jun 2026 — via agentic loop, 1 iteration, audit PASS). `src/utils/topics.js` (10-tag taxonomy, 3 color categories, getTopicColor — single source of truth). `src/components/video/VideoCard.jsx` (16:9 thumbnail + fallback, 2-line title, channel, level badge, color-coded topic chips, green ✓ watched badge, gold ring when active). `src/components/video/VideoGrid.jsx` (responsive auto-fill minmax(240px,1fr) grid, empty state). `src/components/video/FilterBar.jsx` (controlled: multi-select category-colored topic chips in 3 rows, single-select level chips + All, unwatched/watched/all toggle). `api/videos.js` LEFT JOINs `user_video_status` scoped to JWT user → per-video `watched` + `last_watched_at`. `Watch.jsx` refactored to player+timer on top (useWatchSession wiring preserved) + FilterBar/VideoGrid below; useProgress-derived scholar level drives rank-0/1/2 sort (current level → one above → rest); default filter unwatched. `Browse.jsx` = full library browse (default all). Build PASS (146 modules). Note: Browse→Watch deep-link preselect deferred to a later phase.

---

## Phase 8 — YouTube Search + AI Tagging (wired to API)

**Loop goal:** "Wire the Browse page search to /api/youtube-search and /api/tag-video. Results show with tagging-in-progress. Tags cached to Neon. Rate-limited."

Deliverables:
- Search UI on Browse → /api/youtube-search
- "Tagging..." placeholder while Haiku runs
- Tag results written to Neon, never re-fetched
- Error handling: unavailable, quota exceeded
- **Exclude music videos** — comprehensible input requires spoken-word content; music (sung, stylized, music-masked, non-literal) is weak CI. Filter out YouTube Music category (videoCategoryId 10) at the search/import layer in `api/youtube-search.js` (and any import path), as a safety net alongside admin curation.

Status: **NOT STARTED**

---

## Phase 9 — Admin Progress Dashboard + Scholar Provisioning

**Loop goal:** "Build admin progress page. Scholar cards (AT RISK / ON TRACK / PENDING), current vs expected hours, delta, pace. Click-through to individual view. Program goal + per-scholar start date editor. Inline scholar provisioning: create Better Auth account + public.users row + goal assignment in one flow."

Deliverables:
- `src/pages/AdminProgress.jsx`
- `src/components/admin/ScholarCard.jsx`
- `src/components/admin/GoalEditor.jsx` — program goal + per-scholar start_date assignment
- `src/components/admin/AddScholarPanel.jsx` — create scholar: email + display name → Better Auth account creation via `api/provision-scholar.js` → insert `public.users` row (id = Better Auth sub) → assign active program goal
- `api/provision-scholar.js` — admin-only; calls Better Auth admin API to create account, inserts `public.users`, inserts `scholar_goals`; returns temporary password or triggers email invite depending on Better Auth capability
- Individual drill-down = scholar Progress layout, filtered
- Overview stats: total scholars, total hours, at-risk count
- Data from /api/scholars (admin service role)

Status: **NOT STARTED**

---

## Phase 10 — Admin Video Management + AI-Assisted Search

**Loop goal:** "Build admin video management. AI-assisted search using scholar profile context. URL/channel/playlist import via /api/youtube-import. Low-inventory alert < 20 unwatched/level. Stale checker."

Deliverables:
- `src/pages/AdminVideos.jsx`
- `src/components/admin/AddVideoPanel.jsx` — scholar context + AI search + URL import
- Scholar selector drives AI query suggestions
- Suggested query chips from level + interest tags
- Batch import ≤50/call → preview → confirm
- Low-inventory badge on admin nav
- Weekly stale check → flag is_available=false, preserve history

Status: **NOT STARTED**

---

## Phase 11 — Responsive Layout + Desktop Sidebar

**Loop goal:** "Full responsive layout. Mobile bottom nav. 640px+ sidebar. 1024px+ 3-col grid. 1280px+ max-width centered."

Deliverables:
- `src/components/layout/Navbar.jsx`, `Sidebar.jsx`, `BottomNav.jsx`
- Breakpoints verified: 375 / 640 / 1024 / 1280 / 1920
- Admin sidebar items hidden from scholar role

Status: **NOT STARTED**

---

## Phase 12 — Offline Resilience + Connection Indicator

**Loop goal:** "Full offline resilience. localStorage buffer flushes on reconnect + app load. Connection pill in nav (saved/buffering/offline). sendBeacon on beforeunload."

Deliverables:
- `src/utils/offlineBuffer.js` finalized — flush-on-reconnect
- navigator.onLine + online event detection
- Connection pill: green saved / amber buffering / red offline
- Test: kill network mid-session, restore, verify Neon row

Status: **NOT STARTED**

---

## Phase 13 — Polish + Launch Prep

**Loop goal:** "Final polish. Loading states, error boundary, empty states, iOS YouTube notice, Vercel deploy, env vars set."

Deliverables:
- Loading skeletons
- Error boundary in App.jsx
- Empty state when library has no videos
- iOS notice: embeds may open YouTube app — hours still track on return
- Vercel project created, env vars set (server unprefixed, client VITE_), deploy verified
- `README.md` setup instructions

Status: **NOT STARTED**

---

## Session Log

| Date | Phase | Goal | Iterations | Notes |
|---|---|---|---|---|
| Jun 2026 | Design | Grill-me + foundation files | — | All decisions locked. See ARCHITECTURE.md. |
| Jun 2026 | Audit v2 | Foundation file audit | 1 | Fixed: API key exposure (serverless layer), missing scholar start_date (scholar_goals table), hook naming, updated_at triggers, Neon Auth isolation pattern. |
| Jun 2026 | Design v2 | AI tagging + video discovery design | 1 | Channel-level classification as primary tagging path (api/tag-channel.js); per-video fallback only. CEFR-only prompt (no qualitative descriptions). Interest-first principle locked. Edge cases accepted — skip mechanic handles them. level_source adds 'channel' value. |
| Jun 2026 | Phase 1 | Project scaffold | 1 | Vite + React 18 skeleton via agentic loop (build → isolated audit → PASS). HashRouter shell, all `--ngsi-*` tokens, inert AuthContext + apiClient, Vercel SPA/function config. No features. Build green; themed shell verified by screenshot. Also fixed the Agentic Loop protocol URL (filename was `AGENTIC%20LOOP.md`, should be `AGENTIC_LOOP.md`). |
| Jun 2026 | Design v3 | Foundation hardening | 1 | Locked 8 foundation decisions: (1) admin-provisioned users, users.id = Neon Auth sub, single role-based login; (2) hours idempotency via client_flush_id + ON CONFLICT; (3) Asia/Manila timezone for all week/day/pace math; (4) channel import inherits level but each video still gets per-video Haiku topic tagging; (5) completion = per-session ≥95%, non-cumulative, hours always logged; (6) expected_hours capped at target_hours, defined post-deadline status; (7) "reach level X" = entry threshold; (8) channel re-classification re-stamps channel-sourced videos, preserves admin overrides. Tagging logic kept in shared server module (no Claude-Code/API drift). |
| Jun 2026 | Phase 2 | Database schema | 1 | Executed neon/schema.sql on NGS - Immersion Neon project (silent-cherry-49841538) via Neon MCP. 6 tables, 3 views, 2 triggers, 14 indexes all verified PASS. Asia/Manila timezone anchored in views. Neon Auth system schema pre-existed and was untouched. |
| Jun 2026 | Phase 3 | Auth | 1 | Neon Auth (Better Auth) email/password. createAuthClient + useSession. Branded Login page. Navbar with admin pill. RequireAuth/RequireAdmin guards. api/me.js with Better Auth session verification + public.users role lookup. Build PASS. |
| Jun 2026 | Phase 4 | Serverless API layer | 1 | _auth.js, _tag.js (haiku-4-5, shared CEFR+taxonomy), _db.js (getDb+getAdminDb), flush-session (idempotent), progress, scholars (service-role), tag-channel, tag-video, youtube-search, youtube-import (playlist/channel/video). All secret keys server-only. PASS. |
| Jun 2026 | Phase 5 | Watch timer core | 1 | VideoPlayer (YT IFrame API, global single-load, stale-closure-safe refs, cancelled flag). useWatchSession state machine: timer only on PLAYING, per-segment clientFlushId, flush on PAUSED+ENDED, buffer-before-fetch, keepalive fetch on beforeunload, SPA-navigation cleanup flush, buffer drain on mount+reconnect. WatchTimer display. api/videos.js. Watch.jsx wired. Build PASS (92 modules). |
| Jun 2026 | Phase 6 | Hours counter + progress display | 1 | levels.js (DS-style thresholds + helpers), timeFormat.js, pace.js, useProgress hook (GET /api/progress with Bearer token), HoursCounter (large serif number, gold badge, status pill), MilestoneBar (labeled progress bar within current level), WeekStats (3 stat cards), Progress.jsx (loading/error/PENDING/normal states). Build PASS (99 modules). |
| Jun 2026 | Phase 7 | Video library + filter UI | 1 | topics.js (taxonomy + color map), VideoCard (thumbnail/level/topic chips/watched badge/active ring), VideoGrid (responsive auto-fill grid), FilterBar (3-row color-coded topic chips + level + watched toggle), api/videos.js LEFT JOIN user_video_status for per-video watched state, Watch.jsx refactor (player preserved + curated browse, scholar-level-first sort, default unwatched), Browse.jsx full library. Build PASS (146 modules). Browse→Watch preselect deferred. |
| Jun 2026 | Hotfix | Auth login bounce (first live login) | — | First end-to-end login against deployed Vercel + Neon Auth. Login succeeded (sessions created) but app bounced to /login: every /api/me returned 401. Root cause — verifySession sent the browser's opaque session token to Neon Auth /get-session as a Bearer, but Neon Auth sessions are HTTP-only cookies, not backend-verifiable tokens. For a cross-domain backend (app on vercel.app, auth on neon.tech) the documented path is the JWT plugin. Fix: api/_auth.js verifies an EdDSA JWT against {NEON_AUTH_BASE_URL}/.well-known/jwks.json via jose (issuer-checked, user id from sub); src/lib/auth.js adds jwtClient(); new src/lib/authToken.js getAuthToken() is the single token source; AuthContext/useProgress/Watch/useWatchSession send the JWT (not the session token). Also removed an invalid relative callbackURL from Login.jsx. Verified working in production (PRs #15, #16). |
| Jun 2026 | Hotfix | Login HTTP 404 / get-session 400 (proxy regression) | — | After the same-origin auth proxy landed (PR #23), Sign In failed with "HTTP 404" and `/api/neon-auth/get-session` returned 400. Logs confirmed the proxy deployment regressed it while JWT/JWKS verification still worked (so NEON_AUTH_BASE_URL was correct). Root cause — `api/neon-auth/[...path].js` forwarded *all* inbound headers, including Vercel's `x-forwarded-host` / `x-forwarded-proto` / `forwarded` / `x-vercel-*`. Neon's hosted Better Auth sits behind its own trusted proxy and derives its origin/base URL from those headers, so it saw the Vercel host, resolved the wrong origin, and rejected the proxied requests. Fix: strip the forwarding/proxy headers before forwarding so the upstream uses its own configured host (Host already set by fetch). |

---

## Roadmap Notes (Future — Not In Scope Now)

**Per-scholar interest config:** topic tags hardcoded for Claire. Build admin module for per-scholar interest tags driving AI search + surfacing.

**Multiple languages:** `language` field in all tables. Add language = new videos + UI selector + filtered queries. No migration.

**NGH hospitality track:** per-program topic taxonomy. Make taxonomy configurable when NGH joins.

**Video maintenance:** seed 150 at launch; 10–15/week top-up; low-inventory alert (Phase 10); weekly stale check; keep-forever (never delete); shared library, per-scholar watch history.
