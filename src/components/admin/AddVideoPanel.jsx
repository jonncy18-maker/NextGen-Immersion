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

// YouTube-optimised keywords per topic tag — ESL/practice-content mode.
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

// Same topics, but phrased to surface content made FOR native audiences
// (vlogs, storytime, podcasts) rather than "learn English" teaching channels.
// No "English" or CEFR code in these — native content doesn't self-label by
// level, so Haiku tags it from what comes back instead of the search terms.
const NATIVE_TOPIC_KEYWORDS = {
  'Medical & Nursing': 'nurse day in the life',
  'Work & Career': 'day in my life at work',
  'Academic & Study': 'college life documentary',
  'Daily Life': 'daily vlog',
  'Travel & Places': 'travel vlog',
  'Social & Relationships': 'friends hangout vlog',
  'Food & Cooking': 'cooking vlog recipe',
  'Culture & Entertainment': 'reaction video',
  'Sports & Fitness': 'workout vlog',
  'News & Events': 'news commentary',
}

const NATIVE_CONTENT_TYPES = [
  { value: 'vlog', label: 'Vlog' },
  { value: 'storytime', label: 'Storytime' },
  { value: 'podcast interview', label: 'Podcast / Interview' },
  { value: 'documentary', label: 'Documentary' },
  { value: 'explains', label: 'Explainer' },
]

