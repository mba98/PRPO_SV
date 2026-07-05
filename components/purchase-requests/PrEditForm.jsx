'use client';

import { useMemo, useState } from 'react';
import { apiFetch } from '@/lib/apiClient';
import { useAuthStore } from '@/stores/authStore';
import { useI18n } from '@/lib/hooks/useI18n';
import ItemSearchInput from '@/components/lookups/ItemSearchInput';
import VendorSelect from '@/components/lookups/VendorSelect';
import WarehouseSelect from '@/components/lookups/WarehouseSelect';
import ProjectSelect from '@/components/lookups/ProjectSelect';
import LineUomDisplay from '@/components/lookups/LineUomDisplay';
import { DateInput, FormField, Button } from '@/components/ui';
import CreateItemModal from './CreateItemModal';
import { fetchSapItemDetails, mapItemDetailsToLinePatch } from '@/lib/itemLineSelection';
import { parseNumberAllowZero } from '@/lib/numberParsing.js';
import { sumPrDocumentTotal, formatDocumentTotalAmount } from '@/lib/documentTotals.js';

const COMPACT_INPUT = 'input-field-compact';
const LINE_GRID =
  'lg:grid-cols-[2rem_minmax(8rem,1.2fr)_minmax(6rem,1fr)_minmax(7rem,1fr)_minmax(7rem,1fr)_4.5rem_5.5rem_minmax(11.25rem,1.2fr)_4.5rem_2.5rem]';

