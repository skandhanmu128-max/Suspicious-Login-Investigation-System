import React, { createContext, useContext, useState, useEffect } from 'react';
import api, { getStoredToken, setStoredToken } from '../services/api';

export type UserRole = 'ADMIN' | 'ANALYST';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar_color?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  role: UserRole | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem('sentinel_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(getStoredToken);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      const existingToken = getStoredToken();
      if (!existingToken) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      try {
        const data = await api.auth.me();
        if (data.user) {
          setUser(data.user);
          localStorage.setItem('sentinel_user', JSON.stringify(data.user));
        } else {
          logout();
        }
      } catch {
        logout();
      } finally {
        setIsLoading(false);
      }
    }

    checkAuth();

    const handleUnauthorized = () => {
      logout();
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  async function login(email: string, pass: string) {
    setIsLoading(true);
    try {
      const data = await api.auth.login({ email, password: pass });
      if (data.token && data.user) {
        setToken(data.token);
        setUser(data.user);
        setStoredToken(data.token);
        localStorage.setItem('sentinel_user', JSON.stringify(data.user));
      } else {
        throw new Error('Invalid response from authentication server.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  function logout() {
    api.auth.logout();
    setToken(null);
    setUser(null);
    setStoredToken(null);
    localStorage.removeItem('sentinel_user');
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role ?? null,
        token,
        isAuthenticated: Boolean(token && user),
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
