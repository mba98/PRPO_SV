'use client';

import PageHeader from './PageHeader';
import { useI18n } from '@/lib/hooks/useI18n';

/** Bilingual page header from i18n section keys (dashboard, pr, po, apri, settings.*) */
export default function SectionPageHeader({ section, titleKey = 'title', descriptionKey = 'description', actions }) {
  const labels = useI18n();
  const block = labels[section];
  if (!block) return null;
  return (
    <PageHeader
      title={block[titleKey]}
      description={block[descriptionKey]}
      actions={actions}
    />
  );
}
