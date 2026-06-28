import { createAuthClient } from "@neondatabase/neon-js/auth"
import { BetterAuthReactAdapter } from "@neondatabase/neon-js/auth/react/adapters"

// Neon's official SDK (Better Auth under the hood) with the React adapter.
// Unlike the raw better-auth/react client, it caches the session in
// localStorage and syncs across tabs — so the session survives a page refresh
// without relying on the cross-domain (third-party) session cookie, which
// browsers block. The adapter enables React hooks like useSession().
export const authClient = createAuthClient(import.meta.env.VITE_NEON_AUTH_URL, {
  adapter: BetterAuthReactAdapter(),
})
