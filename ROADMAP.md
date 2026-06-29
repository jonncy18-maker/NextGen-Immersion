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

Status: **DONE** (Jun 2026 — via agentic loop, 1 iteration, audit PASS). `api/youtube-search.js` updated: 2-call music filter (search.list → videos.list to get categoryId → filter out category 10); quota 429 detection with clear error message; results capped to requested limit after filtering. `api/add-video.js` (new): admin-only POST endpoint; inserts video with pre-computed tags via `ON CONFLICT (youtube_id) DO NOTHING`; returns `{ added, videoId }`. `src/components/admin/AddVideoPanel.jsx` (new): 500ms debounced search input; per-result async Haiku tagging via `/api/tag-video` triggered on card mount; "Tagging…" placeholder → level badge + topic chips once done; "Add"/"Adding…"/"Added ✓"/"In Library"/"Failed" button states; quota-exceeded and unavailable error messages; empty results state. `src/pages/AdminVideos.jsx`: placeholder replaced with `AddVideoPanel` layout. Build PASS (312 modules).

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

Status: **IN PROGRESS** — Dashboard + goal editor DONE (Jun 2026, agentic loop, 1 iteration, isolated audit PASS). Provisioning (`provision-scholar.js` + `AddScholarPanel.jsx`) DEFERRED to a dedicated follow-up PR so the auth-touching create-scholar path gets its own Vercel preview-deploy verification (per the Phase 14 hard constraint on auth regressions). Built this round:
- `src/pages/AdminProgress.jsx` — overview stats (total scholars / total hours / at-risk count) + responsive `ScholarCard` grid + click-through drill-down reusing the scholar Progress layout (`HoursCounter` + `MilestoneBar` + `WeekStats`) filtered to one scholar. Data from `/api/scholars`.
- `src/components/admin/ScholarCard.jsx` — status-accented card: ON TRACK / AT RISK / PENDING pill, current vs expected hours, delta, this-week, last session.
- `src/components/admin/GoalEditor.jsx` (on `src/pages/AdminGoals.jsx`, route `#/admin/goals`) — program-goal form (level/hours/date) + per-scholar `start_date` rows. start_date is the control that flips a scholar PENDING → ON_TRACK/AT_RISK.
- `src/hooks/useScholars.js` — admin fetch of `/api/scholars`.
- `pages/api/program-goal.js` — admin-only GET active goal + POST. **POST updates the active goal IN PLACE** (never insert-new + deactivate-old) so `scholar_goals.program_goal_id` FK links stay valid and existing scholars aren't orphaned to PENDING; inserts only when no active goal exists.
- `pages/api/scholar-goal.js` — admin-only POST upserts `scholar_goals.start_date` (`ON CONFLICT (user_id, language)`), linking to the active program goal; clears to NULL/PENDING on empty date; 400 if no active program goal exists.
- `src/pages/Admin.jsx` redirects `#/admin` → `#/admin/progress`; `Navbar` gains a Goals link. Both new endpoints: verifySession → 401, role check → 403; no secret returned. `next build` PASS.

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

Status: **DONE** (Jun 2026 — via agentic loop, 1 iteration, audit PASS). Built on top of Phase 8 search foundation:
- `src/components/admin/AddVideoPanel.jsx` — scholar context selector (dropdown of all scholars via `useScholars`; computes current level from `current_hours` via `getLevelForHours`); 5 level-appropriate query chips per scholar; chip click fires search immediately (not debounced); ScholarContext hidden when no scholars in system.
- `src/pages/AdminVideos.jsx` — added Import by URL section (client-side URL parsing for video/?v=, playlist/?list=, channel /channel/UC… patterns; POST /api/youtube-import; shows imported N / skipped M result); added Library Tools section (stale check button + inline result).
- `pages/api/inventory-check.js` (new) — GET, admin-only; counts is_available=true videos per level; returns `{ levels: { super_beginner, beginner, intermediate, advanced } }` with 0 defaults.
- `pages/api/stale-check.js` (new) — POST, admin-only, maxDuration:30; batches all available video youtube_ids 50/call to YouTube videos?part=status; marks private/non-embeddable/missing videos as is_available=false + unavailable_since; skips batch on API error (no false positives); returns { checked, flagged, flaggedTitles }.
- `src/components/layout/Navbar.jsx` — fetches /api/inventory-check on admin mount; shows red dot badge on Videos link when any level < 20 available; cancelled-flag cleanup on unmount.
- All new endpoints: verifyAdmin → 403; YOUTUBE_API_KEY server-side only; next build PASS.

---

## Phase 11 — Responsive Layout + Desktop Sidebar

**Loop goal:** "Full responsive layout. Mobile bottom nav. 640px+ sidebar. 1024px+ 3-col grid. 1280px+ max-width centered."

Deliverables:
- `src/components/layout/Navbar.jsx`, `Sidebar.jsx`, `BottomNav.jsx`
- Breakpoints verified: 375 / 640 / 1024 / 1280 / 1920
- Admin sidebar items hidden from scholar role

Status: **DONE** (Jun 2026 — via agentic loop, 1 iteration, audit PASS). Full responsive layout shell:
- `src/components/layout/Sidebar.jsx` (new) — 200px, cream-dark bg, gold active highlight (left border + tinted bg), Scholar section (Watch/Browse/Progress) + Admin section (Videos 🎬/Dashboard 📊/Goals 🎯) gated on `role==='admin'`; low-inventory red dot on Videos; hidden on mobile via `.ngsi-hide-mobile`.
- `src/components/layout/BottomNav.jsx` (new) — fixed bottom, 56px, navy bg, 3 scholar tabs + 4th Admin tab for admins (→ `/admin/progress`); gold active tab; hidden on desktop via `.ngsi-hide-desktop`.
- `src/components/layout/Navbar.jsx` — inline nav links and low-inventory logic removed (both moved to Sidebar); now: wordmark + admin pill + avatar + signout only.
- `src/App.jsx` `AuthLayout` — flex column shell: Navbar / (Sidebar + main, maxWidth 1280 centered) / BottomNav. `<main>` gets `.ngsi-main-content` class.
- `src/components/video/VideoGrid.jsx` — minmax tuned from 240px → 220px: 1-col mobile, 2-col tablet (440px content), 3-col desktop (824px content).
- `src/styles/global.css` — `.ngsi-hide-mobile` / `.ngsi-hide-desktop` responsive helpers; `.ngsi-main-content` padding-bottom 64px on mobile to clear fixed bottom nav. Next.js build PASS.

