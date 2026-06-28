// Same-origin proxy to the Neon Auth server.
//
// The browser talks only to this app's origin (/api/neon-auth/*), and this
// function forwards to the Neon Auth server. The crucial part: we rewrite the
// upstream Set-Cookie headers to strip the Domain attribute, so the session
// cookie is stored FIRST-PARTY on the app's own domain. A direct cross-domain
// request gets the cookie blocked as a third-party cookie, losing the session
// on every refresh.
//
// NEON_AUTH_BASE_URL is the Neon Auth base, e.g.
//   https://ep-xxx.neonauth.<region>.aws.neon.tech/neondb/auth

const HOP_BY_HOP = new Set([
  'host',
  'connection',
  'content-length',
  'transfer-encoding',
  'keep-alive',
])

// Headers injected by Vercel's edge that MUST NOT reach the upstream Neon Auth
// server. Neon's hosted Better Auth runs behind its own trusted proxy, so it
// derives its own origin/base URL from x-forwarded-host / x-forwarded-proto.
// If we forward Vercel's values (e.g. x-forwarded-host: <app>.vercel.app),
// Better Auth resolves the WRONG origin and rejects the request — sign-in and
// get-session come back 4xx. Stripping these lets the upstream see a clean
// request and use its own configured host (the JWT issuer stays correct too).
const STRIP_FORWARDING = (key) =>
  key === 'forwarded' ||
  key === 'x-real-ip' ||
  key.startsWith('x-forwarded-') ||
  key.startsWith('x-vercel-')

export default async function handler(req, res) {
  const base = process.env.NEON_AUTH_BASE_URL
  if (!base) {
    return res.status(500).json({ error: 'NEON_AUTH_BASE_URL not set' })
  }

  // Reconstruct the sub-path + query from the catch-all route.
  const parts = req.query.path
  const subPath = Array.isArray(parts) ? parts.join('/') : parts || ''
  const qIndex = req.url.indexOf('?')
  const queryString = qIndex >= 0 ? req.url.slice(qIndex) : ''
  const target = `${base}/${subPath}${queryString}`

  // Forward request headers (minus hop-by-hop + host).
  const headers = {}
  for (const [key, value] of Object.entries(req.headers)) {
    const lk = key.toLowerCase()
    if (HOP_BY_HOP.has(lk)) continue
    if (STRIP_FORWARDING(lk)) continue
    headers[key] = Array.isArray(value) ? value.join(', ') : value
  }

  // Body: Better Auth uses JSON. Vercel parses application/json into req.body,
  // so re-serialize it for the upstream request.
  let body
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.body != null) {
    body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
  }

  let upstream
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body,
      redirect: 'manual',
    })
  } catch (err) {
    console.error('neon-auth proxy fetch failed:', err?.message)
    return res.status(502).json({ error: 'Auth upstream unreachable' })
  }

  // Relay status.
  res.status(upstream.status)

  // Relay headers, except Set-Cookie (handled below) and encoding/length
  // headers that no longer apply after the body is buffered.
  upstream.headers.forEach((value, key) => {
    const lk = key.toLowerCase()
    if (lk === 'set-cookie') return
    if (HOP_BY_HOP.has(lk)) return
    if (lk === 'content-encoding') return
    res.setHeader(key, value)
  })

  // Rewrite Set-Cookie: drop the Domain attribute so the cookie is stored
  // host-only on THIS origin (first-party). undici exposes getSetCookie().
  const setCookies =
    typeof upstream.headers.getSetCookie === 'function'
      ? upstream.headers.getSetCookie()
      : []
  if (setCookies.length) {
    const rewritten = setCookies.map(c => c.replace(/;\s*Domain=[^;]*/gi, ''))
    res.setHeader('Set-Cookie', rewritten)
  }

  const buf = Buffer.from(await upstream.arrayBuffer())
  res.send(buf)
}
