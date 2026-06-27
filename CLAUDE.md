# NGS Immersion — Claude Code Instructions

## Agentic Loop
Protocol: https://raw.githubusercontent.com/jonncy18-maker/agentic-loop/main/AGENTIC%20LOOP.md
Orchestrator: https://raw.githubusercontent.com/jonncy18-maker/agentic-loop/main/orchestrator.js
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
Frontend:     React 18 + Vite
Routing:      React Router v6 (HashRouter — Vercel SPA compatible)
Styling:      CSS with --ngsi-* token variables (navy + gold palette — see ARCHITECTURE.md)
Database:     Neon (serverless Postgres) — project: ngs-immersion
Auth:         Neon Auth (built-in, email/password)
Video:        YouTube IFrame API (official embed, client-side)
AI tagging:   Anthropic API — claude-haiku-4-5 ONLY (server-side, level + topic tags, cached forever)
Backend:      Vercel serverless functions (api/ folder) — protects all secret keys
Hosting:      Vercel Hobby (free tier, non-commercial internal use)
Language:     JavaScript (ES modules) — no TypeScript
Formatting:   Prettier
```

---

## CRITICAL — API Key Security

**Vite exposes any `VITE_`-prefixed env variable in the browser bundle.** Secret keys MUST NOT use the `VITE_` prefix. They live server-side only, in Vercel serverless functions under `api/`.

| Key | Prefix | Lives | Why |
|---|---|---|---|
| Anthropic API key | NONE | Server only | Would be harvestable if exposed |
| Neon connection string | NONE | Server only | Full DB write access |
| YouTube Data API key | NONE | Server only | Quota abuse risk |
| Neon Auth publishable key | `VITE_` | Browser | Designed to be public |

**Rule:** Anything that touches Anthropic, the Neon database directly, or the YouTube Data API goes through a Vercel serverless function in `api/`. The browser calls your own `/api/*` endpoints, never the third-party APIs directly. The only secret-bearing code runs server-side.

---

## Project Structure

```
ngs-immersion/
├── api/                          # Vercel serverless functions — SECRET KEYS LIVE HERE
│   ├── tag-video.js              # Calls Anthropic Haiku — never exposes key
│   ├── youtube-search.js         # Calls YouTube Data API — never exposes key
│   ├── youtube-import.js         # Batch playlist/channel import + tag
│   ├── flush-session.js          # Writes watch_sessions to Neon (sendBeacon target)
│   ├── progress.js               # Reads cumulative hours from Neon
│   ├── scholars.js               # Admin: all-scholar progress (service role)
│   └── _db.js                    # Shared Neon connection helper (server-side)
├── src/
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
├── .gitignore
├── vercel.json                   # Vercel config — SPA rewrites + function settings
├── vite.config.js
├── prettier.config.js
└── package.json
```

---

## Environment Variables

```bash
# ─── SERVER-SIDE ONLY (no VITE_ prefix — never exposed to browser) ───
ANTHROPIC_API_KEY=              # Anthropic key — Haiku tagging. Server only.
NEON_DATABASE_URL=              # Neon connection string. Server only.
NEON_DATABASE_URL_ADMIN=        # Neon service-role connection for admin cross-scholar reads
YOUTUBE_API_KEY=                # YouTube Data API v3 key. Server only.

# ─── CLIENT-SIDE (VITE_ prefix — safe to expose) ───
VITE_NEON_AUTH_PUBLISHABLE_KEY= # Neon Auth publishable key — designed to be public
VITE_APP_ENV=development        # development | production
```

In Vercel: set server-side vars as normal env vars (no prefix). Set client vars with the `VITE_` prefix. Vercel injects both at build/runtime correctly.

---

## Key Rules for Claude Code

**API key security:** NEVER put a secret key behind `VITE_`. AI tagging, direct Neon writes, and YouTube Data API calls run ONLY in `api/` serverless functions. The browser calls `/api/*`, never third-party APIs directly.

**Watch timer:** The interval timer in `useWatchSession.js` ONLY ticks inside a `setInterval` started by `YT.PlayerState.PLAYING`. It MUST stop on `PAUSED`, `BUFFERING`, and `ENDED`. Never count time from session boundaries.

**Offline flushing:** Use `navigator.sendBeacon('/api/flush-session', payload)` for the `beforeunload` flush — regular `fetch` is killed on tab close. The localStorage buffer in `utils/offlineBuffer.js` accumulates seconds and flushes on reconnect.

**AI tagging model:** ALWAYS use `claude-haiku-4-5` in `api/tag-video.js`. Never substitute Sonnet or Opus — tagging is lightweight classification and Haiku is the correct tool. One call per video, result cached in Neon forever.

**Goal clock:** Each scholar's goal clock starts on an admin-set `start_date` in the `scholar_goals` table — NOT on account creation and NOT on first session. A scholar with no start_date set has status PENDING and no pace calculation runs.

**Scholar data isolation:** Scholars read/write only their own data. Enforced server-side: the scholar's `/api/*` calls use their Neon Auth JWT to scope queries to their own `user_id`. Admin cross-scholar reads use the service-role connection (`NEON_DATABASE_URL_ADMIN`) in admin-only `api/scholars.js`. Do not rely on database RLS alone — enforce in the API layer.

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

**Routing:** Use `HashRouter` — Vercel SPA deep-link compatibility. `vercel.json` also includes a catch-all rewrite to `index.html`.

**No TypeScript.** JavaScript only. Match the pattern of the existing NGS Scholars repo.

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
