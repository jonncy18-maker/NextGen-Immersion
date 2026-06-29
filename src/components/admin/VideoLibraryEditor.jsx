import { useState, useEffect, useCallback, useRef } from 'react'
import { getAuthToken } from '../../lib/authToken.js'
import { TOPIC_CATEGORIES, ALL_TOPICS, getTopicColor } from '../../utils/topics.js'
import { LEVELS } from '../../utils/levels.js'

const LEVEL_COLORS = {
  a1: '#5B8DB8',
  a2: '#4a9fc4',
  b1: '#4DA67A',
  b2: '#C9A84C',
  c1: '#C0524A',
  c2: '#8B3A8B',
}

const LEVEL_LABELS = Object.fromEntries(LEVELS.map(l => [l.id, l.label]))

async function apiFetch(path, options = {}) {
  const token = await getAuthToken()
  const res = await fetch(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `${res.status}`)
  }
  return res.json()
}

function useVideos() {
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetch = useCallback(() => {
    setLoading(true)
    apiFetch('/api/videos')
      .then(data => setVideos(data.videos || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { videos, setVideos, loading, error, refetch: fetch }
}

function ConfirmModal({ count, onConfirm, onCancel }) {
  return (
    <div style={modal.overlay} onClick={onCancel}>
      <div style={modal.box} onClick={e => e.stopPropagation()}>
        <p style={modal.msg}>
          Remove {count === 1 ? 'this video' : `these ${count} videos`} from the library?
        </p>
        <p style={modal.sub}>Watch history and cumulative hours are preserved.</p>
        <div style={modal.btns}>
          <button style={modal.cancelBtn} onClick={onCancel}>Cancel</button>
          <button style={modal.confirmBtn} onClick={onConfirm}>Remove</button>
        </div>
      </div>
    </div>
  )
}

function CardMenu({ videoId, onClose, onDelete, onLevelChange, onTopicChange, busy }) {
  const ref = useRef(null)

  useEffect(() => {
    const handler = e => {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div ref={ref} style={menu.wrap}>
      <button
        style={{ ...menu.item, color: '#c0524a' }}
        disabled={busy}
        onClick={() => { onClose(); onDelete([videoId]) }}
      >
        Delete
      </button>
      <div style={menu.divider} />
      <label style={menu.label}>Change Level</label>
      <select
        style={menu.select}
        defaultValue=""
        disabled={busy}
        onChange={e => { if (e.target.value) { onClose(); onLevelChange([videoId], e.target.value) } }}
      >
        <option value="" disabled>Select level…</option>
        {LEVELS.map(l => (
          <option key={l.id} value={l.id}>{l.label}</option>
        ))}
      </select>
      <label style={menu.label}>Change Topic</label>
      <select
        style={menu.select}
        defaultValue=""
        disabled={busy}
        onChange={e => { if (e.target.value) { onClose(); onTopicChange([videoId], e.target.value) } }}
      >
        <option value="" disabled>Select topic…</option>
        {TOPIC_CATEGORIES.map(cat => (
          <optgroup key={cat.key} label={cat.label}>
            {cat.topics.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  )
}

function AdminCard({ video, isSelected, anySelected, onToggle, menuOpenId, onOpenMenu, onCloseMenu, onDelete, onLevelChange, onTopicChange, busy }) {
  const isMenuOpen = menuOpenId === video.id

  return (
    <div className="ngsi-lib-card" style={{ ...card.wrap, outline: isSelected ? '2px solid var(--ngsi-gold)' : 'none' }}>
      {/* Checkbox — visible on hover or when any card is selected */}
      <div
        style={{ ...card.checkWrap, opacity: anySelected || isSelected ? 1 : undefined }}
        className="ngsi-card-check"
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggle(video.id)}
          style={card.checkbox}
          aria-label={`Select ${video.title}`}
        />
      </div>

      {/* Thumbnail */}
      <div style={card.thumb}>
        {video.thumbnail_url
          ? <img src={video.thumbnail_url} alt="" style={card.thumbImg} />
          : <div style={card.thumbPlaceholder} />}
      </div>

      {/* Body */}
      <div style={card.body}>
        <p style={card.title} title={video.title}>{video.title}</p>
        <p style={card.channel}>{video.channel_name || ''}</p>
        <div style={card.chips}>
          {video.level && (
            <span style={{ ...chip.base, background: LEVEL_COLORS[video.level] || '#8a8f99', color: '#fff' }}>
              {LEVEL_LABELS[video.level] || video.level}
            </span>
          )}
          {video.topic_primary && (
            <span style={{ ...chip.base, background: getTopicColor(video.topic_primary), color: '#fff' }}>
              {video.topic_primary}
            </span>
          )}
        </div>
      </div>

      {/* 3-dot menu */}
      <div style={card.menuWrap}>
        <button
          style={card.menuBtn}
          onClick={e => { e.stopPropagation(); isMenuOpen ? onCloseMenu() : onOpenMenu(video.id) }}
          aria-label="Card options"
          disabled={busy}
        >
          ⋯
        </button>
        {isMenuOpen && (
          <CardMenu
            videoId={video.id}
            onClose={onCloseMenu}
            onDelete={onDelete}
            onLevelChange={onLevelChange}
            onTopicChange={onTopicChange}
            busy={busy}
          />
        )}
      </div>
    </div>
  )
}

export default function VideoLibraryEditor() {
  const { videos, setVideos, loading, error, refetch } = useVideos()
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [menuOpenId, setMenuOpenId] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null) // { ids: [...] }
  const [busy, setBusy] = useState(false)
  const [opError, setOpError] = useState(null)

  // Filters
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState('')
  const [topicFilter, setTopicFilter] = useState('')

  const filteredVideos = videos.filter(v => {
    if (search && !v.title.toLowerCase().includes(search.toLowerCase()) &&
        !(v.channel_name || '').toLowerCase().includes(search.toLowerCase())) return false
    if (levelFilter && v.level !== levelFilter) return false
    if (topicFilter && v.topic_primary !== topicFilter && v.topic_secondary !== topicFilter) return false
    return true
  })

  const anySelected = selectedIds.size > 0

  const toggleSelect = id => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectAll = () => setSelectedIds(new Set(filteredVideos.map(v => v.id)))
  const deselectAll = () => setSelectedIds(new Set())

  const handleDelete = useCallback(ids => {
    setConfirmDelete({ ids })
  }, [])

  const confirmAndDelete = async () => {
    const { ids } = confirmDelete
    setConfirmDelete(null)
    setBusy(true)
    setOpError(null)
    try {
      await apiFetch('/api/delete-video', {
        method: 'POST',
        body: JSON.stringify({ videoIds: ids }),
      })
      setVideos(prev => prev.filter(v => !ids.includes(v.id)))
      setSelectedIds(prev => { const next = new Set(prev); ids.forEach(id => next.delete(id)); return next })
      window.dispatchEvent(new Event('ngsi-inventory-change'))
    } catch (e) {
      setOpError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const handleLevelChange = useCallback(async (ids, level) => {
    setBusy(true)
    setOpError(null)
    try {
      await apiFetch('/api/update-video', {
        method: 'POST',
        body: JSON.stringify({ videoIds: ids, level }),
      })
      setVideos(prev => prev.map(v => ids.includes(v.id) ? { ...v, level } : v))
      window.dispatchEvent(new Event('ngsi-inventory-change'))
    } catch (e) {
      setOpError(e.message)
    } finally {
      setBusy(false)
    }
  }, [setVideos])

  const handleTopicChange = useCallback(async (ids, topic) => {
    setBusy(true)
    setOpError(null)
    try {
      await apiFetch('/api/update-video', {
        method: 'POST',
        body: JSON.stringify({ videoIds: ids, topic }),
      })
      setVideos(prev => prev.map(v => ids.includes(v.id) ? { ...v, topic_primary: topic } : v))
    } catch (e) {
      setOpError(e.message)
    } finally {
      setBusy(false)
    }
  }, [setVideos])

  const bulkIds = Array.from(selectedIds)

  if (loading) return <p style={s.hint}>Loading library…</p>
  if (error) return <p style={s.error}>{error}</p>

  return (
    <div>
      {/* Filters */}
      <div style={s.filterRow}>
        <input
          type="search"
          placeholder="Search by title or channel…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={s.searchInput}
        />
        <select value={levelFilter} onChange={e => setLevelFilter(e.target.value)} style={s.filterSelect}>
          <option value="">All Levels</option>
          {LEVELS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>
        <select value={topicFilter} onChange={e => setTopicFilter(e.target.value)} style={s.filterSelect}>
          <option value="">All Topics</option>
          {TOPIC_CATEGORIES.map(cat => (
            <optgroup key={cat.key} label={cat.label}>
              {cat.topics.map(t => <option key={t} value={t}>{t}</option>)}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Bulk action bar */}
      {anySelected && (
        <div style={s.bulkBar}>
          <label style={s.bulkCheck}>
            <input
              type="checkbox"
              checked={selectedIds.size === filteredVideos.length}
              onChange={selectedIds.size === filteredVideos.length ? deselectAll : selectAll}
            />
            <span>{selectedIds.size} selected</span>
          </label>
          <div style={s.bulkActions}>
            <button
              style={{ ...s.bulkBtn, color: '#c0524a', borderColor: '#c0524a' }}
              disabled={busy}
              onClick={() => handleDelete(bulkIds)}
            >
              Delete selected
            </button>
            <select
              style={s.bulkSelect}
              defaultValue=""
              disabled={busy}
              onChange={e => { if (e.target.value) { handleLevelChange(bulkIds, e.target.value); e.target.value = '' } }}
            >
              <option value="" disabled>Set Level…</option>
              {LEVELS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
            <select
              style={s.bulkSelect}
              defaultValue=""
              disabled={busy}
              onChange={e => { if (e.target.value) { handleTopicChange(bulkIds, e.target.value); e.target.value = '' } }}
            >
              <option value="" disabled>Set Topic…</option>
              {TOPIC_CATEGORIES.map(cat => (
                <optgroup key={cat.key} label={cat.label}>
                  {cat.topics.map(t => <option key={t} value={t}>{t}</option>)}
                </optgroup>
              ))}
            </select>
            <button style={{ ...s.bulkBtn, marginLeft: 'auto' }} onClick={deselectAll}>Deselect all</button>
          </div>
        </div>
      )}

      {opError && <p style={s.error}>{opError}</p>}

      {filteredVideos.length === 0 ? (
        <p style={s.hint}>{videos.length === 0 ? 'No videos in the library yet.' : 'No videos match these filters.'}</p>
      ) : (
        <>
          <p style={s.count}>{filteredVideos.length} video{filteredVideos.length !== 1 ? 's' : ''}</p>
          <style>{`.ngsi-lib-card:hover .ngsi-card-check { opacity: 1 !important; }`}</style>
          <div style={s.grid}>
            {filteredVideos.map(v => (
              <AdminCard
                key={v.id}
                video={v}
                isSelected={selectedIds.has(v.id)}
                anySelected={anySelected}
                onToggle={toggleSelect}
                menuOpenId={menuOpenId}
                onOpenMenu={setMenuOpenId}
                onCloseMenu={() => setMenuOpenId(null)}
                onDelete={handleDelete}
                onLevelChange={handleLevelChange}
                onTopicChange={handleTopicChange}
                busy={busy}
              />
            ))}
          </div>
        </>
      )}

      {confirmDelete && (
        <ConfirmModal
          count={confirmDelete.ids.length}
          onConfirm={confirmAndDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = {
  filterRow: { display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  searchInput: {
    flex: '1 1 220px',
    padding: '8px 12px',
    fontSize: 13,
    border: '1.5px solid #d0d5dd',
    borderRadius: 7,
    background: '#fff',
    color: 'var(--ngsi-navy)',
    fontFamily: 'inherit',
    outline: 'none',
  },
  filterSelect: {
    padding: '8px 10px',
    fontSize: 13,
    border: '1.5px solid #d0d5dd',
    borderRadius: 7,
    background: '#fff',
    color: 'var(--ngsi-navy)',
    fontFamily: 'inherit',
    cursor: 'pointer',
    minWidth: 130,
  },
  bulkBar: {
    background: 'var(--ngsi-navy)',
    color: '#fff',
    borderRadius: 8,
    padding: '10px 14px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  bulkCheck: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    flexShrink: 0,
  },
  bulkActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    flexWrap: 'wrap',
  },
  bulkBtn: {
    padding: '5px 12px',
    fontSize: 12,
    fontWeight: 600,
    border: '1.5px solid rgba(255,255,255,0.5)',
    borderRadius: 6,
    background: 'transparent',
    color: '#fff',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  bulkSelect: {
    padding: '5px 8px',
    fontSize: 12,
    border: '1.5px solid rgba(255,255,255,0.4)',
    borderRadius: 6,
    background: 'rgba(255,255,255,0.12)',
    color: '#fff',
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  count: { margin: '0 0 10px', fontSize: 12, color: '#8a8f99' },
  grid: { display: 'flex', flexDirection: 'column', gap: 8 },
  hint: { fontSize: 13, color: '#8a8f99', margin: '20px 0' },
  error: { fontSize: 13, color: '#c0524a', margin: '8px 0' },
}

const card = {
  wrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: '#fff',
    border: '1px solid #e8e3da',
    borderRadius: 10,
    padding: '10px 12px',
    position: 'relative',
  },
  checkWrap: {
    flexShrink: 0,
    opacity: 0,
    transition: 'opacity 0.12s',
  },
  checkbox: { width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--ngsi-navy)' },
  thumb: {
    flexShrink: 0,
    width: 80,
    height: 45,
    borderRadius: 5,
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
  channel: { margin: '0 0 4px', fontSize: 11, color: '#8a8f99' },
  chips: { display: 'flex', gap: 4, flexWrap: 'wrap' },
  menuWrap: { position: 'relative', flexShrink: 0 },
  menuBtn: {
    background: 'none',
    border: 'none',
    fontSize: 18,
    color: '#8a8f99',
    cursor: 'pointer',
    padding: '2px 6px',
    borderRadius: 4,
    fontFamily: 'inherit',
    lineHeight: 1,
  },
}

const chip = {
  base: {
    display: 'inline-block',
    padding: '2px 7px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
    lineHeight: '16px',
  },
}

const menu = {
  wrap: {
    position: 'absolute',
    right: 0,
    top: '100%',
    zIndex: 100,
    background: '#fff',
    border: '1px solid #e8e3da',
    borderRadius: 8,
    boxShadow: '0 4px 16px rgba(22,32,64,0.14)',
    padding: '6px 0',
    minWidth: 180,
  },
  item: {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    background: 'none',
    border: 'none',
    padding: '7px 14px',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
    color: 'var(--ngsi-navy)',
  },
  divider: { height: 1, background: '#f0ece2', margin: '4px 0' },
  label: {
    display: 'block',
    padding: '4px 14px 2px',
    fontSize: 10,
    fontWeight: 700,
    color: '#8a8f99',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  select: {
    display: 'block',
    width: 'calc(100% - 28px)',
    margin: '0 14px 6px',
    padding: '5px 8px',
    fontSize: 12,
    border: '1px solid #d0d5dd',
    borderRadius: 5,
    background: '#fff',
    color: 'var(--ngsi-navy)',
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
}

const modal = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(22,32,64,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 500,
  },
  box: {
    background: '#fff',
    borderRadius: 12,
    padding: '24px 28px',
    maxWidth: 360,
    width: '90%',
    boxShadow: '0 8px 32px rgba(22,32,64,0.18)',
  },
  msg: { margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: 'var(--ngsi-navy)' },
  sub: { margin: '0 0 20px', fontSize: 13, color: '#5a6070' },
  btns: { display: 'flex', gap: 10, justifyContent: 'flex-end' },
  cancelBtn: {
    padding: '8px 18px',
    fontSize: 13,
    fontWeight: 600,
    border: '1.5px solid #d0d5dd',
    borderRadius: 7,
    background: '#fff',
    color: 'var(--ngsi-navy)',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  confirmBtn: {
    padding: '8px 18px',
    fontSize: 13,
    fontWeight: 600,
    border: 'none',
    borderRadius: 7,
    background: '#c0524a',
    color: '#fff',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
}
