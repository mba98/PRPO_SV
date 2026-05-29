'use client';

import { useI18n } from '@/lib/hooks/useI18n';
import { useColorModeStore } from '@/stores/colorModeStore';

export default function ColorModeSelector({ compact = false }) {
  const { common } = useI18n();
  const mode = useColorModeStore((s) => s.mode);
  const setColorMode = useColorModeStore((s) => s.setColorMode);

  return (
    <div
      className={`inline-flex rounded-xl border border-border bg-card p-0.5 ${compact ? 'text-xs' : 'text-sm'}`}
      role="group"
      aria-label={common.colorMode}
    >
      <button
        type="button"
        onClick={() => setColorMode('light')}
        className={`min-h-9 rounded-lg px-2.5 font-semibold transition-colors sm:px-3 ${
          mode === 'light'
            ? 'bg-primary text-primary-foreground shadow-md'
            : 'text-muted-foreground hover:bg-muted'
        }`}
      >
        {common.lightMode}
      </button>
      <button
        type="button"
        onClick={() => setColorMode('dark')}
        className={`min-h-9 rounded-lg px-2.5 font-semibold transition-colors sm:px-3 ${
          mode === 'dark'
            ? 'bg-primary text-primary-foreground shadow-md'
            : 'text-muted-foreground hover:bg-muted'
        }`}
      >
        {common.darkMode}
      </button>
    </div>
  );
}
