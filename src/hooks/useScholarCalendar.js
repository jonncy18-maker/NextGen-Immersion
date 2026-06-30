import { useState, useEffect } from 'react'
import { getAuthToken } from '../lib/authToken.js'

export function useScholarCalendar(userId) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!userId) {
      setData(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    setData(null)

    getAuthToken()
      .then(token =>
        fetch(`/api/scholar-calendar?userId=${userId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
      )
      .then(res => {
        if (!res.ok) throw new Error(`${res.status}`)
        return res.json()
      })
      .then(json => {
        if (!cancelled) setData(json)
      })
      .catch(e => {
        if (!cancelled) setError(e.message || 'Failed')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [userId])

  return { data, loading, error }
}
