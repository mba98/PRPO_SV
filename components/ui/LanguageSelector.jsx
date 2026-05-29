'use client';

import { useI18n } from '@/lib/hooks/useI18n';
import { useLanguageStore } from '@/stores/languageStore';

export default function LanguageSelector({ compact = false }) {
  const { common, locale } = useI18n();
  const setLocale = useLanguageStore((s) => s.setLocale);

  return (
    <div
      className={`inline-flex rounded-xl border border-border bg-card p-0.5 ${compact ? 'text-xs' : 'text-sm'}`}
      role="group"
      aria-label={common.language}
    >
      <button
        type="button"
        onClick={() => setLocale('ar')}
        className={`min-h-9 rounded-lg px-2.5 font-semibold transition-colors sm:px-3 ${
          locale === 'ar'
            ? 'bg-primary text-primary-foreground shadow-md'
            : 'text-muted-foreground hover:bg-muted'
        }`}
      >
        {common.arabic}
      </button>
      <button
        type="button"
        onClick={() => setLocale('en')}
        className={`min-h-9 rounded-lg px-2.5 font-semibold transition-colors sm:px-3 ${
          locale === 'en'
            ? 'bg-primary text-primary-foreground shadow-md'
            : 'text-muted-foreground hover:bg-muted'
        }`}
      >
        {common.english}
      </button>
    </div>
  );
}
