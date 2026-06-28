import { createContext, useContext } from 'react';

/**
 * Shell-only auth context. No real auth/DB logic in this phase — it provides
 * an inert default so consumers can be wired up without breaking.
 */
const defaultAuth = { user: null, role: null, loading: false };

const AuthContext = createContext(defaultAuth);

export function AuthProvider({ children }) {
  return (
    <AuthContext.Provider value={defaultAuth}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
