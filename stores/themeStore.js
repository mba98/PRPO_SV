'use client';

import { create } from 'zustand';
import {
  ACCENT_CSS_VARS,
  ACCENT_PALETTE,
  DEFAULT_ACCENT,
  THEME_STORAGE_KEY,
} from '@/lib/theme/themes';
import {
  ACCENT_STORAGE_KEY,
  COLOR_MODE_STORAGE_KEY,
  DEFAULT_COLOR_MODE,
  LEGACY_ACCENT_STORAGE_KEY,
  applyAccentVarsToDocument,
  applyColorModeToDocument,
  normalizeAccentId,
} from '@/lib/theme/documentTheme';
import { useUiTransitionStore } from '@/stores/uiTransitionStore';

function readStoredAccent() {
  if (typeof window === 'undefined') return DEFAULT_ACCENT;
  const stored =
    window.localStorage.getItem(ACCENT_STORAGE_KEY) ||
    window.localStorage.getItem(LEGACY_ACCENT_STORAGE_KEY) ||
    window.localStorage.getItem(THEME_STORAGE_KEY);
  const id = normalizeAccentId(stored);
  if (id && ACCENT_CSS_VARS[id]) return id;
  return DEFAULT_ACCENT;
}

function readStoredColorMode() {
  if (typeof window === 'undefined') return DEFAULT_COLOR_MODE;
  const stored = window.localStorage.getItem(COLOR_MODE_STORAGE_KEY);
  return stored === 'light' ? 'light' : 'dark';
}

function persistAccent(accentId) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ACCENT_STORAGE_KEY, accentId);
  window.localStorage.setItem(THEME_STORAGE_KEY, accentId);
}

function persistColorMode(mode) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, mode);
}

export const useThemeStore = create((set, get) => ({
  accent: DEFAULT_ACCENT,
  mode: DEFAULT_COLOR_MODE,
  initialized: false,

  initTheme: () => {
    const accent = readStoredAccent();
    const mode = readStoredColorMode();
    applyAccentVarsToDocument(accent, ACCENT_CSS_VARS);
    applyColorModeToDocument(mode);
    set({ accent, mode, initialized: true });
  },

  setAccent: (accentId) => {
    const id = normalizeAccentId(accentId);
    const resolved = id && ACCENT_CSS_VARS[id] ? id : DEFAULT_ACCENT;
    if (resolved === get().accent) return;
    persistAccent(resolved);
    applyAccentVarsToDocument(resolved, ACCENT_CSS_VARS);
    set({ accent: resolved });
    useUiTransitionStore.getState().triggerTransition('accent');
  },

  setMode: (mode) => {
    const next = mode === 'light' ? 'light' : 'dark';
    if (next === get().mode) return;
    persistColorMode(next);
    applyColorModeToDocument(next);
    set({ mode: next });
    useUiTransitionStore.getState().triggerTransition('mode');
  },

  /** @alias setMode */
  setColorMode: (mode) => {
    get().setMode(mode);
  },

  toggleMode: () => {
    const next = get().mode === 'dark' ? 'light' : 'dark';
    get().setMode(next);
  },
}));

export { ACCENT_PALETTE };
