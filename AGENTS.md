# NGS Immersion

NGS Immersion is an internal web application for the NextGen Scholars (NGS) program. It is a comprehensible input (CI) platform inspired by Dreaming Spanish — scholars watch YouTube videos in their target language and the app tracks cumulative listening hours toward level-based milestones.

It is NOT a public product. It is an internal scholarship tool with no revenue and no paying customers.

Shared project instructions for every coding agent (Claude Code, Codex, Antigravity). Each agent's role and permissions live in its own global file, not here.

> **Session start:** read `ARCHITECTURE.md` (system design — source of truth, including the annotated project structure) and the latest `ROADMAP.md` entries (phases + session log) before making structural changes.

**Primary scholar (launch):** Claire Buenconsejo — nursing student, University of the Visayas, Cebu, Philippines. English target language. A2 high / B1 low current level. OET Grade B (C1) long-term goal for AHPRA Australia nursing registration.

**Future scholars:** April, Nathalie, and others as the NGS/NGH program expands.

---

## Agentic Loop
Profile: https://raw.githubusercontent.com/jonncy18-maker/Agentic-Loop/main/CODER_PROFILE.md
Protocol: https://raw.githubusercontent.com/jonncy18-maker/Agentic-Loop/main/AGENTIC_LOOP.md
Orchestrator: https://raw.githubusercontent.com/jonncy18-maker/Agentic-Loop/main/orchestrator.js
At the start of every session, read the full profile and protocol from the URLs above before doing anything else.

The **profile applies to every task, with no threshold** — it governs how code is written and how it gets verified.
The **loop applies above the threshold** — it governs whether the right thing was built. Every change that touches 3+ files, creates a new component, touches the data layer, or has user-visible behavior MUST go through the agentic loop. One-liners and typo fixes can run direct — but the profile still applies to them.

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
AI tagging:   GPT-6 Luna (gpt-6-luna) when OPENAI_API_KEY is set, else claude-haiku-4-5 (server-side, level + topic tags, cached forever)
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
| OpenAI API key (optional) | NONE | Server only | Same exposure risk; used only by `lib/api/_ai.js` for the Luna opt-in tasks |
| Neon connection string | NONE | Server only | Full DB write access |
| YouTube Data API key | NONE | Server only | Quota abuse risk |
| `NEON_AUTH_COOKIE_SECRET` | NONE | Server only | Signs the session cookie (32+ chars) |
| `NEON_AUTH_BASE_URL` | NONE | Server only | Neon Auth server URL (handler + JWKS) |
| `IMMERSION_MCP_TOKEN` | NONE | Server only | Bearer secret for the MCP server — grants full admin access if leaked |

**Rule:** Anything that touches Anthropic, the Neon database directly, or the YouTube Data API goes through a Next.js function in `pages/api/`. The browser calls your own `/api/*` endpoints, never the third-party APIs directly. Auth requests go to the same-origin proxy at `/api/auth/*`. The only secret-bearing code runs server-side. No client-exposed secrets remain (the old `VITE_NEON_AUTH_URL` / publishable key are no longer needed — the client talks to the same-origin auth proxy).

---

## Project Structure

The annotated directory tree (`app/`, `pages/api/`, `lib/`, `src/`, `neon/`) lives in `ARCHITECTURE.md` → *Project Structure*.

---

## Environment Variables

```bash
# ─── SERVER-SIDE ONLY (no public prefix — never exposed to the browser) ───
ANTHROPIC_API_KEY=              # Anthropic key — Haiku tagging. Server only.
OPENAI_API_KEY=                 # OPTIONAL — GPT-6 Luna for the ten tasks in lib/api/_ai.js; unset = all Haiku (scope to Preview first). Server only.
AI_FORCE_ANTHROPIC=             # OPTIONAL — 1 sends every task back to Haiku at once
NEON_DATABASE_URL=              # Neon connection string (pooled). Server only.
NEON_DATABASE_URL_ADMIN=        # Neon service-role connection for admin cross-scholar reads
YOUTUBE_API_KEY=                # YouTube Data API v3 key. Server only.
NEON_AUTH_BASE_URL=             # Neon Auth server URL — same-origin handler + JWKS verification
NEON_AUTH_COOKIE_SECRET=        # 32+ char secret signing the first-party session cookie
                                # (openssl rand -base64 32). Server only.
IMMERSION_MCP_TOKEN=            # Bearer secret gating /api/mcp (Claude + ChatGPT connector).
                                # Grants full admin access — generate with
                                # `openssl rand -hex 32`. Server only.

# ─── CLIENT-SIDE ───
# None required. The client talks to the same-origin /api/auth/* proxy, so the
# old VITE_NEON_AUTH_URL / VITE_NEON_AUTH_PUBLISHABLE_KEY are no longer needed.
# Any future browser-exposed value must use the NEXT_PUBLIC_ prefix.
```

