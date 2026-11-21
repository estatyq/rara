import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { useLanguage } from '../i18n/LanguageContext';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { setLang } = useLanguage();
  const [token, setToken] = useState(() => localStorage.getItem('rara_token'));
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('rara_user');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  const syncUserLocale = useCallback((u) => {
    if (u?.locale === 'id' || u?.locale === 'en') {
      const stored = localStorage.getItem('rara_lang');
      if (!stored) {
        setLang(u.locale, { syncServer: false });
      } else if (stored !== u.locale) {
        // Keep backend aligned with the user's explicit UI language preference
        api.updateMe({ locale: stored }).catch(() => {});
      }
    }
  }, [setLang]);

  const fetchProfile = useCallback(async () => {
    if (!localStorage.getItem('rara_token')) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await api.getMe();
      setUser(res.user);
      localStorage.setItem('rara_user', JSON.stringify(res.user));
      syncUserLocale(res.user);
    } catch {
      setToken(null);
      setUser(null);
      localStorage.removeItem('rara_token');
      localStorage.removeItem('rara_user');
    } finally {
      setLoading(false);
    }
  }, [syncUserLocale]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const login = async (identifier, password) => {
    const res = await api.login(identifier, password);
    setToken(res.token);
    setUser(res.user);
    localStorage.setItem('rara_token', res.token);
    localStorage.setItem('rara_user', JSON.stringify(res.user));
    syncUserLocale(res.user);
    return res.user;
  };

  const register = async (payload) => {
    const res = await api.register(payload);
    setToken(res.token);
    setUser(res.user);
    localStorage.setItem('rara_token', res.token);
    localStorage.setItem('rara_user', JSON.stringify(res.user));
    return res.user;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('rara_token');
    localStorage.removeItem('rara_user');
    window.location.href = '/login';
  };

  const isStaff = user?.role === 'PHARMACIST' || user?.role === 'ADMIN';
  const isAdmin = user?.role === 'ADMIN';
  const isPatient = user?.role === 'PATIENT';

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        loading,
        isStaff,
        isAdmin,
        isPatient,
        login,
        register,
        logout,
        refreshUser: fetchProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
