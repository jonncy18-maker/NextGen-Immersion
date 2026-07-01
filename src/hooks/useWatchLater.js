import { useState, useEffect, useCallback } from 'react'
import { getAuthToken } from '../lib/authToken.js'

// Scholar's personal Watch Later queue. add/remove update local state
// optimistically (instant UI feedback) and revert on API failure.
export function useWatchLater() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const token = await getAuthToken()
      const res = await fetch('/api/watch-later', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setItems(json.items || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const isAdded = useCallback(
    videoId => items.some(i => i.id === videoId),
    [items],
  )

  const add = useCallback(async video => {
    setItems(prev => (prev.some(i => i.id === video.id) ? prev : [
      { ...video, added_at: new Date().toISOString() },
      ...prev,
    ]))
    try {
      const token = await getAuthToken()
      const res = await fetch('/api/watch-later', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ videoId: video.id }),
      })
      if (!res.ok) throw new Error('Failed to save video')
    } catch {
      setItems(prev => prev.filter(i => i.id !== video.id))
    }
  }, [])

  const remove = useCallback(async videoId => {
    const previous = items
    setItems(prev => prev.filter(i => i.id !== videoId))
    try {
      const token = await getAuthToken()
      const res = await fetch('/api/watch-later', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ videoId }),
      })
      if (!res.ok) throw new Error('Failed to remove video')
    } catch {
      setItems(previous)
    }
  }, [items])

  return { items, loading, error, isAdded, add, remove, refetch: fetchItems }
}
