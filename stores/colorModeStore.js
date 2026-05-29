'use client';

import { create } from 'zustand';

export const COLOR_MODE_STORAGE_KEY = 'procurement-color-mode';
export const DEFAULT_COLOR_MODE = 'dark';

function readStoredColorMode() {
  if (typeof window === 'undefined') return DEFAULT_COLOR_MODE;
  const stored = window.localStorage.getItem(COLOR_MODE_STORAGE_KEY);
  return stored === 'light' ? 'light' : 'dark';
}

function applyColorModeToDocument(mode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', mode === 'dark');
  root.setAttribute('data-theme', mode);
}

export const useColorModeStore = create((set) => ({
  mode: DEFAULT_COLOR_MODE,
  initialized: false,

  initColorMode: () => {
    const mode = readStoredColorMode();
    applyColorModeToDocument(mode);
    set({ mode, initialized: true });
  },

  setColorMode: (mode) => {
    const next = mode === 'light' ? 'light' : 'dark';
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, next);
    }
    applyColorModeToDocument(next);
    set({ mode: next });
  },

  toggleColorMode: () => {
    const current = readStoredColorMode();
    const next = current === 'dark' ? 'light' : 'dark';
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, next);
    }
    applyColorModeToDocument(next);
    set({ mode: next });
  },
}));
