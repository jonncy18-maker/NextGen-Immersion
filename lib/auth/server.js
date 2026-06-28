import { createNeonAuth } from '@neondatabase/auth/next/server'

// Neon Auth same-origin handler. This proxies auth requests to the Neon Auth
// service (NEON_AUTH_BASE_URL) and issues a signed, first-party session cookie
// on the app's own origin so sessions persist across refreshes.
//
// Required Vercel environment variables (server-side, NOT VITE_-prefixed):
//   NEON_AUTH_BASE_URL       — the Neon Auth server URL (same value already used
//                              by api/_auth.js for JWKS verification)
//   NEON_AUTH_COOKIE_SECRET  — 32+ char secret for signing the session cookie
//                              (generate: openssl rand -base64 32)
//
// The placeholders below exist ONLY so `next build` succeeds in environments
// where the env vars are absent (e.g. local CI). At runtime on Vercel the real
// values must be set — the placeholder secret must never be used in production.
const baseUrl = process.env.NEON_AUTH_BASE_URL || 'https://placeholder.invalid'
const cookieSecret =
  process.env.NEON_AUTH_COOKIE_SECRET ||
  'build-time-placeholder-secret-set-the-real-one-in-vercel'

export const auth = createNeonAuth({
  baseUrl,
  cookies: {
    secret: cookieSecret,
    // First-party cookie on the app origin. 'lax' keeps it on top-level
    // navigations/refreshes (the case we care about) while staying safe.
    sameSite: 'lax',
  },
})