function toDateInput(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function mapLineFromPr(line) {
  return {
    itemCode: line.itemCode || '',
    itemName: line.itemName || '',
    itemGroupName: '',
    uom: line.uom || line.uomCode || '',
    uomCode: line.uomCode || line.uom || '',
    ugpEntry: '',
    ugpName: line.uom || line.uomCode || '',
    vendor: line.vendor || '',
    vendorLabel: line.vendor || '',
    warehouseCode: line.warehouseCode || '',
    warehouseLabel: line.warehouseCode || '',
    quantity: line.quantity ?? 1,
    estimatedUnitPrice: line.estimatedUnitPrice ?? '',
    estimatedTotal: line.estimatedTotal ?? '',
  };
}

function recalcTotal(line) {
  const q = parseNumberAllowZero(line.quantity, 0);
  const p = parseNumberAllowZero(line.estimatedUnitPrice, 0);
  return String(q * p);
}

function validateForm(header, lines, labels) {
  const fieldErrors = {};
  if (!header.requiredDate) {
    fieldErrors.requiredDate = labels.requiredDateRequired;
  }
  lines.forEach((line, idx) => {
    if (!line.itemCode?.trim()) {
      fieldErrors[`line${idx}.item`] = labels.itemRequired;
    }
    if (!line.warehouseCode?.trim()) {
      fieldErrors[`line${idx}.warehouse`] = labels.warehouseRequired;
    }
    if (!line.quantity || Number(line.quantity) <= 0) {
      fieldErrors[`line${idx}.quantity`] = labels.quantityRequired;
    }
    if (line.estimatedUnitPrice === '' || line.estimatedUnitPrice == null) {
      fieldErrors[`line${idx}.unitPrice`] = labels.unitPriceRequired;
    } else if (Number(line.estimatedUnitPrice) < 0) {
      fieldErrors[`line${idx}.unitPrice`] = labels.unitPriceRequired;
    }
  });
  return fieldErrors;
}

export default function PrEditForm({ pr, onSaved, onCancel }) {
  const { pr: prI18n, common, detail } = useI18n();
  const t = { ...prI18n.create, ...prI18n.edit };
  const canCreateItem = useAuthStore((s) => s.hasPermission('items.create'));

  const [header, setHeader] = useState({
    requiredDate: toDateInput(pr.requiredDate),
    documentDate: toDateInput(pr.documentDate),
    dueDate: toDateInput(pr.dueDate),
    project: pr.project || '',
    projectLabel: pr.project || '',
    remarks: pr.remarks || '',
  });
  const [lines, setLines] = useState(
    (pr.lines || []).length ? (pr.lines || []).map(mapLineFromPr) : [mapLineFromPr({})],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [itemModal, setItemModal] = useState(false);
  const [itemModalLine, setItemModalLine] = useState(0);
  const [lineDetailLoading, setLineDetailLoading] = useState({});

  const documentTotal = useMemo(() => sumPrDocumentTotal(lines), [lines]);

  function updateHeader(patch) {
    setHeader((prev) => {
      const next = { ...prev, ...patch };
      if (patch.requiredDate != null) {
        if (!prev.documentDate || prev.documentDate === prev.requiredDate) {
          next.documentDate = patch.requiredDate;
        }
        if (!prev.dueDate || prev.dueDate === prev.requiredDate) {
          next.dueDate = patch.requiredDate;
        }
      }
      return next;
    });
  }

  async function handleItemSelected(itemCode, lineIndex) {
    const code = String(itemCode || '').trim();
    if (!code) return;
    setLineDetailLoading((prev) => ({ ...prev, [lineIndex]: true }));
    try {
      const details = await fetchSapItemDetails(code);
      updateLine(lineIndex, mapItemDetailsToLinePatch(details));
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
        next.estimatedTotal = recalcTotal(next);
        return next;
      }),
    );
    setFieldErrors((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        if (key.startsWith(`line${idx}.`)) delete next[key];
      });
      return next;
    });
  }

  function addLine() {
    setLines((prev) => [...prev, mapLineFromPr({})]);
  }

  function removeLine(idx) {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  }

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    const errors = validateForm(header, lines, t);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setSaving(true);

    const documentDate = header.documentDate || header.requiredDate;
    const dueDate = header.dueDate || header.requiredDate;
    const payload = {
      __v: pr.__v,
      requiredDate: header.requiredDate,
      documentDate: documentDate || undefined,
      dueDate: dueDate || undefined,
      project: header.project || undefined,
      remarks: header.remarks || undefined,
      lines: lines.map((l) => ({
        itemCode: l.itemCode,
        itemName: l.itemName || undefined,
        uom: l.uom || l.ugpName || undefined,
        uomCode: l.uomCode?.trim() || l.uom?.trim() || undefined,
        vendor: l.vendor || undefined,
        warehouseCode: l.warehouseCode || undefined,
        quantity: Number(l.quantity),
        estimatedUnitPrice: l.estimatedUnitPrice ? Number(l.estimatedUnitPrice) : undefined,
        estimatedTotal: l.estimatedTotal ? Number(l.estimatedTotal) : undefined,
      })),
    };

    try {
      const { json, status } = await apiFetch(`/api/purchase-requests/${pr.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
        dedupe: false,
      });
      if (!json.success) {
        setError(json.message || common.errorLoad);
        if (status === 409) {
          setError(json.message || t.versionConflict);
        }
        return;
      }
      onSaved?.(json.data);
    } catch (err) {
      setError(err.message || common.errorLoad);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      {error && (
        <p
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}

      <section className="card space-y-3 p-4 sm:p-5">
        <h2 className="text-base font-bold text-foreground">{t.header}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label={t.requiredDate} required error={fieldErrors.requiredDate}>
            <DateInput
              className={COMPACT_INPUT}
              required
              value={header.requiredDate}
              onChange={(e) => updateHeader({ requiredDate: e.target.value })}
            />
          </FormField>
          <FormField label={t.documentDate}>
            <DateInput
              className={COMPACT_INPUT}
              value={header.documentDate}
              onChange={(e) => updateHeader({ documentDate: e.target.value })}
            />
          </FormField>
          <FormField label={t.dueDate}>
            <DateInput
              className={COMPACT_INPUT}
              value={header.dueDate}
              onChange={(e) => updateHeader({ dueDate: e.target.value })}
            />
          </FormField>
          <FormField label={t.project} className="sm:col-span-2">
            <ProjectSelect
              valueCode={header.project}
              valueLabel={header.projectLabel}
              placeholder={t.searchProject}
              emptyMessage={t.noProjectsFound}
              loadingMessage={t.loading}
              inputClassName={COMPACT_INPUT}
              onSelect={(code, label) =>
                updateHeader({ project: code, projectLabel: label || code })
              }
            />
          </FormField>
        </div>
        <FormField label={t.remarks}>
          <textarea
            className={`${COMPACT_INPUT} max-h-24 resize-y`}
            rows={2}
            placeholder={t.remarksPlaceholder}
            value={header.remarks}
            onChange={(e) => updateHeader({ remarks: e.target.value })}
          />
        </FormField>
      </section>

      <section className="card space-y-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-foreground">{t.lineItems}</h2>
          <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={addLine}>
            {t.addLine}
          </button>
        </div>

        <div className="space-y-2">
          {lines.map((line, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-border bg-card p-3 text-sm shadow-sm"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="font-semibold text-foreground">
                  {t.lineNumber} {idx + 1}
                </span>
                <button
                  type="button"
                  className="text-xs font-semibold text-destructive hover:underline"
                  onClick={() => removeLine(idx)}
                >
                  {t.removeLine}
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <FormField error={fieldErrors[`line${idx}.item`]}>
                  <span className="mb-1 block text-xs text-muted-foreground">{t.item}</span>
                  <ItemSearchInput
                    value={line}
                    inputClassName={COMPACT_INPUT}
                    placeholder={t.searchItem}
                    searchingLabel={t.searching}
                    loadingItemDetailsLabel={t.loadingItemDetails}
                    detailLoading={Boolean(lineDetailLoading[idx])}
                    noResultsMessage={t.noMatchingItems}
                    canCreateNew={canCreateItem}
                    createNewLabel={t.createNewItem}
                    onCreateNew={() => {
                      setItemModalLine(idx);
                      setItemModal(true);
                    }}
                    onItemCodeSelected={(itemCode) => handleItemSelected(itemCode, idx)}
                  />
                </FormField>
                <FormField>
                  <span className="mb-1 block text-xs text-muted-foreground">{t.itemName}</span>
                  <input className={`${COMPACT_INPUT} bg-muted`} readOnly value={line.itemName} />
                </FormField>
                <FormField error={fieldErrors[`line${idx}.warehouse`]}>
                  <span className="mb-1 block text-xs text-muted-foreground">{t.warehouse}</span>
                  <WarehouseSelect
                    key={`wh-${idx}-${line.itemCode}`}
                    syncKey={`${line.itemCode}|${line.warehouseCode}|${line.warehouseLabel}`}
                    valueCode={line.warehouseCode}
                    valueLabel={line.warehouseLabel}
                    placeholder={t.searchWarehouse}
                    emptyMessage={t.noWarehousesFound}
                    loadingMessage={t.loading}
                    inputClassName={COMPACT_INPUT}
                    disabled={Boolean(lineDetailLoading[idx])}
                    onSelect={(code, label) =>
                      updateLine(idx, { warehouseCode: code, warehouseLabel: label })
                    }
                  />
                </FormField>
                <FormField>
                  <span className="mb-1 block text-xs text-muted-foreground">{t.vendor}</span>
                  <VendorSelect
                    valueCode={line.vendor}
                    valueLabel={line.vendorLabel}
                    placeholder={t.searchVendor}
                    emptyMessage={t.noSuggestions}
                    loadingMessage={t.loading}
                    inputClassName={COMPACT_INPUT}
                    onSelect={(code, label) => updateLine(idx, { vendor: code, vendorLabel: label })}
                  />
                </FormField>
                <FormField error={fieldErrors[`line${idx}.quantity`]}>
                  <span className="mb-1 block text-xs text-muted-foreground">{t.quantity}</span>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    className={COMPACT_INPUT}
                    value={line.quantity}
                    onChange={(e) => updateLine(idx, { quantity: e.target.value })}
                  />
                </FormField>
                <FormField error={fieldErrors[`line${idx}.unitPrice`]}>
                  <span className="mb-1 block text-xs text-muted-foreground">{t.unitPrice}</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    className={COMPACT_INPUT}
                    value={line.estimatedUnitPrice}
                    disabled={Boolean(lineDetailLoading[idx])}
                    onChange={(e) => updateLine(idx, { estimatedUnitPrice: e.target.value })}
                  />
                </FormField>
                <FormField>
                  <span className="mb-1 block text-xs text-muted-foreground">{t.uom}</span>
                  <LineUomDisplay line={line} inputClassName={COMPACT_INPUT} />
                </FormField>
                <FormField>
                  <span className="mb-1 block text-xs text-muted-foreground">{t.total}</span>
                  <input className={`${COMPACT_INPUT} bg-muted`} readOnly value={line.estimatedTotal} />
                </FormField>
              </div>
            </div>
          ))}
        </div>
        <p className="text-sm font-semibold text-foreground">
          {detail.documentTotal}: {formatDocumentTotalAmount(documentTotal)}
        </p>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={saving} disabled={saving}>
          {saving ? t.saving : t.saveChanges}
        </Button>
        <button type="button" className="btn-secondary min-h-10" onClick={onCancel}>
          {t.cancel}
        </button>
      </div>

      <CreateItemModal
        open={itemModal}
        onClose={() => setItemModal(false)}
        onCreated={(itemCode) => {
          setItemModal(false);
          handleItemSelected(itemCode, itemModalLine);
        }}
      />
    </form>
  );
}
