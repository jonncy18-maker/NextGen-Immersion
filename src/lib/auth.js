import { createAuthClient } from '@neondatabase/auth/next'

// Same-origin auth client (Next.js model).
//
// The app now runs on Next.js and hosts Neon Auth's official same-origin proxy
// at /api/auth/* (see lib/auth/server.js + app/api/auth/[...path]/route.js). The
// proxy signs a FIRST-PARTY session cookie on the app's own origin, so the
// session survives a page refresh — fixing the cross-site third-party-cookie
// problem of the previous browser-direct-to-neon.tech SPA model.
//
// createAuthClient() takes no URL: it talks to the app's own /api/auth proxy.
// The returned client uses the React adapter under the hood and exposes the same
// surface the app already relies on (useSession, getSession, signIn, signOut,
// token), so AuthContext / Login / authToken.js need no changes.
export const authClient = createAuthClient()
