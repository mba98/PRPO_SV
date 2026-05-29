'use client';

import { create } from 'zustand';
import { DEFAULT_LOCALE, getDir, LOCALE_STORAGE_KEY } from '@/lib/i18n';

function readStoredLocale() {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  return stored === 'en' ? 'en' : 'ar';
}

function applyLocaleToDocument(locale) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('lang', locale);
  root.setAttribute('dir', getDir(locale));
}

export const useLanguageStore = create((set) => ({
  locale: DEFAULT_LOCALE,
  initialized: false,

  initLocale: () => {
    const locale = readStoredLocale();
    applyLocaleToDocument(locale);
    set({ locale, initialized: true });
  },

  setLocale: (next) => {
    const locale = next === 'en' ? 'en' : 'ar';
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    }
    applyLocaleToDocument(locale);
    set({ locale });
  },
}));
