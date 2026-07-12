# NGS Immersion — Roadmap

*Last updated: July 2026 · Phase 28 doc-sync + Phase 30/31 shipped, Phase 29 skipped (see notes)*

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

Status: **DONE (provisioning intentionally not built)** — Dashboard + goal editor DONE (Jun 2026, agentic loop, 1 iteration, isolated audit PASS). The inline account-creation provisioning (`provision-scholar.js` + `AddScholarPanel.jsx`) was first DEFERRED for its own auth preview-deploy verification, then **descoped (Jun 2026)**: the accounts needed for launch already exist and are fully provisioned manually (admin John + scholar Claire — `public.users` rows + Claire's `scholar_goals` start_date linked to the active program goal), so the auth-touching create-scholar UI buys nothing for the current single-scholar launch and isn't worth the auth-regression risk. Future scholars (April, Nathalie) are added the same manual way (create the Neon Auth login + `public.users` row + run `/api/scholar-goal` to set the start date). If/when onboarding cadence grows, revisit with the "link existing account" approach (add the `public.users` row + goal for an already-created Neon Auth account — no password handling) before the full account-creation flow. Built this round:
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

## Phase 25 — Calendar View + Level Progress Bars

**Loop goal:** "Add two visual progress displays to both the scholar Progress tab and the admin scholar drill-down: (1) a single-month activity calendar with prev/next navigation coloring each day green/yellow/red based on daily goal achievement plus per-day hours label and a hover tooltip breaking down hours by category, and (2) DS-style horizontal level progress bars showing fill per CEFR level."

Deliverables:
- `pages/api/daily-calendar.js` — GET, scholar's per-day hours (all history, no date filter) broken down by library_hours / video_external_hours / chatgpt_hours / mentor_hours; also returns pace context (start_date, target_hours, target_date)
- `pages/api/scholar-calendar.js` — GET, admin-only; same breakdown for any scholar via `?userId=`; uses service-role connection
- `src/hooks/useDailyCalendar.js` — fetches `/api/daily-calendar` with auth token
- `src/hooks/useScholarCalendar.js` — fetches `/api/scholar-calendar?userId=` (admin); re-fetches when userId changes
- `src/components/progress/CalendarHeatmap.jsx` — single-month calendar with ‹/› month navigation; floor at June 2026 (program start); cell colors: green = goal met, yellow = partial, red = no hours, gray = before start_date or future; each day shows a small hours label; hover tooltip shows date + total + per-category breakdown
- `src/components/progress/LevelProgressBars.jsx` — one horizontal bar per CEFR level (A1→C2); navy = completed, gold = current level, cream-gray = upcoming; hours label right-aligned
- `src/pages/Progress.jsx` — adds LevelProgressBars + CalendarHeatmap cards after WeekStats
- `src/pages/AdminProgress.jsx` — adds LevelProgressBars + CalendarHeatmap in scholar drill-down view; calendar data fetched via useScholarCalendar keyed on selected scholar
- No changes to existing data, numbers, or hour-counting logic — visual layer only

Status: **DONE** (Jun 2026 — implemented directly per user instruction to write-and-implement simultaneously). `next build` PASS.

---

## Phase 26 — Calendar Day Detail Modal + Admin Drill-down Persistence

**Loop goal:** "Two improvements to the admin dashboard: (1) clicking a calendar day with hours opens a popup modal showing full session details (video titles, durations, completion status, and optional notes) — admin-only, no new page; (2) fix state loss when admin switches windows from a scholar drill-down — the selected scholar should persist across page reloads."

Deliverables:
- `pages/api/scholar-day-detail.js` — GET, admin-only, `?userId=X&date=YYYY-MM-DD`; returns `watch_sessions` (title, channel, duration, completed) and `external_sessions` (type, duration, notes)
- `src/components/admin/DayDetailModal.jsx` — fixed-position overlay modal; fetches day detail on mount; displays Library Video + Other Sessions sections; closes on X / overlay click / Escape
- `src/components/progress/CalendarHeatmap.jsx` — adds optional `onDayClick(dateStr)` prop; cells with hours show pointer cursor and call handler on click
- `src/pages/AdminProgress.jsx` — wires `onDayClick={setDayDetailDate}` on admin CalendarHeatmap; renders `DayDetailModal` when a day is selected; persists selected scholar ID in `sessionStorage` so window-switch reloads restore the drill-down view

Status: **DONE** (Jun 2026 — implemented directly per user instruction). `next build` PASS.

---

## Phase 27 — Combined Filters, Mobile Calendar, Desktop Layout, Day Session Edit/Delete

**Loop goal:** "Five targeted polish improvements: (1) Discover & Import filters (Level, Topic, Duration) work simultaneously — selecting level + topic fires one combined YouTube query not three separate ones; (2) Calendar is usable on mobile — horizontally scrollable with tap-tooltip; (3) Admin dashboard uses horizontal space better on desktop — two scholar cards per row; (4) Admin calendar day detail shows Delete and Edit buttons per session so admins can correct bad data; (5) Discover & Import replaces always-visible level chips with compact dropdowns for Level, Topic, and Duration — all combinable with free text."

Deliverables:
- `pages/api/delete-session.js` (NEW) — admin-only POST; deletes a `watch_session` or `external_session` by id and type; validates UUID format; uses service-role connection
- `pages/api/edit-external-session.js` (NEW) — admin-only POST; updates `session_type`, `duration_seconds`, `notes` for an `external_session`; fetches existing row and merges provided fields
- `pages/api/scholar-day-detail.js` (MODIFIED) — added `ws.id` and external `id` to both SELECT queries; both session types now return their `id` so the modal can issue delete/edit calls
- `src/components/admin/DayDetailModal.jsx` (REWRITE) — added `WatchSessionRow` sub-component with inline confirm-to-delete; added `ExternalSessionRow` sub-component with inline edit form (Type, Duration, Notes) and delete confirm; optimistic local-state updates on success (no refetch); session total calc handles both `seconds_watched` and `duration_seconds` fields
- `src/components/progress/CalendarHeatmap.jsx` (MODIFIED) — wraps grid in `gridScroll` div (`overflowX: auto`) so calendar scrolls horizontally on narrow phones; `minWidth: 260` on grid, `minWidth: 32` on cells; tap-tooltip pattern (`tapInfo` state + `isTappable` logic) for touch devices where `onMouseEnter` doesn't fire
- `src/pages/AdminProgress.jsx` (MODIFIED) — `container.maxWidth` 960→1200 to reduce side whitespace on desktop; `grid.gridTemplateColumns` changed to `minmax(380px, 1fr)` which gives 2 columns at ~800px+ content width
- `src/components/admin/AddVideoPanel.jsx` (REWRITE) — removed always-visible CEFR chip row; added Level dropdown, Topic dropdown (with `<optgroup>` per category), Duration dropdown, and Clear filters button in a compact filter bar; `buildCombinedQuery(text, level, topic)` assembles a single YouTube query from CEFR prefix + topic keywords + free text so all three filters work simultaneously; active filter pills shown below the bar; free-text input remains and contributes to the combined query

Status: **DONE** (Jun 2026 — implemented directly per user instruction). `next build` PASS.

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
| Jun 2026 | Phase 17 | Unified Watch + Browse tab | 1 | FilterDropdowns.jsx (new): 3 compact select elements replacing chip-row FilterBar — Topics with hierarchical optgroup per TOPIC_CATEGORIES, Level with CEFR labels, Watched defaulting to Unwatched. Watch.jsx refactored as unified Watch+Browse page; filter state changed from topics[] to single topic string; filtering/sort logic preserved. Browse.jsx replaced with Navigate redirect to /watch. App.jsx: /browse route is a Navigate redirect; Browse import removed. Sidebar.jsx + BottomNav.jsx: Browse link/tab removed — scholar nav is Watch + Progress only. No API changes, no schema changes. Audit PASS (10/10 SC); next build PASS. |
| Jun 2026 | Phase 17 (cont.) | Multi-select level chips + topic multi-select on Watch tab | — | FilterDropdowns.jsx: level filter refactored into 6 toggle chips (A1/A2/B1/B2/C1/C2) with multi-select; topic filter added as structured dropdown with grouped checkboxes (multi-select). Topic search filter retained as secondary AND filter. `filters.level` changed from string to string[]. Watch.jsx updated for multi-select includes() checks. `next build` PASS. |
| Jun 2026 | Phase 17 (cont.) | 4-category hours breakdown | — | Added library_hours + video_external_hours + chatgpt_hours + mentor_hours to progress.js and scholars.js responses. CategoryBreakdown.jsx updated to always show all 4 rows (removed guard). Scholar Progress page and Admin drill-down both show hours by category. `next build` PASS. |
| Jun 2026 | Phase 24 | CEFR level system + admin mobile nav + Discover level chips | — | Replaced DS-style 4-level system (super_beginner/beginner/intermediate/advanced) with 6 CEFR levels (a1–c2) mapped to hours milestones (A1=0h, A2=150h, B1=300h, B2=600h, C1=1000h, C2=1500h). DB migration: dropped and re-added CHECK constraints on videos.level, channels.level, program_goals.target_level, scholar_goals.target_level; data migrated (51 videos preserved, 0 hours deleted). levels.js rewritten with CEFR ids + name field; _tag.js prompt + fallbacks updated; FilterDropdowns.jsx level chips updated to 6 CEFR chips; Watch.jsx super_beginner mapping removed; HoursCounter.jsx uses level.name instead of level.cefr + proper targetLevelLabel lookup; MilestoneBar max-level text updated; VideoLibraryEditor + AddVideoPanel + inventory-check.js LEVEL_COLORS keys updated. Admin BottomNav expanded from 3 tabs (Watch/Progress/Admin) to 5 (Watch/Progress/Dashboard/Videos/Goals). CEFR level chips row added to Discover & Import search area with toggle-to-search behavior. schema.sql updated. `next build` PASS. |
| Jun 2026 | Phase 27 | Combined filters + mobile calendar + desktop layout + session edit/delete | — | 5 polish improvements: (1) Discover & Import filters now work simultaneously — Level+Topic+free-text build one combined YouTube query via `buildCombinedQuery`; (2) CalendarHeatmap horizontally scrollable on mobile, tap-tooltip for touch devices; (3) AdminProgress wider container + 2-col scholar grid on desktop; (4) DayDetailModal gains per-session Delete (watch+external) and Edit (external only) with inline confirm/form; (5) AddVideoPanel Level/Topic/Duration replaced with compact dropdowns in a filter bar. `next build` PASS. |

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

Status: **DONE** (Jun 2026 — via agentic loop, 1 iteration, audit PASS). Merged Watch and Browse into one unified Watch page:
- `src/components/video/FilterDropdowns.jsx` (new) — three `<select>` dropdowns replacing the chip-row FilterBar: Topics uses `<optgroup>` per `TOPIC_CATEGORIES` (OET/Career, Daily Life, Compelling Interest) with all topics as options; Level shows label + CEFR range; Watched defaults to Unwatched. No hardcoded labels — driven by `utils/topics.js` and `utils/levels.js`.
- `src/pages/Watch.jsx` — filter state changed from `{ topics: [] }` to `{ topic: null }` (single-select); filtering logic updated accordingly; uses FilterDropdowns; "Browse the library" heading removed; all player/timer/mark/complete logic and scholar-level-first sort unchanged.
- `src/pages/Browse.jsx` — replaced with `<Navigate to="/watch" replace />`.
- `src/App.jsx` — Browse import removed; `/browse` route is a `<Navigate to="/watch" replace />`.
- `src/components/layout/Sidebar.jsx` — Browse SidebarLink removed; Scholar section is Watch + Progress.
- `src/components/layout/BottomNav.jsx` — Browse tab removed; scholar tabs are Watch + Progress. No API changes, no schema changes. `next build` PASS.

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

Status: **DONE** (Jun 2026 — via agentic loop, 1 iteration, audit PASS). Added tabbed layout to Admin Videos page and full library management:
- `pages/api/delete-video.js` (new): admin-only POST; soft-deletes (sets `is_available=false, unavailable_since=now()`) one or many videos; preserves watch history and cumulative hours. Returns `{ deleted: N }`.
- `pages/api/update-video.js` (new): admin-only POST; updates `level` (stamps `level_source='admin'`) and/or `topic_primary` for one or many videos. Returns `{ updated: N }`.
- `src/components/admin/VideoLibraryEditor.jsx` (new): full-page library grid with per-card checkbox (appears on hover or when selection is active), 3-dot `CardMenu` popover (Delete / Change Level / Change Topic — each fires immediately), bulk-action bar when ≥1 video is selected (Delete selected / Set Level / Set Topic / Deselect all / select-all checkbox), filter row (search by title/channel, level dropdown, topic dropdown), and a `ConfirmModal` for delete confirmation. Optimistic UI — videos removed/updated in local state immediately; dispatches `ngsi-inventory-change` event on delete or level change.
- `src/pages/AdminVideos.jsx`: tab bar ("Discover & Import" | "Manage Library") added below the page title; existing search + URL import + stale-check content moves to the Discover tab; Manage Library tab renders `VideoLibraryEditor`.
- `src/components/layout/Sidebar.jsx`: inventory `useEffect` now also listens for the `ngsi-inventory-change` window event so the badge re-checks after VideoLibraryEditor deletes or re-levels a video. `next build` PASS.

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

Status: **DONE** (Jun 2026 — via agentic loop, 1 iteration, audit PASS). Surfaced quantified pace delta everywhere in the progress UI:
- `pages/api/progress.js`: added `delta: expectedHours - currentHours` (positive = behind, negative = ahead) to response; all NUMERIC fields coerced with `Number()` at API boundary.
- `pages/api/scholars.js`: added same `delta` field to each scholar object; coerces `current_hours` and `expected_hours` with `Number()` (were previously raw Neon NUMERIC strings).
- `src/components/progress/PaceAnalysis.jsx` (new): left-bordered panel with large Georgia serif number — "X.Xh ahead of pace" (green) or "X.Xh behind pace" (amber/red) — plus secondary line showing ON TRACK/AT RISK status and expected hours by today. PENDING state shows italic "Goal not started" message; goal-met state shows green "Goal reached" with total vs. target.
- `src/pages/Progress.jsx`: imports and renders `PaceAnalysis` below `MilestoneBar` inside the main progress card.
- `src/pages/AdminProgress.jsx` drill-down: same `PaceAnalysis` in the per-scholar detail view.
- `src/components/admin/ScholarCard.jsx`: `delta` destructured from scholar; a compact delta badge (`+X.Xh` ahead / `-X.Xh` behind, colored by status) shown below the AT RISK/ON TRACK pill in the top-right corner of each card. `next build` PASS.

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

Status: **DONE** (Jun 2026 — via agentic loop, 1 iteration, audit PASS). Implemented category-split goals across the full stack:
- **Schema:** Added `target_video_hours`, `target_chatgpt_hours`, `target_mentor_hours` columns to `scholar_goals` via `ALTER TABLE`. Added `'video_external'` to `external_sessions.session_type` CHECK constraint.
- `pages/api/scholar-goal.js`: GET returns all 3 category targets; POST accepts + validates they sum to `target_hours`; upserts via ON CONFLICT.
- `pages/api/progress.js`: Extended to 6 parallel queries — returns `video_hours` (library + video_external), `chatgpt_hours`, `mentor_hours`, plus category targets. All NUMERIC coerced with `Number()`.
- `pages/api/log-external.js`: Added `'video_external'` as valid session type.
- `pages/api/scholars.js`: 4-query parallel fetch returns per-category actuals + targets for every scholar.
- `src/components/progress/CategoryBreakdown.jsx` (new): Read-only 3-row breakdown (🎬 Video Library / 💬 ChatGPT Practice / 📞 Mentor Calls) with mini progress bars, color-coded by pace.
- `src/pages/Progress.jsx`: Renders `CategoryBreakdown` below `PaceAnalysis`.
- `src/pages/AdminProgress.jsx`: Same `CategoryBreakdown` in per-scholar drill-down.
- `src/components/admin/GoalEditor.jsx`: 3 number inputs for category targets with live sum validation.
- `src/components/progress/ExternalHoursButton.jsx`: Added `video_external` option (default); 3-option dropdown.

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

Status: **DONE** (Jun 2026 — confirmed already implemented in Phase 16/earlier work; `useProgress` already returned `refetch`, and both `Progress.jsx` and `AdminProgress.jsx` already passed it as `onLogged` to `ExternalHoursButton`). No new code required — deliverables verified complete.

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

Status: **DONE** (Jun 2026 — via agentic loop, 1 iteration, audit PASS). Implemented full free-text library search with level + topic filters:
- `src/components/video/FilterDropdowns.jsx`: Rewritten with keyword search (title/channel), level dropdown, hierarchical topic dropdown, and topic keyword search. All with 200ms debounce and clear (✕) buttons. Level and topic dropdowns sync via external `useEffect` on parent-driven resets (e.g. "Clear all").
- `src/pages/Watch.jsx`: Filter state extended to include `search`, `topicSearch`; `visibleVideos` useMemo applies all 4 filters with AND logic. Level defaults to scholar's current level on first mount (via `levelInitialized` ref); re-renders don't override user changes. "No videos match your filters" empty state with "Clear all filters" reset.

---

## Phase 23 — Discover & Import Scholar Context: Topic Chips

**Loop goal:** "In the admin Discover & Import tab, extend the existing scholar context panel with topic chips so the admin can browse by level AND topic without typing. Clicking a topic chip builds a pre-composed YouTube search query (CEFR prefix + topic keywords) and fires it immediately."

**Background:** The scholar context panel (`ScholarContext` in `AddVideoPanel.jsx`) already showed a scholar picker and 5 generic level-appropriate search chips. The admin still had to manually type topic keywords. Adding topic chips lets the admin click e.g. "Medical & Nursing" for Claire (B1) and instantly search "B1 B2 English medical nursing listening" — no typing needed.

Deliverables:
- `src/components/admin/AddVideoPanel.jsx` — extended `ScholarContext`:
  - Added `CEFR_PREFIX` map (`super_beginner → 'A1 A2'`, etc.)
  - Added `TOPIC_QUERY_KEYWORDS` map (10 topic tags → YouTube-optimised keywords)
  - Added `buildTopicQuery(topic, level)` — returns `"{CEFR} English {keywords} listening"` when scholar is selected, or `"English {keywords} listening"` without
  - **Level queries** section (labelled) — existing level chips, shown only when a scholar is selected
  - **Topics** section (always visible) — 10 topic chips from `TOPIC_CATEGORIES`, grouped by category (OET/Career / Daily Life / Compelling Interest) with category color borders. Label shows "· combined with B1 B2" when scholar is selected, "· click to search" otherwise
  - Imported `TOPIC_CATEGORIES` from `../../utils/topics.js`

Status: **DONE** (Jun 2026 — via agentic loop, 1 iteration, audit PASS). Pure UI addition — no backend changes. `next build` PASS.

---

## Phase 24 — CEFR Level System + Admin Mobile Nav + Discover Level Chips

**Loop goal:** "Replace the DS-style level system with CEFR levels (A1–C2) mapped to hours milestones. Add Videos and Goals to the admin mobile nav. Add standalone CEFR level chips to the Discover & Import search."

**Background:** The original 4 levels (Super Beginner/Beginner/Intermediate/Advanced) were rough DS-style buckets. CEFR provides internationally recognized levels that map cleanly to hours and communicate progress more precisely. Smaller increments (6 levels vs. 4) also give scholars more frequent milestones and oxytocin hits for incremental progress.

Deliverables:
- `src/utils/levels.js` — 6 CEFR levels: a1 (0h), a2 (150h), b1 (300h), b2 (600h), c1 (1000h), c2 (1500h). Each has `id`, `label` (the CEFR code), and `name` (friendly description). No `cefr` field — the label IS the CEFR code.
- `lib/api/_tag.js` — updated CEFR_MAP and LEVELS array; fallback default changed from 'beginner' to 'a2'.
- `src/components/video/FilterDropdowns.jsx` — 6 CEFR chips (A1–C2) replacing the 3-tier filter.
- `src/pages/Watch.jsx` — removed super_beginner→beginner mapping; direct level id filtering.
- `src/components/layout/BottomNav.jsx` — admin gets 5 tabs: Watch, Progress, Dashboard, Videos, Goals.
- `src/components/admin/AddVideoPanel.jsx` — LEVEL_COLORS and CEFR_PREFIX updated for new ids; standalone CEFR level chips row above the search box (toggleable; clicking searches for that level).
- `pages/api/inventory-check.js` — levels object updated to new 6 keys.
- `src/components/admin/VideoLibraryEditor.jsx` — LEVEL_COLORS keys updated.
- `src/components/progress/HoursCounter.jsx` — uses `currentLevel.name` instead of removed `currentLevel.cefr`; targetLevelLabel lookup via LEVELS array.
- `src/components/progress/MilestoneBar.jsx` — max-level text updated to "C2 Mastery — Maximum Level Reached".
- `neon/schema.sql` — CHECK constraints updated to CEFR ids.
- **DB migration** (live on Neon `silent-cherry-49841538`): dropped and re-added CHECK constraints; migrated 51 video rows (super_beginner→a1, beginner→a2, intermediate→b1, advanced→b2); program_goals.target_level migrated (intermediate→b1). No hours deleted, no session data touched.

Status: **DONE** (Jun 2026). `next build` PASS.

---

## Phase 28 — AI Learning Intelligence

**Loop goal:** "Add six AI-powered features that make the app actively assist Claire's learning journey: OET relevance scoring on every video, a post-watch comprehension self-report, a next-video suggestion after each watch, an AI-generated weekly progress coaching message on the Progress page, a level-up celebration narrative when crossing a milestone, and an admin scholar pattern digest."

**Background:** Anthropic's Haiku is already integrated server-side for video tagging. These features extend that investment to the learning experience itself — giving Claire context-aware nudges and feedback, and giving the admin (Jon) synthesized insight into her habits. All calls go through `pages/api/*` (key stays server-side); all results are cached or client-triggered so Haiku runs sparingly.

**Features:**

### 28a — OET Relevance Scoring
Tag every video with an OET relevance score (1–5) at import time. Score 5 = directly OET-useful (medical, clinical, nurse communication); score 1 = compelling interest only. Cached forever in Neon like level/topic tags. Surfaced as a small "OET" badge on VideoCard when score ≥ 4, and as an "OET-relevant" filter chip in FilterDropdowns.

### 28b — Post-Watch Comprehension Self-Report
After a video ends (YT ENDED event), show a 3-button prompt below the player: "Understood most", "Understood some", "Understood little". Scholar taps one; it's stored as a `comprehension_rating` (1/2/3) on the `watch_sessions` row. No AI needed for the prompt — pure UI + schema. The comprehension score is used by 28c (next video suggestion) and 28f (admin digest). Admin drill-down shows comprehension trend over time.

### 28c — AI Next-Video Suggestion
After a video ends and the scholar rates comprehension (28b), Haiku picks 2–3 videos from the existing library to watch next. Input: current video's level/topic/OET score + comprehension rating + the scholar's recent watch history (last 5 videos + their comprehension ratings) + scholar's goal context (B1, targeting OET). Output: up to 3 `youtube_id` values ranked by fit. Rendered as a "Watch next" row below the player. Cached per `(video_id, comprehension_rating)` tuple in a `next_video_suggestions` table so the same context doesn't re-call Haiku.

### 28d — AI Progress Coaching Message
A short Haiku-generated coaching message rendered on the Progress page, refreshed at most once per day per scholar. Input: current pace (delta, AT RISK / ON TRACK), hours this week vs. target, comprehension trend, recent topics watched. Output: 2–3 sentences of specific, constructive coaching (e.g. "You're 4h behind pace this week. Your comprehension on OET content is trending up — keep targeting Medical & Nursing videos at B1 to maximize OET prep."). Stored in Neon with a `generated_at` timestamp; stale after 24h. Scholar fetches from `/api/progress-coaching`; if stale or absent the endpoint re-generates.

### 28e — Level-Up Celebration Message
When a scholar's cumulative hours first cross a level boundary (e.g. crosses 300h → reaches B1), Haiku generates a personalized 3–4 sentence celebration + forward-looking message. Input: new level, total hours, scholar goal (OET Grade B). Output: personalized text. Stored in a `level_celebrations` table keyed on `(user_id, level)` and rendered as a dismissible banner on the Progress page. Never re-generated; admin can clear to re-trigger.

### 28f — Admin Scholar Pattern Digest
A weekly Haiku-generated summary for admins on the AdminProgress page. Per scholar: synthesizes watch frequency, comprehension trends, topic distribution, and pace status into 2–3 observations (e.g. "Claire watched 5.2h this week, all Medical & Nursing. Comprehension is improving — "Understood most" up from 40% to 65% week-over-week. She's back on pace after last week's gap."). Generated on demand (admin clicks "Generate digest") or auto-generated Sunday midnight Manila time. Stored in `scholar_digests` table; displayed in admin drill-down.

---

**Deliverables:**

Schema:
- Add `oet_relevance` integer (1–5) column to `videos` table
- Add `comprehension_rating` integer (1/2/3) column to `watch_sessions`
- New `next_video_suggestions` table: `video_id`, `comprehension_rating`, `suggested_video_ids` (text[]), `generated_at`
- New `progress_coaching` table: `user_id`, `message`, `generated_at`
- New `level_celebrations` table: `user_id`, `level`, `message`, `dismissed`, `generated_at`
- New `scholar_digests` table: `user_id`, `message`, `generated_at`

API:
- `pages/api/tag-video.js` + `pages/api/tag-channel.js` — add OET relevance scoring to existing Haiku calls; update `lib/api/_tag.js` with the OET 1–5 prompt and taxonomy
- `pages/api/flush-session.js` — accept optional `comprehension_rating` field; write to `watch_sessions`
- `pages/api/next-video.js` (new) — POST `{ videoId, comprehensionRating }`; returns up to 3 suggested videos from library; uses cache first, generates via Haiku if stale/absent
- `pages/api/progress-coaching.js` (new) — GET, JWT-scoped; returns cached message if < 24h old, else generates via Haiku from pace + comprehension data
- `pages/api/level-celebration.js` (new) — GET checks for uncelebrated level crossings; POST `{ level }` to dismiss; POST `{ action: 'regenerate', level }` to re-generate (admin only)
- `pages/api/scholar-digest.js` (new) — GET, admin-only, `?userId=`; returns digest for that scholar; POST `{ userId }` to (re)generate

UI:
- `src/components/player/ComprehensionPrompt.jsx` (new) — shown below player after ENDED event; 3 buttons; calls `/api/flush-session` with `comprehension_rating` appended; on submit calls `onRate` callback
- `src/components/player/NextVideoSuggestions.jsx` (new) — shown below ComprehensionPrompt after rating; 1–3 VideoCard-style tiles; "Watch next" heading; clicking pre-selects video in Watch page
- `src/components/progress/CoachingMessage.jsx` (new) — rendered on Progress page below WeekStats; italic navy/gold card; "refreshes daily" footnote; skeleton while loading
- `src/components/progress/LevelCelebrationBanner.jsx` (new) — dismissible gold banner on Progress page when an uncelebrated level-up exists; shows the Haiku message + "Dismiss" button
- `src/components/admin/ScholarDigest.jsx` (new) — accordion card in admin drill-down; "Generate digest" button; shows the Haiku narrative when available; timestamp of last generation
- `src/components/video/VideoCard.jsx` — add OET badge (blue pill "OET ★") when `oet_relevance >= 4`
- `src/components/video/FilterDropdowns.jsx` — add "OET-relevant" toggle filter (shows only videos with `oet_relevance >= 4`)
- `src/pages/Watch.jsx` — wire ComprehensionPrompt + NextVideoSuggestions below player; pass `onRate` + current video to both
- `src/pages/Progress.jsx` — add CoachingMessage + LevelCelebrationBanner above WeekStats
- `src/pages/AdminProgress.jsx` drill-down — add ScholarDigest accordion

Status: **DONE** (Jun 2026 — implemented directly per user instruction; this doc entry was never flipped from PLANNED at the time). All six features shipped: OET relevance scoring, comprehension self-report, AI next-video suggestions, progress coaching message, level-up celebration banner, and the admin scholar digest. `next build` PASS.

---

## Phase 29 — Duration Filter Slider in Admin Video Search

**Loop goal:** "Add a duration range slider to the admin 'Discover & Import' tab so the admin can filter YouTube search results by video length before adding them to the library. Range: < 5 min to > 30 min."

**Background:** The YouTube Data API's `videoDuration` parameter only offers three coarse buckets (`short` < 4 min, `medium` 4–20 min, `long` > 20 min). For CI purposes, the sweet spot is usually 5–20 min clips — short enough to be digestible, long enough to provide real input. The admin needs finer control. Since `api/youtube-search.js` already makes a `videos.list` call (to get `contentDetails` for the music-category filter), we can parse `contentDetails.duration` (ISO 8601) at the same time and filter by the admin's chosen range server-side before returning results.

Deliverables:
- `pages/api/youtube-search.js` — parse `contentDetails.duration` (ISO 8601 → total seconds) for each result already fetched via `videos.list`. Accept optional `minDuration` and `maxDuration` query params (in seconds). Filter out videos outside the range before returning. Return `duration_seconds` on each result so the client can display it. `maxDuration` already exists as a param on `youtube-import.js` (capped at 1800s = 30 min for imports) — apply the same parsing utility here.
- `src/utils/duration.js` (new, or add to `timeFormat.js`) — `parseIso8601Duration(str)` → total seconds; `formatDuration(seconds)` → "4:32" / "1h 2m" display string. Single source of truth used by both the API layer and the UI.
- `src/components/admin/DurationSlider.jsx` (new) — dual-handle range slider:
  - Min handle: 0 to 60 min, default 0 (no minimum).
  - Max handle: 0 to 60 min (with an "Any" / > 60 min option at the top end), default 30 min.
  - Labels: "< 5 min", "5 min", "10 min", "15 min", "20 min", "30 min", "> 30 min" as snap points or tick marks.
  - Live label shows the selected range: e.g. "5 – 20 min" or "Any – 15 min".
- `src/components/admin/AddVideoPanel.jsx` — add `DurationSlider` above or beside the search input. On search (debounced or chip click), pass the slider values as `minDuration` / `maxDuration` to the `/api/youtube-search` GET call. Search results re-fire automatically when the slider changes (same debounce pattern as the text input).
- Each search result card displays the video duration (e.g. "12:34") alongside the existing level badge and topic chips.

**Design note:** The slider filters search results, not the existing library. It has no effect on the scholar-facing library or the Manage Library tab — those don't surface duration and the existing library content is already curated.

Status: **SKIPPED** (Jul 2026 — audited before building). `pages/api/youtube-search.js` already parses `contentDetails.duration` (ISO 8601 → seconds) for every result and returns `duration_seconds`; `AddVideoPanel.jsx` already ships a working duration-bucket dropdown (`< 5 min` … `> 30 min`) that filters results client-side, plus a duration label on each result card. Functionally equivalent to this spec's goal. Rebuilding it as a dual-handle slider filtering server-side would duplicate existing, working functionality with no user-facing gain — revisit only if the dropdown proves too coarse in practice.

---

## Phase 30 — Watch Later / Library Module

**Loop goal:** "Add a 'Watch Later' button below the YouTube video player on the Watch page. Saved videos appear in a new 'Library' module in the left sidebar and bottom nav, so scholars can build a personal queue and come back to it."

**Background:** Scholars browse the library and may want to save a video for later without watching it immediately — especially when they find something at the right level but don't have time right now. A lightweight bookmarking layer (Watch Later) gives them a personal queue separate from the full library grid. It is scoped to the individual scholar; admins do not manage it.

Deliverables:
- **Schema:** new `watch_later` table — `id` (serial), `user_id` (references `public.users.id`), `video_id` (references `videos.id`), `added_at` (timestamptz default now()). Unique constraint on `(user_id, video_id)`. Index on `user_id`.
- `pages/api/watch-later.js` — JWT-auth, scholar-scoped:
  - `GET` — returns the scholar's watch-later list (video rows joined with video metadata, ordered by `added_at DESC`).
  - `POST { videoId }` — adds a video; `ON CONFLICT (user_id, video_id) DO NOTHING` for idempotency.
  - `DELETE { videoId }` — removes a video.
- `src/hooks/useWatchLater.js` (new) — fetches `GET /api/watch-later`; exposes `{ items, add, remove, isAdded(videoId) }`. `add`/`remove` call the API and update local state optimistically (instant UI feedback, no refetch needed).
- `src/components/player/WatchLaterButton.jsx` (new) — rendered directly below the YouTube video player on the Watch page (above the WatchTimer). Shows:
  - **Not saved:** "+ Watch Later" button (outline, navy).
  - **Saved:** "✓ Saved" button (filled gold) → clicking removes it (toggle).
  - State derived from `useWatchLater`'s `isAdded(currentVideoId)`. Updates instantly via optimistic state.
- `src/pages/Library.jsx` (new) — scholar's personal watch-later queue:
  - Header: "My Library" with a saved count chip.
  - Video grid using the existing `VideoCard` and `VideoGrid` components (same card design, same watched-state display).
  - Each card has a "Remove" option (⋯ menu or ✕ icon) to remove from the queue.
  - Clicking a card navigates to `#/watch` with that video pre-selected (same deep-link pattern as the unified Watch tab).
  - Empty state: "No saved videos yet. Hit '+ Watch Later' below any video to save it here."
- **Navigation:**
  - `src/components/layout/Sidebar.jsx` — add "Library" link (e.g. 🔖 Library → `#/library`) in the Scholar section, below Progress and above the Admin section.
  - `src/components/layout/BottomNav.jsx` — add a 4th scholar tab "Library" (shifting Admin tab to 5th for admins, or keeping 4 total for scholars with Admin tab only visible to admins).
- `src/App.jsx` — add `#/library` route → `<Library />`.

**Design note — no admin view:** Watch Later is a personal scholar tool. Admins do not see or manage scholars' watch-later lists. If an admin is logged in and visits `#/library`, they see their own personal list (empty unless they've saved videos themselves).

