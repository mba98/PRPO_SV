'use client';

import { PortalLoader } from '@/components/ui';
import SectionPageHeader from '@/components/layout/SectionPageHeader';
import LpForm from '@/components/local-purchases/LpForm';
import { usePortalDocument } from '@/lib/hooks/usePortalDocument';

export default function LocalPurchaseEditPage({ params }) {
  const { doc, loading, error } = usePortalDocument(
    'LOCAL_PURCHASE',
    params.id,
    'LocalPurchaseEditPage',
  );

  if (loading) return <PortalLoader fullScreen />;
  if (error || !doc) return <p className="text-sm text-red-600">{error || 'Failed to load'}</p>;
  if (!doc.canEdit) return <p className="text-sm text-red-600">This document cannot be edited.</p>;

  return (
    <div>
      <SectionPageHeader section="lp" titleKey="editTitle" descriptionKey="editDescription" />
      <LpForm mode="edit" initialDoc={doc} />
    </div>
  );
}
