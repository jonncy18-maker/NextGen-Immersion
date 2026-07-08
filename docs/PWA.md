# PWA Foundation — Installable App Groundwork

**Status: PLANNED (not yet built).** This is the runbook for turning the app
into an installable Progressive Web App. Everything here is forward-looking —
no manifest, service worker, or icons exist in the repo yet. Do not read this
as describing shipped behavior.

**Why this exists:** The Play Store native app (see `docs/PLAY-STORE.md`) is a
thin TWA wrapper around a PWA. The PWA *is* the app — the TWA just displays it
in an installable, browser-chrome-free shell. So this PWA groundwork is the
prerequisite for the Play Store work, and is also independently useful (real
home-screen install, offline, push) even if the Play Store step is paused.

This app is the **pilot** for the native rollout across the three NGS repos.
Prove the pipeline here, then replicate the equivalent `docs/PWA.md` in
NextGen-Scholars and AI-Capital-Planning.

---

## What "PWA-ready" means (the acceptance bar)

The app passes Chrome DevTools → Lighthouse → "Installable" with no errors,
and Chrome/Android offers "Add to Home Screen" / "Install app". Concretely
that requires all of:

1. A **web app manifest** served with the correct MIME type, linked from the
   document head, with `name`, `short_name`, `start_url`, `display`,
   `theme_color`, `background_color`, and at minimum 192px + 512px icons
   (plus a 512px `maskable` icon for a non-letterboxed Android icon).
2. A **service worker** registered at a scope covering the whole app, that
   controls the page (needed for installability + offline).
