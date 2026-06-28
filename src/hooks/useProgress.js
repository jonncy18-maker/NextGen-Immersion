import { useState, useEffect, useCallback } from 'react'
import { authClient } from '../lib/auth.js'

export function useProgress() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchProgress = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const session = await authClient.getSession()
      const token = session?.data?.session?.token
      const res = await fetch('/api/progress', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProgress()
  }, [fetchProgress])

  return { data, loading, error, refetch: fetchProgress }
}
