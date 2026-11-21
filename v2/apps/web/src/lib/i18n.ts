import { defaultNS, resources } from '@dosemate/i18n';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const savedLang = typeof window !== 'undefined' ? localStorage.getItem('dm_lang') : null;

void i18n.use(initReactI18next).init({
  resources,
  lng: savedLang === 'en' ? 'en' : 'id',
  fallbackLng: 'id',
  defaultNS,
  ns: ['common', 'nav', 'auth', 'alarm', 'patient', 'health', 'staff', 'errors'],
  interpolation: { escapeValue: false },
});

export default i18n;
