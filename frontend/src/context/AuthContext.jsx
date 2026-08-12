import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api, getToken, setToken } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(getToken() ? 'checking' : 'signed-out');

  // A stored token might be expired or from a deleted account, so it is only
  // trusted once the server has confirmed it.
  useEffect(() => {
    if (!getToken()) {
      return undefined;
    }

    const controller = new AbortController();

    api
      .me({ signal: controller.signal })
      .then(({ user: confirmed }) => {
        setUser(confirmed);
        setStatus('signed-in');
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setToken(null);
          setStatus('signed-out');
        }
      });

    return () => controller.abort();
  }, []);

  const accept = useCallback(({ user: nextUser, token }) => {
    setToken(token);
    setUser(nextUser);
    setStatus('signed-in');
  }, []);

  const value = useMemo(
    () => ({
      user,
      status,
      isSignedIn: status === 'signed-in',
      signIn: async (credentials) => accept(await api.login(credentials)),
      signUp: async (details) => accept(await api.register(details)),
      signOut: () => {
        setToken(null);
        setUser(null);
        setStatus('signed-out');
      },
    }),
    [user, status, accept],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth has to be used inside an AuthProvider');
  }

  return context;
}
