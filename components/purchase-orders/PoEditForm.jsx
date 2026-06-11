'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/apiClient';
import { useI18n } from '@/lib/hooks/useI18n';
import VendorSelect from '@/components/lookups/VendorSelect';
import WarehouseSelect from '@/components/lookups/WarehouseSelect';
import ItemSearchInput from '@/components/lookups/ItemSearchInput';
import { Button, DateInput, FormField, Input } from '@/components/ui';
import { fetchSapItemDetails, mapItemDetailsToLinePatch } from '@/lib/itemLineSelection';
import {
  applyCurrencyChangeToHeader,
  applyVendorCurrencyToHeader,
  isUsdPoCurrency,
  PO_DOC_CURRENCIES,
  resolveFormDocCurrencyFromPo,
  resolveFormDocRateFromPo,
} from '@/lib/poCurrency.js';

const COMPACT_INPUT = 'input-field-compact';

const LINE_GRID =
  'lg:grid-cols-[minmax(5.5rem,0.85fr)_minmax(6rem,1.15fr)_4.25rem_5rem_4rem_5rem_4.5rem]';

function toDateInput(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function recalcLineTotal(line) {
  const q = parseFloat(line.quantity) || 0;
  const p = parseFloat(line.unitPrice) || 0;
  return q && p ? q * p : '';
}

export default function PoEditForm({ po, onSaved, onCancel }) {
  const { po: poI18n } = useI18n();
  const t = poI18n.edit;
  const c = poI18n.create;

  const vendorEditable = po.canEdit !== false;

  const [header, setHeader] = useState({
    vendor: po.vendor || '',
    vendorLabel: po.vendor || '',
    postingDate: toDateInput(po.postingDate),
    documentDate: toDateInput(po.documentDate),
    requiredDate: toDateInput(po.requiredDate),
    dueDate: toDateInput(po.dueDate),
    docCurrency: resolveFormDocCurrencyFromPo(po),
    docRate: resolveFormDocRateFromPo(po),
    remarks: po.remarks || '',
  });
  const [lines, setLines] = useState(
    (po.lines || []).map((line) => ({
      _id: line._id,
      itemCode: line.itemCode || '',
      itemName: line.itemName || '',
      quantity: line.quantity ?? '',
      unitPrice: line.unitPrice ?? '',
      lineTotal: line.lineTotal ?? recalcLineTotal(line),
      warehouseCode: line.warehouseCode || '',
      warehouseLabel: line.warehouseCode || '',
      uomCode: line.uomCode || line.uom || '',
      remarks: line.remarks || '',
    })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [lineDetailLoading, setLineDetailLoading] = useState({});

  async function handleItemSelected(itemCode, lineIndex) {
    const code = String(itemCode || '').trim();
    if (!code) return;

    setLineDetailLoading((prev) => ({ ...prev, [lineIndex]: true }));
    try {
      const details = await fetchSapItemDetails(code);
      const patch = mapItemDetailsToLinePatch(details);
      updateLine(lineIndex, {
        itemCode: patch.itemCode,
        itemName: patch.itemName,
        uomCode: patch.uomCode || patch.ugpName || '',
        ugpEntry: patch.ugpEntry,
        ugpName: patch.ugpName,
        unitPrice: patch.unitPrice,
        warehouseCode: patch.warehouseCode,
        warehouseLabel: patch.warehouseLabel,
      });
    } catch (err) {
      console.error('[item-select] failed to load item details', err);
      updateLine(lineIndex, { itemCode: code });
    } finally {
      setLineDetailLoading((prev) => ({ ...prev, [lineIndex]: false }));
    }
  }

  function updateLine(idx, patch) {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l;
        const next = { ...l, ...patch };
        next.lineTotal = recalcLineTotal(next);
        return next;
      }),
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');

    const payload = {
      __v: po.__v,
      vendor: header.vendor.trim(),
      remarks: header.remarks,
      postingDate: header.postingDate || undefined,
      documentDate: header.documentDate || undefined,
      requiredDate: header.requiredDate || undefined,
      dueDate: header.dueDate || undefined,
      docCurrency: header.docCurrency,
      docRate: header.docRate === '' ? null : header.docRate ? Number(header.docRate) : undefined,
      lines: lines.map((l) => ({
        _id: l._id,
        itemCode: l.itemCode,
        itemName: l.itemName || undefined,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        warehouseCode: l.warehouseCode || undefined,
        uomCode: l.uomCode?.trim() || undefined,
        remarks: l.remarks || undefined,
      })),
    };

    const { json } = await apiFetch(`/api/purchase-orders/${po.id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });

    if (json.success) {
      onSaved?.(json.data);
    } else {
      setError(json.message || 'Failed to save purchase order');
      if (json.errors?.length) {
        setError(json.errors.map((x) => x.message).join(', '));
      }
    }
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <section className="rounded-3xl border border-border bg-card p-4 shadow-xl shadow-black/5 sm:p-5">
        <h2 className="text-base font-bold text-foreground">{t.title}</h2>
        {error && (
          <p
            className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        )}

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label={t.vendor} required className="sm:col-span-2 lg:col-span-1">
            {vendorEditable ? (
              <VendorSelect
                loadAllOnFocus
                valueCode={header.vendor}
                valueLabel={header.vendorLabel}
                disabled={saving}
                placeholder={c.searchVendor}
                emptyMessage={c.noVendorsFound}
                loadingMessage={c.loadingVendors}
                failedMessage={c.failedLoadVendors}
                inputClassName={COMPACT_INPUT}
                onSelect={(code, label, vendor) =>
                  setHeader((h) => ({
                    ...h,
                    vendor: code,
                    vendorLabel: label || code,
                    ...applyVendorCurrencyToHeader(vendor, h),
                  }))
                }
              />
            ) : (
              <Input className={COMPACT_INPUT} readOnly value={header.vendor} />
            )}
          </FormField>
          <FormField label={t.docCurrency}>
            <select
              className={`${COMPACT_INPUT} w-full`}
              value={header.docCurrency}
              disabled={saving}
              onChange={(e) =>
                setHeader((h) => ({
                  ...h,
                  ...applyCurrencyChangeToHeader(e.target.value, h),
                }))
              }
            >
              {PO_DOC_CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label={t.docRate}>
            <Input
              type="number"
              min="0"
              step="any"
              className={COMPACT_INPUT}
              value={header.docRate}
              disabled={saving || !isUsdPoCurrency(header.docCurrency)}
              onChange={(e) => setHeader((h) => ({ ...h, docRate: e.target.value }))}
            />
          </FormField>
          <FormField label={t.postingDate}>
            <DateInput
              className={COMPACT_INPUT}
              value={header.postingDate}
              onChange={(e) => setHeader((h) => ({ ...h, postingDate: e.target.value }))}
            />
          </FormField>
          <FormField label={t.documentDate}>
            <DateInput
              className={COMPACT_INPUT}
              value={header.documentDate}
              onChange={(e) => setHeader((h) => ({ ...h, documentDate: e.target.value }))}
            />
          </FormField>
          <FormField label={t.dueDate}>
            <DateInput
              className={COMPACT_INPUT}
              value={header.dueDate}
              onChange={(e) => setHeader((h) => ({ ...h, dueDate: e.target.value }))}
            />
          </FormField>
          <FormField label={t.requiredDate}>
            <DateInput
              className={COMPACT_INPUT}
              value={header.requiredDate}
              onChange={(e) => setHeader((h) => ({ ...h, requiredDate: e.target.value }))}
            />
          </FormField>
        </div>
        <FormField label={t.remarks} className="mt-3">
          <textarea
            className={`${COMPACT_INPUT} max-h-24 resize-y`}
            rows={2}
            value={header.remarks}
            onChange={(e) => setHeader((h) => ({ ...h, remarks: e.target.value }))}
          />
        </FormField>
      </section>

      <section className="rounded-3xl border border-border bg-card p-4 shadow-xl shadow-black/5 sm:p-5">
        <h2 className="text-base font-bold text-foreground">{t.lineItems}</h2>

        <div
          className={`mt-3 hidden gap-2 px-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground lg:grid ${LINE_GRID}`}
        >
          <span>{t.item}</span>
          <span>{t.itemName}</span>
          <span>{t.quantity}</span>
          <span>{t.unitPrice}</span>
          <span>{t.uomCode}</span>
          <span>{t.warehouse}</span>
          <span>{t.total}</span>
        </div>

        <div className="mt-2 space-y-2">
          {lines.map((line, idx) => (
            <div
              key={line._id || idx}
              className="rounded-2xl border border-border bg-muted/20 p-3 text-sm"
            >
              <p className="mb-2 font-semibold text-foreground lg:hidden">
                {t.lineNumber} {idx + 1}
              </p>
              <div className={`grid gap-2 sm:grid-cols-2 lg:items-start lg:gap-2 ${LINE_GRID}`}>
                <FormField className="lg:mt-0">
                  <span className="mb-1 block text-xs text-muted-foreground lg:hidden">{t.item}</span>
                  <ItemSearchInput
                    value={line}
                    inputClassName={COMPACT_INPUT}
                    searchingLabel={c.searching}
                    loadingItemDetailsLabel={c.loadingItemDetails}
                    detailLoading={Boolean(lineDetailLoading[idx])}
                    onItemCodeSelected={(itemCode) => handleItemSelected(itemCode, idx)}
                  />
                </FormField>

                <FormField className="lg:mt-0">
                  <span className="mb-1 block text-xs text-muted-foreground lg:hidden">
                    {t.itemName}
                  </span>
                  <Input
                    className={COMPACT_INPUT}
                    value={line.itemName}
                    onChange={(e) => updateLine(idx, { itemName: e.target.value })}
                  />
                </FormField>

                <FormField className="lg:mt-0">
                  <span className="mb-1 block text-xs text-muted-foreground lg:hidden">
                    {t.quantity}
                  </span>
                  <Input
                    type="number"
                    min="0.01"
                    step="any"
                    className={COMPACT_INPUT}
                    required
                    value={line.quantity}
                    onChange={(e) => updateLine(idx, { quantity: e.target.value })}
                  />
                </FormField>

                <FormField className="lg:mt-0">
                  <span className="mb-1 block text-xs text-muted-foreground lg:hidden">
                    {t.unitPrice}
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    className={COMPACT_INPUT}
                    required
                    value={line.unitPrice}
                    disabled={Boolean(lineDetailLoading[idx])}
                    onChange={(e) => updateLine(idx, { unitPrice: e.target.value })}
                  />
                </FormField>

                <FormField className="lg:mt-0">
                  <span className="mb-1 block text-xs text-muted-foreground lg:hidden">
                    {t.uomCode}
                  </span>
                  <Input
                    className={COMPACT_INPUT}
                    value={line.uomCode}
                    onChange={(e) => updateLine(idx, { uomCode: e.target.value })}
                  />
                </FormField>

                <FormField className="lg:mt-0">
                  <span className="mb-1 block text-xs text-muted-foreground lg:hidden">
                    {t.warehouse}
                  </span>
                  <WarehouseSelect
                    key={`wh-${idx}-${line.itemCode}`}
                    syncKey={`${line.itemCode}|${line.warehouseCode}|${line.warehouseLabel}`}
                    valueCode={line.warehouseCode}
                    valueLabel={line.warehouseLabel}
                    inputClassName={COMPACT_INPUT}
                    disabled={Boolean(lineDetailLoading[idx])}
                    onSelect={(code, label) =>
                      updateLine(idx, { warehouseCode: code, warehouseLabel: label })
                    }
                  />
                </FormField>

                <div className="flex items-end lg:mt-0">
                  <p className="w-full rounded-xl bg-muted/40 px-2 py-2 text-center text-sm font-semibold text-foreground lg:py-2.5">
                    <span className="lg:hidden text-xs font-normal text-muted-foreground">
                      {t.total}:{' '}
                    </span>
                    {line.lineTotal || '—'}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={saving} disabled={saving}>
          {saving ? t.saving : t.saveChanges}
        </Button>
        {onCancel && (
          <Button type="button" variant="secondary" disabled={saving} onClick={onCancel}>
            {t.cancel}
          </Button>
        )}
      </div>
    </form>
  );
}
