import { createContext, useContext, useState, useEffect } from 'react';
import { authClient } from '../lib/auth.js';
import { getAuthToken } from '../lib/authToken.js';

const AuthContext = createContext({ user: null, role: null, loading: true, signOut: async () => {} });

export function AuthProvider({ children }) {
  const { data: sessionData, isPending } = authClient.useSession();
  const [role, setRole] = useState(null);
  // Start true: when useSession resolves a valid session, isPending flips to
  // false one render BEFORE the effect below runs (effects run after render).
  // If roleLoading were false in that gap, `loading` would be false with user
  // still null, and RequireAuth would redirect to /login before /api/me
  // resolves — stranding an authenticated user on the login page after refresh.
  const [roleLoading, setRoleLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (isPending) return;

    if (!sessionData) {
      setUser(null);
      setRole(null);
      setRoleLoading(false);
      return;
    }

    // Session available — fetch a JWT, then look up role from our API
    setRoleLoading(true);
    let cancelled = false;

    (async () => {
      try {
        const token = await getAuthToken();
        if (!token) {
          if (!cancelled) {
            setUser(null);
            setRole(null);
          }
          return;
        }
        const res = await fetch('/api/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        if (res.status === 404) {
          // Authenticated but not provisioned in public.users
          setUser({ ...sessionData.user, notProvisioned: true });
          setRole(null);
          return;
        }
        if (!res.ok) {
          setUser(null);
          setRole(null);
          return;
        }
        const data = await res.json();
        setUser(sessionData.user);
        setRole(data.role);
      } catch {
        if (!cancelled) {
          setUser(null);
          setRole(null);
        }
      } finally {
        if (!cancelled) setRoleLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isPending, sessionData]);

  async function signOut() {
    await authClient.signOut();
    setUser(null);
    setRole(null);
  }

  const loading = isPending || roleLoading;

  return (
    <AuthContext.Provider value={{ user, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