function buildTopicQuery(topic, level, mode = 'practice') {
  if (mode === 'native') {
    const keywords = NATIVE_TOPIC_KEYWORDS[topic] || topic.toLowerCase()
    return keywords
  }
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
  // relevanceLanguage=en biases YouTube's ranking toward English-language
  // content WITHOUT adding an "English" keyword to the query text itself —
  // that's the mechanism that keeps native-mode search language-constrained
  // without reintroducing the "learn English" bias the mode exists to avoid.
  const res = await fetch(`/api/youtube-search?q=${encodeURIComponent(q)}&maxResults=20&language=en`, {
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

function ScholarContext({ onChipClick, mode }) {
  const { data: scholars } = useScholars()
  const [selectedId, setSelectedId] = useState('')

  if (!scholars || scholars.length === 0) return null

  const scholar = scholars.find((s) => s.user_id === selectedId) || null
  const level = scholar ? getLevelForHours(parseFloat(scholar.current_hours || 0)) : null
  // ESL-phrased level chips ("A1 English for beginners") only make sense when
  // searching for practice content — native content doesn't self-describe by
  // CEFR level, so showing them in native mode would just reintroduce the bias.
  const levelChips = mode === 'practice' && level ? LEVEL_QUERY_CHIPS[level.id] || [] : []

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

      {/* Topic chips — always shown; query includes CEFR prefix when scholar is
          selected AND mode is practice (native mode never inserts a CEFR code) */}
      <p style={ctxStyles.sectionLabel}>
        Topics
        {mode === 'practice' && level ? ` · combined with ${CEFR_PREFIX[level.id] || level.label}` : ' · click to search'}
      </p>
      {TOPIC_CATEGORIES.map((cat) => (
        <div key={cat.key} style={ctxStyles.topicGroup}>
          <span style={{ ...ctxStyles.catLabel, color: cat.color }}>{cat.label}</span>
          <div style={ctxStyles.chips}>
            {cat.topics.map((topic) => (
              <button
                key={topic}
                style={{ ...ctxStyles.topicChipBtn, borderColor: cat.color, color: cat.color }}
                onClick={() => onChipClick(buildTopicQuery(topic, level, mode))}
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
        <p style={cardStyles.channel}>
          {item.channelName}
          {fmtDuration(item.duration_seconds) && (
            <span style={cardStyles.dur}> · {fmtDuration(item.duration_seconds)}</span>
          )}
        </p>
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

const DURATION_OPTIONS = [
  { value: 'any',    label: 'Any length' },
  { value: 'under5', label: '< 5 min' },
  { value: '5to10',  label: '5–10 min' },
  { value: '10to15', label: '10–15 min' },
  { value: '15to20', label: '15–20 min' },
  { value: '20to30', label: '20–30 min' },
  { value: 'over30', label: '> 30 min' },
]

function matchesDuration(secs, filter) {
  if (!filter || filter === 'any') return true
  if (filter === 'under5')  return secs < 300
  if (filter === '5to10')   return secs >= 300  && secs < 600
  if (filter === '10to15')  return secs >= 600  && secs < 900
  if (filter === '15to20')  return secs >= 900  && secs < 1200
  if (filter === '20to30')  return secs >= 1200 && secs < 1800
  if (filter === 'over30')  return secs >= 1800
  return true
}

function fmtDuration(secs) {
  if (!secs) return null
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`
  if (m > 0) return `${m}m`
  return `${s}s`
}

// All topics for the topic dropdown
const ALL_TOPICS = TOPIC_CATEGORIES.flatMap(cat => cat.topics.map(t => ({ value: t, label: t, catLabel: cat.label })))

// Build combined YouTube search query from free text + level + topic filters.
// mode 'practice' = the original ESL-teaching-channel search (CEFR code +
// "English" + "listening"). mode 'native' = native-audience content search
// (no "English"/CEFR terms at all — Haiku tags level from what comes back).
function buildCombinedQuery(text, level, topic, mode = 'practice', nativeContentType = 'vlog') {
  if (mode === 'native') {
    const topicKeywords = topic ? (NATIVE_TOPIC_KEYWORDS[topic] || topic.toLowerCase()) : ''
    const parts = []
    if (topicKeywords) parts.push(topicKeywords)
    if (text && text.trim()) parts.push(text.trim())
    if (nativeContentType) parts.push(nativeContentType)
    return parts.join(' ')
  }
  const levelPrefix = level ? CEFR_PREFIX[level] : ''
  const topicKeywords = topic ? (TOPIC_QUERY_KEYWORDS[topic] || topic.toLowerCase()) : ''
  const parts = []
  if (levelPrefix) parts.push(levelPrefix)
  parts.push('English')
  if (topicKeywords) parts.push(topicKeywords)
  if (text && text.trim()) parts.push(text.trim())
  if (!topicKeywords && !text?.trim()) parts.push('listening')
  return parts.join(' ')
}

export default function AddVideoPanel() {
  const [query, setQuery] = useState('')
  const [filterLevel, setFilterLevel] = useState('')
  const [filterTopic, setFilterTopic] = useState('')
  const [duration, setDuration] = useState('any')
  const [searchState, setSearchState] = useState('idle') // idle | loading | done | quota | unavailable
  const [results, setResults] = useState([])
  // 'native' surfaces content made for native audiences (vlogs, storytime,
  // podcasts) instead of ESL-teaching channels — default, since that's the
  // library's known gap. 'practice' keeps the original CEFR-coded ESL search
  // for when structured practice/OET material is actually wanted.
  const [contentMode, setContentMode] = useState('native')
  const [nativeContentType, setNativeContentType] = useState('vlog')

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

  // Re-fire search whenever level or topic filter changes (if there's something to search)
  function triggerSearch(text, level, topic, mode = contentMode, nativeType = nativeContentType) {
    if (!text.trim() && !level && !topic) {
      setResults([])
      setSearchState('idle')
      return
    }
    const combined = buildCombinedQuery(text, level, topic, mode, nativeType)
    debouncedSearch(combined)
  }

  const handleChange = (e) => {
    const val = e.target.value
    setQuery(val)
    triggerSearch(val, filterLevel, filterTopic)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      const combined = buildCombinedQuery(query, filterLevel, filterTopic, contentMode, nativeContentType)
      if (combined.trim()) doSearch(combined)
    }
  }

  const handleLevelChange = (e) => {
    const val = e.target.value
    setFilterLevel(val)
    triggerSearch(query, val, filterTopic)
  }

  const handleTopicChange = (e) => {
    const val = e.target.value
    setFilterTopic(val)
    triggerSearch(query, filterLevel, val)
  }

  const handleModeChange = (mode) => {
    setContentMode(mode)
    triggerSearch(query, filterLevel, filterTopic, mode, nativeContentType)
  }

  const handleNativeTypeChange = (e) => {
    const val = e.target.value
    setNativeContentType(val)
    triggerSearch(query, filterLevel, filterTopic, contentMode, val)
  }

  // Scholar context chip click: override free-text query directly
  const handleChipClick = useCallback(
    (chip) => {
      setQuery(chip)
      doSearch(chip)
    },
    [doSearch],
  )

  const activeFilters = [
    // Level has no effect in native mode (dropped from the query entirely) —
    // don't show a pill implying it's still filtering anything.
    contentMode === 'practice' && filterLevel ? `Level: ${filterLevel.toUpperCase()}` : null,
    filterTopic ? `Topic: ${filterTopic}` : null,
  ].filter(Boolean)

  function clearFilters() {
    setFilterLevel('')
    setFilterTopic('')
    setQuery('')
    setResults([])
    setSearchState('idle')
  }

  return (
    <div style={panelStyles.wrap}>
      {/* ── Content mode toggle ── */}
      <div style={panelStyles.modeRow}>
        <div style={panelStyles.modeToggle} role="tablist" aria-label="Search mode">
          <button
            type="button"
            role="tab"
            aria-selected={contentMode === 'native'}
            style={{ ...panelStyles.modeBtn, ...(contentMode === 'native' ? panelStyles.modeBtnActive : {}) }}
            onClick={() => handleModeChange('native')}
          >
            Native content
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={contentMode === 'practice'}
            style={{ ...panelStyles.modeBtn, ...(contentMode === 'practice' ? panelStyles.modeBtnActive : {}) }}
            onClick={() => handleModeChange('practice')}
          >
            ESL / practice content
          </button>
        </div>
        <p style={panelStyles.modeHint}>
          {contentMode === 'native'
            ? 'Searches for vlogs, storytime, podcasts, and documentaries — not "learn English" teaching channels.'
            : 'Searches CEFR-coded ESL practice channels (listening drills, OET prep, structured lessons).'}
        </p>
      </div>

      <ScholarContext onChipClick={handleChipClick} mode={contentMode} />

      {/* ── Filter bar ── */}
      <div style={panelStyles.filterBar}>
        {/* Level dropdown — practice mode only; native content doesn't self-label by CEFR */}
        {contentMode === 'practice' && (
          <div style={panelStyles.filterGroup}>
            <label style={panelStyles.filterLabel} htmlFor="avp-level">Level</label>
            <select
              id="avp-level"
              value={filterLevel}
              onChange={handleLevelChange}
              style={panelStyles.filterSelect}
              aria-label="Filter by CEFR level"
            >
              <option value="">Any Level</option>
              {LEVELS.map(l => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Content type dropdown — native mode only */}
        {contentMode === 'native' && (
          <div style={panelStyles.filterGroup}>
            <label style={panelStyles.filterLabel} htmlFor="avp-native-type">Content type</label>
            <select
              id="avp-native-type"
              value={nativeContentType}
              onChange={handleNativeTypeChange}
              style={panelStyles.filterSelect}
              aria-label="Filter by native content type"
            >
              {NATIVE_CONTENT_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Topic dropdown */}
        <div style={panelStyles.filterGroup}>
          <label style={panelStyles.filterLabel} htmlFor="avp-topic">Topic</label>
          <select
            id="avp-topic"
            value={filterTopic}
            onChange={handleTopicChange}
            style={panelStyles.filterSelect}
            aria-label="Filter by topic"
          >
            <option value="">Any Topic</option>
            {TOPIC_CATEGORIES.map(cat => (
              <optgroup key={cat.key} label={cat.label}>
                {cat.topics.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Duration dropdown */}
        <div style={panelStyles.filterGroup}>
          <label style={panelStyles.filterLabel} htmlFor="avp-duration">Duration</label>
          <select
            id="avp-duration"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            style={panelStyles.filterSelect}
            aria-label="Filter results by duration"
          >
            {DURATION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Clear filters */}
        {(filterLevel || filterTopic) && (
          <button style={panelStyles.clearFiltersBtn} onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>

      {/* Active filter pills */}
      {activeFilters.length > 0 && (
        <div style={panelStyles.activePills}>
          {activeFilters.map(f => (
            <span key={f} style={panelStyles.activePill}>{f}</span>
          ))}
        </div>
      )}

      {/* Free text search (always fires combined query) */}
      <div style={panelStyles.searchRow}>
        <input
          type="search"
          placeholder="Search YouTube (e.g. nursing conversation, hospital scene)…"
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

      {results.length > 0 && (() => {
        const filtered = results.filter((item) => matchesDuration(item.duration_seconds || 0, duration))
        return (
          <div style={panelStyles.results}>
            {filtered.length === 0 ? (
              <p style={panelStyles.hint}>No results match the selected duration.</p>
            ) : (
              filtered.map((item) => (
                <ResultCard key={item.youtubeId} item={item} />
              ))
            )}
          </div>
        )
      })()}
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
  modeRow: { display: 'flex', flexDirection: 'column', gap: 6 },
  modeToggle: {
    display: 'inline-flex',
    background: '#f0ece2',
    borderRadius: 8,
    padding: 3,
    gap: 3,
    alignSelf: 'flex-start',
  },
  modeBtn: {
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 600,
    border: 'none',
    borderRadius: 6,
    background: 'transparent',
    color: '#8a8f99',
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },
  modeBtnActive: {
    background: '#fff',
    color: 'var(--ngsi-navy)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
  },
  modeHint: {
    margin: 0,
    fontSize: 12,
    color: '#8a8f99',
  },
  filterBar: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    alignItems: 'flex-end',
  },
  filterGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    flex: '1 1 120px',
    minWidth: 0,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: '#8a8f99',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  filterSelect: {
    padding: '7px 10px',
    fontSize: 13,
    border: '1.5px solid #d0d5dd',
    borderRadius: 7,
    background: '#fff',
    color: 'var(--ngsi-navy)',
    fontFamily: 'inherit',
    cursor: 'pointer',
    width: '100%',
  },
  clearFiltersBtn: {
    padding: '7px 12px',
    fontSize: 12,
    fontWeight: 600,
    color: '#c0524a',
    background: 'none',
    border: '1.5px solid #e8b4ae',
    borderRadius: 7,
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
    alignSelf: 'flex-end',
  },
  activePills: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: -4,
  },
  activePill: {
    padding: '3px 10px',
    fontSize: 12,
    fontWeight: 600,
    background: '#eef2ff',
    color: '#4338ca',
    borderRadius: 20,
    border: '1px solid #c7d2fe',
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
  dur: { color: '#aaa', fontWeight: 400 },
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
