'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/layout/PageHeader';
import { apiFetch } from '@/lib/apiClient';
import { AnimatedSkeletonLoader, AnimatedStatusBadge } from '@/components/ui';

export default function ApprovedForPoPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { json } = await apiFetch('/api/purchase-requests/approved-for-po?limit=100');
      if (json.success) setItems(json.data);
      setLoading(false);
    })();
  }, []);

  return (
    <div>
      <PageHeader
        title="PRs approved for PO"
        description="Purchase requests created in SAP and available for purchase order creation (Phase 4)."
      />
      {loading ? (
        <AnimatedSkeletonLoader rows={5} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">PR Number</th>
                <th className="px-4 py-3">SAP Doc</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                    No PRs ready for PO
                  </td>
                </tr>
              )}
              {items.map((pr) => (
                <tr key={pr.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/purchase-requests/${pr.id}`}
                      className="font-medium text-brand-600 hover:underline"
                    >
                      {pr.portalPRNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{pr.sapPRDocNum}</td>
                  <td className="px-4 py-3">{pr.department}</td>
                  <td className="px-4 py-3">
                    <AnimatedStatusBadge status={pr.status} />
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
