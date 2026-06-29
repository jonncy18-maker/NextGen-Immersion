import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { getAuthToken } from '../../lib/authToken.js'

export default function Sidebar() {
  const { role } = useAuth()
  const [lowInventory, setLowInventory] = useState(false)

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
        if (!cancelled) setLowInventory(Object.values(data.levels).some((n) => n < 20))
      } catch {}
    }
    checkInventory()
    window.addEventListener('ngsi-inventory-change', checkInventory)
    return () => {
      cancelled = true
      window.removeEventListener('ngsi-inventory-change', checkInventory)
    }
  }, [role])

  return (
    <aside className="ngsi-hide-mobile" style={styles.sidebar}>
      <div style={styles.section}>
        <span style={styles.sectionLabel}>Scholar</span>
        <SidebarLink to="/watch" icon="▶">Watch</SidebarLink>
        <SidebarLink to="/progress" icon="◎">Progress</SidebarLink>
      </div>
      {role === 'admin' && (
        <>
          <div style={styles.divider} />
          <div style={styles.section}>
            <span style={styles.sectionLabel}>Admin</span>
            <SidebarLink to="/admin/videos" icon="🎬" badge={lowInventory}>
              Videos
            </SidebarLink>
            <SidebarLink to="/admin/progress" icon="📊">Dashboard</SidebarLink>
            <SidebarLink to="/admin/goals" icon="🎯">Goals</SidebarLink>
          </div>
        </>
      )}
    </aside>
  )
}

function SidebarLink({ to, icon, children, badge }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 16px',
        paddingLeft: isActive ? 13 : 16,
        borderLeft: isActive ? '3px solid var(--ngsi-gold)' : '3px solid transparent',
        background: isActive ? 'rgba(201,168,76,0.12)' : 'transparent',
        color: 'var(--ngsi-navy)',
        textDecoration: 'none',
        fontSize: 14,
        fontWeight: isActive ? 700 : 500,
        position: 'relative',
        transition: 'background 0.12s',
      })}
    >
      <span style={{ width: 16, textAlign: 'center', fontSize: 14, flexShrink: 0 }}>{icon}</span>
      {children}
      {badge && (
        <span
          title="Low inventory — some levels have fewer than 20 videos"
          style={{
            position: 'absolute',
            right: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: '#c0524a',
          }}
        />
      )}
    </NavLink>
  )
}

const styles = {
  sidebar: {
    width: 200,
    flexShrink: 0,
    background: 'var(--ngsi-cream-dark)',
    borderRight: '1px solid #d5cfc5',
    display: 'flex',
    flexDirection: 'column',
    paddingTop: 16,
    overflowY: 'auto',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#8a8f99',
    padding: '4px 16px 6px',
  },
  divider: {
    height: 1,
    background: '#d5cfc5',
    margin: '12px 16px',
  },
}
