import { TOPIC_CATEGORIES } from '../../utils/topics.js'
import { LEVELS } from '../../utils/levels.js'

const WATCHED_OPTIONS = [
  { value: 'unwatched', label: 'Unwatched' },
  { value: 'watched', label: 'Watched' },
  { value: 'all', label: 'All' },
]

export default function FilterBar({ filters, onChange, style }) {
  const toggleTopic = topic => {
    const has = filters.topics.includes(topic)
    const topics = has
      ? filters.topics.filter(t => t !== topic)
      : [...filters.topics, topic]
    onChange({ ...filters, topics })
  }

  const setLevel = level => onChange({ ...filters, level })
  const setWatched = watchedFilter => onChange({ ...filters, watchedFilter })

  return (
    <div style={{ ...styles.bar, ...style }}>
      {/* ── Topics ── */}
      <div style={styles.group}>
        <span style={styles.groupLabel}>Topics</span>
        {TOPIC_CATEGORIES.map(cat => (
          <div key={cat.key} style={styles.catRow}>
            <span style={styles.catLabel}>{cat.label}</span>
            <div style={styles.chips}>
              {cat.topics.map(topic => {
                const selected = filters.topics.includes(topic)
                return (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => toggleTopic(topic)}
                    style={{
                      ...styles.chip,
                      ...(selected
                        ? { background: cat.color, color: '#fff', borderColor: cat.color }
                        : { background: '#fff', color: cat.color, borderColor: cat.color }),
                    }}
                  >
                    {topic}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ── Level ── */}
      <div style={styles.group}>
        <span style={styles.groupLabel}>Level</span>
        <div style={styles.chips}>
          <button
            type="button"
            onClick={() => setLevel(null)}
            style={{
              ...styles.chip,
              ...(filters.level === null ? styles.levelChipActive : styles.levelChip),
            }}
          >
            All levels
          </button>
          {LEVELS.map(l => {
            const active = filters.level === l.id
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => setLevel(l.id)}
                style={{
                  ...styles.chip,
                  ...(active ? styles.levelChipActive : styles.levelChip),
                }}
              >
                {l.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Watched ── */}
      <div style={styles.group}>
        <span style={styles.groupLabel}>Show</span>
        <div style={styles.chips}>
          {WATCHED_OPTIONS.map(opt => {
            const active = filters.watchedFilter === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setWatched(opt.value)}
                style={{
                  ...styles.chip,
                  ...(active ? styles.levelChipActive : styles.levelChip),
                }}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const styles = {
  bar: {
    background: '#fff',
    border: '1px solid var(--ngsi-cream-dark)',
    borderRadius: 10,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    marginBottom: 16,
  },
  group: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  groupLabel: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: 'var(--ngsi-navy)',
  },
  catRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    flexWrap: 'wrap',
  },
  catLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: '#8a8f99',
    minWidth: 130,
    paddingTop: 5,
  },
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    fontSize: 12,
    fontWeight: 600,
    padding: '5px 11px',
    borderRadius: 999,
    border: '1px solid',
    cursor: 'pointer',
    lineHeight: 1.2,
  },
  levelChip: {
    background: '#fff',
    color: 'var(--ngsi-navy)',
    borderColor: 'var(--ngsi-cream-dark)',
  },
  levelChipActive: {
    background: 'var(--ngsi-navy)',
    color: '#fff',
    borderColor: 'var(--ngsi-navy)',
  },
}
