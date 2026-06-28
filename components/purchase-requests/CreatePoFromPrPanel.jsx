'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/apiClient';
import VendorSelect from '@/components/lookups/VendorSelect';
import PoBusinessFields from '@/components/purchase-orders/PoBusinessFields';
import { Button } from '@/components/ui';
import { useI18n } from '@/lib/hooks/useI18n';
import { buildPoDraftFromPr } from '@/lib/poFromPrDraft.js';
import { isUsdPoCurrency } from '@/lib/poCurrency.js';

/**
 * Create portal PO from an SAP-created PR — vendor first, then full editable draft.
 */
export default function CreatePoFromPrPanel({ pr, compact = false }) {
  const router = useRouter();
  const { po: poI18n } = useI18n();
  const c = poI18n.create;

  const [vendor, setVendor] = useState('');
  const [vendorLabel, setVendorLabel] = useState('');
  const [draft, setDraft] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const pendingVendors = pr.pendingVendors || [];
  const suggestedVendors = pr.suggestedVendors || [];
  const vendorOptions = pendingVendors.length ? pendingVendors : suggestedVendors;
  const vendorOptionsKey = vendorOptions.join('|');
  const existingForVendor = (pr.existingPOs || []).find(
    (o) => o.vendor === vendor.trim() && o.status !== 'Rejected' && o.status !== 'rejected',
  );

  useEffect(() => {
    const defaultVendor = vendorOptions[0] || '';
    setVendor(defaultVendor);
    setVendorLabel(defaultVendor);
    setDraft(null);
  }, [pr.id, vendorOptionsKey, vendorOptions]);

  function initializeDraft(vendorCode, vendorRow) {
    const nextDraft = buildPoDraftFromPr(pr, vendorCode, vendorRow);
    setDraft({
      header: {
        vendor: nextDraft.vendor,
        vendorLabel: nextDraft.vendorLabel,
        postingDate: nextDraft.postingDate,
        documentDate: nextDraft.documentDate,
        requiredDate: nextDraft.requiredDate,
        dueDate: nextDraft.dueDate,
        docCurrency: nextDraft.docCurrency,
        docRate: nextDraft.docRate,
        remarks: nextDraft.remarks,
      },
      lines: nextDraft.lines,
    });
  }

  function handleVendorSelect(code, label, vendorRow) {
    const trimmed = (code || '').trim();
    if (!trimmed) return;

    if (draft && draft.header.vendor && draft.header.vendor !== trimmed) {
      const confirmed = window.confirm(c.poVendorChangeConfirm);
      if (!confirmed) return;
    }

    setVendor(trimmed);
    setVendorLabel(label || trimmed);
    initializeDraft(trimmed, vendorRow);
    setError('');
  }

  async function handleCreate() {
    if (submitting || !draft) return;
    const vendorCode = draft.header.vendor.trim();
    if (!vendorCode) {
      setError(c.vendorRequired);
      return;
    }
    if (!draft.lines.length) {
      setError(c.noLinesForVendor);
      return;
    }

    setSubmitting(true);
    setError('');

    const { header, lines } = draft;
    const payload = {
      vendor: vendorCode,
      postingDate: header.postingDate || undefined,
      documentDate: header.documentDate || undefined,
      requiredDate: header.requiredDate || undefined,
      dueDate: header.dueDate || undefined,
      docCurrency: header.docCurrency,
      docRate:
        header.docRate === '' || !isUsdPoCurrency(header.docCurrency)
          ? null
          : Number(header.docRate),
      remarks: header.remarks || undefined,
      lines: lines.map((line) => ({
        relatedPRLineId: line.relatedPRLineId,
        itemCode: line.itemCode,
        itemName: line.itemName || undefined,
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice),
        warehouseCode: line.warehouseCode || undefined,
        uomCode: line.uomCode?.trim() || undefined,
        remarks: line.remarks || undefined,
      })),
    };

    const { json } = await apiFetch(`/api/purchase-orders/from-pr/${pr.id}`, {
      method: 'POST',
      body: JSON.stringify(payload),
      dedupe: false,
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
    setError(json.message || c.createFailed);
    setSubmitting(false);
  }

  if (!pr.canCreatePo) return null;

  const wrapperClass = compact
    ? 'rounded-md border border-border bg-muted px-4 py-3'
    : 'card space-y-3';

  return (
    <section className={wrapperClass}>
      <h2 className="text-sm font-semibold text-foreground">{c.title}</h2>
      <p className="text-xs text-muted-foreground">{c.fromPrHint}</p>
      {vendorOptions.length > 1 && (
        <p className="text-xs text-amber-700 dark:text-amber-300">{c.multiVendorHint}</p>
      )}
      {vendorOptions.length > 0 && vendorOptions.length <= 3 && (
        <p className="text-xs text-muted-foreground">
          {c.suggestedVendors}: {vendorOptions.join(', ')}
        </p>
      )}
      {existingForVendor ? (
        <p className="text-sm text-foreground">
          {c.existingPoForVendor}{' '}
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
                onSelect={handleVendorSelect}
              />
            </div>
          </label>

          {draft && (
            <div className="space-y-4 pt-2">
              <PoBusinessFields
                header={draft.header}
                setHeader={(updater) =>
                  setDraft((prev) => ({
                    ...prev,
                    header: typeof updater === 'function' ? updater(prev.header) : updater,
                  }))
                }
                lines={draft.lines}
                setLines={(updater) =>
                  setDraft((prev) => ({
                    ...prev,
                    lines: typeof updater === 'function' ? updater(prev.lines) : updater,
                  }))
                }
                vendorEditable
                disabled={submitting}
                showDocumentTotal
                onVendorChange={(code, label, vendorRow) => {
                  setVendor(code);
                  setVendorLabel(label || code);
                  if (vendorRow) {
                    setDraft((prev) => {
                      if (!prev) return prev;
                      const refreshed = buildPoDraftFromPr(pr, code, vendorRow);
                      return {
                        header: {
                          ...prev.header,
                          vendor: refreshed.vendor,
                          vendorLabel: refreshed.vendorLabel,
                          docCurrency: refreshed.docCurrency,
                          docRate: refreshed.docRate,
                        },
                        lines: prev.lines.map((line) => {
                          const match = refreshed.lines.find(
                            (l) =>
                              l.relatedPRLineId === line.relatedPRLineId ||
                              l.itemCode === line.itemCode,
                          );
                          return match
                            ? {
                                ...line,
                                itemCode: match.itemCode,
                                itemName: match.itemName || line.itemName,
                                uomCode: line.uomCode || match.uomCode,
                              }
                            : line;
                        }),
                      };
                    });
                  }
                }}
              />
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
              <Button
                type="button"
                variant="primary"
                loading={submitting}
                disabled={submitting || !draft.header.vendor.trim()}
                onClick={handleCreate}
              >
                {submitting ? c.creatingPurchaseOrder : c.createPurchaseOrder}
              </Button>
            </div>
          )}
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