---

## Phase 12 — Offline Resilience + Connection Indicator

**Loop goal:** "Full offline resilience. localStorage buffer flushes on reconnect + app load. Connection pill in nav (saved/buffering/offline). sendBeacon on beforeunload."

Deliverables:
- `src/utils/offlineBuffer.js` finalized — flush-on-reconnect
- navigator.onLine + online event detection
- Connection pill: green saved / amber buffering / red offline
- Test: kill network mid-session, restore, verify Neon row

Status: **DONE** (Jun 2026 — via agentic loop, 1 iteration, isolated audit PASS). Built on the Phase 5 buffer foundation:
- `src/utils/offlineBuffer.js` finalized — added `getBufferedCount()`, a reusable exported `drainBuffer()` (single source of truth: posts every buffered segment to `/api/flush-session` with the JWT, removes each on `res.ok`, leaves non-ok items queued, stops on network error; module-level `draining` in-flight guard serializes overlapping triggers), and a same-tab `BUFFER_CHANGE_EVENT` dispatched on every `bufferFlush`/`removeBuffered` (the `storage` event only fires cross-tab, so the in-tab pill needs its own signal).
- `src/hooks/useConnection.js` (new) — `navigator.onLine` (SSR-guarded) + `online`/`offline` listeners drive `online`; buffered count tracked via `BUFFER_CHANGE_EVENT` + cross-tab `storage`; derives `status` = offline / buffering / saved; **drives the app-wide flush-on-reconnect AND flush-on-app-load** (drains on mount and on `online`), so the buffer syncs regardless of which page is mounted (not Watch-only).
- `src/components/layout/ConnectionPill.jsx` (new) — colored dot + label pill: green Saved / amber Buffering (N) / red Offline, with a status-aware `title` and `role="status" aria-live="polite"`. Uses new `--ngsi-status-*` tokens.
- `src/components/layout/Navbar.jsx` — renders `<ConnectionPill />` (present on every authed page via `AuthLayout`).
- `src/styles/tokens.css` — added `--ngsi-status-saved` / `--ngsi-status-buffering` / `--ngsi-status-offline`.
- `src/hooks/useWatchSession.js` — replaced its duplicated local drain with the shared `drainBuffer` (no behavior change; `draining` guard + `ON CONFLICT (client_flush_id)` keep the now-two drain triggers idempotent — no double-counted hours, no dropped resumed-play seconds). Per-segment `clientFlushId` reset on PAUSED/ENDED unchanged. `next build` PASS.

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

Status: **DONE** (Jun 2026 — via agentic loop, 1 iteration, isolated audit PASS). Final UI polish for launch:
- `src/components/layout/ErrorBoundary.jsx` (new) — class error boundary (`getDerivedStateFromError` + `componentDidCatch`); branded navy/gold/cream fallback with a Reload button instead of a blank screen. Wrapped as the **outermost** element in `src/App.jsx` (outside `AuthProvider`/`HashRouter`) so any render crash is caught.
- `src/components/video/VideoGridSkeleton.jsx` (new) — shimmer placeholder cards that mirror `VideoGrid`'s grid + `VideoCard`'s shape (no layout jump). Driven by a `.ngsi-skeleton` shimmer class + `@keyframes ngsi-shimmer` added to `global.css`, with a `prefers-reduced-motion` opt-out. Replaces the bare "Loading…" text on Watch + Browse.
- `src/components/video/EmptyState.jsx` (new) — friendly empty block (icon + title + message). Watch + Browse render it when the **unfiltered** library is genuinely empty (`videos.length === 0`); `VideoGrid` keeps its own "No videos match these filters." message for the filtered-but-non-empty case. Branch order on both pages: error → loading (skeleton) → empty → grid.
- `src/components/player/IosPlaybackNotice.jsx` (new) — one-time dismissible notice (persisted in `localStorage`, private-mode-guarded) telling iPhone/iPad users embeds may open the YouTube app and that hours still track on return. iOS-only (UA + iPadOS-reports-as-Mac via `maxTouchPoints`; SSR-safe). Rendered above the player on Watch.
- `README.md` — added a Notes section (iOS playback behavior + resilience). The Vercel project / env vars / deploy were already completed and verified in Phase 14, and `README.md` setup instructions already existed — those deliverables were satisfied earlier; this phase covered the remaining UI polish. `next build` PASS.

---

## Phase 14 — Cross-Site Session Persistence

**Loop goal:** "Keep scholars signed in across cold opens (new day, tab eviction, hard refresh) without breaking login. The app is on `*.vercel.app`; Neon Auth is on `*.neon.tech`, so the session cookie is third-party and `SameSite`-restricted — the browser drops it and the next cold load bounces to /login."

