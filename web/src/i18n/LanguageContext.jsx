import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { translations } from './translations';
import { localizeSeedText } from './seedDataTranslations';
import { api } from '../api/client';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    const saved = localStorage.getItem('rara_lang');
    return saved === 'en' || saved === 'id' ? saved : 'id';
  });

  useEffect(() => {
    localStorage.setItem('rara_lang', lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((nextLang, { syncServer = true } = {}) => {
    const normalized = nextLang === 'en' ? 'en' : 'id';
    setLangState(normalized);
    if (syncServer && localStorage.getItem('rara_token')) {
      api.updateMe({ locale: normalized }).catch(() => {});
    }
  }, []);

  const toggleLanguage = useCallback(() => {
    setLang(lang === 'id' ? 'en' : 'id', { syncServer: true });
  }, [lang, setLang]);

  const t = translations[lang] || translations.id;
  const dateLocale = lang === 'en' ? 'en-US' : 'id-ID';
  const localize = useCallback((text) => localizeSeedText(text, lang), [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, toggleLanguage, dateLocale, localize }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
