'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/apiClient';
import VendorSelect from '@/components/lookups/VendorSelect';
import { PortalLoader, AnimatedStatusBadge, Button } from '@/components/ui';
import { useI18n } from '@/lib/hooks/useI18n';

function formatTemplate(template, vars) {
  return Object.entries(vars).reduce(
    (str, [key, value]) => str.replaceAll(`{${key}}`, String(value ?? '')),
    template,
  );
}

export default function ApprovedForPoManager() {
  const { pr, po: poI18n } = useI18n();
  const t = pr.approvedForPo;
  const c = poI18n.create;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [vendor, setVendor] = useState('');
  const [vendorLabel, setVendorLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const selected = items.find((prItem) => prItem.id === selectedId);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { json } = await apiFetch('/api/purchase-requests/approved-for-po?limit=100');
    if (json.success) {
      setItems(json.data);
      setSelectedId((prev) => prev || json.data[0]?.id || '');
    } else {
      setError(json.message || t.loadError);
    }
    setLoading(false);
  }, [t.loadError]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!selected) return;
    const defaultVendor =
      selected.pendingVendors?.[0] || selected.suggestedVendors?.[0] || '';
    setVendor(defaultVendor);
    setVendorLabel(defaultVendor);
  }, [selectedId, selected]);

  async function handleCreatePo() {
    if (submitting) return;
    if (!selectedId || !vendor.trim()) {
      setError(c.vendorRequired);
      return;
    }
    setSubmitting(true);
    setError('');
    setMessage('');
    const { json } = await apiFetch(`/api/purchase-orders/from-pr/${selectedId}`, {
      method: 'POST',
      body: JSON.stringify({ vendor: vendor.trim() }),
    });
    if (json.success) {
      const poId = json.data.po?.id;
      const poNumber = json.data.po?.portalPONumber;
      setMessage(formatTemplate(t.poCreatedSuccess, { number: poNumber }));
      if (poId) {
        window.location.href = `/purchase-orders/${poId}`;
        return;
      }
      await load();
    } else {
      setError(json.message || t.createError);
    }
    setSubmitting(false);
  }

  return (
    <div className="space-y-6">
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200"
        >
          {message}
        </p>
      )}

      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <PortalLoader />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 overflow-x-auto rounded-3xl border border-border bg-card shadow-xl shadow-black/5">
            <table className="min-w-full text-sm">
              <thead className="bg-muted text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-10 px-4 py-3" />
                  <th className="px-4 py-3">{t.colPrNumber}</th>
                  <th className="px-4 py-3">{t.colSapPr}</th>
                  <th className="px-4 py-3">{t.colDepartment}</th>
                  <th className="px-4 py-3">{t.colStatus}</th>
                  <th className="px-4 py-3">{t.colSapPo}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      {t.emptyList}
                    </td>
                  </tr>
                )}
                {items.map((prItem) => (
                  <tr
                    key={prItem.id}
                    className={`cursor-pointer transition-colors hover:bg-muted/60 ${
                      selectedId === prItem.id ? 'bg-primary/10 ring-1 ring-primary' : ''
                    }`}
                    onClick={() => setSelectedId(prItem.id)}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="radio"
                        name="pr-select"
                        checked={selectedId === prItem.id}
                        onChange={() => setSelectedId(prItem.id)}
                        aria-label={prItem.portalPRNumber}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/purchase-requests/${prItem.id}`}
                        className="font-medium text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {prItem.portalPRNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{prItem.sapPRDocNum || prItem.sapPRDocEntry}</td>
                    <td className="px-4 py-3">{prItem.department || '—'}</td>
                    <td className="px-4 py-3">
                      <AnimatedStatusBadge status={prItem.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {prItem.sapPODocNum || '—'}
                      {prItem.pendingVendors?.length > 0 && (
                        <span className="ms-1 text-xs text-amber-700 dark:text-amber-300">
                          ({formatTemplate(t.vendorsPending, { count: prItem.pendingVendors.length })})
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-4 rounded-3xl border border-border bg-card p-4 shadow-xl shadow-black/5 sm:p-5">
            <h2 className="text-lg font-semibold text-foreground">{t.createTitle}</h2>
            <p className="text-xs text-muted-foreground">{t.createHint}</p>
            {!selected ? (
              <p className="text-sm text-muted-foreground">{t.selectPr}</p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {formatTemplate(t.prLine, {
                    pr: selected.portalPRNumber,
                    sap: selected.sapPRDocNum || selected.sapPRDocEntry,
                  })}
                </p>
                {selected.suggestedVendors?.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t.suggestedVendors}: {selected.suggestedVendors.join(', ')}
                  </p>
                )}
                {selected.existingPOs?.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    <p className="font-semibold text-foreground">{t.existingPos}</p>
                    <ul className="mt-1 space-y-0.5">
                      {selected.existingPOs.map((o) => (
                        <li key={o.id}>
                          {o.portalPONumber} — {o.vendor} ({o.status})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
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
                <Button
                  type="button"
                  variant="primary"
                  className="w-full"
                  loading={submitting}
                  disabled={submitting || !vendor.trim()}
                  onClick={handleCreatePo}
                >
                  {submitting ? c.creatingPurchaseOrder : c.createPurchaseOrder}
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
