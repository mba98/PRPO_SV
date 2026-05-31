'use client';

/** @deprecated Use SunMoonToggle in TopBar */
import { useI18n } from '@/lib/hooks/useI18n';
import { useThemeStore } from '@/stores/themeStore';

export default function ColorModeSelector({ compact = false }) {
  const { common } = useI18n();
  const mode = useThemeStore((s) => s.mode);
  const setColorMode = useThemeStore((s) => s.setMode);

  return (
    <div
      className={`lang-pill-group ${compact ? 'text-xs' : 'text-sm'}`}
      role="group"
      aria-label={common.colorMode}
    >
      <button
        type="button"
        onClick={() => setColorMode('light')}
        className={`lang-pill ${mode === 'light' ? 'lang-pill-active' : 'lang-pill-inactive'}`}
      >
        {common.lightMode}
      </button>
      <button
        type="button"
        onClick={() => setColorMode('dark')}
        className={`lang-pill ${mode === 'dark' ? 'lang-pill-active' : 'lang-pill-inactive'}`}
      >
        {common.darkMode}
      </button>
    </div>
  );
}