**Why this is deferred (not a quick fix):**
- Our current setup is Neon's *recommended* React-SPA pattern: the browser talks directly to Neon Auth via `VITE_NEON_AUTH_URL` (`src/lib/auth.js`). Login works; only persistence across cold loads is affected.
- Neon hosts the auth server in the SPA model, so **we cannot reconfigure its cookie** — `configure_neon_auth` exposes only trusted_origins / localhost / auth_methods / oauth / email_provider. There is **no** SameSite, cookie-domain, or partitioned-cookie (CHIPS) toggle. The documented `cookies: { sameSite: 'none' }` fix applies only to the Next.js model where *you* host the handler.
- A hand-rolled same-origin proxy was already tried and **broke login twice** (PRs #22–#24): Vercel's `api/[...path].js` catch-all only matched single-segment subpaths, so `POST /sign-in/email` 404'd, and the forwarded upstream base was wrong. Do not retry the hand-rolled proxy.

**Candidate approaches (pick during the loop, verify on a preview deploy before merging):**
1. **Move the app to Next.js on Vercel** and use Neon's official `createNeonAuth().handler()` + `NEON_AUTH_COOKIE_SECRET`. Next.js handles catch-all routing correctly, the cookie becomes first-party on the app origin, and `sameSite`/secret are configurable. Largest change; also tidies the `api/` layer. The "right" architecture.
2. **Custom domain** where the app and Neon Auth share one registrable parent domain (cookie becomes first-party) — only if Neon ever offers a custom auth domain (not available today on this tier).
3. Re-evaluate partitioned cookies (CHIPS) if Neon adds support.

**Hard constraint:** any attempt must be built on a branch and **verified on a Vercel preview deploy that sign-in still works** before merging — login regression is the failure mode that bit us repeatedly.

Status: **DONE** (Jun 2026 — approach #1, Next.js migration; verified in production: login works on first attempt, session persists across refresh). Two client-side bearer-token attempts first (fetchOptions, then window.fetch interception) both regressed sign-in and were reverted — confirming the roadmap's call that only the architectural fix works. Migrated the Vite SPA to **Next.js 16** (App Router) hosting Neon's official same-origin handler:
- `lib/auth/server.js` — `createNeonAuth({ baseUrl, cookies:{ secret, sameSite:'lax' }})` (issues a first-party `session_data` cookie on the app origin).
- `app/api/auth/[...path]/route.js` — `export const { GET, POST } = auth.handler()` (force-dynamic).
- `src/lib/auth.js` — swapped to no-arg `createAuthClient()` from `@neondatabase/auth/next` (same-origin `/api/auth/*`); identical client surface (useSession/signIn/signOut/token) so AuthContext/Login/authToken.js are unchanged.
- App shell: `app/layout.jsx` + `app/page.jsx` (`'use client'`, `next/dynamic(..., { ssr:false })`) renders the existing HashRouter SPA verbatim. `next.config.js` rewrites non-API paths to `/`.
- Backend: `api/*` → `pages/api/*` verbatim (classic `(req,res)`); shared helpers moved to `lib/api/` (Next 16 no longer excludes `_`-prefixed files from routing, so leaving them under pages/api exposed them as endpoints). JWT/JWKS verification unchanged.
- `package.json` (next 16, @neondatabase/auth; dropped vite), `vercel.json`, `.env.example` (added NEON_AUTH_COOKIE_SECRET), removed index.html/main.jsx/vite.config.js. `next build` PASS.
- **Vercel setup (done):** `NEON_AUTH_COOKIE_SECRET` (32+ chars) + `NEON_DATABASE_URL` scoped to **Production AND Preview**; Framework Preset switched **Vite → Next.js** (the project was pinned to Vite — builds failed until changed). Per-deploy preview URLs added to Neon `trusted_origins` for testing.
- **Two follow-up fixes after merge of the migration:** (a) `/api/me` 401 "Invalid Compact JWS" — the same-origin proxy doesn't surface `set-auth-jwt`, so `getAuthToken()` now fetches `GET /api/auth/token` for a real JWT; (b) refresh logout + first-sign-in-failure — render-timing races where the route guard evaluated before auth settled (fixed via `AuthContext` `roleLoading=true` init and `Login` effect-based navigation). Verified on production. (PRs #29, #30.)

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
| Jun 2026 | Hotfix | Login HTTP 404 (remove broken auth proxy) | — | The header-strip fix above did not resolve it. Probing the live endpoints through Vercel proved the same-origin proxy had two independent faults: (1) the catch-all `api/neon-auth/[...path].js` only matched single-segment subpaths, so the two-segment `POST /api/neon-auth/sign-in/email` never reached the function — Vercel returned NOT_FOUND (the user's "HTTP 404"); single-segment paths like `/get-session` did reach it. (2) Even those single-segment requests 404'd at Neon (`x-neon-ret-request-id` present), so the forwarded upstream base path was wrong too. Fix: drop the proxy from the auth path entirely and talk to Neon directly via `import.meta.env.VITE_NEON_AUTH_URL` — the config that previously logged in (PRs #16, #21). Removed `api/neon-auth/[...path].js`; neon-js still caches the session in localStorage and `/api/*` calls still use the JWKS-verified JWT. (Cross-domain session-cookie persistence on refresh remains a separate follow-up; the proxy that aimed to fix it broke login.) Verified in production via Vercel bundle-hash + endpoint probing (PR #25). |
| Jun 2026 | Investigation | Session persistence options (cold-open logout) | — | Decided NOT to fix now; logged as Phase 14. Findings: our direct-to-Neon config is Neon's recommended React-SPA pattern; Neon hosts the auth server so we can't reconfigure its third-party `SameSite`-restricted cookie (`configure_neon_auth` exposes no cookie/SameSite/partitioned setting); the only robust fixes (official `createNeonAuth().handler()` on a same-origin Next.js server, or a shared custom domain) are deliberate architectural changes, not hotfixes. Re-introducing a hand-rolled proxy is explicitly ruled out (broke login in PRs #22–#24). Login works on the supported config; cold-open re-login accepted for an internal single-scholar SPA. |
| Jun 2026 | Phase 8 | YouTube Search + AI Tagging (wired to API) | 1 | youtube-search.js: 2-call music filter + quota 429. add-video.js (new): admin-only save with ON CONFLICT idempotency. AddVideoPanel.jsx (new): debounced search, per-card async Haiku tagging ("Tagging…" → chips), Add/Added/In Library/Failed states. AdminVideos.jsx: placeholder replaced. Build PASS (312 modules). |
| Jun 2026 | Chore | Navbar nav links | — | Added inline nav (Watch/Browse/Progress + admin Videos/Dashboard) so pages are reachable ahead of Phase 11. Active link highlighted in gold. (PR #28.) |
| Jun 2026 | Phase 14 | Next.js migration — same-origin first-party auth | 1 | Migrated Vite SPA → Next.js 16 (App Router) to host Neon's createNeonAuth() same-origin handler (app/api/auth/[...path]), making the session cookie first-party so it survives refresh. Client → no-arg createAuthClient() from @neondatabase/auth/next. api/* → pages/api/* verbatim; shared helpers → lib/api/. Dropped Vite (index.html/main.jsx/vite.config). Two prior client-side bearer attempts reverted (regressed login). (PR #29.) |
| Jun 2026 | Hotfix | Vercel preset + Preview env vars | — | Vercel project was pinned to Framework Preset = Vite → builds failed (looked for dist/); switched to Next.js. NEON_DATABASE_URL/NEON_AUTH_COOKIE_SECRET weren't scoped to Preview → /api/me 500 broke login on previews; scoped to Prod+Preview. Diagnosed via Vercel runtime logs (now visible since auth runs same-origin). |
| Jun 2026 | Hotfix | /api/me 401 + refresh/first-login races | — | (a) /api/me 401 "Invalid Compact JWS": same-origin proxy doesn't surface set-auth-jwt header, so getAuthToken() fell back to the opaque session token — fixed by fetching GET /api/auth/token for a real JWT. (b) Refresh logout + first-sign-in-failure: route guard evaluated before auth settled — fixed via AuthContext roleLoading=true init and Login effect-based navigation. Verified in production. (PRs #29, #30.) |
| Jun 2026 | Phase 9 | Admin progress dashboard + goal editor (provisioning deferred) | 1 | AdminProgress (overview stats + ScholarCard grid + drill-down reusing HoursCounter/MilestoneBar/WeekStats), GoalEditor on /admin/goals (program goal + per-scholar start_date), useScholars hook, program-goal.js (POST updates active goal IN PLACE to preserve scholar_goals FK links), scholar-goal.js (upsert start_date ON CONFLICT (user_id, language)), Admin→/admin/progress redirect, Navbar Goals link. Both endpoints admin-only (401/403). Isolated audit PASS; next build PASS. Provisioning (provision-scholar.js + AddScholarPanel) deferred to its own PR for preview-deploy auth verification. |
| Jun 2026 | Docs | Post-Phase-14 documentation sync | — | Updated CLAUDE.md (stack/structure/env/auth rules), ARCHITECTURE.md (system diagram + API layer + new Authentication section + routing), README.md (full setup/deploy guide), ROADMAP.md (Phase 14 DONE + this log) to reflect the Next.js/same-origin-auth reality. |
| Jun 2026 | Phase 10 | Admin video management + AI-assisted search | 1 | Scholar context selector in AddVideoPanel (useScholars + getLevelForHours → level chips, immediate search on chip click). Import by URL section in AdminVideos (client-side video/playlist/channel URL parsing, POST youtube-import, shows imported/skipped). Library Tools section (stale check button → POST stale-check, shows flagged count). inventory-check.js (GET, available video counts per level). stale-check.js (batch 50 to YouTube status API, marks private/non-embeddable as unavailable, skip-on-error). Navbar low-inventory red dot badge on Videos link. Audit PASS; next build PASS. |
| Jun 2026 | Phase 11 | Responsive layout + desktop sidebar | 1 | Sidebar.jsx (new, cream-dark, gold active, scholar+admin sections, low-inventory dot, hidden mobile). BottomNav.jsx (new, fixed bottom nav, 3/4 tabs, hidden desktop). Navbar stripped to wordmark+avatar+signout only. AuthLayout restructured: Navbar / (Sidebar+main, maxWidth 1280 centered) / BottomNav. VideoGrid minmax 240→220px for correct 2/3-col breakpoints with sidebar. global.css responsive helpers + mobile bottom-nav padding clearance. Audit PASS; next build PASS. |
| Jun 2026 | Hotfix | Sidebar left-anchor (wide viewport centering bug) | — | At viewports wider than 1280px the content area left-aligned leaving a blank cream strip on the right. Root cause: in a flex-column container `align-items:stretch` resolves cross-axis `auto` margins to 0, so `maxWidth:1280` + `margin:'0 auto'` on `shellStyles.body` had no centering effect — the body was left-anchored at 1280px. Fix: removed `maxWidth`/`margin`/`width` from `shellStyles.body` (simplified to `{flex:1, display:'flex'}`). The sidebar stays left-anchored at all widths; individual page containers (Watch/Browse/AdminVideos) handle their own max-width centering. (PR #36.) |
| Jun 2026 | Phase 12 | Offline resilience + connection indicator | 1 | offlineBuffer.js finalized (getBufferedCount, reusable drainBuffer with in-flight guard, same-tab BUFFER_CHANGE_EVENT). useConnection hook (navigator.onLine + online/offline + buffered count → offline/buffering/saved; drives app-wide drain on mount + reconnect). ConnectionPill in Navbar (green Saved / amber Buffering(N) / red Offline, --ngsi-status-* tokens, aria-live). useWatchSession deduped onto the shared drainBuffer (idempotency preserved via draining guard + ON CONFLICT). Isolated audit PASS; next build PASS. |
| Jun 2026 | Hotfix | Scholar progress page crash (Neon NUMERIC → string) | — | Navigating to `/#/progress` showed "This page couldn't load" for scholars; admin dashboard worked. Root cause: `scholar_pace` view computes `current_hours`, `hours_this_week`, and `expected_hours` with `ROUND(...)::numeric`. Neon's `@neondatabase/serverless` driver returns Postgres `NUMERIC` columns as JS strings. `Progress.jsx` passed `data.current_hours` directly to `HoursCounter` which called `.toFixed(1)` on the string → `TypeError`. `AdminProgress.jsx` already wraps all values in `Number()` (hence worked). Fix: coerce the three NUMERIC fields to `Number` at the API boundary in `pages/api/progress.js`. Rule: always `Number()` coerce `ROUND(...)::numeric` outputs from Neon before passing to JS arithmetic or string formatting. (PR #37.) |
| Jun 2026 | Phase 13 | Polish + launch prep | 1 | ErrorBoundary (class, branded reload fallback) wrapped outermost in App.jsx. VideoGridSkeleton (shimmer cards mirroring VideoGrid/VideoCard; `.ngsi-skeleton` + `@keyframes ngsi-shimmer` in global.css + prefers-reduced-motion) replaces bare "Loading…" on Watch+Browse. EmptyState shown when the unfiltered library is empty (distinct from VideoGrid's filtered-empty message); branch order error→loading→empty→grid. IosPlaybackNotice (iOS-only, dismissible, localStorage-persisted) above the player on Watch. README Notes section. Vercel deploy/env + README setup already done in Phase 14. Isolated audit PASS; next build PASS. |
| Jun 2026 | Phase 15 | Per-scholar program goals | 1 | Schema: added target_level/target_hours/target_date to scholar_goals (ADD COLUMN IF NOT EXISTS). scholar_pace view rewritten with COALESCE(sg.*, pg.*) fallback — per-scholar values win, program_goals stays as fallback FK. scholar-goal.js: added GET; POST upserts all four goal fields. program-goal.js: applyToAll action stamps template onto all scholar_goals rows. GoalEditor.jsx: ScholarGoalRow gains three labeled inputs + Apply template button. scholars.js + progress.js unchanged (view rewrite covers them). Isolated audit PASS (8/8 SC); next build PASS. |
| Jun 2026 | Phase 16 | External hours logging | 1 | Schema: external_sessions table (8 cols, user_id index); user_total_hours view replaced with UNION ALL(watch_sessions, external_sessions) so scholar_pace picks up external hours automatically. log-external.js (new): POST; scholar forced to own userId; admin can log for any scholar; validates session_type enum + durationMinutes + sessionDate + notes; returns inserted row. progress.js: 3 parallel queries; adds user_id + video_hours_this_week + external_hours_this_week to response. ExternalHoursButton.jsx (new): modal with 4 inputs, POST, onLogged callback. Progress.jsx + AdminProgress.jsx: button added to normal/drill-down state. WeekStats.jsx: breakdown chip when external > 0. Audit PASS (9/9 SC); next build PASS. |

---

## Phase 15 — Per-Scholar Program Goals

**Loop goal:** "Make the program goal configurable per scholar. Each scholar gets their own target level, target hours, and target date — not a single shared program goal. Admin can set or override each scholar's goal independently."

**Background:** Phase 9 built a single `program_goals` table with one active global goal that all scholars share via `scholar_goals.program_goal_id`. In practice, scholars join at different times and have different graduation / registration deadlines (e.g. Claire's OET exam date vs. April's or Nathalie's), so a single shared target date doesn't fit.

Deliverables:
- Schema change: add `target_level`, `target_hours`, and `target_date` columns directly to `scholar_goals` (or migrate `program_goals` to a per-scholar model). Each scholar row is self-contained — no shared FK.
- `pages/api/scholar-goal.js` updated — POST accepts per-scholar `target_level` / `target_hours` / `target_date` in addition to `start_date`; GET returns the scholar's own goal fields.
- `pages/api/program-goal.js` — retain as a template/default-setter (admin can push a template to all scholars at once) but individual scholars can diverge.
- `src/components/admin/GoalEditor.jsx` updated — per-scholar rows now show editable `target_date` (and optionally target level/hours) alongside `start_date`. Template apply button pushes defaults to all scholars.
- `pages/api/scholars.js` + `scholar_pace` view updated — pace calculations use the scholar's own `target_date` / `target_hours` instead of the global goal.
- `src/pages/Progress.jsx` + `src/components/progress/WeekStats.jsx` — deadline display uses the scholar's own target date.

Status: **DONE** (Jun 2026 — via agentic loop, 1 iteration, audit PASS). Made every scholar's goal self-contained:
- **Schema migration** (live on Neon `silent-cherry-49841538`): added `target_level text`, `target_hours integer`, `target_date date` columns to `scholar_goals` using `ADD COLUMN IF NOT EXISTS`. Replaced the `scholar_pace` view with COALESCE logic — per-scholar columns take precedence over the joined `program_goals` row; a scholar is PENDING when either effective `target_hours` or `target_date` is NULL.
- `neon/schema.sql` updated to match live state.
- `pages/api/scholar-goal.js` (full rewrite): added GET (admin-only; returns the scholar's goal row including all three new fields, or null); POST now accepts and validates `targetLevel`, `targetHours`, `targetDate` alongside `startDate`; upserts all four; retains 400 if no active program goal exists (needed for COALESCE fallback FK).
- `pages/api/program-goal.js`: added `action: 'applyToAll'` POST branch (handled before existing save logic) — stamps the active template's three goal fields onto all `scholar_goals` rows for that language; returns `{ updated: N }`.
- `src/components/admin/GoalEditor.jsx`: section renamed "Scholar Goals"; `ScholarGoalRow` gains three labeled inputs (Target date, Target level select, Target hours number); dirty detection + POST body cover all four fields; "Apply template to all scholars" button added with applying/applied/error states.
- `pages/api/scholars.js` and `pages/api/progress.js` required no code changes — they SELECT from `scholar_pace` which the view rewrite covers automatically.
- `src/pages/Progress.jsx` and `src/components/progress/WeekStats.jsx` required no code changes — they already consume `target_date`/`target_hours`/`target_level` from the API response. `next build` PASS.

---

## Phase 16 — External Hours Logging

**Loop goal:** "Add the ability to log external study hours from the dashboard. Both scholars and admins can record time spent on activities outside the video library. Supported types: ChatGPT conversation practice and weekly mentor call."

**Background:** Comprehensible input doesn't happen only through video watching. Scholars also practice English via ChatGPT conversation and have weekly 1-on-1 calls with their NGS mentor — both of which count toward total input hours and should appear in the progress display.

Deliverables:
- Schema: new `external_sessions` table — `id`, `user_id`, `session_type` (enum: `chatgpt_conversation` | `mentor_call`), `duration_seconds`, `session_date`, `notes` (optional), `created_at`. Indexed by `user_id`.
- `pages/api/log-external.js` — POST, JWT-auth (scholar logs their own; admin can log on behalf of a scholar). Validates `session_type` against the allowed enum.
- `pages/api/progress.js` updated — cumulative hours query sums both `watch_sessions` and `external_sessions` for the scholar.
- `src/components/progress/ExternalHoursButton.jsx` — modal/drawer triggered by a "+ Add Hours" button on the Progress page and the admin per-scholar drill-down. Contains:
  - Type dropdown: "ChatGPT Conversation" / "Weekly Mentor Call"
  - Duration input (minutes)
  - Optional date picker (defaults today)
  - Submit → POST `/api/log-external`
- Admin dashboard: same button available on each ScholarCard drill-down so the admin can log on behalf of a scholar who didn't self-log.
- `src/components/progress/WeekStats.jsx` — "This Week" stat includes external hours alongside video hours. Optionally show a breakdown chip (e.g. "2h video · 1h external").

Status: **DONE** (Jun 2026 — via agentic loop, 1 iteration, audit PASS). Scholars and admins can now log non-video study time (ChatGPT conversations and weekly mentor calls) and have it count toward cumulative progress:
- **Schema migration** (live on Neon `silent-cherry-49841538`): new `external_sessions` table (8 columns, `user_id` index); `user_total_hours` view replaced with UNION ALL version combining `watch_sessions` + `external_sessions` — all downstream pace calculations (`scholar_pace`, ON TRACK / AT RISK) automatically include external hours.
- `neon/schema.sql` updated to match live state.
- `pages/api/log-external.js` (new): POST; JWT-auth; scholars forced to own `user_id` (body `userId` ignored for non-admins); admin can log for any scholar; validates `sessionType` enum, `durationMinutes` (positive number → `duration_seconds` server-side), `sessionDate` (defaults to Asia/Manila today), `notes` (trim, 500-char cap). Returns `{ id, session_type, duration_seconds, session_date }`.
- `pages/api/progress.js`: now runs 3 parallel queries; adds `user_id`, `video_hours_this_week`, `external_hours_this_week` to response (all `Number()`-coerced); existing fields unchanged.
- `src/components/progress/ExternalHoursButton.jsx` (new): modal component with session type select, minutes input, date picker, notes textarea; POSTs to `/api/log-external`; calls `onLogged()` on success; shows Logging… / error states.
- `src/pages/Progress.jsx`: imports and renders `ExternalHoursButton` (normal state only); passes two new breakdown props to `WeekStats`.
- `src/pages/AdminProgress.jsx`: same button in scholar drill-down, wired to `refetch` from `useScholars()`.
- `src/components/progress/WeekStats.jsx`: breakdown chip ("Xh video · Xh other") shown below "This Week" value when `externalHoursThisWeek > 0`. Audit PASS (9/9 SC); next build PASS.

---

## Phase 17 — Unified Watch + Browse Tab

**Loop goal:** "Merge the Watch and Browse tabs into a single tab using the Browse layout as the base. The topic filter becomes a hierarchical menu at the top of the library with three top-level buckets and nested sub-categories. Level and watched state become dropdown filters rather than chip rows."

**Background:** The current app has two separate nav items — Watch (player + quick browse) and Browse (full library). This split is confusing; Dreaming Spanish puts discovery and playback on the same screen. The Browse layout (video grid + filters) is the better base. The topic chip rows also get crowded at mobile widths — hierarchical dropdowns scale better.

Deliverables:
- Nav change: remove the separate Browse tab. Sidebar and BottomNav show one "Watch" tab that opens the unified page.
- `src/pages/Watch.jsx` refactored as the unified Watch+Browse page:
  - Player area (collapsible on mobile, hidden until a video is selected) at the top.
  - Filter row below the player (or at the very top on desktop): **Topics** dropdown | **Level** dropdown | **Watched** dropdown — all as `<select>` or custom dropdown components, not chip rows.
  - Topics dropdown structure (hierarchical, single-select at the sub-category level):
    - **OET / Career** (top-level label, not selectable) → Medical & Nursing | Work & Professional | Academic & Study Skills
    - **Daily Life** (top-level label) → Everyday Conversations | Health & Wellness | Family & Relationships
    - **Compelling Interests** (top-level label) → Travel & Culture | Entertainment & Media | Science & Nature
    - "All Topics" as the default/reset option at the top.
  - Level dropdown: All Levels | Super Beginner (A1–A2) | Beginner (A2–B1) | Intermediate (B1–B2) | Advanced (B2–C1)
  - Watched dropdown: Unwatched | Watched | All
  - `VideoGrid` below — same card, same scholar-level-first sort, same empty + skeleton states.
- `src/pages/Browse.jsx` deleted (or redirected to `#/watch` for any bookmarked deep links).
- `src/components/video/FilterBar.jsx` replaced or refactored into the new dropdown-based `FilterDropdowns.jsx` component.
- Route cleanup: remove `#/browse` route from `src/App.jsx`; admin Videos page link to Watch is updated if needed.

**Design note:** The three top-level topic buckets map directly to the existing color system (blue OET/Career, green Daily Life, gray Compelling Interests). The sub-category labels inside the dropdown do not need color coding — only the topic chips on the VideoCard keep their colors.

Status: **PLANNED**

---

## Phase 18 — Admin Video Library Editor (Tabs, Edit, Delete, Bulk Actions)

**Loop goal:** "Add a tabbed layout to the Admin Videos page. The existing AI search + import content becomes the 'Discover & Import' tab. A new 'Manage Library' tab shows the full video library with single-select and multi-select editing: 3-dot menu per card (delete, change level, change topic), plus a bulk-action bar when multiple videos are selected."

**Background:** The admin currently has no way to remove stale/wrong videos from the library or correct AI-tagged level/topic without deleting and re-adding. The existing `AddVideoPanel` (search + URL import + stale check) becomes one of two tabs; the new tab gives full CRUD over the existing library.

Deliverables:
- `src/pages/AdminVideos.jsx` — add tab bar at the top with two tabs:
  - **"Discover & Import"** — wraps the existing `AddVideoPanel` content (AI search, URL import, stale check, inventory tools) unchanged.
  - **"Manage Library"** — new tab, renders `VideoLibraryEditor`.
- `src/components/admin/VideoLibraryEditor.jsx` (new) — shows the full video library in a grid:
  - Each card is selectable (checkbox appears on hover / when any selection is active).
  - **Single-select:** clicking a card's ⋯ (three-dot) button in the upper-right corner opens a popover menu:
    - **Delete** — confirmation modal ("Remove this video from the library?") → soft-delete (sets `is_available=false`, preserves watch history; see design note below).
    - **Change Level** — inline dropdown of the four CEFR levels; saves immediately; stamps `level_source='admin'` so re-classification doesn't overwrite it.
    - **Change Topic** — inline dropdown of all topic values from the taxonomy; saves immediately.
  - **Multi-select:** checking 2+ videos shows a sticky bulk-action bar above the grid with the same three actions:
    - **Delete selected** — single confirmation for the batch.
    - **Set Level** — level dropdown applies to all selected; stamps `level_source='admin'` on each.
    - **Set Topic** — topic dropdown applies to all selected.
  - Select-all checkbox in the bulk bar. Deselect-all clears selection and hides the bar.
  - Filter/search within the tab (search by title, filter by level/topic/watched state) so admins can quickly find what they need in a large library.
- `pages/api/delete-video.js` (new) — admin-only POST; accepts `{ videoIds: [...] }` (array, 1 or many); sets `is_available = false` + `unavailable_since = now()` on each. Does NOT hard-delete — watch history and cumulative hours must be preserved. Returns `{ deleted: N }`.
- `pages/api/update-video.js` (new) — admin-only POST; accepts `{ videoIds: [...], level?: string, topic?: string }`; applies whichever fields are present; sets `level_source='admin'` when `level` is updated. Returns `{ updated: N }`.
- Inventory badge in Navbar re-checks after any delete or level change (same `/api/inventory-check` call).

**Design note — soft delete:** The existing roadmap note says "keep-forever (never delete)" to protect watch history and cumulative hours. Manual admin deletion uses the same `is_available=false` path as the stale checker — videos disappear from the scholar library and stop counting toward inventory, but `watch_sessions` rows are untouched and cumulative hours are unaffected. If a hard-delete is ever needed (duplicate imports), that's a future DBA operation outside the UI.

**Design note — level_source:** Setting `level_source='admin'` on a bulk level-change marks those videos as admin-overridden, which means a future channel re-classification won't overwrite them (per the existing re-classification rule in CLAUDE.md).

Status: **PLANNED**

---

## Phase 19 — Progress Analysis: Hours Behind / Ahead

**Loop goal:** "Surface an explicit hours-behind (or ahead) figure on the Progress page for scholars, and on the admin per-scholar drill-down. Replace the bare ON TRACK / AT RISK pill with a quantified delta — e.g. '14.5h behind pace' or '3h ahead of pace' — so scholars and admins can see exactly how far off target they are, not just a traffic-light status."

**Background:** The `scholar_pace` view already computes `expected_hours` (hours the scholar should have by today given their start date and target) and `current_hours`. The difference (`expected_hours − current_hours`) is already used to determine AT RISK vs. ON TRACK, but the raw number is never shown to the user. This phase surfaces it prominently.

Deliverables:
- `pages/api/progress.js` — confirm `delta` (or `hours_behind`) is returned in the response. It is `expected_hours − current_hours`; positive = behind, negative = ahead. Coerce to `Number()` (same rule as the other NUMERIC fields). If not already returned, add it.
- `src/components/progress/PaceAnalysis.jsx` (new) — replaces or extends the existing status pill in `Progress.jsx` and the admin drill-down. Displays:
  - **Hours behind / ahead:** large, prominent number with sign — e.g. "14.5h behind pace" (amber/red) or "3.2h ahead of pace" (green). Shown to one decimal place.
  - **Status label:** ON TRACK / AT RISK derived from the delta (unchanged logic), shown as a smaller secondary label alongside or below the number.
  - **PENDING state:** if no start_date is set, shows "Goal not started — no pace data yet."
  - **Goal met state:** if `current_hours ≥ target_hours`, shows "Goal reached" with total hours.
- `src/pages/Progress.jsx` — render `PaceAnalysis` below `MilestoneBar` (or replace the existing status pill in `WeekStats`/`HoursCounter` with the new component). Same data already fetched from `/api/progress` — no new API calls.
- `src/pages/AdminProgress.jsx` drill-down — render `PaceAnalysis` in the per-scholar detail view so admins see the same quantified delta when they click into a scholar. `ScholarCard` can optionally show a compact one-liner (e.g. "−14.5h") in the card body.
- `src/components/admin/ScholarCard.jsx` — add the numeric delta as a secondary line under the AT RISK / ON TRACK pill (compact form, same color coding).

**Design note:** Use the existing `--ngsi-status-*` token colors (green saved → ahead, amber buffering → behind-but-close, red offline → significantly behind). "Significantly behind" threshold TBD by the pace logic already in `src/utils/pace.js`.

Status: **PLANNED**

---

## Phase 20 — Category-Split Goals + Read-Only Progress Breakdown

**Loop goal:** "Extend the per-scholar goal (Phase 15) with per-category hour targets. Goals are set by admin only. The scholar Progress page shows a read-only breakdown of actual vs. target hours per category. The only scholar action is logging external hours (Phase 16's button) with the category dropdown — no other goal editing."

**Background:** Currently the goal is a single total-hours target. The program has three distinct input categories — video library watching, ChatGPT conversation practice, and weekly mentor calls — and it makes sense to set and track a target for each independently (e.g. 200h video + 50h ChatGPT + 50h mentor = 300h total). The admin sets the split; scholars see their progress against it and log their own external hours.

**Decision (locked):** There are 3 external session types. Phase 16's `session_type` enum gains a third value: `video_external` — self-reported video watching done outside the NGS library (e.g. Dreaming Spanish, YouTube directly). The log-hours dropdown has 3 options: 🎬 Video watching (outside app) / 💬 ChatGPT practice / 📞 Mentor call. The automatically-tracked NGS library hours (`watch_sessions`) remain separate and are never manually logged — they are the 4th data source that feeds `video_hours` in the progress breakdown (library hours + `video_external` hours combined).

Deliverables:
- **Schema:** add `target_video_hours`, `target_chatgpt_hours`, `target_mentor_hours` columns to `scholar_goals` (alongside the existing `target_hours` total). Admin sets all three; total should sum to `target_hours` (enforce at the API layer, not DB constraint). Migration via `ALTER TABLE`.
- `pages/api/scholar-goal.js` — POST accepts the three per-category targets; validates they sum to `target_hours`; returns them on GET.
- `pages/api/progress.js` — extend response to include per-category actuals:
  - `video_hours` — sum of `watch_sessions.duration_seconds / 3600` for the scholar (already computable from existing data).
  - `chatgpt_hours` — sum of `external_sessions` where `session_type = 'chatgpt_conversation'`.
  - `mentor_hours` — sum of `external_sessions` where `session_type = 'mentor_call'`.
  - Plus their corresponding targets (`target_video_hours`, `target_chatgpt_hours`, `target_mentor_hours`) from `scholar_goals`. All coerced to `Number()`.
- `src/components/progress/CategoryBreakdown.jsx` (new) — read-only three-row breakdown rendered on the scholar Progress page and the admin per-scholar drill-down. Each row shows:
  - Category icon + label (🎬 Video Library / 💬 ChatGPT Practice / 📞 Mentor Calls)
  - A mini progress bar: `actual / target` hours
  - Numeric label: e.g. "47.2 / 100h"
  - Color coded by the existing `--ngsi-status-*` tokens (green if on track within that category, amber/red if behind).
- `src/pages/Progress.jsx` — render `CategoryBreakdown` below `PaceAnalysis`. No new API call — same `useProgress` data, now with category fields.
- `src/pages/AdminProgress.jsx` drill-down — same `CategoryBreakdown` component, same props.
- `src/components/admin/GoalEditor.jsx` — per-scholar goal rows gain three number inputs for the category targets (`Video h`, `ChatGPT h`, `Mentor h`) alongside the existing `start_date` and `target_date` fields. Live validation shows the sum vs. `target_hours`. Admin-only; no scholar-facing edit UI.
- Phase 16's `external_sessions.session_type` enum updated to add `video_external`. `ExternalHoursButton` dropdown updated to 3 options: 🎬 Video watching (outside app) / 💬 ChatGPT practice / 📞 Mentor call.
- `pages/api/progress.js` — `video_hours` = NGS library hours (`watch_sessions`) + self-reported external video hours (`external_sessions` where `session_type = 'video_external'`), combined into a single total for the Video category.

**Design note — total vs. category targets:** `target_hours` (the overall goal) remains the primary pace-calculation input (used by `scholar_pace`, `PaceAnalysis`, `ScholarCard`). The category targets are additive detail — they must sum to `target_hours`, but the AT RISK / ON TRACK logic continues to operate on the total. Per-category pace is displayed informally (the mini bars) rather than with a separate AT RISK pill per category.

Status: **PLANNED**

---

## Phase 21 — Live Progress Refresh After Manual Hour Logging

**Loop goal:** "After a scholar logs external hours via the Phase 16 button, the Progress page and dashboard update immediately — no page refresh required. The refetch is triggered by the successful POST to /api/log-external and updates all progress components in place."

**Background:** `useProgress` fetches once on mount. After logging external hours the data is stale until the user refreshes. Since the hours are persisted server-side on POST success, the fix is straightforward: expose a `refetch` callback from `useProgress` and call it after every confirmed log-external write.

Deliverables:
- `src/hooks/useProgress.js` — confirm `refetch` is already returned (it was added in Phase 6). If not, add it: a stable callback that re-fires the `/api/progress` GET and updates the hook's state in place. No new API endpoint needed.
- `src/components/progress/ExternalHoursButton.jsx` (Phase 16) — after `POST /api/log-external` returns `res.ok`, call the `refetch` function passed in as a prop (or obtained from a shared context — see design note). The button enters a brief "Logged ✓" state, then the progress components re-render with the updated totals automatically.
- `src/pages/Progress.jsx` — pass `refetch` from `useProgress` down to `ExternalHoursButton` (or wire via context).
- `src/pages/AdminProgress.jsx` drill-down — same pattern: the admin's per-scholar detail view also passes `refetch` to the logging button so the drill-down totals update live when the admin logs hours on behalf of a scholar.
- No optimistic update needed — the server round-trip is fast (Neon write → confirmed → refetch) and the button's loading state covers the gap. Do not update local state before the POST confirms; always refetch from source of truth.

**Design note — refetch propagation:** `ExternalHoursButton` needs access to the `refetch` for the *scholar's own* progress data. On `Progress.jsx` this is trivial (same hook, pass as prop). On `AdminProgress.jsx` the drill-down uses a separate per-scholar data fetch — ensure `refetch` refers to the correct scholar's data hook, not the overview list.

Status: **PLANNED**

---

## Phase 22 — Free-Text Library Search with Level Filter

**Loop goal:** "Add a free-text search input to the scholar video library so scholars (and admins browsing the library) can type a keyword and filter results by title or channel name. Pair it with a level filter dropdown. Results narrow in real-time as the user types — no new API call, purely client-side filtering of the already-loaded library."

**Background:** The current library filter (FilterBar / Phase 17's dropdown redesign) only supports topic chips and a watched-state toggle — no keyword search, and topic selection is all-or-nothing chip rows. Scholars have no way to type a keyword (e.g. 'nursing', 'hospital') or quickly jump to a specific topic. All filtering is client-side over the library already fetched from `/api/videos`, so this is a pure UI addition with no backend changes.

Deliverables:
- `src/components/video/FilterDropdowns.jsx` (Phase 17 component, or `FilterBar.jsx` if Phase 17 hasn't landed yet) — filter row contains four controls:

  **1. Keyword search input**
  - Placeholder: "Search videos…"
  - Filters client-side on `title` and `channel_name` (case-insensitive substring match).
  - 200ms debounce. Clear (✕) button when non-empty.

  **2. Level filter dropdown**
  - Options: All Levels / Super Beginner (A1–A2) / Beginner (A2–B1) / Intermediate (B1–B2) / Advanced (B2–C1).
  - **Default:** pre-selected to the scholar's current level (derived from `current_hours` via `getLevelForHours`) so the library opens showing relevant content. Scholar can change it at any time. Admin view defaults to All Levels.

  **3. Topic filter — structured dropdown**
  - Hierarchical dropdown matching Phase 17's three-bucket structure:
    - OET / Career → Medical & Nursing | Work & Professional | Academic & Study Skills
    - Daily Life → Everyday Conversations | Health & Wellness | Family & Relationships
    - Compelling Interests → Travel & Culture | Entertainment & Media | Science & Nature
  - **Default:** pre-selected to the scholar's primary topic bucket based on their profile (e.g. Claire = OET/Career pre-selected). Scholar can change it. Admin defaults to All Topics.
  - Selecting a top-level bucket shows all videos in that bucket; selecting a sub-category narrows to that sub-category only.

  **4. Free-text topic filter input** (alongside or below the structured dropdown)
  - Placeholder: "Filter by topic keyword…"
  - Filters client-side on the video's `topic` field (case-insensitive substring). Useful for finding e.g. all videos tagged 'nursing' without navigating the hierarchy.
  - Works as an additional AND filter on top of the structured topic dropdown (both can be active at once, or either alone).
  - Clear (✕) button when non-empty.

- Combined filtering: all four controls apply simultaneously with AND logic. A video must match every active filter to appear.
- `src/pages/Watch.jsx` — wire all four filter states into the existing filter pipeline; pass scholar level + primary topic as default props so the library opens pre-filtered.
- Empty state: "No videos match your filters." with a "Clear all filters" link (distinct from the library-is-empty state).
- Admin "Manage Library" tab (Phase 18's `VideoLibraryEditor`) — wire the keyword search + level + structured topic dropdown (no scholar-default pre-selection for admin; all default to All). Free-text topic filter optional here.

**Design note — scholar defaults:** The level and topic defaults are derived from data already in the app (`current_hours` → level; scholar profile → primary bucket). They are UI defaults only — the scholar can freely override. Do not persist filter state between sessions; always reset to scholar-appropriate defaults on mount.

**Design note — no YouTube search here:** This is library search only (client-side over already-fetched videos). YouTube keyword search for *adding* new videos lives in the admin "Discover & Import" tab (`AddVideoPanel`) and is a separate flow. Do not mix them.

Status: **PLANNED**

---

## Roadmap Notes (Future — Not In Scope Now)

**Per-scholar interest config:** topic tags hardcoded for Claire. Build admin module for per-scholar interest tags driving AI search + surfacing.

**Multiple languages:** `language` field in all tables. Add language = new videos + UI selector + filtered queries. No migration.

**NGH hospitality track:** per-program topic taxonomy. Make taxonomy configurable when NGH joins.

**Video maintenance:** seed 150 at launch; 10–15/week top-up; low-inventory alert (Phase 10); weekly stale check; keep-forever (never delete); shared library, per-scholar watch history.
