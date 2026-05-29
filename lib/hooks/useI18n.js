'use client';

import { useMemo } from 'react';
import { getDictionary, getDir, navLabel, statusLabel } from '@/lib/i18n';
import { useLanguageStore } from '@/stores/languageStore';

export function useI18n() {
  const locale = useLanguageStore((s) => s.locale);

  return useMemo(() => {
    const dict = getDictionary(locale);
    return {
      locale,
      dir: getDir(locale),
      isRtl: locale === 'ar',
      statusLabel: (status) => statusLabel(status, locale),
      navLabel: (item) => navLabel(item, locale),
      ...dict,
    };
  }, [locale]);
}
