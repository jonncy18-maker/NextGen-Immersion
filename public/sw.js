// Static, hand-rolled service worker (no build step, no dependency).
// See docs/PWA.md "Minimal hand-rolled (no dependency) alternative".
//
// Scope: app-shell + static-asset caching only.
//   - /api/** and /api/auth/** are NEVER intercepted — requests to those
//     paths are not even passed to respondWith(), so they always hit the
//     network untouched. This protects the sendBeacon-based hours-flush
//     path (src/utils/offlineBuffer.js -> /api/flush-session) and the
//     first-party auth session cookie.
//   - Static assets (icons, /_next/static/*): cache-first.
//   - App shell (everything else, same-origin GET): stale-while-revalidate,
//     so the SPA opens offline.
//   - Only GET requests are ever intercepted; POST/PUT/etc. always go
//     straight to the network.
//
// Bump CACHE_VERSION on any change to the caching strategy or precache list
// so `activate` cleans up the old cache and stale JS/CSS can't get pinned
// after a deploy (see docs/PWA.md "Gotchas — SW caching stale JS").
const CACHE_VERSION = 'v1'
const SHELL_CACHE = `ngsi-shell-${CACHE_VERSION}`
const STATIC_CACHE = `ngsi-static-${CACHE_VERSION}`
const CURRENT_CACHES = [SHELL_CACHE, STATIC_CACHE]

const PRECACHE_URLS = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !CURRENT_CACHES.includes(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  )
})

function isApiPath(pathname) {
  return pathname.startsWith('/api/')
}

function isStaticAsset(pathname) {
  return (
    pathname.startsWith('/_next/static/') ||
    pathname.startsWith('/icons/') ||
    /\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff|woff2|ttf|otf|eot)$/i.test(pathname)
  )
}

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Never intercept non-GET requests (POST /api/flush-session via
  // sendBeacon, auth POSTs, etc. must always go straight to the network).
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Only handle same-origin requests.
  if (url.origin !== self.location.origin) return

  // /api/** and /api/auth/** are network-only — do not even call
  // respondWith(), let the browser handle it as if there were no SW.
  if (isApiPath(url.pathname)) return

  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request))
    return
  }

  event.respondWith(staleWhileRevalidate(request))
})

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE)
  const cached = await cache.match(request)
  if (cached) return cached

  try {
    const response = await fetch(request)
    if (response && response.ok) {
      cache.put(request, response.clone())
    }
    return response
  } catch (err) {
    if (cached) return cached
    throw err
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL_CACHE)
  const cached = await cache.match(request)

  const networkFetch = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone())
      }
      return response
    })
    .catch(() => undefined)

  return cached || (await networkFetch) || Response.error()
}
