'use client';

import { useEffect } from 'react';
import { useThemeStore } from '@/stores/themeStore';
import { useLanguageStore } from '@/stores/languageStore';
import ThemeTransitionOverlay from '@/components/ui/ThemeTransitionOverlay';

export default function AppProviders({ children }) {
  const initTheme = useThemeStore((s) => s.initTheme);
  const initLocale = useLanguageStore((s) => s.initLocale);

  useEffect(() => {
    initTheme();
    initLocale();
  }, [initTheme, initLocale]);

  return (
    <>
      <ThemeTransitionOverlay />
      {children}
    </>
  );
}
