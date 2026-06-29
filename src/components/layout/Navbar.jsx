import { useState, useEffect } from 'react'
import { useNavigate, NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { getAuthToken } from '../../lib/authToken.js'

export default function Navbar() {
  const { user, role, signOut } = useAuth()
  const navigate = useNavigate()
  const [lowInventory, setLowInventory] = useState(false)

  const displayName = user?.name || user?.email || ''
  const initial = displayName.charAt(0).toUpperCase()

  useEffect(() => {
    if (role !== 'admin') return
    let cancelled = false
    async function checkInventory() {
      try {
        const token = await getAuthToken()
        if (cancelled) return
        const res = await fetch('/api/inventory-check', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (!cancelled) {
          setLowInventory(Object.values(data.levels).some((n) => n < 20))
        }
      } catch {}
    }
    checkInventory()
    return () => {
      cancelled = true
    }
  }, [role])

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  const navItems = [
    { to: '/watch', label: 'Watch' },
    { to: '/browse', label: 'Browse' },
    { to: '/progress', label: 'Progress' },
    ...(role === 'admin'
      ? [
          { to: '/admin/videos', label: 'Videos', badge: lowInventory },
          { to: '/admin/progress', label: 'Dashboard' },
          { to: '/admin/goals', label: 'Goals' },
        ]
      : []),
  ]

  return (
    <nav
      style={{
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
      }}
    >
      {/* Left: Wordmark + nav links */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <span
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: '18px',
            fontWeight: 'bold',
            color: 'var(--ngsi-gold)',
            letterSpacing: '0.01em',
            userSelect: 'none',
          }}
        >
          NGS Immersion
        </span>
        <nav style={{ display: 'flex', gap: 4 }}>
          {navItems.map(({ to, label, badge }) => (
            <div key={to} style={{ position: 'relative', display: 'inline-block' }}>
              <NavLink
                to={to}
                style={({ isActive }) => ({
                  fontSize: 13,
                  fontWeight: isActive ? 700 : 400,
                  color: isActive ? 'var(--ngsi-gold)' : 'var(--ngsi-cream)',
                  textDecoration: 'none',
                  padding: '4px 10px',
                  borderRadius: 6,
                  background: isActive ? 'rgba(201,168,76,0.12)' : 'transparent',
                  transition: 'background 0.15s',
                  display: 'block',
                })}
              >
                {label}
              </NavLink>
              {badge && (
                <span
                  title="Low inventory — some levels have fewer than 20 videos"
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: '#c0524a',
                    pointerEvents: 'none',
                  }}
                />
              )}
            </div>
          ))}
        </nav>
      </div>

      {/* Right: role badge + avatar + name + sign out */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        {/* Admin badge */}
        {role === 'admin' && (
          <span
            style={{
              fontSize: '11px',
              fontWeight: '700',
              color: 'var(--ngsi-gold)',
              border: '1px solid var(--ngsi-gold)',
              borderRadius: '999px',
              padding: '2px 10px',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            Admin
          </span>
        )}

        {/* Avatar */}
        <div
          aria-hidden="true"
          style={{
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
          }}
        >
          {initial}
        </div>

        {/* Display name */}
        <span
          style={{
            color: 'var(--ngsi-cream)',
            fontSize: '13px',
            maxWidth: '160px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {displayName}
        </span>

        {/* Sign out button */}
        <button
          onClick={handleSignOut}
          style={{
            background: 'none',
            border: 'none',
            color: '#8a8f99',
            fontSize: '12px',
            cursor: 'pointer',
            padding: '4px 0',
            lineHeight: 1,
            textDecoration: 'underline',
            textUnderlineOffset: '2px',
          }}
          onMouseEnter={(e) => (e.target.style.color = 'var(--ngsi-cream)')}
          onMouseLeave={(e) => (e.target.style.color = '#8a8f99')}
        >
          Sign out
        </button>
      </div>
    </nav>
  )
}
