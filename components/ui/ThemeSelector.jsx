'use client';

import { ACCENT_THEMES } from '@/lib/theme/themes';
import { useThemeStore } from '@/stores/themeStore';
import { useI18n } from '@/lib/hooks/useI18n';
import Select from './Select';

export default function ThemeSelector({ compact = false }) {
  const accent = useThemeStore((s) => s.accent);
  const setAccent = useThemeStore((s) => s.setAccent);
  const { common, locale } = useI18n();

  return (
    <label className={compact ? 'inline-flex items-center gap-2' : 'block'}>
      {!compact && <span className="form-label">{common.themeColor}</span>}
      <Select
        value={accent}
        onChange={(e) => setAccent(e.target.value)}
        aria-label={common.themeColor}
        className={compact ? 'min-w-[7rem]' : ''}
      >
        {ACCENT_THEMES.map((t) => (
          <option key={t.id} value={t.id}>
            {locale === 'en' ? t.labelEn : t.labelAr}
          </option>
        ))}
      </Select>
    </label>
  );
}
