import { createContext, useContext, useState, useEffect } from 'react';
import { authClient } from '../lib/auth.js';

const AuthContext = createContext({ user: null, role: null, loading: true, signOut: async () => {} });

export function AuthProvider({ children }) {
  const { data: sessionData, isPending } = authClient.useSession();
  const [role, setRole] = useState(null);
  const [roleLoading, setRoleLoading] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (isPending) return;

    if (!sessionData) {
      setUser(null);
      setRole(null);
      setRoleLoading(false);
      return;
    }

    // Session available — fetch role from our API
    setRoleLoading(true);
    const token = sessionData?.session?.token;

    fetch('/api/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (res.status === 404) {
          // User exists in Better Auth but not provisioned in public.users
          setUser({ ...sessionData.user, notProvisioned: true });
          setRole(null);
          return;
        }
        if (!res.ok) {
          // Other error — treat as not signed in
          setUser(null);
          setRole(null);
          return;
        }
        const data = await res.json();
        setUser(sessionData.user);
        setRole(data.role);
      })
      .catch(() => {
        setUser(null);
        setRole(null);
      })
      .finally(() => {
        setRoleLoading(false);
      });
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
