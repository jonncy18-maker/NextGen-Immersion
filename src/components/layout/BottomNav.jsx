import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'

const scholarTabs = [
  { to: '/watch', icon: '▶', label: 'Watch' },
  { to: '/progress', icon: '◎', label: 'Progress' },
]

const adminTabs = [
  { to: '/watch', icon: '▶', label: 'Watch' },
  { to: '/progress', icon: '◎', label: 'Progress' },
  { to: '/admin/progress', icon: '⊞', label: 'Dashboard' },
  { to: '/admin/videos', icon: '▤', label: 'Videos' },
  { to: '/admin/goals', icon: '◈', label: 'Goals' },
]

export default function BottomNav() {
  const { role } = useAuth()
  const tabs = role === 'admin' ? adminTabs : scholarTabs

  return (
    <nav className="ngsi-hide-desktop" style={styles.nav}>
      {tabs.map(({ to, icon, label }) => (
        <NavLink
          key={to}
          to={to}
          style={({ isActive }) => ({
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
            textDecoration: 'none',
            paddingBottom: 4,
            color: isActive ? 'var(--ngsi-gold)' : '#8a9bb5',
          })}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.04em' }}>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

const styles = {
  nav: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    height: 56,
    background: 'var(--ngsi-navy)',
    display: 'flex',
    alignItems: 'stretch',
    borderTop: '1px solid var(--ngsi-navy-light)',
    zIndex: 200,
  },
}
