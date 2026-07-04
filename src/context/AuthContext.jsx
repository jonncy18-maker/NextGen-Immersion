import { createContext, useContext, useState, useEffect } from 'react';
import { authClient } from '../lib/auth.js';
import { getAuthToken } from '../lib/authToken.js';

const AuthContext = createContext({ user: null, role: null, loading: true, signOut: async () => {} });

export function AuthProvider({ children }) {
  const { data: sessionData, isPending } = authClient.useSession();
  const [role, setRole] = useState(null);
  const [user, setUser] = useState(null);
  // `loading` gates the UI ONLY until auth is resolved the first time. It starts
  // true and, once we've resolved the session (with or without a user), it is
  // never flipped back to true. This is deliberate:
  //
  // Better Auth's useSession() refetches the session whenever the tab/window
  // regains focus. Each refetch hands back a NEW sessionData object (same signed-
  // in user), and previously that (a) re-ran the effect and (b) flipped loading
  // back to true — which made RequireAuth/RequireAdmin render null and UNMOUNT
  // the whole page tree. When /api/me resolved the page remounted fresh, wiping
  // all screen state (selected video, filters, scroll). i.e. "moving away from
  // the screen refreshed it to its initial state." Keeping loading latched-false
  // after the first resolution keeps the page mounted across those background
  // revalidations. We also key the effect on the stable user id, not the
  // sessionData object reference, so an unchanged user never re-triggers it.
  const [loading, setLoading] = useState(true);

  const sessionUserId = sessionData?.user?.id ?? null;

  useEffect(() => {
    // Wait for the FIRST session determination only. During a later background
    // refetch isPending may blip, but `loading` is already latched false so the
    // tree stays mounted regardless.
    if (isPending) return;

    if (!sessionUserId) {
      setUser(null);
      setRole(null);
      setLoading(false);
      return;
    }

    // Session available — fetch a JWT, then look up role from our API
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
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Keyed on the stable user id so a focus-triggered session refetch with an
    // unchanged user does not re-run role resolution or remount the app.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, sessionUserId]);

  async function signOut() {
    await authClient.signOut();
    setUser(null);
    setRole(null);
  }

  return (
    <AuthContext.Provider value={{ user, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
