'use client';

/**
 * Backward-compatible color mode API — state lives in themeStore.
 */
import { create } from 'zustand';
import {
  COLOR_MODE_STORAGE_KEY,
  DEFAULT_COLOR_MODE,
  applyColorModeToDocument,
} from '@/lib/theme/documentTheme';
import { useThemeStore } from '@/stores/themeStore';

export { COLOR_MODE_STORAGE_KEY, DEFAULT_COLOR_MODE };

function readStoredColorMode() {
  if (typeof window === 'undefined') return DEFAULT_COLOR_MODE;
  const stored = window.localStorage.getItem(COLOR_MODE_STORAGE_KEY);
  return stored === 'light' ? 'light' : 'dark';
}

export const useColorModeStore = create((set) => ({
  mode: DEFAULT_COLOR_MODE,
  initialized: false,

  initColorMode: () => {
    const theme = useThemeStore.getState();
    if (!theme.initialized) {
      theme.initTheme();
    }
    set({ mode: useThemeStore.getState().mode, initialized: true });
  },

  setColorMode: (mode) => {
    useThemeStore.getState().setMode(mode);
    set({ mode: useThemeStore.getState().mode });
  },

  toggleColorMode: () => {
    useThemeStore.getState().toggleMode();
    set({ mode: useThemeStore.getState().mode });
  },
}));

/** Standalone apply for legacy imports */
export function applyColorModeToDocumentLegacy(mode) {
  applyColorModeToDocument(mode);
}
