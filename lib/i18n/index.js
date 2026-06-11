import * as ar from './ar.js';
import * as en from './en.js';
import { PO_STATUS, PO_STATUS_LABELS, normalizePoStatus } from '@/lib/poStatus.js';

export const LOCALE_STORAGE_KEY = 'procurement-locale';
export const DEFAULT_LOCALE = 'en';
export const LOCALES = ['ar', 'en'];

const dictionaries = { ar, en };

export function getDictionary(locale) {
  const key = locale === 'en' ? 'en' : 'ar';
  return dictionaries[key];
}

export function getDir(locale) {
  return locale === 'en' ? 'ltr' : 'rtl';
}

const STATUS_KEY_ALIASES = {
  'pending warehouse approval': 'Pending Warehouse Approval',
  'pending project manager approval': 'Pending Project Manager Approval',
  'pending project manager': 'Pending Project Manager',
  'pending operation manager approval': 'Pending Operation Manager Approval',
  'pending operation manager': 'Pending Operation Manager',
  'pending finance approval': 'Pending Finance Approval',
  'pending finance': 'Pending Finance',
};

function normalizeStatusKey(status) {
  if (!status || typeof status !== 'string') return status;
  const poNorm = normalizePoStatus(status);
  if (PO_STATUS_LABELS[poNorm]) return PO_STATUS_LABELS[poNorm];
  return STATUS_KEY_ALIASES[status.toLowerCase()] || status;
}

export function statusLabel(status, locale = DEFAULT_LOCALE) {
  if (!status) return '—';
  const key = normalizeStatusKey(status);
  const dict = getDictionary(locale);
  const map = locale === 'en' ? dict.statusEn : dict.statusAr;
  return map?.[key] || PO_STATUS_LABELS[normalizePoStatus(status)] || status;
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
