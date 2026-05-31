'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import SectionPageHeader from '@/components/layout/SectionPageHeader';
import { apiFetch } from '@/lib/apiClient';
import { useAuthStore } from '@/stores/authStore';
import { PortalLoader, AnimatedStatusBadge, AnimatedTableContainer, Button } from '@/components/ui';
import { useI18n } from '@/lib/hooks/useI18n';

export default function ReadyForApriPage() {
  const { common, po: poI18n } = useI18n();
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
    else setError(json.message || common.errorLoad);
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
      <SectionPageHeader section="po" titleKey="readyForApriTitle" descriptionKey="readyForApriDesc" />
      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
      {loading ? (
        <div className="flex justify-center py-12">
          <PortalLoader />
        </div>
      ) : (
        <AnimatedTableContainer>
          <table className="data-table">
            <thead>
              <tr>
                <th>PO Number</th>
                <th>SAP PO</th>
                <th>Vendor</th>
                <th>Status</th>
                {canCreate && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={canCreate ? 5 : 4} className="py-8 text-center text-muted-foreground">
                    No POs ready for A/P reserve invoice
                  </td>
                </tr>
              )}
              {items.map((po) => (
                <tr key={po.id}>
                  <td>
                    <Link
                      href={`/purchase-orders/${po.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {po.portalPONumber}
                    </Link>
                  </td>
                  <td>{po.sapPODocNum}</td>
                  <td>{po.vendor}</td>
                  <td>
                    <AnimatedStatusBadge status={po.status} />
                  </td>
                  {canCreate && (
                    <td>
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
        </AnimatedTableContainer>
      )}
    </div>
  );
}
