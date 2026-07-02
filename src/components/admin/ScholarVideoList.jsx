import { useState, useMemo } from 'react'
import { useScholarVideos } from '../../hooks/useScholarVideos.js'
import FilterBar from '../video/FilterBar.jsx'
import VideoGrid from '../video/VideoGrid.jsx'

const DEFAULT_FILTERS = { topics: [], level: null, watchedFilter: 'all' }

function openOnYouTube(video) {
  window.open(`https://www.youtube.com/watch?v=${video.youtube_id}`, '_blank', 'noopener,noreferrer')
}

export default function ScholarVideoList({ userId }) {
  const { data, loading, error } = useScholarVideos(userId)
  const [filters, setFilters] = useState(DEFAULT_FILTERS)

  const videos = data?.videos ?? []

  const filtered = useMemo(() => {
    return videos.filter(v => {
      if (filters.watchedFilter === 'watched' && !v.watched) return false
      if (filters.watchedFilter === 'unwatched' && v.watched) return false
      if (filters.level && v.level !== filters.level) return false
      if (filters.topics.length > 0) {
        const videoTopics = [v.topic_primary, v.topic_secondary].filter(Boolean)
        if (!filters.topics.some(t => videoTopics.includes(t))) return false
      }
      return true
    })
  }, [videos, filters])

  const watchedCount = videos.filter(v => v.watched).length

  if (loading) {
    return <div style={styles.center}><p style={styles.centerText}>Loading videos…</p></div>
  }

  if (error) {
    return <div style={styles.center}><p style={styles.centerText}>Couldn&apos;t load this scholar&apos;s videos.</p></div>
  }

  return (
    <div>
      <p style={styles.summary}>
        {watchedCount} of {videos.length} library videos watched
      </p>
      <FilterBar filters={filters} onChange={setFilters} />
      <VideoGrid videos={filtered} onSelect={openOnYouTube} />
    </div>
  )
}

const styles = {
  summary: {
    margin: '0 0 12px',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--ngsi-navy)',
  },
  center: {
    display: 'flex',
    justifyContent: 'center',
    padding: '48px 0',
  },
  centerText: { color: '#8a8f99', fontSize: 14, margin: 0 },
}
