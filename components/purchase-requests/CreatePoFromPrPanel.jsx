'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/apiClient';
import VendorSelect from '@/components/lookups/VendorSelect';
import { Button } from '@/components/ui';
import { useI18n } from '@/lib/hooks/useI18n';

/**
 * Create portal PO from an SAP-created PR (one vendor per PO).
 */
export default function CreatePoFromPrPanel({ pr, compact = false }) {
  const router = useRouter();
  const { po: poI18n } = useI18n();
  const c = poI18n.create;
  const [vendor, setVendor] = useState('');
  const [vendorLabel, setVendorLabel] = useState('');
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
    const defaultVendor = vendorOptions[0] || '';
    setVendor(defaultVendor);
    setVendorLabel(defaultVendor);
  }, [pr.id, vendorOptionsKey, vendorOptions]);

  async function handleCreate() {
    if (submitting) return;
    const vendorCode = vendor.trim();
    if (!vendorCode) {
      setError(c.vendorRequired);
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
        <p className="text-xs text-amber-700 dark:text-amber-300">
          Multiple vendors on this PR — create one PO per vendor.
        </p>
      )}
      {vendorOptions.length > 0 && vendorOptions.length <= 3 && (
        <p className="text-xs text-muted-foreground">
          Suggested: {vendorOptions.join(', ')}
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
            <span className="form-label">{c.vendor}</span>
            <div className="mt-1">
              <VendorSelect
                loadAllOnFocus
                valueCode={vendor}
                valueLabel={vendorLabel}
                disabled={submitting}
                placeholder={c.searchVendor}
                emptyMessage={c.noVendorsFound}
                loadingMessage={c.loadingVendors}
                failedMessage={c.failedLoadVendors}
                debounceMs={250}
                listLimit={100}
                onSelect={(code, label) => {
                  setVendor(code);
                  setVendorLabel(label || code);
                }}
              />
            </div>
          </label>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button
            type="button"
            variant="primary"
            loading={submitting}
            disabled={submitting || !vendor.trim()}
            onClick={handleCreate}
          >
            {submitting ? c.creatingPurchaseOrder : c.createPurchaseOrder}
          </Button>
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
