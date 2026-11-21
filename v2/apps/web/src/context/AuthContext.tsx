import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, type AuthUser, setSessionTokens } from '../lib/api';

export interface ActiveAlarm {
  doseId: string | null;
  medicationName: string;
  dosage: string | null;
  instructions: string | null;
  timeLabel: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  isStaff: boolean;
  isOffline: boolean;
  activeAlarm: ActiveAlarm | null;
  setActiveAlarm: (alarm: ActiveAlarm | null) => void;
  login: (identifier: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  switchLocale: (next: 'id' | 'en') => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [activeAlarm, setActiveAlarm] = useState<ActiveAlarm | null>(null);

  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.getMe();
      setUser(res.user);
      setSessionTokens(null, res.user.activeTenantId);
      if (res.user.locale && res.user.locale !== i18n.language) {
        const stored = localStorage.getItem('dm_lang');
        if (!stored) void i18n.changeLanguage(res.user.locale);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [i18n]);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const login = async (identifier: string, password: string) => {
    const res = await api.login({ login: identifier, password });
    setSessionTokens(res.accessToken, res.user.activeTenantId);
    const me = await api.getMe();
    setUser(me.user);
    return me.user;
  };

  const logout = async () => {
    try {
      await api.logout();
    } finally {
      setSessionTokens(null, null);
      setUser(null);
    }
  };

  const switchLocale = (next: 'id' | 'en') => {
    localStorage.setItem('dm_lang', next);
    document.documentElement.lang = next;
    void i18n.changeLanguage(next);
    if (user) {
      api.updateMe({ locale: next }).catch(() => {});
    }
  };

  const isStaff = Boolean(user && ['PHARMACIST', 'TENANT_ADMIN', 'SUPER_ADMIN'].includes(user.globalRole));

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isStaff,
        isOffline,
        activeAlarm,
        setActiveAlarm,
        login,
        logout,
        refreshUser,
        switchLocale,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
