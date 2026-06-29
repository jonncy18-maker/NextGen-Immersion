import { useState, useEffect, useCallback } from 'react'
import { getAuthToken } from '../lib/authToken.js'

// Admin-only: fetches every scholar's pace summary from /api/scholars
// (service-role cross-scholar read). Returns an array of scholar_pace rows.
export function useScholars() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchScholars = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const token = await getAuthToken()
      const res = await fetch('/api/scholars', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(Array.isArray(json) ? json : [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchScholars()
  }, [fetchScholars])

  return { data, loading, error, refetch: fetchScholars }
}
