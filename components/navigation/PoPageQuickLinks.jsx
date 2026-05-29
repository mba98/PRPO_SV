'use client';

import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';

export default function PoPageQuickLinks() {
  const hasAnyPermission = useAuthStore((s) => s.hasAnyPermission);

  if (!hasAnyPermission(['po.create', 'view.all'])) {
    return null;
  }

  return (
    <Link href="/purchase-requests/approved-for-po" className="btn-secondary text-sm">
      PRs ready for PO
    </Link>
  );
}
