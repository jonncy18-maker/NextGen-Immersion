import { useState } from 'react'

// Manual "pull the latest deploy" escape hatch. Our service worker serves the
// app shell stale-while-revalidate (see public/sw.js), so an installed PWA kept
// warm in the background can run an old shell indefinitely. Clicking this button
// asks the SW to check for a new sw.js, purges only the ngsi-* app-shell/static
// caches so the reload re-fetches fresh from network, then reloads.
//
// CRITICAL — it must NOT touch anything that would drop state:
//   - no localStorage writes/clears  → preserves the offline hours buffer
//                                       (src/utils/offlineBuffer.js) + theme
//   - no cookie changes               → preserves the first-party auth session
//   - no service-worker unregister    → keeps the sendBeacon flush path alive
//   - only deletes caches whose key startsWith('ngsi-') — never other caches
//
// Two visual modes via `variant`:
//   "sidebar" — full-width row styled like the sidebar's nav items (desktop)
//   "navbar"  — icon-only round button mirroring ThemeToggle (mobile)
// Inline SVG so the icon renders identically on every platform. The bare
// `↻` character we used first was nearly invisible on some Android system
// fonts (it fell back to a plain circle), so users couldn't tell it was a
// refresh control. This is the Feather "refresh-cw" glyph; it inherits the
// button's text color via `currentColor`.
function RefreshIcon({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  )
}

export default function UpdateButton({ variant = 'navbar' }) {
  const [busy, setBusy] = useState(false)

  async function handleRefresh() {
    if (busy) return
    setBusy(true)

    // 1. Ask the service worker to check for a newer sw.js.
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration()
        if (registration) await registration.update()
      } catch {
        // ignore — a failed update check should not block the reload
      }
    }

    // 2. Purge only our own app-shell/static caches so the reload pulls fresh
    //    from network. Never delete caches we didn't create.
    if ('caches' in window) {
      try {
        const keys = await caches.keys()
        await Promise.all(
          keys.filter((key) => key.startsWith('ngsi-')).map((key) => caches.delete(key)),
        )
      } catch {
        // ignore — reload still helps even if cache purge fails
      }
    }

    // 3. Reload — unmounts everything and re-fetches the shell.
    window.location.reload()
  }

  if (variant === 'sidebar') {
    return (
      <button
        type="button"
        onClick={handleRefresh}
        disabled={busy}
        aria-label="Refresh app"
        title="Refresh app — pull the latest version"
        style={styles.sidebarBtn}
        onMouseEnter={(e) => {
          if (!busy) e.currentTarget.style.background = 'rgba(201,168,76,0.12)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
        }}
      >
        <span style={styles.sidebarIcon} className={busy ? 'ngsi-spin' : undefined}>
          <RefreshIcon size={16} />
        </span>
        {busy ? 'Refreshing…' : 'Refresh app'}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleRefresh}
      disabled={busy}
      aria-label="Refresh app"
      title="Refresh app"
      style={styles.navbarBtn}
    >
      <span className={busy ? 'ngsi-spin' : undefined} style={{ lineHeight: 1, display: 'flex' }}>
        <RefreshIcon size={16} />
      </span>
    </button>
  )
}

const styles = {
  // Mirrors ThemeToggle's round icon-button in the navbar.
  navbarBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '30px',
    height: '30px',
    borderRadius: '50%',
    border: '1px solid var(--ngsi-navy-light)',
    background: 'transparent',
    color: 'var(--ngsi-gold)',
    fontSize: '16px',
    cursor: 'pointer',
    flexShrink: 0,
    lineHeight: 1,
  },
  // Belongs with the sidebar's SidebarLink rows (same padding / font-size).
  sidebarBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '8px 16px',
    border: 'none',
    borderLeft: '3px solid transparent',
    background: 'transparent',
    color: 'var(--ngsi-navy)',
    fontSize: 14,
    fontWeight: 500,
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'background 0.12s',
  },
  sidebarIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 16,
    flexShrink: 0,
  },
}
