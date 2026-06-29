import { useState, useEffect, useRef } from 'react'
import { TOPIC_CATEGORIES } from '../../utils/topics.js'

const DURATION_OPTIONS = [
  { value: 'any',    label: 'Any Duration' },
  { value: 'under5', label: 'Under 5 min' },
  { value: '5to10',  label: '5–10 min' },
  { value: '10to15', label: '10–15 min' },
  { value: '15to20', label: '15–20 min' },
  { value: '20to30', label: '20–30 min' },
  { value: 'over30', label: 'Over 30 min' },
]

const LEVELS = [
  { value: 'a1', label: 'A1' },
  { value: 'a2', label: 'A2' },
  { value: 'b1', label: 'B1' },
  { value: 'b2', label: 'B2' },
  { value: 'c1', label: 'C1' },
  { value: 'c2', label: 'C2' },
]

function TopicMultiSelect({ selected, onChange }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function toggleTopic(topic) {
    if (selected.includes(topic)) {
      onChange(selected.filter(t => t !== topic))
    } else {
      onChange([...selected, topic])
    }
  }

  const label = selected.length === 0
    ? 'All Topics'
    : selected.length === 1
      ? selected[0]
      : `${selected[0]}, +${selected.length - 1}`

  return (
    <div ref={containerRef} style={styles.topicContainer}>
      <button
        style={{ ...styles.topicBtn, ...(open ? styles.topicBtnOpen : {}) }}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Filter by topic"
      >
        <span style={styles.topicBtnLabel}>{label}</span>
        <span style={{ ...styles.topicBtnArrow, transform: open ? 'rotate(180deg)' : 'none' }}>▾</span>
      </button>
      {open && (
        <div style={styles.topicPopover} role="listbox" aria-multiselectable="true">
          {TOPIC_CATEGORIES.map(cat => (
            <div key={cat.key} style={styles.topicGroup}>
              <p style={styles.topicGroupLabel}>{cat.label}</p>
              {cat.topics.map(topic => {
                const checked = selected.includes(topic)
                return (
                  <label key={topic} style={styles.topicOption}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleTopic(topic)}
                      style={styles.topicCheckbox}
                    />
                    <span style={styles.topicOptionText}>{topic}</span>
                  </label>
                )
              })}
            </div>
          ))}
          {selected.length > 0 && (
            <button style={styles.clearTopicsBtn} onClick={() => { onChange([]); setOpen(false) }}>
              Clear all topics
            </button>
          )}
        </div>
      )}
    </div>
  )
}

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

  function toggleLevel(value) {
    const current = filters.level ?? []
    if (current.includes(value)) {
      onChange({ ...filters, level: current.filter(l => l !== value) })
    } else {
      onChange({ ...filters, level: [...current, value] })
    }
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

        {/* Topic multi-select */}
        <TopicMultiSelect
          selected={filters.topic ?? []}
          onChange={topics => onChange({ ...filters, topic: topics })}
        />

        {/* Duration dropdown */}
        <select
          value={filters.duration ?? 'any'}
          onChange={e => onChange({ ...filters, duration: e.target.value })}
          style={styles.select}
          aria-label="Filter by video duration"
        >
          {DURATION_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
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

      {/* Level toggle chips */}
      <div style={styles.levelRow}>
        {LEVELS.map(lvl => {
          const active = (filters.level ?? []).includes(lvl.value)
          return (
            <button
              key={lvl.value}
              style={{ ...styles.levelChip, ...(active ? styles.levelChipActive : {}) }}
              onClick={() => toggleLevel(lvl.value)}
              aria-pressed={active}
            >
              {lvl.label}
            </button>
          )
        })}
        {(filters.level ?? []).length > 0 && (
          <button
            style={styles.clearLevelBtn}
            onClick={() => onChange({ ...filters, level: [] })}
          >
            All Levels
          </button>
        )}
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
  levelRow: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' },
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
  levelChip: {
    padding: '5px 14px',
    border: '1.5px solid var(--ngsi-cream-dark)',
    borderRadius: 20,
    background: '#fff',
    color: 'var(--ngsi-navy)',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background 0.12s, color 0.12s, border-color 0.12s',
  },
  levelChipActive: {
    background: 'var(--ngsi-navy)',
    color: '#fff',
    borderColor: 'var(--ngsi-navy)',
  },
  clearLevelBtn: {
    padding: '5px 10px',
    border: 'none',
    borderRadius: 20,
    background: 'none',
    color: '#8a8f99',
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textDecoration: 'underline',
  },
  topicContainer: {
    position: 'relative',
    flex: '1 1 150px',
    minWidth: 140,
  },
  topicBtn: {
    width: '100%',
    padding: '7px 12px',
    border: '1px solid var(--ngsi-cream-dark)',
    borderRadius: 8,
    background: '#fff',
    color: 'var(--ngsi-navy)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 4,
    textAlign: 'left',
  },
  topicBtnOpen: {
    borderColor: 'var(--ngsi-navy)',
  },
  topicBtnLabel: {
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
  },
  topicBtnArrow: {
    flexShrink: 0,
    fontSize: 11,
    transition: 'transform 0.15s',
    display: 'inline-block',
  },
  topicPopover: {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: 0,
    zIndex: 200,
    background: '#fff',
    border: '1px solid #e8e3da',
    borderRadius: 10,
    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    padding: '10px 0',
    minWidth: 220,
    maxHeight: 320,
    overflowY: 'auto',
  },
  topicGroup: {
    padding: '6px 12px',
  },
  topicGroupLabel: {
    margin: '0 0 4px',
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#8a8f99',
  },
  topicOption: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 0',
    cursor: 'pointer',
    fontSize: 13,
    color: 'var(--ngsi-navy)',
  },
  topicCheckbox: {
    cursor: 'pointer',
    accentColor: 'var(--ngsi-navy)',
  },
  topicOptionText: {
    userSelect: 'none',
  },
  clearTopicsBtn: {
    display: 'block',
    width: '100%',
    padding: '6px 12px',
    background: 'none',
    border: 'none',
    borderTop: '1px solid #e8e3da',
    color: '#8a8f99',
    fontSize: 12,
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'inherit',
    marginTop: 4,
  },
}
