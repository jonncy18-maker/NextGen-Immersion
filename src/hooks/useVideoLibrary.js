import { useState, useEffect, useCallback } from 'react'
import { getAuthToken } from '../lib/authToken.js'

async function fetchVideos() {
  const token = await getAuthToken()
  const res = await fetch('/api/videos', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to load videos')
  const data = await res.json()
  return data.videos
}

// Shared video-library fetch used by both Watch.jsx (player + full filtered
// grid) and Home.jsx (recommended / recently-added rows + topic counts) so
// there is a single source of truth for "the scholar's video list" instead of
// two divergent fetches against /api/videos.
export function useVideoLibrary() {
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchVideos()
      .then(vs => setVideos(vs))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return { videos, setVideos, loading, error }
}
