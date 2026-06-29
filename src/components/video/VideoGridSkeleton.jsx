// Shimmer placeholders shown while the video library loads. Mirrors VideoGrid's
// grid + VideoCard's shape so the layout doesn't jump when real cards arrive.
export default function VideoGridSkeleton({ count = 8 }) {
  return (
    <div style={styles.grid} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={styles.card}>
          <div className="ngsi-skeleton" style={styles.thumb} />
          <div style={styles.body}>
            <div className="ngsi-skeleton" style={styles.lineWide} />
            <div className="ngsi-skeleton" style={styles.lineNarrow} />
            <div style={styles.chips}>
              <div className="ngsi-skeleton" style={styles.chip} />
              <div className="ngsi-skeleton" style={styles.chip} />
            </div>
          </div>
        </div>
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
  card: {
    display: 'flex',
    flexDirection: 'column',
    background: '#fff',
    border: '1px solid var(--ngsi-cream-dark)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  thumb: {
    width: '100%',
    aspectRatio: '16 / 9',
    borderRadius: 0,
  },
  body: {
    padding: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  lineWide: { height: 12, width: '90%' },
  lineNarrow: { height: 10, width: '55%' },
  chips: { display: 'flex', gap: 6, marginTop: 2 },
  chip: { height: 16, width: 54, borderRadius: 999 },
}