In Vercel: set all of the above as env vars (no prefix) and ensure they are enabled for **both Production and Preview** — a missing `NEON_DATABASE_URL` on Preview makes `/api/me` 500 and breaks login on preview deploys. The **Framework Preset must be Next.js** (not Vite). Each new preview deploy gets a unique URL that must be added to Neon Auth `trusted_origins` (via `configure_neon_auth`) to sign in there; production and the stable branch alias are already trusted.

---

## Key Rules

**API key security:** NEVER put a secret key behind `NEXT_PUBLIC_` (or the old `VITE_`). AI tagging, direct Neon writes, and YouTube Data API calls run ONLY in `pages/api/*` functions. The browser calls `/api/*`, never third-party APIs directly.

**MCP server (`app/api/mcp`, `lib/mcp-*.js`):** Exposes the admin dashboard — and the handful of per-scholar actions with no admin equivalent — to Claude (claude.ai's OAuth connector, or a bare bearer header in Claude Code/Desktop config) and ChatGPT (its "Access token / API key" custom-connector mode, which is why the endpoint deliberately lives at the literal path `/api/mcp` rather than a nested one). Every tool in `lib/mcp-tools.js` is a thin same-origin-fetch wrapper around an existing `pages/api/*` route — no tool talks to Neon, Anthropic, or the YouTube Data API directly, same rule as the browser SPA. Because this app has real per-scholar Neon Auth accounts but the MCP connector is a single always-on integration (not a scholar logging in), `lib/api/_auth.js`'s `verifySession`/`verifyAdmin` also accept the MCP server's own shared secret (`IMMERSION_MCP_TOKEN`) in place of a JWT: a bare `Bearer <secret>` resolves to a real admin user row (every admin-gated route just works), and `Bearer <secret>:<userId>` impersonates that scholar (for routes with no admin/cross-scholar variant — mark-video, watch-later, next-video, etc.). This impersonation format is constructed server-side inside `lib/mcp-tools.js` for the internal fetch back into `pages/api/*`; it is never accepted from an external MCP client, whose own bearer header (checked by `lib/mcp-server.js`) must always be the bare secret. Do not weaken this by accepting the `:userId` suffix anywhere the JWT path also runs client-exposed — it exists solely for this server-to-server hop. New tool = new `pages/api/*` route first, then a `CATALOG` entry in `lib/mcp-tools.js` — never a second, looser way to reach the database.

**Auth (same-origin model — Phase 14):** Neon Auth runs through Neon's official same-origin handler. `lib/auth/server.js` calls `createNeonAuth({ baseUrl: NEON_AUTH_BASE_URL, cookies: { secret: NEON_AUTH_COOKIE_SECRET, sameSite: 'lax' } })`; `app/api/auth/[...path]/route.js` exposes it as `export const { GET, POST } = auth.handler()`. The browser client (`src/lib/auth.js`) is the **no-arg** `createAuthClient()` from `@neondatabase/auth/next`, which talks to the same-origin `/api/auth/*` proxy — so the session cookie is **first-party** and survives refresh. Do NOT revert to the browser-direct-to-Neon (`VITE_NEON_AUTH_URL`) client or a hand-rolled proxy — both reintroduce the third-party-cookie logout (see ROADMAP history, PRs #22–#24, #29–#30). For `/api/*` authorization, `getAuthToken()` (`src/lib/authToken.js`) fetches a real JWT from `GET /api/auth/token`; `lib/api/_auth.js` JWKS-verifies it (unchanged). Guard against redirect races: any code that gates on auth must treat "session present, user not yet resolved" as still-loading (see `AuthContext` `roleLoading` init + `Login` effect-based navigation).

**Watch timer:** The interval timer in `useWatchSession.js` ONLY ticks inside a `setInterval` started by `YT.PlayerState.PLAYING`. It MUST stop on `PAUSED`, `BUFFERING`, and `ENDED`. Never count time from session boundaries.

**Offline flushing:** Use `navigator.sendBeacon('/api/flush-session', payload)` for the `beforeunload` flush — regular `fetch` is killed on tab close. The localStorage buffer in `utils/offlineBuffer.js` accumulates seconds and flushes on reconnect.

**Hours idempotency:** Every flush carries a client-generated `client_flush_id` (UUID). `api/flush-session.js` writes with `ON CONFLICT (client_flush_id) DO NOTHING` so overlapping flushes (sendBeacon + pause + reconnect + app-load) are written once. Clear the localStorage buffer only after a confirmed write, and keep the same id across retries. This is the core guard against inflated cumulative hours.

**Neon NUMERIC type:** `@neondatabase/serverless` returns Postgres `NUMERIC` / `DECIMAL` columns (including `ROUND(expr, n)` results) as **JavaScript strings**, not numbers. Always coerce with `Number()` at the API boundary before sending to the client — do NOT rely on the component to handle it. Affected columns in this project: `current_hours`, `hours_this_week`, `expected_hours` in `scholar_pace` (all `ROUND(...)::numeric`). Plain `INTEGER` and `BIGINT` columns are returned as JS numbers. If a component calls `.toFixed()`, `+`, or any arithmetic on a Neon-sourced value, verify the column type first.

**Completion semantics:** `completed = true` only when a SINGLE session reaches ≥95% of the video. It is NOT cumulative — watching 50% twice does not complete a video. Hours from every session always count toward cumulative input regardless of completion.

**AI tagging model:** tagging runs through `lib/api/_ai.js` — GPT-6 Luna (`gpt-6-luna`) whenever `OPENAI_API_KEY` is set, `claude-haiku-4-5` otherwise and on any Luna failure (John's call, 2026-10-01: cheaper, and tagging is subjective). Prompts below are model-agnostic. Two endpoints: `api/tag-channel.js` classifies a channel's **level** once when it is added — all videos from that channel inherit `level_source: 'channel'` (primary path, fast). `api/tag-video.js` is the fallback for individual channelless imports (level + topics). **Topics are always per-video:** even channel imports get a lightweight per-video Haiku topic call (topic varies within a channel; level does not). Use CEFR mappings only in the prompt (super_beginner=A1–A2, beginner=A2–B1, intermediate=B1–B2, advanced=B2–C1) — no qualitative descriptions. Keep the prompt + taxonomy in one shared server module imported by both endpoints (no drift). Results cached in Neon forever; admin overrides with `level_source: 'admin'`. Re-classifying a channel re-stamps its `level_source: 'channel'` videos but preserves `admin` overrides.

**Luna (Oct 2026) — ten tasks in `lib/api/_ai.js`:** which tasks run on GPT-6 Luna vs `claude-haiku-4-5`, the `AI_FORCE_ANTHROPIC` switch, and the 2026-10-01 tagging check live in `ARCHITECTURE.md` → *AI Tagging* → *Luna*. The OpenAI key and every call to OpenAI stay server-side (`pages/api/*` via `lib/api/_ai.js`).

**Goal clock:** Each scholar's goal clock starts on an admin-set `start_date` in the `scholar_goals` table — NOT on account creation and NOT on first session. A scholar with no start_date set has status PENDING and no pace calculation runs. All "today"/"this week" math is computed in **Asia/Manila** (program timezone). `expected_hours` is capped at `target_hours`; past the target date a scholar is ON_TRACK only if the full target was met. `target_hours` is the entry threshold of the target level (Intermediate = 300h).

**Neon Auth password format:** setting a scholar password via SQL needs an exact `@better-auth/utils` scrypt hash (hex-string salt, NFKC-normalized password) — use the script in `docs/neon-auth-passwords.md`; never hand-roll the hash.

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

**Model IDs in code stay pinned.** Model IDs in application code (`HAIKU_MODEL` / `LUNA_MODEL` in `lib/api/_ai.js`, `MODEL` in `pages/api/progress-coaching.js` and `pages/api/level-celebration.js`) stay pinned to exact IDs deliberately — a floating alias would change behavior and cost with no deploy or diff.

---

## Native app (PWA → Play Store) — IN PROGRESS

This app is the **pilot** for shipping the NGS apps as installable Android apps
via a PWA wrapped in a Trusted Web Activity (TWA), distributed on the Play
**Internal Testing** track (private — scholars install from Play by email
allowlist, not a public listing). The PWA foundation and TWA package are built; device verification and the Play upload remain. Full runbooks:

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

## References

- NGS Scholars repo (existing patterns): https://github.com/jonncy18-maker/NextGen-Scholars
- Agentic Loop protocol: https://github.com/jonncy18-maker/Agentic-Loop
- Neon Auth docs: https://neon.com/docs/guides/neon-auth
- YouTube IFrame API: https://developers.google.com/youtube/iframe_api_reference
- Vercel serverless functions: https://vercel.com/docs/functions

---

## Where things live

- `ARCHITECTURE.md` — system design, project structure, schema, API layer, auth, AI tagging (incl. Luna routing), design system.
- `ROADMAP.md` — phase build order, Next Up, dated session log. `UPDATES.md` — user-facing update log.
- `STACK_BLUEPRINT.md` — the gold-standard stack/instruction-file shape other repos copy from this one.
- `docs/` — runbooks: `PWA.md`, `PLAY-STORE.md`, `neon-auth-passwords.md`, `nextjs-neon-vercel-auth-starter.md`.

**Keep this file short — it is a maintenance rule.** Before adding anything, ask: does it change how code is written across the repo? Domain detail goes in `ARCHITECTURE.md`, `docs/` or a skill. A procedure John runs goes in `docs/`. A dated account of why a decision was made goes in `ROADMAP.md`. Anything only Claude Code needs goes in `CLAUDE.md`. State each rule once, and never put agent permissions (push, merge, deploy) here.

## Working in an agent copy (Codex / Antigravity)

Applies only when your working directory is under `~/code/_codex/` or `~/code/_antigravity/`. Those copies sync from the local `main` in `~/code/<repo>`, not from GitHub (local `main` is usually ahead, and the copies have no push access).

At the start of each session, with the copy on a clean `main`:

1. `git fetch local && git merge --ff-only local/main`.
2. If the copy is not on a clean `main`, or the fast-forward fails, stop and tell John. Do not reset, rebase or discard anything on your own.
3. Do your work on a local branch and hand it back through the audit inbox; never edit `main` in the copy.
