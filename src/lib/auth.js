import { createAuthClient } from "@neondatabase/neon-js/auth"
import { BetterAuthReactAdapter } from "@neondatabase/neon-js/auth/react/adapters"

// Auth runs through the app's OWN origin (/neon-auth/* is proxied to the Neon
// Auth server by a vercel.json rewrite). This makes the session cookie
// first-party on the app domain, so the browser keeps it across refreshes.
// Talking to the Neon Auth domain directly gets the cookie blocked as a
// third-party cookie — the session is then lost on every reload.
const authBaseUrl =
  typeof window !== "undefined"
    ? `${window.location.origin}/neon-auth`
    : "/neon-auth"

export const authClient = createAuthClient(authBaseUrl, {
  adapter: BetterAuthReactAdapter(),
})
