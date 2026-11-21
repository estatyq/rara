import { enResources } from './locales/en.js';
import { idResources, type TranslationResources } from './locales/id.js';

export { idResources, enResources };
export type { TranslationResources };
export * from './notifications.js';

export const resources = {
  id: idResources,
  en: enResources,
} as const;

export const defaultNS = 'common' as const;
export const supportedLocales = ['id', 'en'] as const;
