import { useState, useEffect, useRef } from 'react'
import { TOPIC_CATEGORIES } from '../../utils/topics.js'
import { LEVELS } from '../../utils/levels.js'

export default function FilterDropdowns({ filters, onChange, style }) {
  const [searchDraft, setSearchDraft] = useState(filters.search ?? '')
  const [topicSearchDraft, setTopicSearchDraft] = useState(filters.topicSearch ?? '')

  const searchTimer = useRef(null)
  const topicSearchTimer = useRef(null)

  // Sync local drafts if parent resets filters externally (e.g. "Clear all")
  useEffect(() => { setSearchDraft(filters.search ?? '') }, [filters.search])
  useEffect(() => { setTopicSearchDraft(filters.topicSearch ?? '') }, [filters.topicSearch])

  function handleSearchChange(val) {
    setSearchDraft(val)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => onChange({ ...filters, search: val || '' }), 200)
  }

  function handleTopicSearchChange(val) {
    setTopicSearchDraft(val)
    clearTimeout(topicSearchTimer.current)
    topicSearchTimer.current = setTimeout(() => onChange({ ...filters, topicSearch: val || '' }), 200)
  }

  return (
    <div style={{ ...styles.wrap, ...style }}>
      <div style={styles.row}>
        {/* Keyword search */}
        <div style={styles.searchWrap}>
          <input
            type="search"
            placeholder="Search videos…"
            value={searchDraft}
            onChange={e => handleSearchChange(e.target.value)}
            style={styles.searchInput}
            aria-label="Search videos by title or channel"
          />
          {searchDraft && (
            <button style={styles.clearBtn} onClick={() => handleSearchChange('')} aria-label="Clear search">
              ✕
            </button>
          )}
        </div>

        {/* Level dropdown */}
        <select
          value={filters.level ?? ''}
          onChange={e => onChange({ ...filters, level: e.target.value || null })}
          style={styles.select}
          aria-label="Filter by level"
        >
          <option value="">All Levels</option>
          {LEVELS.map(l => (
            <option key={l.id} value={l.id}>{l.label} ({l.cefr})</option>
          ))}
        </select>

        {/* Topic dropdown */}
        <select
          value={filters.topic ?? ''}
          onChange={e => onChange({ ...filters, topic: e.target.value || null })}
          style={styles.select}
          aria-label="Filter by topic"
        >
          <option value="">All Topics</option>
          {TOPIC_CATEGORIES.map(cat => (
            <optgroup key={cat.key} label={cat.label}>
              {cat.topics.map(t => <option key={t} value={t}>{t}</option>)}
            </optgroup>
          ))}
        </select>

        {/* Watched dropdown */}
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

      {/* Topic keyword search — secondary AND filter */}
      <div style={styles.topicRow}>
        <div style={styles.searchWrap}>
          <input
            type="search"
            placeholder="Filter by topic keyword…"
            value={topicSearchDraft}
            onChange={e => handleTopicSearchChange(e.target.value)}
            style={{ ...styles.searchInput, fontSize: 12 }}
            aria-label="Filter by topic keyword"
          />
          {topicSearchDraft && (
            <button style={styles.clearBtn} onClick={() => handleTopicSearchChange('')} aria-label="Clear topic filter">
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const styles = {
  wrap: { marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 },
  row: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  topicRow: { display: 'flex', gap: 10 },
  searchWrap: { position: 'relative', flex: '2 1 200px', minWidth: 160 },
  searchInput: {
    width: '100%',
    padding: '7px 32px 7px 12px',
    border: '1px solid var(--ngsi-cream-dark)',
    borderRadius: 8,
    background: '#fff',
    color: 'var(--ngsi-navy)',
    fontSize: 13,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  },
  clearBtn: {
    position: 'absolute',
    right: 8,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    color: '#8a8f99',
    cursor: 'pointer',
    fontSize: 11,
    padding: 2,
    lineHeight: 1,
    fontFamily: 'inherit',
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
    flex: '1 1 130px',
    minWidth: 120,
    appearance: 'auto',
    fontFamily: 'inherit',
  },
}
