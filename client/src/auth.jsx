import React, { createContext, useContext, useState, useCallback } from 'react';
import { api } from './api.js';

const AuthContext = createContext(null);
const STORE_KEY = 'lt_session';

function readSession() {
  try {
    const raw = localStorage.getItem(STORE_KEY) || sessionStorage.getItem(STORE_KEY);
    return JSON.parse(raw || 'null');
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readSession);

  const login = useCallback(async (identifier, password, remember) => {
    const res = await api.login(identifier, password);
    const data = { token: res.token, user: res.user };
    setSession(data);
    if (remember) localStorage.setItem(STORE_KEY, JSON.stringify(data));
    else sessionStorage.setItem(STORE_KEY, JSON.stringify(data));
    return data;
  }, []);

  const logout = useCallback(() => {
    setSession(null);
    localStorage.removeItem(STORE_KEY);
    sessionStorage.removeItem(STORE_KEY);
  }, []);

  return (
    <AuthContext.Provider value={{ user: session?.user || null, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
