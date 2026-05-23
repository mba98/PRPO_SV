import { Suspense } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/layout/PageHeader';
import PoListManager from '@/components/purchase-orders/PoListManager';
import { AnimatedSkeletonLoader } from '@/components/ui';

export default function PurchaseOrdersPage() {
  return (
    <div>
      <PageHeader
        title="Purchase Orders"
        description="Review and approve purchase orders. SAP documents are created after final finance approval."
        actions={
          <Link href="/purchase-requests/approved-for-po" className="btn-secondary text-sm">
            PRs ready for PO
          </Link>
        }
      />
      <Suspense fallback={<AnimatedSkeletonLoader rows={6} />}>
        <PoListManager />
      </Suspense>
    </div>
  );
}
