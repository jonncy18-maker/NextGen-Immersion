import { createAuthClient } from "@neondatabase/neon-js/auth"
import { BetterAuthReactAdapter } from "@neondatabase/neon-js/auth/react/adapters"

// Auth runs through the app's OWN origin via the serverless proxy at
// /api/neon-auth (see api/neon-auth/[...path].js). The proxy forwards requests
// to the Neon Auth server and rewrites Set-Cookie to be first-party on the app
// domain, so the browser keeps the session cookie across refreshes. Talking to
// the Neon Auth domain directly gets the cookie blocked as a third-party
// cookie — the session is then lost on every reload.
const authBaseUrl =
  typeof window !== "undefined"
    ? `${window.location.origin}/api/neon-auth`
    : "/api/neon-auth"

export const authClient = createAuthClient(authBaseUrl, {
  adapter: BetterAuthReactAdapter(),
})
