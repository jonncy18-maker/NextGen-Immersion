# Next.js + Neon + Vercel — Auth Starter

A reusable, copy-pasteable recipe for **first-party, refresh-persistent auth** with Neon Auth (Better Auth) on Vercel. Extracted from the NGS Immersion Phase 14 migration so you never have to re-derive it (or re-suffer it).

**Use this when:** the project has login via **Neon Auth** + a Neon database + secret API keys, hosted on Vercel. (If a project is purely static / client-only with no auth or secrets, a plain Vite SPA is fine — you don't need any of this.)

**Why Next.js and not a Vite SPA:** Neon Auth's session is an **HttpOnly cookie** set by the auth server. A Vite SPA has no server on your own domain, so the cookie ends up set by `*.neon.tech` while your app is on `*.vercel.app` → it's a *third-party* cookie → browsers block it → you're logged out on every refresh. Running Neon's same-origin handler on **your own origin** (which needs a server → Next.js on Vercel) makes the cookie **first-party** and the problem disappears. (Token-in-localStorage providers like Supabase don't have this issue, which is why Vite works with them.)

---

## 0. Dependencies

```jsonc
// package.json
{
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "@neondatabase/auth": "^0.4.2-beta",   // ships the same-origin handler; peer-requires next >= 16
    "@neondatabase/serverless": "^0.10.4",  // DB driver for serverless
    "jose": "^6.2.3",                        // JWKS / JWT verification in API routes
    "next": "^16.2.9",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  }
}
```

> `@neondatabase/auth` peer-requires **Next.js ≥ 16** (it accepts React 18). Don't pin Next 14/15.

---

## 1. Environment variables (server-side only)

```bash
NEON_DATABASE_URL=          # Neon pooled connection string
NEON_AUTH_BASE_URL=         # Neon Auth server URL (from the Neon console / get_neon_auth_config)
NEON_AUTH_COOKIE_SECRET=    # 32+ chars — signs the first-party session cookie. openssl rand -base64 32
```

No `NEXT_PUBLIC_` / client vars are needed — the browser talks to the same-origin `/api/auth/*` proxy. **Set all three for both Production AND Preview in Vercel** (see §5).

---

## 2. The auth handler (server, same-origin proxy)

```js
// lib/auth/server.js
import { createNeonAuth } from '@neondatabase/auth/next/server'

// Placeholders only so `next build` succeeds when env is absent (local/CI).
// The REAL values must be set in Vercel at runtime.
const baseUrl = process.env.NEON_AUTH_BASE_URL || 'https://placeholder.invalid'
const cookieSecret =
  process.env.NEON_AUTH_COOKIE_SECRET ||
  'build-time-placeholder-secret-set-the-real-one-in-vercel'

export const auth = createNeonAuth({
  baseUrl,
  cookies: {
    secret: cookieSecret,
    sameSite: 'lax', // first-party cookie kept on top-level navigations / refresh
  },
})
```

```js
// app/api/auth/[...path]/route.js
import { auth } from '../../../../lib/auth/server.js'

export const dynamic = 'force-dynamic'
export const { GET, POST } = auth.handler()
```

That catch-all serves `/api/auth/*` (sign-in, sign-out, get-session, token, …) on your own origin → **first-party cookie**.

---

## 3. The auth client (browser)

```js
// src/lib/auth.js
import { createAuthClient } from '@neondatabase/auth/next'

// No URL argument: talks to the same-origin /api/auth/* proxy.
// Exposes useSession / signIn / signOut / token, same as the SPA client.
export const authClient = createAuthClient()
```

```js
// src/lib/authToken.js
import { authClient } from './auth.js'

// Returns a real EdDSA JWT for authorizing your OWN /api/* routes.
// GOTCHA: the same-origin proxy doesn't surface the `set-auth-jwt` header the
// SDK caches into session.token, so authClient.token()/getSession() fall back
// to the OPAQUE session token, which fails JWKS verification ("Invalid Compact
// JWS"). Fetch /api/auth/token directly to mint a real JWT from the cookie.
export async function getAuthToken() {
  try {
    const res = await fetch('/api/auth/token', {
      credentials: 'include',
      headers: { accept: 'application/json' },
    })
    if (res.ok) {
      const data = await res.json().catch(() => null)
      if (data?.token) return data.token
    }
  } catch {
    /* fall through */
  }
  try {
    const res = await authClient.token()
    return res?.data?.token ?? res?.token ?? null
  } catch {
    return null
  }
}
```

---

## 4. Verifying the JWT in your API routes

```js
// lib/api/_auth.js   (NOTE: in lib/, NOT pages/api/ — Next 16 turns _-files in
// pages/api into routes and would expose them as endpoints)
import { jwtVerify, createRemoteJWKSet } from 'jose'

let _jwks = null
function getJwks() {
  if (!_jwks) {
    _jwks = createRemoteJWKSet(
      new URL(`${process.env.NEON_AUTH_BASE_URL}/.well-known/jwks.json`),
    )
  }
  return _jwks
}

export async function verifySession(authHeader) {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null
  const baseUrl = process.env.NEON_AUTH_BASE_URL
  if (!baseUrl) return null
  try {
    const { payload } = await jwtVerify(token, getJwks(), {
      issuer: new URL(baseUrl).origin,
    })
    if (!payload?.sub) return null
    return { id: payload.sub, email: payload.email, name: payload.name }
  } catch {
    return null
  }
}
```

```js
// lib/api/_db.js
import { neon } from '@neondatabase/serverless'
export function getDb() {
  return neon(process.env.NEON_DATABASE_URL || process.env.DATABASE_URL)
}
```

```js
// pages/api/me.js  — example protected route (classic req,res handler)
import { getDb } from '../../lib/api/_db.js'
import { verifySession } from '../../lib/api/_auth.js'

export default async function handler(req, res) {
  const authUser = await verifySession(req.headers.authorization)
  if (!authUser) return res.status(401).json({ error: 'Unauthorized' })
  const sql = getDb()
  const rows = await sql`SELECT role FROM users WHERE id = ${authUser.id}`
  if (!rows.length) return res.status(404).json({ error: 'not_provisioned' })
  return res.status(200).json({ role: rows[0].role })
}
```

> **Why `pages/api` for data routes:** they keep the classic `(req,res)` signature, so porting/writing them is trivial. The `app/api/auth` handler must be App Router (`{ GET, POST }`). Mixing `app/` + `pages/api/` in one Next project is fully supported. Browser calls send the JWT as `Authorization: Bearer ${await getAuthToken()}`.

---

## 5. The race guards (the bugs that cost the most time)

If you gate routes on a client auth context, the guard can evaluate **before** auth settles and wrongly redirect to `/login`. Two patterns prevent it:

```jsx
// AuthContext: start roleLoading TRUE.
// When useSession resolves a session, isPending flips false one render BEFORE
// the effect that fetches the user runs. If loading were false in that gap with
// user still null, the guard redirects to /login. Starting true closes the gap.
const [roleLoading, setRoleLoading] = useState(true)   // NOT false
// ...
const loading = isPending || roleLoading
```

```jsx
// Login: navigate from an EFFECT once user is set — not optimistically after signIn.
// signIn sets the session, but useSession + /api/me haven't propagated yet, so an
// immediate navigate hits the guard with user=null and bounces back — which makes
// the FIRST sign-in attempt fail and only the second work.
useEffect(() => {
  if (!loading && user) navigate('/watch', { replace: true })
}, [user, loading, navigate])

async function handleSubmit(e) {
  e.preventDefault()
  const result = await authClient.signIn.email({ email, password })
  if (result?.error) { setError(result.error.message); setSubmitting(false); return }
  // success: do NOT navigate here — let the effect above do it once user resolves
}
```

---

## 6. Vercel + Neon setup checklist

- [ ] **Framework Preset = Next.js** (Project → Settings → Build & Deployment). If the project was ever Vite, this stays pinned to Vite and builds fail looking for `dist/` — switch it and turn OFF the Build Command / Output Directory overrides.
- [ ] Set `NEON_DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET` for **Production AND Preview**. A missing `NEON_DATABASE_URL` on Preview makes data routes 500 and breaks login on preview deploys.
- [ ] Generate the cookie secret: `openssl rand -base64 32` (same value across environments).
- [ ] **Neon Auth trusted origins:** add your production domain. Each *ephemeral* preview deploy gets a unique URL (`<project>-<hash>-<team>.vercel.app`) — add the specific one to `trusted_origins` when you need to sign in on it (CSRF/origin check rejects untrusted origins).
- [ ] `.gitignore`: `node_modules`, `.next`, `next-env.d.ts`, `.env`.

---

## 7. Gotchas cheat-sheet

| Symptom | Cause | Fix |
|---|---|---|
| Logged out on every refresh | Third-party cookie (auth not same-origin) | Use the `createNeonAuth` handler same-origin (this whole doc) |
| Build fails: "No Output Directory named 'dist'" | Vercel preset still Vite | Set Framework Preset = Next.js; clear overrides |
| `/api/*` 500 "No database connection string" on preview | Env var not scoped to Preview | Enable the var for Preview |
| `/api/me` 401 "Invalid Compact JWS" | SDK returned opaque session token, not a JWT | `getAuthToken()` fetches `/api/auth/token` (§3) |
| First sign-in fails, second works | Navigated before auth settled | Login effect-based navigation (§5) |
| Refresh bounces to /login despite valid session | Guard evaluated before user resolved | `roleLoading = true` initial (§5) |
| `_db`/`_auth` exposed as `/api/_db` | `_`-files under `pages/api` ARE routes in Next 16 | Put shared helpers in `lib/`, not `pages/api/` |
| Sign-in 403 / CSRF on a preview URL | Preview origin not trusted | Add it to Neon `trusted_origins` |

---

## Appendix — porting an existing Vite SPA (instead of rebuilding in Next)

You can keep an existing React Router (`HashRouter`) SPA verbatim and just wrap it:

```jsx
// app/layout.jsx
import '../src/styles/global.css'
export const metadata = { title: 'My App' }
export default function RootLayout({ children }) {
  return (<html lang="en"><body>{children}</body></html>)
}
```

```jsx
// app/page.jsx — client shell, SSR disabled (the SPA is browser-only)
'use client'
import dynamic from 'next/dynamic'
const App = dynamic(() => import('../src/App.jsx'), { ssr: false })
export default function Page() { return <App /> }
```

```js
// next.config.js — serve the SPA shell for non-API deep links / hard refresh
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [{ source: '/((?!api|_next|favicon.ico).*)', destination: '/' }]
  },
}
export default nextConfig
```

Then move your old `api/*` functions to `pages/api/*` verbatim, move shared `_`-helpers to `lib/api/`, delete `index.html` / `src/main.jsx` / `vite.config.js`, and drop Vite from `package.json`. (For a brand-new project, skip the appendix and just build natively in the App Router.)
```
