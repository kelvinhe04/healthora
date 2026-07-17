import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import es from './locales/es/common.json';
import en from './locales/en/common.json';

export const STORAGE_KEY = 'healthora-lang';
export const SUPPORTED_LANGUAGES = ['es', 'en'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      es: { common: es },
      en: { common: en },
    },
    fallbackLng: 'es',
    supportedLngs: [...SUPPORTED_LANGUAGES],
    defaultNS: 'common',
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: STORAGE_KEY,
    },
    interpolation: { escapeValue: false },
    returnEmptyString: false,
  });

export default i18n;
