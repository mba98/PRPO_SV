'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/hooks/useI18n';
import { useVendorCurrencyConfig } from '@/lib/hooks/useVendorCurrencyConfig.js';
import VendorSelect from '@/components/lookups/VendorSelect';
import WarehouseSelect from '@/components/lookups/WarehouseSelect';
import ItemSearchInput from '@/components/lookups/ItemSearchInput';
import { DateInput, FormField, Input } from '@/components/ui';
import { fetchSapItemDetails, mapItemDetailsToLinePatch } from '@/lib/itemLineSelection';
import {
  applyCurrencyChangeToHeader,
  getAllowedCurrencyCodes,
  isCurrencyDropdownReadOnly,
  requiresPoDocRate,
} from '@/lib/poCurrency.js';
import {
  PO_COMPACT_INPUT,
  PO_LINE_GRID,
  recalcPoLineTotal,
  sumPoLineTotals,
} from '@/lib/poFormUtils.js';

export default function PoBusinessFields({
  header,
  setHeader,
  lines,
  setLines,
  vendorEditable = true,
  disabled = false,
  showDocumentTotal = false,
  onVendorChange,
}) {
  const { po: poI18n } = useI18n();
  const t = poI18n.edit;
  const c = poI18n.create;
  const [lineDetailLoading, setLineDetailLoading] = useState({});

  const vendorCode = String(header?.vendor || '').trim();
  const { vendorCurrencyConfig, currencyLoading, currencyError } = useVendorCurrencyConfig(
    vendorCode,
    setHeader,
    { failedLoadMessage: c.failedLoadVendorCurrencies },
  );

  function updateLine(idx, patch) {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l;
        const next = { ...l, ...patch };
        next.lineTotal = recalcPoLineTotal(next);
        return next;
      }),
    );
  }

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

  const documentTotal = sumPoLineTotals(lines);
  const allowedCurrencies = vendorCurrencyConfig?.allowedCurrencies || [];
  const currencyOptions =
    allowedCurrencies.length > 0
      ? allowedCurrencies
      : getAllowedCurrencyCodes(vendorCurrencyConfig).map((code) => ({ code, name: code }));
  const currencyReadOnly =
    !currencyLoading && !currencyError && isCurrencyDropdownReadOnly(vendorCurrencyConfig);
  const localCurrency =
    vendorCurrencyConfig?.companyLocalCurrency || header.companyLocalCurrency;
  const docRateRequired = requiresPoDocRate(header.docCurrency, localCurrency);
  const showMultiCurrencyHint =
    vendorCurrencyConfig?.currencyMode === 'all' && currencyOptions.length > 1;

  return (
    <>
      <section className="rounded-3xl border border-border bg-card p-4 shadow-xl shadow-black/5 sm:p-5">
        <h2 className="text-base font-bold text-foreground">{t.title}</h2>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label={t.vendor} required className="sm:col-span-2 lg:col-span-1">
            {vendorEditable ? (
              <VendorSelect
                loadAllOnFocus
                valueCode={header.vendor}
                valueLabel={header.vendorLabel}
                disabled={disabled}
                placeholder={c.searchVendor}
                emptyMessage={c.noVendorsFound}
                loadingMessage={c.loadingVendors}
                failedMessage={c.failedLoadVendors}
                inputClassName={PO_COMPACT_INPUT}
                onSelect={(code, label, vendor) => {
                  const nextHeader = {
                    ...header,
                    vendor: code,
                    vendorLabel: label || code,
                  };
                  setHeader(nextHeader);
                  onVendorChange?.(code, label, vendor, nextHeader);
                }}
              />
            ) : (
              <Input className={PO_COMPACT_INPUT} readOnly value={header.vendor} />
            )}
          </FormField>
          <FormField label={t.docCurrency}>
            <select
              className={`${PO_COMPACT_INPUT} w-full`}
              value={header.docCurrency}
              disabled={disabled || currencyLoading || Boolean(currencyError) || currencyReadOnly}
              onChange={(e) =>
                setHeader((h) => ({
                  ...h,
                  ...applyCurrencyChangeToHeader(e.target.value, h, localCurrency),
                }))
              }
            >
              {currencyLoading && (
                <option value={header.docCurrency || ''}>
                  {header.docCurrency || c.loadingVendorCurrencies}
                </option>
              )}
              {!currencyLoading && currencyError && (
                <option value="">{currencyError}</option>
              )}
              {!currencyLoading && !currencyError && currencyOptions.length === 0 && (
                <option value="">{c.noVendorCurrencies}</option>
              )}
              {!currencyLoading &&
                !currencyError &&
                currencyOptions.map(({ code, name }) => (
                  <option key={code} value={code}>
                    {name && name !== code ? `${code} — ${name}` : code}
                  </option>
                ))}
            </select>
            {currencyError && (
              <p className="mt-1 text-xs text-destructive" role="alert">
                {currencyError}
              </p>
            )}
            {showMultiCurrencyHint && (
              <p className="mt-1 text-xs text-muted-foreground">{c.multiCurrencyVendorHint}</p>
            )}
          </FormField>
          <FormField label={t.docRate} required={docRateRequired}>
            <Input
              type="number"
              min="0"
              step="any"
              className={PO_COMPACT_INPUT}
              value={header.docRate}
              required={docRateRequired}
              disabled={disabled || !docRateRequired}
              onChange={(e) => setHeader((h) => ({ ...h, docRate: e.target.value }))}
            />
            {docRateRequired && (
              <p className="mt-1 text-xs text-muted-foreground">{c.foreignDocRateRequired}</p>
            )}
          </FormField>
          <FormField label={t.postingDate}>
            <DateInput
              className={PO_COMPACT_INPUT}
              value={header.postingDate}
              disabled={disabled}
              onChange={(e) => setHeader((h) => ({ ...h, postingDate: e.target.value }))}
            />
          </FormField>
          <FormField label={t.documentDate}>
            <DateInput
              className={PO_COMPACT_INPUT}
              value={header.documentDate}
              disabled={disabled}
              onChange={(e) => setHeader((h) => ({ ...h, documentDate: e.target.value }))}
            />
          </FormField>
          <FormField label={t.dueDate}>
            <DateInput
              className={PO_COMPACT_INPUT}
              value={header.dueDate}
              disabled={disabled}
              onChange={(e) => setHeader((h) => ({ ...h, dueDate: e.target.value }))}
            />
          </FormField>
          <FormField label={t.requiredDate}>
            <DateInput
              className={PO_COMPACT_INPUT}
              value={header.requiredDate}
              disabled={disabled}
              onChange={(e) => setHeader((h) => ({ ...h, requiredDate: e.target.value }))}
            />
          </FormField>
        </div>
        <FormField label={t.remarks} className="mt-3">
          <textarea
            className={`${PO_COMPACT_INPUT} max-h-24 resize-y`}
            rows={2}
            value={header.remarks}
            disabled={disabled}
            onChange={(e) => setHeader((h) => ({ ...h, remarks: e.target.value }))}
          />
        </FormField>
        {showDocumentTotal && (
          <p className="mt-3 text-sm font-semibold text-foreground">
            {t.documentTotal}: {documentTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
        )}
      </section>

      <section className="rounded-3xl border border-border bg-card p-4 shadow-xl shadow-black/5 sm:p-5">
        <h2 className="text-base font-bold text-foreground">{t.lineItems}</h2>

        <div
          className={`mt-3 hidden gap-2 px-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground lg:grid ${PO_LINE_GRID}`}
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
              key={line._id || line.relatedPRLineId || idx}
              className="rounded-2xl border border-border bg-muted/20 p-3 text-sm"
            >
              <p className="mb-2 font-semibold text-foreground lg:hidden">
                {t.lineNumber} {idx + 1}
              </p>
              <div className={`grid gap-2 sm:grid-cols-2 lg:items-start lg:gap-2 ${PO_LINE_GRID}`}>
                <FormField className="lg:mt-0">
                  <span className="mb-1 block text-xs text-muted-foreground lg:hidden">{t.item}</span>
                  <ItemSearchInput
                    value={line}
                    inputClassName={PO_COMPACT_INPUT}
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
                    className={PO_COMPACT_INPUT}
                    value={line.itemName}
                    disabled={disabled}
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
                    className={PO_COMPACT_INPUT}
                    required
                    value={line.quantity}
                    disabled={disabled}
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
                    className={PO_COMPACT_INPUT}
                    required
                    value={line.unitPrice}
                    disabled={disabled || Boolean(lineDetailLoading[idx])}
                    onChange={(e) => updateLine(idx, { unitPrice: e.target.value })}
                  />
                </FormField>

                <FormField className="lg:mt-0">
                  <span className="mb-1 block text-xs text-muted-foreground lg:hidden">
                    {t.uomCode}
                  </span>
                  <Input
                    className={PO_COMPACT_INPUT}
                    value={line.uomCode}
                    disabled={disabled}
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
                    inputClassName={PO_COMPACT_INPUT}
                    disabled={disabled || Boolean(lineDetailLoading[idx])}
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
    </>
  );
}
