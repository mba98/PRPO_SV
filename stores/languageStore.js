'use client';

import { create } from 'zustand';
import { DEFAULT_LOCALE, getDir, LOCALE_STORAGE_KEY } from '@/lib/i18n';
import { useUiTransitionStore } from '@/stores/uiTransitionStore';

function readStoredLocale() {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored === 'en' || stored === 'ar') return stored;
  return DEFAULT_LOCALE;
}

function applyLocaleToDocument(locale) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('lang', locale);
  root.setAttribute('dir', getDir(locale));
}

export const useLanguageStore = create((set, get) => ({
  locale: DEFAULT_LOCALE,
  initialized: false,

  initLocale: () => {
    const locale = readStoredLocale();
    applyLocaleToDocument(locale);
    set({ locale, initialized: true });
  },

  setLocale: (next) => {
    const locale = next === 'en' ? 'en' : 'ar';
    if (locale === get().locale) return;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    }
    applyLocaleToDocument(locale);
    set({ locale });
    useUiTransitionStore.getState().triggerTransition('locale');
  },
}));