**Design note — optimistic updates:** `add` and `remove` in `useWatchLater` update local state immediately without waiting for the API response, so the button toggles instantly. On API error, revert the local state and show a brief error toast.

Status: **DONE** (Jul 2026 — via agentic loop, independent audit PASS). Schema applied live via Neon MCP. Deviates from the original spec in two places: (1) `Library.jsx` navigates via a new `?videoId=` query param that `Watch.jsx` resolves once the library loads (rather than relying on a pre-existing deep-link pattern, which didn't actually exist yet); (2) card removal uses the existing `VideoCard`'s ⋯ menu (extended with an optional `onRemove` item) rather than a separate ✕ icon, for reuse over duplication. `next build` PASS.

---

## Phase 31 — Video Resume Position ("Pick Up Where You Left Off")

**Loop goal:** "When a scholar pauses or leaves a video mid-way, save their playback position. When they return to that video later, the player automatically seeks to where they stopped so they can pick up where they left off."

**Background:** The existing watch session flush (`api/flush-session.js`) records `duration_seconds` — how many seconds were watched in that session. This is used for cumulative hours and is deliberately not a position marker (a scholar could rewatch the same segment). A separate `position_seconds` value — the absolute timestamp in the video at the moment of pause/stop — is needed for resume. These are distinct: `duration_seconds` feeds the hours counter; `position_seconds` feeds the player on next load.

**Key distinction:** `duration_seconds` = seconds actively watched this session (for hours counting). `position_seconds` = `player.getCurrentTime()` at pause/stop (for resume). A scholar who watches from 5:00 to 5:30, then scrubs back to 2:00 and watches to 2:20 has `duration_seconds = 50` but `position_seconds = 140` (2:20).

Deliverables:
- **Schema:** new `video_resume_positions` table — `user_id`, `video_id`, `position_seconds` (integer), `updated_at`. Primary key on `(user_id, video_id)`. Upserted on every flush.
- `pages/api/flush-session.js` — accept an additional optional field `position_seconds` in the POST body. Upsert into `video_resume_positions` on `(user_id, video_id)` — this is a separate write from the `watch_sessions` insert; the existing `client_flush_id` idempotency on `watch_sessions` is unchanged. Clear the position row when `completed = true` (≥95% watched — no point resuming a finished video).
- `pages/api/videos.js` — LEFT JOIN `video_resume_positions` (scoped to the JWT user) and include `resume_position_seconds` (null if none) on each video in the response.
- `src/hooks/useWatchSession.js` — on PAUSED and ENDED events, read `player.getCurrentTime()` and include `position_seconds` in the flush payload alongside `duration_seconds`. On ENDED (video finished), send `position_seconds: 0` so it clears on the server (handled by the `completed = true` path).
- `src/components/player/VideoPlayer.jsx` — accept a `resumeAt` prop (seconds). After the player is ready (`onReady` event), if `resumeAt > 0`, call `player.seekTo(resumeAt, true)` before playback begins. Show a brief dismissible "Resuming from 5:23 →" toast/chip below the player so the scholar knows the seek happened; include a "Start from beginning" link that clears the resume position and seeks to 0.
- `src/pages/Watch.jsx` — pass `video.resume_position_seconds` as `resumeAt` to `VideoPlayer` when a video is selected.
- `src/pages/Library.jsx` (Phase 30) — VideoCards for videos with a saved resume position show a small progress bar indicator at the bottom of the thumbnail (similar to Netflix/YouTube's red progress bar) so the scholar can see at a glance which saved videos they've partially watched.

**Design note — no resume for completed videos:** Once a video is marked `completed = true` (single session ≥95%), the `video_resume_positions` row is deleted server-side. Re-watching a completed video always starts from the beginning.

**Design note — flush on video switch:** `useWatchSession.js` already flushes when the user switches videos within the SPA (cleanup effect). That flush should also include the current `player.getCurrentTime()` as `position_seconds`.

Status: **DONE** (Jul 2026 — via agentic loop, independent audit PASS). Schema applied live via Neon MCP. `position_seconds` is threaded through a `playerRef` inside `useWatchSession` (captured via an extended `onStateChange(state, player)` signature from `VideoPlayer`), kept strictly separate from `seconds_watched`/hours counting per the audit's explicit check. `VideoCard` reads `resume_position_seconds` directly off the video object (no new prop plumbing needed) to render the thumbnail progress bar, so it works on both the Watch grid and the Library page automatically. `next build` PASS.
| Jun 2026 | Phase 9 | Provisioning descoped | — | Decided NOT to build the deferred inline account-creation flow (`provision-scholar.js` + `AddScholarPanel.jsx`). The launch accounts already exist and are fully provisioned manually (admin John + scholar Claire: `public.users` rows + Claire's `scholar_goals` start_date linked to the active program goal), so the auth-touching create-scholar UI adds no value for the single-scholar launch and isn't worth the auth-regression risk. Future scholars added manually (Neon Auth login + `public.users` row + `/api/scholar-goal`); revisit with a "link existing account" panel if onboarding cadence grows. Phase 9 marked DONE (dashboard + goal editor shipped earlier; provisioning intentionally not built). Docs-only. |
| Jul 2026 | Phase 32 (PWA groundwork) | Installable PWA foundation | 2 | `app/manifest.js` (name/icons/theme per `docs/PWA.md`), `public/icons/*` (192/512 + maskable placeholders), `ServiceWorkerRegistration.jsx`. First build attempt used Serwist but required forcing the app off Turbopack onto webpack app-wide (Serwist doesn't support Turbopack) — flagged by audit as exceeding "wrapping exercise" scope and reworked to `docs/PWA.md`'s hand-rolled fallback (`public/sw.js`), restoring Turbopack. `next.config.js` SPA rewrite extended to exclude manifest/sw/icons. SW confirmed network-only for `/api/**` (all methods, including POST/sendBeacon) via code trace + curl. Build PASS (Turbopack); independent audit PASS. TWA/asset-links/Bubblewrap steps not started — Play Console account creation in progress (John). |

---

## Phase 32 — Native Android app (PWA → TWA → Play Internal Testing)

**Status: PLANNED (pilot for the NGS native rollout).** Not started. Goal:
ship Immersion as an installable Android app so scholars — who are used to
installing apps, not "Add to Home Screen" from a browser — get it from the
Play Store. Private distribution via the **Internal Testing** track (email
allowlist, up to 100 testers), not a public production listing.

**Why Immersion first:** highest native benefit (offline hour-tracking already
half-built via `offlineBuffer.js`; future push pace-nudges), and it already
solved the first-party-cookie session problem (Phase 14) that the TWA depends
on.

Runbooks (written; work not begun): `docs/PWA.md` (installable-PWA groundwork)
and `docs/PLAY-STORE.md` (TWA packaging + Internal Testing rollout).

Deliverables (planned):
- [x] PWA foundation — web manifest (`app/manifest.js`), service worker
      (hand-rolled — Serwist was tried first but required forcing the whole
      app off Turbopack onto webpack, exceeding this pass's "wrapping
      exercise, not a redesign" scope; reverted in favor of `docs/PWA.md`'s
      documented zero-dependency fallback at `public/sw.js`), 192/512 +
      maskable icons (real brand mark as of Jul 2026 — a globe/speech-bubble
      "Talk" icon generated for the Play Store listing, swapped in to
      replace the original placeholder navy/gold "N" glyph so the installed
      app icon matches the Play Store listing icon).
      Verified via build + curl: manifest/SW/icons resolve correctly and
      aren't swallowed by the SPA rewrite; `/api/**` (including POST, e.g.
      `sendBeacon`) confirmed untouched by the SW. Not yet run through actual
      Lighthouse (no GUI browser in the build environment) — recommend a
      manual Chrome/Android installability pass before considering this
      fully closed.
- [x] TWA package (PWABuilder), stable package id
      (`com.nextgenscholars.immersion`), `public/.well-known/assetlinks.json`.
      Package id verified correctly baked into the generated `.aab`/`.apk`
      (an earlier PWABuilder export had defaulted to an auto-derived package
      id and was caught and regenerated). `next.config.js` SPA rewrite
      excludes `.well-known/`. `assetlinks.json` now carries **both**
      fingerprints per `docs/PLAY-STORE.md`'s guidance: the **Play App
      Signing key** (`CC:D4:3F:...`, from Play Console → Protected with Play
      → App signing, after the first AAB upload and enrollment) and the
      locally-generated **upload key** (`DA:62:70:...`, from PWABuilder) —
      the app-signing key is what matters for the Play-installed app; the
      upload key covers sideloaded test builds signed with the same local
      keystore.
- [ ] **Verify early:** session cookie persists inside the installed TWA on a
      real Android device (the #1 risk).
- [ ] Play Console (John's account, $25, verified Jul 2026) → Internal
      Testing release → upload the `.aab` → scholar email allowlist →
      opt-in link.

Owner split: Claude Code does the code (PWA, asset-links, config); John owns
the Play Console account, signing, upload, tester list, and device testing.

Deferred: push notifications; public production listing (would trigger the
12-tester/14-day gate + content review — not planned for Immersion).

---

## Roadmap Notes (Future — Not In Scope Now)

**Per-scholar interest config:** topic tags hardcoded for Claire. Build admin module for per-scholar interest tags driving AI search + surfacing.

**Multiple languages:** `language` field in all tables. Add language = new videos + UI selector + filtered queries. No migration.

**NGH hospitality track:** per-program topic taxonomy. Make taxonomy configurable when NGH joins.

**Video maintenance:** seed 150 at launch; 10–15/week top-up; low-inventory alert (Phase 10); weekly stale check; keep-forever (never delete); shared library, per-scholar watch history.
