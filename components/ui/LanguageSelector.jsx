'use client';

import { useI18n } from '@/lib/hooks/useI18n';
import { useLanguageStore } from '@/stores/languageStore';

export default function LanguageSelector({ compact = false }) {
  const { common, locale } = useI18n();
  const setLocale = useLanguageStore((s) => s.setLocale);

  return (
    <div
      className={`lang-pill-group ${compact ? 'text-xs' : 'text-sm'}`}
      role="group"
      aria-label={common.language}
    >
      <button
        type="button"
        onClick={() => setLocale('ar')}
        className={`lang-pill ${locale === 'ar' ? 'lang-pill-active' : 'lang-pill-inactive'}`}
      >
        {common.arabic}
      </button>
      <button
        type="button"
        onClick={() => setLocale('en')}
        className={`lang-pill ${locale === 'en' ? 'lang-pill-active' : 'lang-pill-inactive'}`}
      >
        {common.english}
      </button>
    </div>
  );
}
