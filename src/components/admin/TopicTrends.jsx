import { useScholarTopicTrends } from '../../hooks/useScholarTopicTrends.js'
import { getTopicColor } from '../../utils/topics.js'
import AiInsightCard from './AiInsightCard.jsx'

function TopicRow({ topic, watchedCount, totalAvailable }) {
  const ratio = totalAvailable > 0 ? watchedCount / totalAvailable : 0
  const unwatched = totalAvailable - watchedCount
  const color = getTopicColor(topic)
  const lowInventory = unwatched <= 2

  return (
    <div style={row.wrap}>
      <div style={row.body}>
        <div style={row.topLine}>
          <span style={row.label}>{topic}</span>
          <span style={row.count}>
            {watchedCount} / {totalAvailable} watched
            {lowInventory && <span style={row.lowTag}> · low inventory</span>}
          </span>
        </div>
        <div style={row.barBg}>
          <div style={{ ...row.barFill, width: `${ratio * 100}%`, background: color }} />
        </div>
      </div>
    </div>
  )
}

export default function TopicTrends({ userId }) {
  const { data, loading, error } = useScholarTopicTrends(userId)
  const topics = data?.topics ?? []

  return (
    <div>
      <div style={styles.card}>
        <p style={styles.heading}>Topic Interest Breakdown</p>
        {loading && <p style={styles.status}>Loading…</p>}
        {error && <p style={styles.status}>Couldn&apos;t load topic trends.</p>}
        {!loading && !error && topics.length === 0 && (
          <p style={styles.status}>No tagged videos yet.</p>
        )}
        {!loading && !error && topics.map(t => (
          <TopicRow
            key={t.topic}
            topic={t.topic}
            watchedCount={t.watched_count}
            totalAvailable={t.total_available}
          />
        ))}
      </div>

      <div style={{ ...styles.card, marginTop: 12 }}>
        <AiInsightCard label="AI Topic Insight" endpoint="/api/scholar-topic-trends" userId={userId} />
      </div>
    </div>
  )
}

const styles = {
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    boxShadow: '0 1px 4px rgba(22,32,64,0.08)',
    overflow: 'hidden',
    padding: '14px 16px',
  },
  heading: {
    margin: '0 0 12px',
    fontSize: 11,
    fontWeight: 700,
    color: '#8a8f99',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  status: { fontSize: 13, color: '#8a8f99', margin: 0 },
}

const row = {
  wrap: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  topLine: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 4,
    flexWrap: 'wrap',
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--ngsi-navy)',
  },
  count: {
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--ngsi-navy)',
    flexShrink: 0,
  },
  lowTag: {
    color: '#C95B3A',
    fontWeight: 700,
  },
  barBg: {
    height: 5,
    borderRadius: 3,
    background: '#ede7d9',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
    transition: 'width 0.3s ease',
  },
}