3. Served over **HTTPS** (Vercel already does this).
4. A **viewport meta** tag (Next's default metadata covers this).

---

## This app's specifics (read before writing code)

- **Framework:** Next.js 16 App Router, but the UI is a client SPA rendered
  via `next/dynamic(..., { ssr:false })` in `app/page.jsx`, routed by
  **HashRouter** (routes live in the URL hash). Implication: `start_url` is
  `"/"` — the shell — and the hash route resolves client-side after load. Do
  **not** set `start_url` to a hash path; keep it `/` (optionally
  `"/?source=pwa"` for install-attribution analytics later).
- **`next.config.js` rewrites** every non-`api`/`_next` path to `/`. The
  service worker file and `manifest` must be reachable and **must not** be
  swallowed by that rewrite — verify `/manifest.webmanifest` and the SW URL
  resolve to the real files, not the SPA shell. If using `app/manifest.js`
  (the Next metadata route) it's served under `/manifest.webmanifest` and is
  excluded as a `_next`-adjacent metadata route; confirm this after wiring.
- **Offline is already half-solved.** `src/utils/offlineBuffer.js` buffers
  watch-seconds in localStorage and flushes on reconnect, and flushes use
  `navigator.sendBeacon`. The service worker's job is **shell + asset
  caching** (HTML, JS, CSS, icons) so the app *opens* offline — it should NOT
  try to cache or replay `/api/flush-session` writes (the existing buffer +
  `client_flush_id` idempotency owns that path). Keep the two mechanisms
  separate; do not let the SW intercept API POSTs.
- **Auth interaction:** the SW must not cache `/api/*` or `/api/auth/*`
  responses. Session is a first-party HttpOnly cookie (Phase 14) — caching
  authed API responses would leak/stale scholar data. Use a **network-only**
  strategy for `/api/**`, cache-first only for static assets.

---

## Recommended approach: Serwist (modern next-pwa successor)

`next-pwa` is effectively unmaintained and lags Next major versions; on
Next 16 prefer **Serwist** (`@serwist/next`), the actively-maintained
successor. Alternative if you want zero dependencies: hand-roll a minimal SW
(see "Minimal hand-rolled" below) — fine for a shell-cache-only app like this.

### Steps (Serwist)

1. `npm install @serwist/next && npm install -D serwist`
2. Wrap the Next config:
   ```js
   // next.config.js
   import withSerwistInit from '@serwist/next'
   const withSerwist = withSerwistInit({
     swSrc: 'app/sw.js',
     swDest: 'public/sw.js',
     // Do NOT precache/route /api — network-only there.
   })
   // ...keep the existing rewrites() block...
   export default withSerwist(nextConfig)
   ```
3. Create `app/sw.js` — precache the build manifest + static assets; register
   a runtime `NetworkOnly` route for `/api/` and `/api/auth/`; `CacheFirst`
   for images/fonts/icons; `StaleWhileRevalidate` for the app shell.
4. Add the manifest as `app/manifest.js` (Next metadata route) OR a static
   `public/manifest.webmanifest` + `<link rel="manifest">` in
   `app/layout.jsx`. Prefer `app/manifest.js` for type-checked, single-source
   metadata.
5. Add icons to `public/icons/` (see below) and reference them in the manifest.
6. Add `themeColor` / `appleWebApp` to the layout's `metadata` export so iOS
   Safari also treats it as an app (Apple ignores the manifest's theme color).

### Manifest starter (adapt values)

```jsonc
{
  "name": "NGS Immersion",
  "short_name": "Immersion",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#162040",   // navy — matches --ngsi-* tokens
  "theme_color": "#162040",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

> `theme_color` / `background_color` use the navy `#162040` from
> `src/styles/tokens.css`. Keep them in sync with the token palette so the
> splash/status-bar matches the app.

### Minimal hand-rolled (no dependency) alternative

If you'd rather not add Serwist: put a static `public/sw.js` that on `install`
pre-caches the shell + icons and on `fetch` does cache-first for same-origin
GET requests **excluding `/api/`**, network-only otherwise; register it from a
small client component mounted in `app/layout.jsx`. Downside: you hand-maintain
the precache list (no build-manifest injection). Acceptable for a shell-only
cache; revisit Serwist if caching needs grow.

---

## Icons

Need square PNGs at 192 and 512, plus a **maskable** 512 (safe-zone padding so
Android's adaptive-icon mask doesn't crop the logo). Source from the existing
NGS gold-on-navy badge. Generate with any PWA asset generator (e.g. PWABuilder
Image Generator or `pwa-asset-generator`) and drop into `public/icons/`. Verify
the maskable icon in Chrome DevTools → Application → Manifest → "maskable"
preview (the logo must sit inside the safe circle).

---

## Verification checklist (do all before calling it done)

- [ ] `npm run build && npm run start`, open in Chrome.
- [ ] DevTools → Application → Manifest: no errors, icons render, maskable OK.
- [ ] DevTools → Application → Service Workers: registered + activated,
      controlling the page.
- [ ] Lighthouse (or DevTools → Application → "Installability"): installable,
      no PWA errors.
- [ ] "Install app" appears in Chrome's omnibox / Android menu; installed app
      launches full-screen (no URL bar) at `start_url`.
- [ ] **Offline test:** DevTools → Network → Offline, reload → the app shell
      loads (does not show the browser dino). Watch-hours buffering still works
      via the existing `offlineBuffer.js` (unchanged).
- [ ] **Auth still works inside the installed app** — sign in, refresh, confirm
      the session persists (first-party cookie). This is the single most
      important check; verify on a real Android device, not just desktop.
- [ ] `/api/*` responses are NOT served from the SW cache (Network tab shows
      them hitting the network every time).

---

## Gotchas

- **SW caching stale JS after deploy.** A too-aggressive precache can pin the
  old bundle. Serwist handles cache-busting via the build manifest; if
  hand-rolling, version the cache name and clean old caches on `activate`.
- **The `next.config.js` SPA rewrite** can accidentally route `/sw.js` or the
  manifest to the shell — always curl/inspect the actual response after wiring.
- **iOS install is second-class.** iOS supports Add-to-Home-Screen PWAs but
  ignores the manifest's `theme_color`/push in older versions; use the
  `appleWebApp` metadata. Not our priority (scholars are on Android), but don't
  assume iOS behaves like Android.
- **Push notifications are a separate, later effort** — they need a push
  service + permission UX + a backend to send them. Not required for
  installability; deferred (see `docs/PLAY-STORE.md` → Future).

---

## Next step after this

Once the PWA passes the checklist here, proceed to `docs/PLAY-STORE.md` to wrap
it as a TWA and distribute via the Play Internal Testing track.
