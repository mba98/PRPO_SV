'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/layout/PageHeader';
import { apiFetch } from '@/lib/apiClient';
import { useAuthStore } from '@/stores/authStore';
import { AnimatedSkeletonLoader, AnimatedStatusBadge } from '@/components/ui';

export default function ReadyForApriPage() {
  const router = useRouter();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canCreate = hasPermission('apinvoice.create');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creatingId, setCreatingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { json } = await apiFetch('/api/purchase-orders/ready-for-ap-reserve-invoice?limit=100');
    if (json.success) setItems(json.data);
    else setError(json.message || 'Failed to load');
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createApri(poId) {
    setCreatingId(poId);
    setError('');
    const { json } = await apiFetch(`/api/ap-reserve-invoices/from-po/${poId}`, { method: 'POST' });
    setCreatingId(null);
    if (json.success && json.data?.apri?.id) {
      router.push(`/ap-reserve-invoices/${json.data.apri.id}`);
      return;
    }
    if (json.error === 'DUPLICATE_APRI' || json.error === 'APRI_EXISTS_FAILED') {
      setError(json.message || 'An APRI already exists for this PO');
      load();
      return;
    }
    setError(json.message || 'Failed to create A/P Reserve Invoice');
    load();
  }

  return (
    <div>
      <PageHeader
        title="POs ready for A/P Reserve Invoice"
        description="Purchase orders created in SAP without an existing A/P reserve invoice."
      />
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
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
                {canCreate && <th className="px-4 py-3">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 && (
                <tr>
                  <td colSpan={canCreate ? 5 : 4} className="px-4 py-8 text-center text-slate-500">
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
                  {canCreate && (
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="btn-primary text-xs"
                        disabled={creatingId === po.id}
                        onClick={() => createApri(po.id)}
                      >
                        {creatingId === po.id ? 'Creating…' : 'Create APRI'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
