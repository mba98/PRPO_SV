'use client';

import { ACCENT_THEMES } from '@/lib/theme/themes';
import { useThemeStore } from '@/stores/themeStore';
import { common } from '@/lib/i18n';

export default function ThemeSelector({ compact = false }) {
  const accent = useThemeStore((s) => s.accent);
  const setAccent = useThemeStore((s) => s.setAccent);

  return (
    <label className={compact ? 'inline-flex items-center gap-2' : 'block'}>
      {!compact && (
        <span className="mb-1 block text-xs font-medium text-slate-600">{common.themeColor}</span>
      )}
      <select
        value={accent}
        onChange={(e) => setAccent(e.target.value)}
        className="min-h-10 rounded-lg border border-slate-300 bg-white px-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        aria-label={common.themeColor}
      >
        {ACCENT_THEMES.map((t) => (
          <option key={t.id} value={t.id}>
            {t.labelAr}
          </option>
        ))}
      </select>
    </label>
  );
}
