import AddVideoPanel from '../components/admin/AddVideoPanel.jsx'

export default function AdminVideos() {
  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.title}>Video Library</h1>
        <p style={styles.sub}>
          Search YouTube to find content for the library. Music videos are excluded automatically.
          Each result is AI-tagged with level and topic before you add it.
        </p>
        <AddVideoPanel />
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
    maxWidth: 800,
    margin: '0 auto',
    padding: 24,
  },
  title: {
    margin: '0 0 6px',
    fontSize: 22,
    fontWeight: 700,
    color: 'var(--ngsi-navy)',
  },
  sub: {
    margin: '0 0 20px',
    fontSize: 13,
    color: '#5a6070',
    lineHeight: 1.5,
  },
}
