# NGS Immersion — Claude Code Instructions

## Agentic Loop
Protocol: https://raw.githubusercontent.com/jonncy18-maker/Agentic-Loop/main/AGENTIC_LOOP.md
Orchestrator: https://raw.githubusercontent.com/jonncy18-maker/Agentic-Loop/main/orchestrator.js
At the start of every session, read the full protocol from the URL above before doing anything else.
Every change that touches 3+ files, creates a new component, touches the data layer, or has user-visible behavior MUST go through the agentic loop. One-liners and typo fixes can run direct.

---

## What This Project Is

NGS Immersion is an internal web application for the NextGen Scholars (NGS) program. It is a comprehensible input (CI) platform inspired by Dreaming Spanish — scholars watch YouTube videos in their target language and the app tracks cumulative listening hours toward level-based milestones.

It is NOT a public product. It is an internal scholarship tool with no revenue and no paying customers.

**Primary scholar (launch):** Claire Buenconsejo — nursing student, University of the Visayas, Cebu, Philippines. English target language. A2 high / B1 low current level. OET Grade B (C1) long-term goal for AHPRA Australia nursing registration.

**Future scholars:** April, Nathalie, and others as the NGS/NGH program expands.

---

## Stack

```
Framework:    Next.js 16 (App Router) — hosts the SPA + serverless API + same-origin auth
Frontend:     React 18 SPA rendered inside Next via app/page.jsx (next/dynamic, ssr:false)
Routing:      React Router v6 (HashRouter) — runs client-side inside the Next shell
Styling:      CSS with --ngsi-* token variables (navy + gold palette — see ARCHITECTURE.md)
Database:     Neon (serverless Postgres) — project: ngs-immersion (silent-cherry-49841538)
Auth:         Neon Auth (Better Auth) via Neon's SAME-ORIGIN handler (createNeonAuth)
              → first-party session cookie on the app origin (survives refresh)
Video:        YouTube IFrame API (official embed, client-side)
AI tagging:   Anthropic API — claude-haiku-4-5 ONLY (server-side, level + topic tags, cached forever)
Backend:      Next.js functions — pages/api/* (classic req,res) + app/api/auth/[...path] (auth proxy)
Hosting:      Vercel Hobby (free tier, non-commercial internal use) — Framework Preset: Next.js
Language:     JavaScript (ES modules) — no TypeScript
Formatting:   Prettier
```

> **Stack history:** Phases 1–13 were built on Vite (client-only SPA). Phase 14 migrated to
> Next.js so Neon Auth's same-origin handler could issue a **first-party** session cookie —
> the Vite/SPA model talked to Neon directly, making the cookie third-party (browser-blocked),
> so sessions were lost on every refresh. Migrating to Next.js fixed it. The React UI is
> unchanged; only the build framework and the auth transport moved.

---

## CRITICAL — API Key Security

