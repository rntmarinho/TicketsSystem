import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { apiFetch, safeJson } from '../services/api';

const AuthContext = createContext(null);

function decodeToken(token) {
  try {
    const payload = token.split('.')[1];
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(normalized));
  } catch {
    return null;
  }
}

function isTokenValid(token) {
  const decoded = decodeToken(token);
  return !!(decoded && decoded.exp && decoded.exp * 1000 > Date.now());
}

// Contexto de autenticação real: valida expiração do JWT e confirma o papel
// atual do usuário via GET /users/me, em vez de confiar cegamente no que está
// salvo no localStorage (que pode estar desatualizado ou ter sido adulterado).
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  const loadSession = useCallback(async () => {
    const token = localStorage.getItem('token');

    if (!token || !isTokenValid(token)) {
      clearSession();
      setLoading(false);
      return;
    }

    try {
      const response = await apiFetch('/users/me');
      const data = await safeJson(response);

      if (response.ok && data && data.id) {
        setUser(data);
        localStorage.setItem('user', JSON.stringify(data));
      } else {
        clearSession();
      }
    } catch {
      // apiFetch já trata 401 (redireciona pro login); outros erros de rede
      // não devem derrubar a sessão local — mantém o usuário como não carregado.
      clearSession();
    } finally {
      setLoading(false);
    }
  }, [clearSession]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const login = (token, userData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    clearSession();
  };

  const value = {
    user,
    role: user?.access_type || null,
    isAuthenticated: !!user,
    loading,
    login,
    logout,
    refresh: loadSession
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth precisa ser usado dentro de um AuthProvider');
  }
  return ctx;
}
