import { createAuthClient } from "@neondatabase/neon-js/auth"
import { BetterAuthReactAdapter } from "@neondatabase/neon-js/auth/react/adapters"

// ─── Cross-domain session persistence (bearer-token via fetch interception) ───
//
// The app lives on *.vercel.app; Neon Auth lives on *.neon.tech. The Better Auth
// session is an HTTP-only cookie on the neon.tech domain — a third-party cookie
// from the app's perspective — which modern browsers block. So on every cold
// load `useSession()`'s GET /get-session had no credential to send and resolved
// to null, bouncing the user to /login on a refresh.
//
// Fix: Better Auth's documented cross-domain pattern. On a successful auth
// response the server returns the session token in the `set-auth-token` header;
// we persist it and replay it as `Authorization: Bearer` on /get-session so the
// session no longer depends on the blocked cookie.
//
// We do this by wrapping window.fetch rather than via the client's fetchOptions:
// passing fetchOptions.onSuccess into the neon-js client overrode the adapter's
// own onSuccess (which injects the JWT into the session) and broke sign-in.
// Intercepting fetch keeps the adapter's hooks untouched, so login is unaffected.
//
// This is safe in every case:
//   - If Neon's auth server does NOT support bearer tokens, it never sends
//     `set-auth-token`, so nothing is stored and no Authorization header is ever
//     added — identical to the prior cookie-only behavior (no-op).
//   - The Bearer header is only added to /get-session and /token (never to
//     sign-in/sign-up), and only when a token is already stored.
//
// Do NOT reintroduce the same-origin proxy (broke login in #22-#24).
const SESSION_TOKEN_KEY = "ngsi.session_token"
const AUTH_BASE = import.meta.env.VITE_NEON_AUTH_URL

export function getStoredSessionToken() {
  try {
    return localStorage.getItem(SESSION_TOKEN_KEY) || null
  } catch {
    return null
  }
}

export function clearStoredSessionToken() {
  try {
    localStorage.removeItem(SESSION_TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

if (
  typeof window !== "undefined" &&
  AUTH_BASE &&
  !window.__ngsiAuthFetchPatched
) {
  window.__ngsiAuthFetchPatched = true
  const origFetch = window.fetch.bind(window)
  const isAuthUrl = (u) => typeof u === "string" && u.startsWith(AUTH_BASE)
  // Replay the bearer token only on session-read endpoints, never on sign-in.
  const isReplayUrl = (u) => /\/(get-session|token)(\?|$)/.test(u)

  window.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input?.url

    let nextInit = init
    if (isAuthUrl(url) && isReplayUrl(url)) {
      const stored = getStoredSessionToken()
      if (stored) {
        const headers = new Headers(init.headers || undefined)
        if (!headers.has("authorization")) {
          headers.set("authorization", `Bearer ${stored}`)
        }
        nextInit = { ...init, headers }
      }
    }

    const res = await origFetch(input, nextInit)

    // Capture/refresh the session token whenever the auth server issues one.
    if (isAuthUrl(url)) {
      const token = res.headers.get("set-auth-token")
      if (token) {
        try {
          localStorage.setItem(SESSION_TOKEN_KEY, token)
        } catch {
          /* ignore */
        }
      }
    }

    return res
  }
}

export const authClient = createAuthClient(import.meta.env.VITE_NEON_AUTH_URL, {
  adapter: BetterAuthReactAdapter(),
})
