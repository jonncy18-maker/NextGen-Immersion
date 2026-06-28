import { createAuthClient } from "@neondatabase/neon-js/auth"
import { BetterAuthReactAdapter } from "@neondatabase/neon-js/auth/react/adapters"

// Talk to the Neon Auth (Better Auth) server directly at VITE_NEON_AUTH_URL.
//
// We previously tried routing auth through a same-origin serverless proxy
// (/api/neon-auth) to make the session cookie first-party, but that broke login
// entirely: Vercel's catch-all only matched single-segment subpaths, so the
// two-segment POST /sign-in/email never reached the proxy (HTTP 404), and the
// upstream path the proxy forwarded to 404'd on Neon as well. The direct config
// below is the one that actually logs in (verified in production).
//
// Neon's official SDK (Better Auth under the hood) with the React adapter caches
// the session in localStorage and syncs across tabs, so the session survives a
// page refresh without depending on the cross-domain session cookie. The app's
// own /api/* calls are authorized with a short-lived JWT (see authToken.js), not
// the cookie. Neon Auth trusts the app origin (trusted_origins), so the direct
// cross-origin sign-in / get-session requests are allowed.
export const authClient = createAuthClient(import.meta.env.VITE_NEON_AUTH_URL, {
  adapter: BetterAuthReactAdapter(),
})
