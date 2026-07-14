import { useState, useRef, useEffect } from 'react'

// The avatar in the top-right doubles as the account menu: tap it to reveal
// the signed-in name and a Sign out action. This keeps Sign out reachable on
// every screen size without a standalone button that overflowed the mobile
// navbar. Closes on outside-click or Escape.
export default function AvatarMenu({ displayName, initial, onSignOut }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function onDocPointer(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocPointer)
    document.addEventListener('touchstart', onDocPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocPointer)
      document.removeEventListener('touchstart', onDocPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} style={styles.wrap}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        style={styles.avatar}
      >
        {initial}
      </button>

      {open && (
        <div role="menu" style={styles.menu}>
          {displayName && (
            <div style={styles.header}>
              <span style={styles.name}>{displayName}</span>
            </div>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onSignOut()
            }}
            style={styles.item}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(201,168,76,0.14)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

const styles = {
  wrap: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  avatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: 'var(--ngsi-navy-light)',
    border: '1.5px solid var(--ngsi-gold)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--ngsi-gold)',
    fontWeight: '700',
    fontSize: '14px',
    flexShrink: 0,
    cursor: 'pointer',
    padding: 0,
  },
  menu: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    right: 0,
    minWidth: '180px',
    background: 'var(--ngsi-surface)',
    border: '1px solid var(--ngsi-cream-dark)',
    borderRadius: '10px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
    overflow: 'hidden',
    zIndex: 300,
    padding: '4px',
  },
  header: {
    padding: '8px 12px',
    borderBottom: '1px solid var(--ngsi-cream-dark)',
    marginBottom: '4px',
  },
  name: {
    display: 'block',
    color: 'var(--ngsi-navy)',
    fontSize: '13px',
    fontWeight: 700,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  item: {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    background: 'transparent',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 12px',
    color: 'var(--ngsi-navy)',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
}
