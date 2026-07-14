import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authClient } from '../lib/auth.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Navigate only once auth state actually reflects the signed-in user. Doing
  // this here (instead of right after signIn resolves) avoids a race: signIn
  // sets the session, but useSession + /api/me haven't propagated yet, so an
  // immediate navigate hit the guard with user still null and bounced back to
  // /login — which is why the FIRST sign-in attempt failed and only the second
  // (session already present) worked. This also redirects an already
  // authenticated user away from /login. Land on Home ("/"), not Watch.
  useEffect(() => {
    if (!loading && user) {
      navigate('/', { replace: true });
    }
  }, [user, loading, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const result = await authClient.signIn.email({
        email,
        password,
      });

      if (result?.error) {
        setError(result.error.message || 'Sign in failed. Please check your credentials.');
        setSubmitting(false);
        return;
      }
      // Success: keep the button in its submitting state and let the effect
      // above navigate once the auth context resolves the user. Do NOT navigate
      // here — the session hasn't propagated to the route guard yet.
    } catch (err) {
      setError(err?.message || 'Sign in failed. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--ngsi-navy)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '48px 40px',
          width: '100%',
          maxWidth: '400px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: '28px',
              fontWeight: 'bold',
              color: 'var(--ngsi-gold)',
              margin: '0 0 8px 0',
            }}
          >
            NGS Immersion
          </h1>
          <p
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: '14px',
              color: '#6b7280',
              margin: 0,
            }}
          >
            Immersive Learning Platform
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label
              htmlFor="email"
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '6px',
              }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
              style={{
                width: '100%',
                padding: '10px 14px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '15px',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--ngsi-gold)')}
              onBlur={(e) => (e.target.style.borderColor = '#d1d5db')}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label
              htmlFor="password"
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '6px',
              }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              style={{
                width: '100%',
                padding: '10px 14px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '15px',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--ngsi-gold)')}
              onBlur={(e) => (e.target.style.borderColor = '#d1d5db')}
            />
          </div>

          {/* Error message */}
          {error && (
            <div
              style={{
                marginBottom: '16px',
                padding: '10px 14px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                color: '#dc2626',
                fontSize: '13px',
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: submitting ? '#b8934a' : 'var(--ngsi-gold)',
              color: 'var(--ngsi-navy)',
              border: 'none',
              borderRadius: '6px',
              fontSize: '15px',
              fontWeight: '700',
              cursor: submitting ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.15s',
              letterSpacing: '0.02em',
            }}
          >
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
