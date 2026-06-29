import { TOPIC_CATEGORIES } from '../../utils/topics.js'
import { LEVELS } from '../../utils/levels.js'

export default function FilterDropdowns({ filters, onChange }) {
  return (
    <div style={styles.row}>
      <select
        value={filters.topic ?? ''}
        onChange={e => onChange({ ...filters, topic: e.target.value || null })}
        style={styles.select}
        aria-label="Filter by topic"
      >
        <option value="">All Topics</option>
        {TOPIC_CATEGORIES.map(cat => (
          <optgroup key={cat.key} label={cat.label}>
            {cat.topics.map(t => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      <select
        value={filters.level ?? ''}
        onChange={e => onChange({ ...filters, level: e.target.value || null })}
        style={styles.select}
        aria-label="Filter by level"
      >
        <option value="">All Levels</option>
        {LEVELS.map(l => (
          <option key={l.id} value={l.id}>
            {l.label} ({l.cefr})
          </option>
        ))}
      </select>

      <select
        value={filters.watchedFilter}
        onChange={e => onChange({ ...filters, watchedFilter: e.target.value })}
        style={styles.select}
        aria-label="Filter by watched state"
      >
        <option value="unwatched">Unwatched</option>
        <option value="watched">Watched</option>
        <option value="all">All</option>
      </select>
    </div>
  )
}

const styles = {
  row: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  select: {
    padding: '7px 12px',
    border: '1px solid var(--ngsi-cream-dark)',
    borderRadius: 8,
    background: '#fff',
    color: 'var(--ngsi-navy)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    minWidth: 140,
    flex: 1,
    appearance: 'auto',
  },
}
