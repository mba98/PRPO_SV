'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useI18n } from '@/lib/hooks/useI18n';
import { useLanguageStore } from '@/stores/languageStore';

export default function LanguageSelector() {
  const { common, locale } = useI18n();
  const setLocale = useLanguageStore((s) => s.setLocale);
  const reduceMotion = useReducedMotion();

  const isArabic = locale === 'ar';
  const label = isArabic ? 'AR' : 'EN';
  const tooltip = isArabic ? common.switchToEnglish : common.switchToArabic;

  function handleToggle() {
    setLocale(isArabic ? 'en' : 'ar');
  }

  return (
    <motion.button
      type="button"
      className="topbar-icon-btn"
      onClick={handleToggle}
      aria-label={tooltip}
      title={tooltip}
      whileTap={reduceMotion ? undefined : { scale: 0.95 }}
    >
      <motion.span
        key={label}
        initial={reduceMotion ? false : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        {label}
      </motion.span>
    </motion.button>
  );
}
