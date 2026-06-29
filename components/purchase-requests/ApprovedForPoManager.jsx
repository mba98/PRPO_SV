'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/apiClient';
import VendorSelect from '@/components/lookups/VendorSelect';
import PoBusinessFields from '@/components/purchase-orders/PoBusinessFields';
import { PortalLoader, AnimatedStatusBadge, Button } from '@/components/ui';
import { useI18n } from '@/lib/hooks/useI18n';
import { buildPoDraftFromPr } from '@/lib/poFromPrDraft.js';
import { getPoExchangeRateSubmitBlocker } from '@/lib/poCurrency.js';

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
  const [draft, setDraft] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [exchangeRateState, setExchangeRateState] = useState({
    rateLoading: false,
    rateError: '',
    needsRate: false,
  });

  const selected = items.find((prItem) => prItem.id === selectedId);

  const load = useCallback(async (isCancelled) => {
    setLoading(true);
    setError('');
    const { json } = await apiFetch('/api/purchase-requests/approved-for-po?limit=100', {
      source: 'ApprovedForPoManager',
    });
    if (isCancelled?.()) return;
    if (json.success) {
      setItems(json.data);
      setSelectedId((prev) => prev || json.data[0]?.id || '');
    } else {
      setError(json.message || t.loadError);
    }
    setLoading(false);
  }, [t.loadError]);

  useEffect(() => {
    let cancelled = false;
    load(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    if (!selected) {
      setVendor('');
      setVendorLabel('');
      setDraft(null);
      return;
    }
    const defaultVendor =
      selected.pendingVendors?.[0] || selected.suggestedVendors?.[0] || '';
    setVendor(defaultVendor);
    setVendorLabel(defaultVendor);
    setDraft(null);
  }, [selectedId, selected]);

  function initializeDraft(prItem, vendorCode, vendorRow = null) {
    const nextDraft = buildPoDraftFromPr(prItem, vendorCode, vendorRow);
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
    if (!trimmed || !selected) return;

    if (draft && draft.header.vendor && draft.header.vendor !== trimmed) {
      const confirmed = window.confirm(c.poVendorChangeConfirm);
      if (!confirmed) return;
    }

    setVendor(trimmed);
    setVendorLabel(label || trimmed);
    initializeDraft(selected, trimmed, vendorRow);
    setError('');
  }

  async function handleCreatePo() {
    if (submitting || !draft || !selectedId) return;
    const vendorCode = draft.header.vendor.trim();
    if (!vendorCode) {
      setError(c.vendorRequired);
      return;
    }
    if (!draft.lines.length) {
      setError(c.noLinesForVendor);
      return;
    }

    const rateBlocker = getPoExchangeRateSubmitBlocker(
      draft.header,
      draft.header.companyLocalCurrency,
      exchangeRateState,
      {
        loading: c.loadingExchangeRate,
        missing: c.sapExchangeRateMissing,
      },
    );
    if (rateBlocker) {
      setError(rateBlocker);
      return;
    }

    setSubmitting(true);
    setError('');
    setMessage('');

    const { header, lines } = draft;
    const { json } = await apiFetch(`/api/purchase-orders/from-pr/${selectedId}`, {
      method: 'POST',
      body: JSON.stringify({
        vendor: vendorCode,
        postingDate: header.postingDate || undefined,
        documentDate: header.documentDate || undefined,
        requiredDate: header.requiredDate || undefined,
        dueDate: header.dueDate || undefined,
        docCurrency: header.docCurrency,
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
      }),
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

          <div className="max-h-[calc(100vh-8rem)] space-y-4 overflow-y-auto rounded-3xl border border-border bg-card p-4 shadow-xl shadow-black/5 sm:p-5">
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
                      onSelect={handleVendorSelect}
                    />
                  </div>
                </label>
                {draft && (
                  <div className="space-y-4 pt-2">
                    <PoBusinessFields
                      header={draft.header}
                      setHeader={(updater) =>
                        setDraft((prev) => {
                          if (!prev) return prev;
                          return {
                            ...prev,
                            header: typeof updater === 'function' ? updater(prev.header) : updater,
                          };
                        })
                      }
                      lines={draft.lines}
                      setLines={(updater) =>
                        setDraft((prev) => {
                          if (!prev) return prev;
                          return {
                            ...prev,
                            lines: typeof updater === 'function' ? updater(prev.lines) : updater,
                          };
                        })
                      }
                      vendorEditable
                      disabled={submitting}
                      showDocumentTotal
                      onExchangeRateStateChange={setExchangeRateState}
                      onVendorChange={(code, label) => {
                        setVendor(code);
                        setVendorLabel(label || code);
                        setDraft((prev) => {
                          if (!prev || !selected) return prev;
                          const refreshed = buildPoDraftFromPr(selected, code, null);
                          return {
                            header: {
                              ...prev.header,
                              vendor: refreshed.vendor,
                              vendorLabel: label || refreshed.vendorLabel,
                              postingDate: prev.header.postingDate || refreshed.postingDate,
                              documentDate: prev.header.documentDate || refreshed.documentDate,
                              requiredDate: prev.header.requiredDate || refreshed.requiredDate,
                              dueDate: prev.header.dueDate || refreshed.dueDate,
                              remarks: prev.header.remarks || refreshed.remarks,
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
                      }}
                    />
                    <Button
                      type="button"
                      variant="primary"
                      className="w-full"
                      loading={submitting}
                      disabled={
                        submitting ||
                        !draft.header.vendor.trim() ||
                        exchangeRateState.rateLoading ||
                        Boolean(exchangeRateState.rateError)
                      }
                      onClick={handleCreatePo}
                    >
                      {submitting ? c.creatingPurchaseOrder : c.createPurchaseOrder}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
