'use client';

import { create } from 'zustand';
import { ACCENT_CSS_VARS, DEFAULT_ACCENT, THEME_STORAGE_KEY } from '@/lib/theme/themes';

function applyAccentToDocument(accentId) {
  if (typeof document === 'undefined') return;
  const vars = ACCENT_CSS_VARS[accentId] || ACCENT_CSS_VARS[DEFAULT_ACCENT];
  const root = document.documentElement;
  root.setAttribute('data-accent', accentId);
  Object.entries(vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
  root.style.setProperty('--primary', vars['--brand-600']);
  root.style.setProperty('--primary-foreground', '#ffffff');
}

function readStoredAccent() {
  if (typeof window === 'undefined') return DEFAULT_ACCENT;
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored && ACCENT_CSS_VARS[stored]) return stored;
  return DEFAULT_ACCENT;
}

export const useThemeStore = create((set) => ({
  accent: DEFAULT_ACCENT,
  initialized: false,

  initTheme: () => {
    const accent = readStoredAccent();
    applyAccentToDocument(accent);
    set({ accent, initialized: true });
  },

  setAccent: (accentId) => {
    const id = ACCENT_CSS_VARS[accentId] ? accentId : DEFAULT_ACCENT;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_STORAGE_KEY, id);
    }
    applyAccentToDocument(id);
    set({ accent: id });
  },
}));
