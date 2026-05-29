'use client';

import { useEffect } from 'react';
import { useThemeStore } from '@/stores/themeStore';
import { useLanguageStore } from '@/stores/languageStore';
import { useColorModeStore } from '@/stores/colorModeStore';

export default function AppProviders({ children }) {
  const initTheme = useThemeStore((s) => s.initTheme);
  const initLocale = useLanguageStore((s) => s.initLocale);
  const initColorMode = useColorModeStore((s) => s.initColorMode);

  useEffect(() => {
    initTheme();
    initLocale();
    initColorMode();
  }, [initTheme, initLocale, initColorMode]);

  return children;
}
