'use client';

import { useI18n } from '@/lib/hooks/useI18n';
import { useLanguageStore } from '@/stores/languageStore';

export default function LanguageSelector() {
  const { common, locale } = useI18n();
  const setLocale = useLanguageStore((s) => s.setLocale);

  const isArabic = locale === 'ar';
  const label = isArabic ? 'AR' : 'EN';
  const tooltip = isArabic ? common.switchToEnglish : common.switchToArabic;

  function handleToggle() {
    setLocale(isArabic ? 'en' : 'ar');
  }

  return (
    <button
      type="button"
      className="topbar-icon-btn"
      onClick={handleToggle}
      aria-label={tooltip}
      title={tooltip}
    >
      {label}
    </button>
  );
}
