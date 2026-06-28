import { createAuthClient } from "@neondatabase/neon-js/auth"
import { BetterAuthReactAdapter } from "@neondatabase/neon-js/auth/react/adapters"

// ─── Cross-domain session persistence (bearer-token pattern) ──────────────────
//
// The app lives on *.vercel.app; Neon Auth lives on *.neon.tech. The Better Auth
// session is an HTTP-only cookie on the neon.tech domain — a third-party cookie
// from the app's perspective — which modern browsers block. So on every cold
// load `useSession()`'s GET /get-session had no credential to send and resolved
// to null, bouncing the user to /login on refresh.
//
// Fix: Better Auth's documented cross-domain pattern. On a successful auth
// response the server returns the session token in the `set-auth-token` header;
// we persist it in localStorage and replay it as `Authorization: Bearer <token>`
// on every subsequent auth request (get-session, token, …). This makes the
// session independent of the third-party cookie, so it survives a refresh.
//
// This is additive and cannot regress login: on first sign-in localStorage is
// empty, so the token callback returns undefined and no Authorization header is
// sent — exactly the prior cookie-based flow. We previously tried a same-origin
// proxy here, which broke login twice (do NOT reintroduce it); this approach
// touches only the client fetch config, not the request routing.
const SESSION_TOKEN_KEY = "ngsi.session_token"

export function getStoredSessionToken() {
  try {
    return localStorage.getItem(SESSION_TOKEN_KEY) || undefined
  } catch {
    return undefined
  }
}

function storeSessionToken(token) {
  try {
    if (token) localStorage.setItem(SESSION_TOKEN_KEY, token)
  } catch {
    /* localStorage unavailable — fall back to cookie-only behavior */
  }
}

export function clearStoredSessionToken() {
  try {
    localStorage.removeItem(SESSION_TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

export const authClient = createAuthClient(import.meta.env.VITE_NEON_AUTH_URL, {
  adapter: BetterAuthReactAdapter(),
  fetchOptions: {
    // Replay the stored session token as a Bearer credential. Returns undefined
    // when nothing is stored, so no header is added (no-op before first login).
    auth: {
      type: "Bearer",
      token: () => getStoredSessionToken(),
    },
    // Capture the long-lived session token whenever the auth server issues one.
    // Chained after the neon adapter's own onSuccess (which reads set-auth-jwt).
    onSuccess: (ctx) => {
      const token = ctx?.response?.headers?.get("set-auth-token")
      if (token) storeSessionToken(token)
    },
  },
})
