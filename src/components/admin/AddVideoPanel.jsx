import { useState, useRef, useCallback } from 'react'
import { getAuthToken } from '../../lib/authToken.js'
import { getTopicColor, TOPIC_CATEGORIES } from '../../utils/topics.js'
import { LEVELS, getLevelForHours } from '../../utils/levels.js'
import { useScholars } from '../../hooks/useScholars.js'

const LEVEL_LABELS = Object.fromEntries(LEVELS.map((l) => [l.id, l.label]))
const LEVEL_COLORS = {
  a1: '#5B8DB8',
  a2: '#4a9fc4',
  b1: '#4DA67A',
  b2: '#C9A84C',
  c1: '#C0524A',
  c2: '#8B3A8B',
}

// CEFR code injected into topic queries when a scholar is selected.
const CEFR_PREFIX = {
  a1: 'A1',
  a2: 'A2',
  b1: 'B1',
  b2: 'B2',
  c1: 'C1',
  c2: 'C2',
}

const LEVEL_QUERY_CHIPS = {
  a1: [
    'slow English for beginners',
    'basic English conversation A1',
    'simple English sentences',
    'English for absolute beginners',
    'A1 English listening practice',
  ],
  a2: [
    'easy English conversation A2',
    'English for daily life',
    'slow English listening',
    'simple English stories A2',
    'A2 English practice',
  ],
  b1: [
    'B1 English conversation',
    'English podcast beginner intermediate',
    'real English listening B1',
    'English for daily work',
    'B1 English fluency',
  ],
  b2: [
    'B2 English conversation',
    'upper intermediate English',
    'English podcast intermediate',
    'B2 English listening',
    'natural English conversation',
  ],
  c1: [
    'advanced English conversation C1',
    'native speed English',
    'English news analysis',
    'academic English listening',
    'C1 English discussion',
  ],
  c2: [
    'C2 English mastery',
    'native English podcast',
    'advanced academic English',
    'English debate discussion',
    'native speaker English',
  ],
}

// YouTube-optimised keywords per topic tag.
const TOPIC_QUERY_KEYWORDS = {
  'Medical & Nursing': 'medical nursing',
  'Work & Career': 'work career professional',
  'Academic & Study': 'academic study skills',
  'Daily Life': 'everyday daily life',
  'Travel & Places': 'travel',
  'Social & Relationships': 'social conversations',
  'Food & Cooking': 'food cooking',
  'Culture & Entertainment': 'culture entertainment',
  'Sports & Fitness': 'sports fitness',
  'News & Events': 'news current events',
}

function buildTopicQuery(topic, level) {
  const keywords = TOPIC_QUERY_KEYWORDS[topic] || topic.toLowerCase()
  const prefix = level ? CEFR_PREFIX[level.id] + ' ' : ''
  return `${prefix}English ${keywords} listening`
}

function useDebounce(fn, delay) {
  const timer = useRef(null)
  return useCallback(
    (...args) => {
      clearTimeout(timer.current)
      timer.current = setTimeout(() => fn(...args), delay)
    },
    [fn, delay],
  )
}

async function searchYouTube(q) {
  const token = await getAuthToken()
  const res = await fetch(`/api/youtube-search?q=${encodeURIComponent(q)}&maxResults=10`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 429) throw new Error('quota')
  if (!res.ok) throw new Error('unavailable')
  return res.json()
}

async function tagVideo(title, description) {
  const token = await getAuthToken()
  const res = await fetch('/api/tag-video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ title, description }),
  })
  if (!res.ok) throw new Error('tag failed')
  return res.json()
}

async function addVideo(video, tags) {
  const token = await getAuthToken()
  const res = await fetch('/api/add-video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      youtubeId: video.youtubeId,
      title: video.title,
      channelName: video.channelName,
      channelId: video.channelId,
      thumbnailUrl: video.thumbnail_url,
      description: video.description,
      language: 'english',
      level: tags.level,
      topicPrimary: tags.topic_primary,
      topicSecondary: tags.topic_secondary,
    }),
  })
  if (!res.ok) throw new Error('save failed')
  return res.json()
}

