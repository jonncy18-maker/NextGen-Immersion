import { useState } from 'react'
import AddVideoPanel from '../components/admin/AddVideoPanel.jsx'
import VideoLibraryEditor from '../components/admin/VideoLibraryEditor.jsx'
import { getAuthToken } from '../lib/authToken.js'

function parseYouTubeUrl(raw) {
  try {
    const u = new URL(raw.trim())
    const host = u.hostname.replace(/^www\./, '').replace(/^m\./, '')
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1).split('?')[0]
      if (id) return { type: 'video', youtubeId: id }
    }
    if (host === 'youtube.com') {
      const v = u.searchParams.get('v')
      if (v) return { type: 'video', youtubeId: v }
      const list = u.searchParams.get('list')
      if (list) return { type: 'playlist', youtubeId: list }
      const parts = u.pathname.split('/').filter(Boolean)
      if (parts[0] === 'channel' && parts[1]) {
        return { type: 'channel', youtubeId: parts[1] }
      }
    }
  } catch {}
  return null
}

export default function AdminVideos() {
  const [tab, setTab] = useState('discover')

  const [importUrl, setImportUrl] = useState('')
  const [importState, setImportState] = useState('idle') // idle|loading|done|error
  const [importResult, setImportResult] = useState(null)
  const [importError, setImportError] = useState('')

  const [staleState, setStaleState] = useState('idle') // idle|loading|done|error
  const [staleResult, setStaleResult] = useState(null)

  async function handleImport() {
    const parsed = parseYouTubeUrl(importUrl)
    if (!parsed) {
      setImportError(
        "Couldn't parse URL. Paste a YouTube video (?v=…), playlist (?list=…), or channel (/channel/UC…) URL.",
      )
      return
    }
    setImportError('')
    setImportState('loading')
    setImportResult(null)
    try {
      const token = await getAuthToken()
      const res = await fetch('/api/youtube-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: parsed.type, youtubeId: parsed.youtubeId, language: 'english' }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Import failed')
      }
      const data = await res.json()
      setImportResult(data)
      setImportState('done')
    } catch (err) {
      setImportError(err.message || 'Import failed')
      setImportState('error')
    }
  }

  async function handleStaleCheck() {
    setStaleState('loading')
    setStaleResult(null)
    try {
      const token = await getAuthToken()
      const res = await fetch('/api/stale-check', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Check failed')
      const data = await res.json()
      setStaleResult(data)
      setStaleState('done')
    } catch {
      setStaleState('error')
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.title}>Video Library</h1>

        {/* ── Tab bar ───────────────────────────────────────────────── */}
        <div style={styles.tabBar}>
          <button
            style={{ ...styles.tab, ...(tab === 'discover' ? styles.tabActive : {}) }}
            onClick={() => setTab('discover')}
          >
            Discover &amp; Import
          </button>
          <button
            style={{ ...styles.tab, ...(tab === 'library' ? styles.tabActive : {}) }}
            onClick={() => setTab('library')}
          >
            Manage Library
          </button>
        </div>

        {/* ── Discover & Import tab ─────────────────────────────────── */}
        {tab === 'discover' && (
          <>
            <p style={styles.sub}>
              Search YouTube to find content for the library. Music videos are excluded
              automatically. Each result is AI-tagged with level and topic before you add it.
            </p>
            <AddVideoPanel />

            {/* ── Import by URL ──────────────────────────────────────── */}
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>Import by URL</h2>
              <p style={styles.sub}>
                Paste a YouTube video, playlist, or channel URL. AI-tags and adds all videos (up to
                50 per import). Channel URLs must use the /channel/UC… format.
              </p>
              <div style={styles.importRow}>
                <input
                  type="url"
                  value={importUrl}
                  onChange={(e) => {
                    setImportUrl(e.target.value)
                    setImportError('')
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleImport()}
                  placeholder="https://www.youtube.com/watch?v=… or /playlist?list=… or /channel/UC…"
                  style={styles.importInput}
                  disabled={importState === 'loading'}
                />
                <button
                  onClick={handleImport}
                  disabled={!importUrl.trim() || importState === 'loading'}
                  style={{
                    ...styles.btn,
                    ...(!importUrl.trim() || importState === 'loading' ? styles.btnDisabled : {}),
                  }}
                >
                  {importState === 'loading' ? 'Importing…' : 'Import'}
                </button>
              </div>
              {importError && <p style={styles.error}>{importError}</p>}
              {importState === 'done' && importResult && (
                <p style={styles.success}>
                  Imported {importResult.imported} video{importResult.imported !== 1 ? 's' : ''},
                  skipped {importResult.skipped} already in library.
                </p>
              )}
            </div>

            {/* ── Library Tools ──────────────────────────────────────── */}
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>Library Tools</h2>
              <p style={styles.sub}>
                Check for videos that have been deleted, made private, or are no longer embeddable.
                Stale videos are flagged unavailable but never deleted — their watch history is
                preserved.
              </p>
              <button
                onClick={handleStaleCheck}
                disabled={staleState === 'loading'}
                style={{
                  ...styles.outlineBtn,
                  ...(staleState === 'loading' ? styles.btnDisabled : {}),
                }}
              >
                {staleState === 'loading' ? 'Checking…' : 'Check for stale videos'}
              </button>
              {staleState === 'done' && staleResult && (
                <p style={styles.success}>
                  {staleResult.flagged === 0
                    ? `All ${staleResult.checked} videos are available.`
                    : `Checked ${staleResult.checked} — flagged ${staleResult.flagged} unavailable: ${staleResult.flaggedTitles.join(', ')}${staleResult.flagged > 5 ? '…' : ''}`}
                </p>
              )}
              {staleState === 'error' && (
                <p style={styles.error}>Stale check failed. Try again.</p>
              )}
            </div>
          </>
        )}

        {/* ── Manage Library tab ───────────────────────────────────── */}
        {tab === 'library' && <VideoLibraryEditor />}
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
    margin: '0 0 16px',
    fontSize: 22,
    fontWeight: 700,
    color: 'var(--ngsi-navy)',
  },
  tabBar: {
    display: 'flex',
    gap: 4,
    borderBottom: '2px solid #e8e3da',
    marginBottom: 24,
  },
  tab: {
    padding: '8px 18px',
    fontSize: 13,
    fontWeight: 600,
    border: 'none',
    background: 'none',
    color: '#8a8f99',
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    marginBottom: -2,
    fontFamily: 'inherit',
    transition: 'color 0.12s',
  },
  tabActive: {
    color: 'var(--ngsi-navy)',
    borderBottom: '2px solid var(--ngsi-navy)',
  },
  sub: {
    margin: '0 0 20px',
    fontSize: 13,
    color: '#5a6070',
    lineHeight: 1.5,
  },
  section: {
    marginTop: 40,
    paddingTop: 32,
    borderTop: '1px solid #e8e3da',
  },
  sectionTitle: {
    margin: '0 0 6px',
    fontSize: 17,
    fontWeight: 700,
    color: 'var(--ngsi-navy)',
  },
  importRow: {
    display: 'flex',
    gap: 8,
    marginBottom: 10,
  },
  importInput: {
    flex: 1,
    padding: '10px 14px',
    fontSize: 13,
    border: '1.5px solid #d0d5dd',
    borderRadius: 8,
    outline: 'none',
    background: '#fff',
    color: 'var(--ngsi-navy)',
    fontFamily: 'inherit',
  },
  btn: {
    padding: '10px 18px',
    fontSize: 13,
    fontWeight: 600,
    border: 'none',
    borderRadius: 8,
    background: 'var(--ngsi-navy)',
    color: '#fff',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  outlineBtn: {
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 600,
    border: '1.5px solid var(--ngsi-navy)',
    borderRadius: 8,
    background: 'transparent',
    color: 'var(--ngsi-navy)',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  btnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  success: {
    fontSize: 13,
    color: '#1D9E75',
    margin: '8px 0 0',
  },
  error: {
    fontSize: 13,
    color: '#c0524a',
    margin: '8px 0 0',
  },
}
