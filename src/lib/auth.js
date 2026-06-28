import { createAuthClient } from "better-auth/react"
import { jwtClient } from "better-auth/client/plugins"

// Neon Auth is Better Auth under the hood. The jwtClient plugin adds
// authClient.token(), which mints a short-lived JWT for backend /api/* calls.
// (Neon Auth sessions are cookies; backend functions verify the JWT via JWKS.)
export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_NEON_AUTH_URL,
  plugins: [jwtClient()],
})
