# NGS Immersion

Internal comprehensible-input (CI) platform for the **NextGen Scholars** program. Scholars watch YouTube videos in their target language; the app tracks cumulative listening hours (counting time **only while the video is playing**) toward Dreaming-Spanish-style level milestones. Admins manage the video library, set program goals + per-scholar start dates, and monitor all scholars.

Internal scholarship tool — not a public product.

> **Authoritative docs:** [`ARCHITECTURE.md`](./ARCHITECTURE.md) (system design — source of truth) · [`CLAUDE.md`](./CLAUDE.md) (build rules + conventions) · [`ROADMAP.md`](./ROADMAP.md) (phases + session log).
>
> **Reusable recipe:** [`docs/nextjs-neon-vercel-auth-starter.md`](./docs/nextjs-neon-vercel-auth-starter.md) — copy-pasteable first-party auth setup for any new Next.js + Neon + Vercel project (handler, client, JWT verify, race guards, Vercel/Neon checklist, gotchas).

---

## Stack

- **Next.js 16** (App Router) — hosts the SPA, the serverless API, and the same-origin auth proxy
- **React 18** SPA (React Router v6 `HashRouter`) rendered client-side inside the Next shell (`app/page.jsx`, `ssr:false`)
- **Neon** (serverless Postgres) + **Neon Auth** (Better Auth) via Neon's **same-origin handler** — first-party session cookie
- **Anthropic** `claude-haiku-4-5` for level/topic tagging (server-side only)
- **YouTube** IFrame API (playback) + Data API v3 (search/import, server-side)
- **Vercel** Hobby hosting · JavaScript (ES modules, no TypeScript) · Prettier

> Phases 1–13 were built on Vite; **Phase 14 migrated to Next.js** so the session cookie could be first-party (the Vite SPA talked to Neon directly, making the cookie third-party and breaking sessions on refresh). The React UI is unchanged.

---

## Project layout

```
app/                       Next.js App Router — SPA shell + auth handler
  page.jsx                 renders the React SPA (next/dynamic, ssr:false)
  api/auth/[...path]/route.js   Neon same-origin auth proxy
pages/api/                 API functions (classic req,res) — SECRET KEYS HERE
lib/auth/server.js         createNeonAuth() handler config
lib/api/                   shared server helpers (_db, _auth, _tag)
src/                       the React SPA (App.jsx, pages, components, hooks, utils)
neon/schema.sql            full database schema
next.config.js             SPA rewrite (non-API paths → /)
```

---

## Local development

```bash
npm install
npm run dev        # next dev
npm run build      # next build
npm start          # next start (after build)
npm run format     # prettier
```

Create `.env` from [`.env.example`](./.env.example) and fill in the values (all server-side; see below).

---

## Environment variables

All server-side (no public prefix). Set in `.env` locally and in Vercel for **both Production and Preview**.

| Variable | Purpose |
|---|---|
| `NEON_DATABASE_URL` | Neon Postgres connection string (pooled) |
| `NEON_DATABASE_URL_ADMIN` | Service-role connection for admin cross-scholar reads (may equal the above) |
| `NEON_AUTH_BASE_URL` | Neon Auth server URL — used by the auth handler and JWKS verification |
| `NEON_AUTH_COOKIE_SECRET` | 32+ char secret signing the first-party session cookie (`openssl rand -base64 32`) |
| `ANTHROPIC_API_KEY` | Haiku tagging |
| `YOUTUBE_API_KEY` | YouTube Data API v3 |

No client-exposed variables are required (the browser uses the same-origin `/api/auth/*` proxy). Any future browser value must use the `NEXT_PUBLIC_` prefix.

---

## Deploying (Vercel)

1. **Framework Preset = Next.js** (Project → Settings → Build & Deployment). Leave Build Command / Output Directory on Next.js defaults.
2. Set all env vars above for **Production and Preview**. A missing `NEON_DATABASE_URL` on Preview makes `/api/me` 500 and blocks login on preview deploys.
3. **Trusted origins:** add each deployment origin you need to sign in from (production domain + any preview URL you test) to Neon Auth `trusted_origins`. Production and the stable branch alias are already trusted; ephemeral per-commit preview URLs must be added when testing auth there.

---

## Key invariants (do not break)

- **Secrets never reach the browser** — Anthropic / Neon / YouTube / cookie secret live only in `pages/api/*` and `lib/`.
- **Watch timer counts only `PLAYING`** seconds; flushes are idempotent via `client_flush_id` + `ON CONFLICT DO NOTHING`.
- **Auth is same-origin** — do not revert to a browser-direct Neon client or a hand-rolled proxy (both reintroduce the third-party-cookie logout).
- **Tagging uses `claude-haiku-4-5` only**, with the shared prompt/taxonomy in `lib/api/_tag.js`.
