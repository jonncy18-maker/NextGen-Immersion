import { neon } from "@neondatabase/serverless"

export function getDb() {
  return neon(process.env.NEON_DATABASE_URL)
}

export function getAdminDb() {
  return neon(process.env.NEON_DATABASE_URL_ADMIN)
}
