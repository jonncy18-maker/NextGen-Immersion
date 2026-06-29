import { auth } from '../../../../lib/auth/server.js'

// Catch-all Neon Auth proxy route: handles /api/auth/* (sign-in, sign-out,
// get-session, token, …) on the app's own origin so the session cookie is
// first-party.
export const dynamic = 'force-dynamic'

export const { GET, POST } = auth.handler()
