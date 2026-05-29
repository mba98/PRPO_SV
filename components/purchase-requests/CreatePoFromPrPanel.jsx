'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/apiClient';

/**
 * Create portal PO from an SAP-created PR (one vendor per PO).
 */
export default function CreatePoFromPrPanel({ pr, compact = false }) {
  const router = useRouter();
  const [vendor, setVendor] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const pendingVendors = pr.pendingVendors || [];
  const suggestedVendors = pr.suggestedVendors || [];
  const vendorOptions = pendingVendors.length ? pendingVendors : suggestedVendors;
  const vendorOptionsKey = vendorOptions.join('|');
  const existingForVendor = (pr.existingPOs || []).find(
    (o) => o.vendor === vendor.trim() && o.status !== 'Rejected',
  );

  useEffect(() => {
    setVendor(vendorOptions[0] || '');
  }, [pr.id, vendorOptionsKey, vendorOptions]);

  async function handleCreate() {
    const vendorCode = vendor.trim();
    if (!vendorCode) {
      setError('Select or enter a vendor code');
      return;
    }
    setSubmitting(true);
    setError('');
    const { json } = await apiFetch(`/api/purchase-orders/from-pr/${pr.id}`, {
      method: 'POST',
      body: JSON.stringify({ vendor: vendorCode }),
    });
    if (json.success) {
      const poId = json.data.po?.id;
      if (poId) router.push(`/purchase-orders/${poId}`);
      return;
    }
    if (!json.success && json.error === 'DUPLICATE_PO' && json.data?.poId) {
      router.push(`/purchase-orders/${json.data.poId}`);
      return;
    }
    setError(json.message || 'PO creation failed');
    setSubmitting(false);
  }

  if (!pr.canCreatePo) return null;

  const wrapperClass = compact
    ? 'rounded-md border border-border bg-muted px-4 py-3'
    : 'card space-y-3';

  return (
    <section className={wrapperClass}>
      <h2 className="text-sm font-semibold text-foreground">Create Purchase Order</h2>
      <p className="text-xs text-muted-foreground">
        Creates a portal PO from SAP PR {pr.sapPRDocNum || pr.sapPRDocEntry}. SAP PO is created after
        finance approval.
      </p>
      {vendorOptions.length > 1 && (
        <p className="text-xs text-amber-700">
          Multiple vendors on this PR — create one PO per vendor.
        </p>
      )}
      {existingForVendor ? (
        <p className="text-sm text-foreground">
          PO already exists for this vendor:{' '}
          <Link
            href={`/purchase-orders/${existingForVendor.id}`}
            className="font-medium text-primary hover:underline"
          >
            {existingForVendor.portalPONumber}
          </Link>{' '}
          ({existingForVendor.status})
        </p>
      ) : (
        <>
          <label className="block text-sm">
            <span className="text-muted-foreground">Vendor (SAP CardCode)</span>
            <input
              className="input-field mt-1"
              value={vendor}
              list={`vendor-suggestions-${pr.id}`}
              placeholder="e.g. V10000"
              onChange={(e) => setVendor(e.target.value)}
            />
            <datalist id={`vendor-suggestions-${pr.id}`}>
              {vendorOptions.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
          </label>
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          <button
            type="button"
            className="btn-primary"
            disabled={submitting || !vendor.trim()}
            onClick={handleCreate}
          >
            {submitting ? 'Creating…' : 'Create PO'}
          </button>
        </>
      )}
      {(pr.existingPOs || []).length > 0 && !existingForVendor && (
        <ul className="text-xs text-muted-foreground">
          {(pr.existingPOs || []).map((o) => (
            <li key={o.id}>
              <Link href={`/purchase-orders/${o.id}`} className="text-primary hover:underline">
                {o.portalPONumber}
              </Link>{' '}
              — {o.vendor} ({o.status})
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
