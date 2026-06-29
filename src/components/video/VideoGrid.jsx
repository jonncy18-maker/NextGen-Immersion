import VideoCard from './VideoCard.jsx'

export default function VideoGrid({ videos, onSelect, selectedId, onMark }) {
  if (!videos || videos.length === 0) {
    return <div style={styles.empty}>No videos match these filters.</div>
  }

  return (
    <div style={styles.grid}>
      {videos.map(v => (
        <VideoCard
          key={v.id}
          video={v}
          onSelect={onSelect}
          active={v.id === selectedId}
          onMark={onMark}
        />
      ))}
    </div>
  )
}

const styles = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 16,
  },
  empty: {
    padding: '40px 16px',
    textAlign: 'center',
    color: '#8a8f99',
    fontSize: 14,
  },
}
