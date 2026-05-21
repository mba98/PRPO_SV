'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/layout/PageHeader';
import { apiFetch } from '@/lib/apiClient';
import { AnimatedSkeletonLoader, AnimatedStatusBadge } from '@/components/ui';

export default function ReadyForApriPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { json } = await apiFetch('/api/purchase-orders/ready-for-ap-reserve-invoice?limit=100');
      if (json.success) setItems(json.data);
      setLoading(false);
    })();
  }, []);

  return (
    <div>
      <PageHeader
        title="POs ready for A/P Reserve Invoice"
        description="Purchase orders created in SAP — available for A/P reserve invoice (Phase 5)."
      />
      {loading ? (
        <AnimatedSkeletonLoader rows={5} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">PO Number</th>
                <th className="px-4 py-3">SAP PO</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                    No POs ready for A/P reserve invoice
                  </td>
                </tr>
              )}
              {items.map((po) => (
                <tr key={po.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/purchase-orders/${po.id}`}
                      className="font-medium text-brand-600 hover:underline"
                    >
                      {po.portalPONumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{po.sapPODocNum}</td>
                  <td className="px-4 py-3">{po.vendor}</td>
                  <td className="px-4 py-3">
                    <AnimatedStatusBadge status={po.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