**Next.js inlines any `NEXT_PUBLIC_`-prefixed env variable into the browser bundle.** Secret keys MUST NOT use a public prefix. They live server-side only, in the Next.js functions under `pages/api/` and the auth handler config (`lib/auth/server.js`). (The same applied to Vite's `VITE_` prefix pre-migration — the principle is unchanged.)

| Key | Prefix | Lives | Why |
|---|---|---|---|
| Anthropic API key | NONE | Server only | Would be harvestable if exposed |
| Neon connection string | NONE | Server only | Full DB write access |
| YouTube Data API key | NONE | Server only | Quota abuse risk |
| `NEON_AUTH_COOKIE_SECRET` | NONE | Server only | Signs the session cookie (32+ chars) |
| `NEON_AUTH_BASE_URL` | NONE | Server only | Neon Auth server URL (handler + JWKS) |

**Rule:** Anything that touches Anthropic, the Neon database directly, or the YouTube Data API goes through a Next.js function in `pages/api/`. The browser calls your own `/api/*` endpoints, never the third-party APIs directly. Auth requests go to the same-origin proxy at `/api/auth/*`. The only secret-bearing code runs server-side. No client-exposed secrets remain (the old `VITE_NEON_AUTH_URL` / publishable key are no longer needed — the client talks to the same-origin auth proxy).

---

## Project Structure

```
ngs-immersion/
├── app/                          # Next.js App Router
│   ├── layout.jsx                # Root layout — imports global CSS, <html>/<body>
│   ├── page.jsx                  # 'use client' — renders the SPA via next/dynamic (ssr:false)
│   └── api/
│       └── auth/[...path]/route.js  # Neon same-origin auth proxy: export {GET,POST}=auth.handler()
├── pages/                        # Next.js Pages Router — API functions only (classic req,res)
│   └── api/                      # SECRET KEYS LIVE HERE
│       ├── tag-channel.js        # Classifies channel level via Haiku — primary tagging path
│       ├── tag-video.js          # Haiku per-video tagging — fallback for channelless imports
│       ├── youtube-search.js     # YouTube Data API + music-category filter — never exposes key
│       ├── youtube-import.js     # Batch playlist/channel import + tag (maxDuration 30)
│       ├── add-video.js          # Admin: save one searched video with pre-computed tags
│       ├── flush-session.js      # Writes watch_sessions to Neon (sendBeacon target)
│       ├── progress.js           # Reads cumulative hours from Neon
│       ├── videos.js             # Library list + per-video watched state (JWT-scoped)
│       ├── mark-video.js         # Manual watched/unwatched toggle
│       ├── me.js                 # Current user role lookup (JWT → public.users)
│       └── scholars.js           # Admin: all-scholar progress (service role)
├── lib/                          # Server-side modules (NOT routes — outside pages/api)
│   ├── auth/
│   │   └── server.js             # createNeonAuth({baseUrl, cookies:{secret}}) — the auth handler
│   └── api/
│       ├── _db.js                # Shared Neon connection helper (getDb/getAdminDb)
│       ├── _auth.js              # verifySession/verifyAdmin — JWKS-verifies the Neon JWT
│       └── _tag.js               # Haiku prompt + CEFR/topic taxonomy (shared by tag endpoints)
├── next.config.js                # reactStrictMode + rewrite non-API paths to / (SPA shell)
├── src/                          # The React SPA (unchanged by the migration)
│   ├── App.jsx                   # Root — HashRouter, routes, AuthContext
│   ├── pages/
│   │   ├── Watch.jsx             # Main watch page — player + browse
│   │   ├── Progress.jsx          # Hours counter + milestones (scholar view)
│   │   ├── Browse.jsx            # Full video browse + search
│   │   ├── Admin.jsx             # Admin shell — scholar management
│   │   ├── AdminProgress.jsx     # Admin progress — scholar cards
│   │   ├── AdminVideos.jsx       # Admin video library + AI-assisted add
│   │   └── Login.jsx             # Auth page
│   ├── components/
│   │   ├── player/
│   │   │   ├── VideoPlayer.jsx   # YouTube IFrame API wrapper
│   │   │   └── WatchTimer.jsx    # Play-state timer — only ticks when playing
│   │   ├── progress/
│   │   │   ├── HoursCounter.jsx  # Big hours display + level badge
│   │   │   ├── MilestoneBar.jsx  # Progress bar to next level
│   │   │   └── WeekStats.jsx     # This week / target / last session
│   │   ├── video/
│   │   │   ├── VideoCard.jsx     # Video card — thumbnail, level, topic, watched
│   │   │   ├── VideoGrid.jsx     # Responsive grid wrapper
│   │   │   └── FilterBar.jsx     # Topic + level + watched/unwatched filters
│   │   ├── admin/
│   │   │   ├── ScholarCard.jsx   # Scholar progress card — AT RISK / ON TRACK
│   │   │   ├── AddVideoPanel.jsx # AI-assisted search + URL import
│   │   │   └── GoalEditor.jsx    # Program-wide goal + per-scholar start date
│   │   └── layout/
│   │       ├── Navbar.jsx        # Top nav — NGS badge + wordmark + avatar
│   │       ├── Sidebar.jsx       # Desktop sidebar (hidden on mobile)
│   │       └── BottomNav.jsx     # Mobile bottom nav (hidden on desktop)
│   ├── context/
│   │   └── AuthContext.jsx       # Auth state + useAuth hook
│   ├── hooks/
│   │   ├── useWatchSession.js    # YouTube IFrame state + interval timer
│   │   └── useProgress.js        # Calls /api/progress for cumulative hours
│   ├── lib/
│   │   ├── auth.js               # createAuthClient() (no-arg) from @neondatabase/auth/next → same-origin /api/auth/*
│   │   ├── authToken.js          # getAuthToken() — GET /api/auth/token for the JWT sent to /api/*
│   │   └── apiClient.js          # Fetch wrapper for own /api/* endpoints
│   ├── utils/
│   │   ├── levels.js             # DS-style hour thresholds
│   │   ├── timeFormat.js         # Seconds → hours display formatting
│   │   ├── offlineBuffer.js      # localStorage queue for poor connections
│   │   └── pace.js               # AT RISK / ON TRACK pace calculations
│   └── styles/
│       ├── tokens.css            # --ngsi-* CSS variables
│       └── global.css            # Base styles
├── neon/
│   └── schema.sql                # Full database schema — run once on new project
├── public/
├── CLAUDE.md                     # This file
├── ARCHITECTURE.md               # System design — source of truth
├── ROADMAP.md                    # Feature build order + session log
├── .env.example                  # Required environment variables
├── .gitignore                    # ignores node_modules, .next, next-env.d.ts, .env
├── vercel.json                   # Vercel config (minimal — Next handles routing)
├── prettier.config.js
└── package.json                  # next build/dev/start (no Vite; index.html/main.jsx removed)
```

---

## Environment Variables

```bash
# ─── SERVER-SIDE ONLY (no public prefix — never exposed to the browser) ───
ANTHROPIC_API_KEY=              # Anthropic key — Haiku tagging. Server only.
NEON_DATABASE_URL=              # Neon connection string (pooled). Server only.
NEON_DATABASE_URL_ADMIN=        # Neon service-role connection for admin cross-scholar reads
YOUTUBE_API_KEY=                # YouTube Data API v3 key. Server only.
NEON_AUTH_BASE_URL=             # Neon Auth server URL — same-origin handler + JWKS verification
NEON_AUTH_COOKIE_SECRET=        # 32+ char secret signing the first-party session cookie
                                # (openssl rand -base64 32). Server only.

# ─── CLIENT-SIDE ───
# None required. The client talks to the same-origin /api/auth/* proxy, so the
# old VITE_NEON_AUTH_URL / VITE_NEON_AUTH_PUBLISHABLE_KEY are no longer needed.
# Any future browser-exposed value must use the NEXT_PUBLIC_ prefix.
```

In Vercel: set all of the above as env vars (no prefix) and ensure they are enabled for **both Production and Preview** — a missing `NEON_DATABASE_URL` on Preview makes `/api/me` 500 and breaks login on preview deploys. The **Framework Preset must be Next.js** (not Vite). Each new preview deploy gets a unique URL that must be added to Neon Auth `trusted_origins` (via `configure_neon_auth`) to sign in there; production and the stable branch alias are already trusted.

---

## Key Rules for Claude Code

**API key security:** NEVER put a secret key behind `NEXT_PUBLIC_` (or the old `VITE_`). AI tagging, direct Neon writes, and YouTube Data API calls run ONLY in `pages/api/*` functions. The browser calls `/api/*`, never third-party APIs directly.

**Auth (same-origin model — Phase 14):** Neon Auth runs through Neon's official same-origin handler. `lib/auth/server.js` calls `createNeonAuth({ baseUrl: NEON_AUTH_BASE_URL, cookies: { secret: NEON_AUTH_COOKIE_SECRET, sameSite: 'lax' } })`; `app/api/auth/[...path]/route.js` exposes it as `export const { GET, POST } = auth.handler()`. The browser client (`src/lib/auth.js`) is the **no-arg** `createAuthClient()` from `@neondatabase/auth/next`, which talks to the same-origin `/api/auth/*` proxy — so the session cookie is **first-party** and survives refresh. Do NOT revert to the browser-direct-to-Neon (`VITE_NEON_AUTH_URL`) client or a hand-rolled proxy — both reintroduce the third-party-cookie logout (see ROADMAP history, PRs #22–#24, #29–#30). For `/api/*` authorization, `getAuthToken()` (`src/lib/authToken.js`) fetches a real JWT from `GET /api/auth/token`; `lib/api/_auth.js` JWKS-verifies it (unchanged). Guard against redirect races: any code that gates on auth must treat "session present, user not yet resolved" as still-loading (see `AuthContext` `roleLoading` init + `Login` effect-based navigation).

**Watch timer:** The interval timer in `useWatchSession.js` ONLY ticks inside a `setInterval` started by `YT.PlayerState.PLAYING`. It MUST stop on `PAUSED`, `BUFFERING`, and `ENDED`. Never count time from session boundaries.

**Offline flushing:** Use `navigator.sendBeacon('/api/flush-session', payload)` for the `beforeunload` flush — regular `fetch` is killed on tab close. The localStorage buffer in `utils/offlineBuffer.js` accumulates seconds and flushes on reconnect.

**Hours idempotency:** Every flush carries a client-generated `client_flush_id` (UUID). `api/flush-session.js` writes with `ON CONFLICT (client_flush_id) DO NOTHING` so overlapping flushes (sendBeacon + pause + reconnect + app-load) are written once. Clear the localStorage buffer only after a confirmed write, and keep the same id across retries. This is the core guard against inflated cumulative hours.

**Neon NUMERIC type:** `@neondatabase/serverless` returns Postgres `NUMERIC` / `DECIMAL` columns (including `ROUND(expr, n)` results) as **JavaScript strings**, not numbers. Always coerce with `Number()` at the API boundary before sending to the client — do NOT rely on the component to handle it. Affected columns in this project: `current_hours`, `hours_this_week`, `expected_hours` in `scholar_pace` (all `ROUND(...)::numeric`). Plain `INTEGER` and `BIGINT` columns are returned as JS numbers. If a component calls `.toFixed()`, `+`, or any arithmetic on a Neon-sourced value, verify the column type first.

**Completion semantics:** `completed = true` only when a SINGLE session reaches ≥95% of the video. It is NOT cumulative — watching 50% twice does not complete a video. Hours from every session always count toward cumulative input regardless of completion.

**AI tagging model:** ALWAYS use `claude-haiku-4-5` for all tagging. Two endpoints: `api/tag-channel.js` classifies a channel's **level** once when it is added — all videos from that channel inherit `level_source: 'channel'` (primary path, fast). `api/tag-video.js` is the fallback for individual channelless imports (level + topics). **Topics are always per-video:** even channel imports get a lightweight per-video Haiku topic call (topic varies within a channel; level does not). Use CEFR mappings only in the prompt (super_beginner=A1–A2, beginner=A2–B1, intermediate=B1–B2, advanced=B2–C1) — no qualitative descriptions. Keep the prompt + taxonomy in one shared server module imported by both endpoints (no drift). Results cached in Neon forever; admin overrides with `level_source: 'admin'`. Re-classifying a channel re-stamps its `level_source: 'channel'` videos but preserves `admin` overrides.

**Goal clock:** Each scholar's goal clock starts on an admin-set `start_date` in the `scholar_goals` table — NOT on account creation and NOT on first session. A scholar with no start_date set has status PENDING and no pace calculation runs. All "today"/"this week" math is computed in **Asia/Manila** (program timezone). `expected_hours` is capped at `target_hours`; past the target date a scholar is ON_TRACK only if the full target was met. `target_hours` is the entry threshold of the target level (Intermediate = 300h).

**Neon Auth password format:** Passwords in `neon_auth.account` use `@better-auth/utils` scrypt — format is `<hex_salt>:<hex_hash>` (161 chars total: 32-char hex salt + `:` + 128-char hex hash). Parameters: N=16384, r=16, p=1, dkLen=64. Critically, the salt is passed to `node:crypto scrypt` as a **hex string** (not a Buffer), and the password is **NFKC-normalized** before hashing. To set a password via SQL, generate the hash with this exact script:
```js
const { randomBytes, scrypt } = require('node:crypto')
const salt = randomBytes(16).toString('hex') // hex string, not Buffer
scrypt(password.normalize('NFKC'), salt, 64, { N: 16384, r: 16, p: 1, maxmem: 128*16384*16*2 }, (err, key) => {
  console.log(`${salt}:${key.toString('hex')}`) // paste this into the UPDATE
})
```
Then: `UPDATE neon_auth.account SET password = '<output>', "updatedAt" = now() WHERE "userId" = '<id>' AND "providerId" = 'credential'`

**Scholar data isolation & provisioning:** Accounts are admin-provisioned — no public self-signup. `users.id` is the Neon Auth subject (`sub`), supplied on insert (not a random uuid), so the API can scope every query by the verified JWT `sub`. One login screen for all; `role` (`scholar` | `admin`) drives the UI. Scholars read/write only their own data via their JWT-scoped `/api/*` calls. Admin cross-scholar reads use the service-role connection (`NEON_DATABASE_URL_ADMIN`) in admin-only `pages/api/scholars.js`. Do not rely on database RLS alone — enforce in the API layer.

**Responsive breakpoints:**
- `< 640px` — mobile: bottom nav, single column
- `640px–1024px` — tablet: sidebar, 2-col video grid
- `≥ 1024px` — desktop: full sidebar, 3-col video grid
- `≥ 1280px` — widescreen: max-width container centered

**Color system:**
- OET/career topic tags → blue `#378ADD`
- Daily life topic tags → green `#1D9E75`
- Compelling interest topic tags → gray/muted
- Navy `#162040`, Gold `#C9A84C`, Cream `#F5F0E8`

**Routing:** The app uses `HashRouter` (client-side, in the URL hash) rendered inside the Next.js shell (`app/page.jsx` → `next/dynamic(..., { ssr:false })`). `next.config.js` rewrites any non-API, non-asset path to `/` so deep links / hard refreshes land on the SPA shell; HashRouter then reads the hash. Do NOT add `index.html`/`vite.config.js` — those are gone. `/api/*` and `/api/auth/*` must remain excluded from the SPA rewrite.

**No TypeScript.** JavaScript only. Match the pattern of the existing NGS Scholars repo.

---

## Native app (PWA → Play Store) — PLANNED

This app is the **pilot** for shipping the NGS apps as installable Android apps
via a PWA wrapped in a Trusted Web Activity (TWA), distributed on the Play
**Internal Testing** track (private — scholars install from Play by email
allowlist, not a public listing). Nothing is built yet. Full runbooks:

- **`docs/PWA.md`** — installable-PWA groundwork (manifest, service worker,
  icons). Prerequisite for the TWA. Key rule: the service worker must keep
  `/api/**` and `/api/auth/*` **network-only** (never cache authed responses)
  and must not interfere with the existing `offlineBuffer.js` / `sendBeacon`
  hours-flush path.
- **`docs/PLAY-STORE.md`** — TWA packaging (Bubblewrap/PWABuilder), Digital
  Asset Links, and the Internal Testing rollout. #1 risk to verify early:
  the first-party session cookie (Phase 14) persisting inside the TWA.

See `ROADMAP.md` for status/phase tracking.

---

## Neon MCP Setup (Claude Code)

```bash
npx neonctl@latest init
```

This authenticates via OAuth, creates a Neon API key, and wires Claude Code to the ngs-immersion Neon project automatically. Run once per machine. Use it to run `neon/schema.sql` and verify tables.

---

## References

- NGS Scholars repo (existing patterns): https://github.com/jonncy18-maker/NextGen-Scholars
- Agentic Loop protocol: https://github.com/jonncy18-maker/Agentic-Loop
- Neon MCP + Claude Code guide: https://neon.com/guides/claude-code-mcp-neon
- Neon Auth docs: https://neon.com/docs/guides/neon-auth
- YouTube IFrame API: https://developers.google.com/youtube/iframe_api_reference
- Vercel serverless functions: https://vercel.com/docs/functions
