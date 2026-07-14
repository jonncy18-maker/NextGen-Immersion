import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import ConnectionPill from './ConnectionPill.jsx'
import ThemeToggle from './ThemeToggle.jsx'

export default function Navbar() {
  const { user, role, signOut } = useAuth()
  const navigate = useNavigate()

  const displayName = user?.name || user?.email || ''
  const initial = displayName.charAt(0).toUpperCase()

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <nav style={styles.nav}>
      <div style={styles.brand}>
        <img src="/icons/icon-512.png" alt="" style={styles.brandIcon} />
        <span style={styles.wordmark}>NGS Immersion</span>
      </div>

      <div style={styles.right}>
        <ThemeToggle />
        <ConnectionPill />

        {role === 'admin' && <span style={styles.adminPill}>Admin</span>}

        <div aria-hidden="true" style={styles.avatar}>
          {initial}
        </div>

        <span style={styles.displayName}>{displayName}</span>

        <button
          onClick={handleSignOut}
          style={styles.signOutBtn}
          onMouseEnter={(e) => (e.target.style.color = 'var(--ngsi-cream)')}
          onMouseLeave={(e) => (e.target.style.color = '#8a8f99')}
        >
          Sign out
        </button>
      </div>
    </nav>
  )
}

const styles = {
  nav: {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    width: '100%',
    height: '56px',
    backgroundColor: 'var(--ngsi-navy)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 20px',
    boxSizing: 'border-box',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  brandIcon: {
    width: '30px',
    height: '30px',
    borderRadius: '7px',
    display: 'block',
    flexShrink: 0,
  },
  wordmark: {
    fontFamily: 'Georgia, serif',
    fontSize: '18px',
    fontWeight: 'bold',
    color: 'var(--ngsi-gold)',
    letterSpacing: '0.01em',
    userSelect: 'none',
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  adminPill: {
    fontSize: '11px',
    fontWeight: '700',
    color: 'var(--ngsi-gold)',
    border: '1px solid var(--ngsi-gold)',
    borderRadius: '999px',
    padding: '2px 10px',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
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
  },
  displayName: {
    color: 'var(--ngsi-cream)',
    fontSize: '13px',
    maxWidth: '160px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  signOutBtn: {
    background: 'none',
    border: 'none',
    color: '#8a8f99',
    fontSize: '12px',
    cursor: 'pointer',
    padding: '4px 0',
    lineHeight: 1,
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
  },
}
