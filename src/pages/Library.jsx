import { useNavigate } from 'react-router-dom'
import { useWatchLater } from '../hooks/useWatchLater.js'
import VideoGrid from '../components/video/VideoGrid.jsx'
import VideoGridSkeleton from '../components/video/VideoGridSkeleton.jsx'
import EmptyState from '../components/video/EmptyState.jsx'

export default function Library() {
  const navigate = useNavigate()
  const { items, loading, error, remove } = useWatchLater()

  const handleSelect = video => {
    navigate(`/watch?videoId=${video.id}`)
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>My Library</h1>
          {!loading && items.length > 0 && (
            <span style={styles.countChip}>{items.length} saved</span>
          )}
        </div>

        {error ? (
          <p style={styles.hint}>{error}</p>
        ) : loading ? (
          <VideoGridSkeleton />
        ) : items.length === 0 ? (
          <EmptyState
            icon="🔖"
            title="No saved videos yet"
            message="Hit '+ Watch Later' below any video to save it here."
          />
        ) : (
          <VideoGrid videos={items} onSelect={handleSelect} onRemove={v => remove(v.id)} />
        )}
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: 'calc(100vh - 56px)',
    background: 'var(--ngsi-cream)',
  },
  container: {
    maxWidth: 1280,
    margin: '0 auto',
    padding: 16,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  title: {
    margin: 0,
    fontSize: 20,
    fontWeight: 700,
    color: 'var(--ngsi-navy)',
  },
  countChip: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--ngsi-navy)',
    background: 'var(--ngsi-cream-dark)',
    padding: '3px 10px',
    borderRadius: 999,
  },
  hint: {
    fontSize: 14,
    color: '#8a8f99',
  },
}
