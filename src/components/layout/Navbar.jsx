import { useNavigate, NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

export default function Navbar() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();

  const displayName = user?.name || user?.email || '';
  const initial = displayName.charAt(0).toUpperCase();

  async function handleSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

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
          {[
            { to: '/watch', label: 'Watch' },
            { to: '/browse', label: 'Browse' },
            { to: '/progress', label: 'Progress' },
            ...(role === 'admin'
              ? [
                  { to: '/admin/videos', label: 'Videos' },
                  { to: '/admin/progress', label: 'Dashboard' },
                  { to: '/admin/goals', label: 'Goals' },
                ]
              : []),
          ].map(({ to, label }) => (
            <NavLink
              key={to}
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
              })}
            >
              {label}
            </NavLink>
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
  );
}
