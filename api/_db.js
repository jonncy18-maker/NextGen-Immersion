import { neon } from "@neondatabase/serverless"

export function getDb() {
  return neon(process.env.NEON_DATABASE_URL)
}
