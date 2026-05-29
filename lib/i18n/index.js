import * as ar from './ar.js';
import * as en from './en.js';

export const LOCALE_STORAGE_KEY = 'procurement-locale';
export const DEFAULT_LOCALE = 'ar';
export const LOCALES = ['ar', 'en'];

const dictionaries = { ar, en };

export function getDictionary(locale) {
  const key = locale === 'en' ? 'en' : 'ar';
  return dictionaries[key];
}

export function getDir(locale) {
  return locale === 'en' ? 'ltr' : 'rtl';
}

export function statusLabel(status, locale = DEFAULT_LOCALE) {
  if (!status) return '—';
  const dict = getDictionary(locale);
  const map = locale === 'en' ? dict.statusEn : dict.statusAr;
  return map?.[status] || status;
}

export function navLabel(item, locale = DEFAULT_LOCALE) {
  if (!item?.labelKey) return item?.label || '';
  const dict = getDictionary(locale);
  return dict.nav[item.labelKey] || item.label || item.labelKey;
}

/** @deprecated use getDictionary(locale) in client via useI18n */
export {
  nav,
  common,
  login,
  dashboard,
  filters,
  detail,
  approve,
  pr,
  po,
  apri,
  settings,
  statusAr,
} from './ar.js';
