import { neon } from "@neondatabase/serverless"

// Vercel+Neon integration auto-creates DATABASE_URL; NEON_DATABASE_URL is the manual override
export function getDb() {
  return neon(process.env.NEON_DATABASE_URL || process.env.DATABASE_URL)
}

export function getAdminDb() {
  return neon(process.env.NEON_DATABASE_URL_ADMIN || process.env.NEON_DATABASE_URL || process.env.DATABASE_URL)
}