function ScholarContext({ onChipClick }) {
  const { data: scholars } = useScholars()
  const [selectedId, setSelectedId] = useState('')

  if (!scholars || scholars.length === 0) return null

  const scholar = scholars.find((s) => s.user_id === selectedId) || null
  const level = scholar ? getLevelForHours(parseFloat(scholar.current_hours || 0)) : null
  const levelChips = level ? LEVEL_QUERY_CHIPS[level.id] || [] : []

  return (
    <div style={ctxStyles.wrap}>
      {/* Scholar picker */}
      <div style={ctxStyles.row}>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          style={ctxStyles.select}
        >
          <option value="">Scholar context (optional)</option>
          {scholars.map((s) => {
            const lv = getLevelForHours(parseFloat(s.current_hours || 0))
            return (
              <option key={s.user_id} value={s.user_id}>
                {s.scholar_name} — {lv.label} ({s.current_hours}h)
              </option>
            )
          })}
        </select>
        {level && (
          <span
            style={{
              ...chipStyles.base,
              background: LEVEL_COLORS[level.id] || '#8a8f99',
              color: '#fff',
              flexShrink: 0,
            }}
          >
            {level.label}
          </span>
        )}
      </div>

      {/* Level query chips — shown when a scholar is selected */}
      {levelChips.length > 0 && (
        <>
          <p style={ctxStyles.sectionLabel}>Level queries</p>
          <div style={ctxStyles.chips}>
            {levelChips.map((chip) => (
              <button key={chip} style={ctxStyles.chipBtn} onClick={() => onChipClick(chip)}>
                {chip}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Topic chips — always shown; query includes CEFR prefix when scholar is selected */}
      <p style={ctxStyles.sectionLabel}>
        Topics{level ? ` · combined with ${CEFR_PREFIX[level.id] || level.label}` : ' · click to search'}
      </p>
      {TOPIC_CATEGORIES.map((cat) => (
        <div key={cat.key} style={ctxStyles.topicGroup}>
          <span style={{ ...ctxStyles.catLabel, color: cat.color }}>{cat.label}</span>
          <div style={ctxStyles.chips}>
            {cat.topics.map((topic) => (
              <button
                key={topic}
                style={{ ...ctxStyles.topicChipBtn, borderColor: cat.color, color: cat.color }}
                onClick={() => onChipClick(buildTopicQuery(topic, level))}
              >
                {topic}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function ResultCard({ item, onAdd }) {
  const [tagState, setTagState] = useState('idle') // idle | tagging | done | error
  const [tags, setTags] = useState(null)
  const [addState, setAddState] = useState('idle') // idle | adding | added | exists | error
  const tagStarted = useRef(false)

  // Kick off tagging once on mount
  const startTag = useCallback(async () => {
    if (tagStarted.current) return
    tagStarted.current = true
    setTagState('tagging')
    try {
      const result = await tagVideo(item.title, item.description || '')
      setTags(result)
      setTagState('done')
    } catch {
      setTagState('error')
    }
  }, [item.title, item.description])

  // Use a ref callback to trigger tagging when the card mounts
  const cardRef = useCallback(
    (node) => {
      if (node) startTag()
    },
    [startTag],
  )

  const handleAdd = async () => {
    if (!tags || addState !== 'idle') return
    setAddState('adding')
    try {
      const result = await addVideo(item, tags)
      setAddState(result.added ? 'added' : 'exists')
      if (onAdd) onAdd(item.youtubeId, result.added)
    } catch {
      setAddState('error')
    }
  }

  return (
    <div ref={cardRef} style={cardStyles.wrap}>
      <div style={cardStyles.thumb}>
        {item.thumbnail_url ? (
          <img src={item.thumbnail_url} alt="" style={cardStyles.thumbImg} />
        ) : (
          <div style={cardStyles.thumbPlaceholder} />
        )}
      </div>
      <div style={cardStyles.body}>
        <p style={cardStyles.title} title={item.title}>
          {item.title}
        </p>
        <p style={cardStyles.channel}>{item.channelName}</p>
        <div style={cardStyles.chips}>
          {tagState === 'tagging' && <span style={chipStyles.tagging}>Tagging…</span>}
          {tagState === 'done' && tags && (
            <>
              <span
                style={{
                  ...chipStyles.base,
                  background: LEVEL_COLORS[tags.level] || '#8a8f99',
                  color: '#fff',
                }}
              >
                {LEVEL_LABELS[tags.level] || tags.level}
              </span>
              {tags.topic_primary && (
                <span
                  style={{
                    ...chipStyles.base,
                    background: getTopicColor(tags.topic_primary),
                    color: '#fff',
                  }}
                >
                  {tags.topic_primary}
                </span>
              )}
              {tags.topic_secondary && (
                <span
                  style={{
                    ...chipStyles.base,
                    background: getTopicColor(tags.topic_secondary),
                    color: '#fff',
                    opacity: 0.85,
                  }}
                >
                  {tags.topic_secondary}
                </span>
              )}
            </>
          )}
          {tagState === 'error' && <span style={chipStyles.error}>Tag failed</span>}
        </div>
      </div>
      <div style={cardStyles.action}>
        <button
          style={{
            ...btnStyles.base,
            ...(addState === 'added' ? btnStyles.added : {}),
            ...(addState === 'exists' ? btnStyles.exists : {}),
            ...(addState === 'error' ? btnStyles.err : {}),
            ...(addState === 'adding' ? btnStyles.adding : {}),
            ...(!tags || addState !== 'idle' ? btnStyles.disabled : {}),
          }}
          disabled={!tags || addState !== 'idle'}
          onClick={handleAdd}
        >
          {addState === 'idle' && 'Add'}
          {addState === 'adding' && 'Adding…'}
          {addState === 'added' && 'Added ✓'}
          {addState === 'exists' && 'In Library'}
          {addState === 'error' && 'Failed'}
        </button>
      </div>
    </div>
  )
}

const CEFR_LEVEL_CHIPS = [
  { id: 'a1', label: 'A1', query: 'A1 English listening practice beginner' },
  { id: 'a2', label: 'A2', query: 'A2 English listening elementary' },
  { id: 'b1', label: 'B1', query: 'B1 English conversation pre-intermediate' },
  { id: 'b2', label: 'B2', query: 'B2 English listening upper intermediate' },
  { id: 'c1', label: 'C1', query: 'C1 advanced English conversation' },
  { id: 'c2', label: 'C2', query: 'C2 mastery English native speaker' },
]

export default function AddVideoPanel() {
  const [query, setQuery] = useState('')
  const [searchState, setSearchState] = useState('idle') // idle | loading | done | quota | unavailable
  const [results, setResults] = useState([])
  const [activeLevelChip, setActiveLevelChip] = useState(null)

  const doSearch = useCallback(async (q) => {
    if (!q.trim()) {
      setResults([])
      setSearchState('idle')
      return
    }
    setSearchState('loading')
    setResults([])
    try {
      const data = await searchYouTube(q.trim())
      setResults((data.items || []).filter((item) => !item.in_library))
      setSearchState('done')
    } catch (err) {
      setSearchState(err.message === 'quota' ? 'quota' : 'unavailable')
    }
  }, [])

  const debouncedSearch = useDebounce(doSearch, 500)

  const handleChange = (e) => {
    const val = e.target.value
    setQuery(val)
    setActiveLevelChip(null)
    debouncedSearch(val)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      clearTimeout(undefined)
      doSearch(query)
    }
  }

  const handleChipClick = useCallback(
    (chip) => {
      setQuery(chip)
      setActiveLevelChip(null)
      doSearch(chip)
    },
    [doSearch],
  )

  const handleLevelChip = useCallback(
    (chip) => {
      const isActive = activeLevelChip === chip.id
      if (isActive) {
        setActiveLevelChip(null)
        setQuery('')
        setResults([])
        setSearchState('idle')
      } else {
        setActiveLevelChip(chip.id)
        setQuery(chip.query)
        doSearch(chip.query)
      }
    },
    [activeLevelChip, doSearch],
  )

  return (
    <div style={panelStyles.wrap}>
      <ScholarContext onChipClick={handleChipClick} />

      {/* CEFR level filter chips */}
      <div style={panelStyles.cefrRow}>
        <span style={panelStyles.cefrLabel}>Level</span>
        {CEFR_LEVEL_CHIPS.map((chip) => (
          <button
            key={chip.id}
            style={{
              ...panelStyles.cefrChip,
              background: activeLevelChip === chip.id ? LEVEL_COLORS[chip.id] : '#fff',
              color: activeLevelChip === chip.id ? '#fff' : 'var(--ngsi-navy)',
              borderColor: LEVEL_COLORS[chip.id],
            }}
            onClick={() => handleLevelChip(chip)}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div style={panelStyles.searchRow}>
        <input
          type="search"
          placeholder="Search YouTube (e.g. English nursing conversation)…"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          style={panelStyles.input}
          aria-label="Search YouTube"
        />
      </div>

      {searchState === 'loading' && <p style={panelStyles.hint}>Searching…</p>}
      {searchState === 'quota' && (
        <p style={panelStyles.error}>YouTube quota exceeded — try again tomorrow.</p>
      )}
      {searchState === 'unavailable' && (
        <p style={panelStyles.error}>YouTube search unavailable. Check connection and try again.</p>
      )}
      {searchState === 'done' && results.length === 0 && (
        <p style={panelStyles.hint}>
          No new results — music videos and videos already in the library are excluded automatically.
        </p>
      )}

      {results.length > 0 && (
        <div style={panelStyles.results}>
          {results.map((item) => (
            <ResultCard key={item.youtubeId} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const ctxStyles = {
  wrap: {
    background: '#f8f5ef',
    border: '1px solid #e8e3da',
    borderRadius: 10,
    padding: '12px 14px',
    marginBottom: 12,
  },
  row: { display: 'flex', alignItems: 'center', gap: 8 },
  select: {
    flex: 1,
    padding: '7px 10px',
    fontSize: 13,
    border: '1.5px solid #d0d5dd',
    borderRadius: 7,
    background: '#fff',
    color: 'var(--ngsi-navy)',
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: '#8a8f99',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    margin: '10px 0 4px',
  },
  chips: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  chipBtn: {
    padding: '4px 10px',
    fontSize: 12,
    fontWeight: 500,
    border: '1px solid #c5bfb0',
    borderRadius: 5,
    background: '#fff',
    color: 'var(--ngsi-navy)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    lineHeight: 1.4,
  },
  topicGroup: { marginBottom: 8 },
  catLabel: {
    display: 'block',
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
  topicChipBtn: {
    padding: '3px 10px',
    fontSize: 12,
    fontWeight: 500,
    border: '1.5px solid',
    borderRadius: 5,
    background: '#fff',
    cursor: 'pointer',
    fontFamily: 'inherit',
    lineHeight: 1.4,
  },
}

const panelStyles = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 12 },
  cefrRow: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' },
  cefrLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: '#8a8f99',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginRight: 2,
  },
  cefrChip: {
    padding: '4px 10px',
    fontSize: 12,
    fontWeight: 600,
    border: '1.5px solid',
    borderRadius: 5,
    cursor: 'pointer',
    fontFamily: 'inherit',
    lineHeight: 1.4,
    transition: 'background 0.12s, color 0.12s',
  },
  searchRow: { display: 'flex', gap: 8 },
  input: {
    flex: 1,
    padding: '10px 14px',
    fontSize: 14,
    border: '1.5px solid #d0d5dd',
    borderRadius: 8,
    outline: 'none',
    background: '#fff',
    color: 'var(--ngsi-navy)',
    fontFamily: 'inherit',
  },
  results: { display: 'flex', flexDirection: 'column', gap: 8 },
  hint: { fontSize: 13, color: '#8a8f99', margin: 0 },
  error: { fontSize: 13, color: '#c0524a', margin: 0 },
}

const cardStyles = {
  wrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: '#fff',
    border: '1px solid #e8e3da',
    borderRadius: 10,
    padding: '10px 12px',
  },
  thumb: {
    flexShrink: 0,
    width: 88,
    height: 50,
    borderRadius: 6,
    overflow: 'hidden',
    background: '#e8e3da',
  },
  thumbImg: { width: '100%', height: '100%', objectFit: 'cover' },
  thumbPlaceholder: { width: '100%', height: '100%', background: '#d5cebd' },
  body: { flex: 1, minWidth: 0 },
  title: {
    margin: '0 0 2px',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--ngsi-navy)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  channel: { margin: '0 0 6px', fontSize: 12, color: '#8a8f99' },
  chips: { display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' },
  action: { flexShrink: 0 },
}

const chipStyles = {
  base: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
    lineHeight: '18px',
  },
  tagging: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 11,
    background: '#f0ece2',
    color: '#8a8f99',
    lineHeight: '18px',
    fontStyle: 'italic',
  },
  error: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 11,
    background: '#fef2f2',
    color: '#c0524a',
    lineHeight: '18px',
  },
}

const btnStyles = {
  base: {
    padding: '6px 14px',
    fontSize: 12,
    fontWeight: 600,
    border: '1.5px solid var(--ngsi-navy)',
    borderRadius: 6,
    background: 'transparent',
    color: 'var(--ngsi-navy)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'background 0.15s',
  },
  added: {
    background: '#1D9E75',
    border: '1.5px solid #1D9E75',
    color: '#fff',
    cursor: 'default',
  },
  exists: {
    background: '#f0ece2',
    border: '1.5px solid #c5bfb0',
    color: '#8a8f99',
    cursor: 'default',
  },
  adding: { opacity: 0.7, cursor: 'default' },
  err: {
    background: '#fef2f2',
    border: '1.5px solid #c0524a',
    color: '#c0524a',
    cursor: 'default',
  },
  disabled: { opacity: 0.45, cursor: 'not-allowed' },
}
