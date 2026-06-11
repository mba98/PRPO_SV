'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/apiClient';
import {
  uploadDocumentAttachments,
  formatAttachmentUploadWarning,
} from '@/lib/attachmentUploadHelpers';
import { useAuthStore } from '@/stores/authStore';
import { useI18n } from '@/lib/hooks/useI18n';
import ItemSearchInput from '@/components/lookups/ItemSearchInput';
import VendorSelect from '@/components/lookups/VendorSelect';
import WarehouseSelect from '@/components/lookups/WarehouseSelect';
import ProjectSelect from '@/components/lookups/ProjectSelect';
import UomGroupSelect from '@/components/lookups/UomGroupSelect';
import AttachmentDropzone from '@/components/attachments/AttachmentDropzone';
import { DateInput, FormField } from '@/components/ui';
import CreateItemModal from './CreateItemModal';

const COMPACT_INPUT = 'input-field-compact';

const LINE_GRID =
  'lg:grid-cols-[2rem_minmax(8rem,1.2fr)_minmax(6rem,1fr)_minmax(7rem,1fr)_minmax(7rem,1fr)_4.5rem_5.5rem_minmax(11.25rem,1.2fr)_4.5rem_2.5rem]';

const EMPTY_LINE = () => ({
  itemCode: '',
  itemName: '',
  itemGroupName: '',
  uom: '',
  uomCode: '',
  ugpEntry: '',
  ugpName: '',
  vendor: '',
  vendorLabel: '',
  warehouseCode: '',
  warehouseLabel: '',
  quantity: 1,
  estimatedUnitPrice: '',
  estimatedTotal: '',
});

function recalcTotal(line) {
  const q = parseFloat(line.quantity) || 0;
  const p = parseFloat(line.estimatedUnitPrice) || 0;
  return q && p ? String(q * p) : line.estimatedTotal;
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

export default function PrCreateForm() {
  const router = useRouter();
  const { pr, common } = useI18n();
  const t = pr.create;
  const canCreateItem = useAuthStore((s) => s.hasPermission('items.create'));

  const [header, setHeader] = useState({
    requiredDate: '',
    documentDate: '',
    dueDate: '',
    project: '',
    projectLabel: '',
    remarks: '',
  });
  const [lines, setLines] = useState([EMPTY_LINE()]);
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [itemModal, setItemModal] = useState(false);
  const [itemModalLine, setItemModalLine] = useState(0);

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
    setLines((prev) => [...prev, EMPTY_LINE()]);
  }

  function removeLine(idx) {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setWarning('');

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
        ugpEntry: l.ugpEntry ? Number(l.ugpEntry) : undefined,
        ugpName: l.ugpName || undefined,
        vendor: l.vendor || undefined,
        warehouseCode: l.warehouseCode || undefined,
        quantity: Number(l.quantity),
        estimatedUnitPrice: l.estimatedUnitPrice ? Number(l.estimatedUnitPrice) : undefined,
        estimatedTotal: l.estimatedTotal ? Number(l.estimatedTotal) : undefined,
      })),
    };

    try {
      const { json: createJson } = await apiFetch('/api/purchase-requests', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!createJson.success) {
        setError(createJson.message || common.errorLoad);
        if (createJson.errors?.length) {
          setError(createJson.errors.map((x) => x.message).join(', '));
        }
        setSaving(false);
        return;
      }

      const prId = createJson.data.id;
      const { json: submitJson } = await apiFetch(`/api/purchase-requests/${prId}/submit`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (!submitJson.success) {
        setWarning(
          `${createJson.data.portalPRNumber || prId}: ${submitJson.message || common.errorLoad}`,
        );
        router.push(`/purchase-requests/${prId}`);
        setSaving(false);
        return;
      }

      if (files.length > 0) {
        const { failures } = await uploadDocumentAttachments({
          documentType: 'PR',
          documentId: prId,
          files,
        });
        if (failures.length) {
          const warn = formatAttachmentUploadWarning(failures, 'PR');
          router.push(`/purchase-requests/${prId}?attachmentWarning=${encodeURIComponent(warn)}`);
          setSaving(false);
          return;
        }
      }

      router.push(`/purchase-requests/${prId}`);
    } catch (err) {
      setError(err.message || common.errorLoad);
    }
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}
      {warning && (
        <p
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200"
          role="status"
        >
          {warning}
        </p>
      )}

      <section className="card space-y-3 p-4 sm:p-5">
        <h2 className="text-base font-bold text-foreground">{t.header}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <FormField
            label={t.requiredDate}
            required
            error={fieldErrors.requiredDate}
          >
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

        <div className={`hidden lg:grid ${LINE_GRID} lg:gap-2 lg:px-1 lg:text-[10px] lg:font-bold lg:uppercase lg:tracking-widest lg:text-muted-foreground`}>
          <span>#</span>
          <span>{t.item}</span>
          <span>{t.itemName}</span>
          <span>{t.warehouse}</span>
          <span>{t.vendor}</span>
          <span>{t.quantity}</span>
          <span>{t.unitPrice}</span>
          <span>{t.uom}</span>
          <span>{t.total}</span>
          <span className="sr-only">{t.removeLine}</span>
        </div>

        <div className="space-y-2">
          {lines.map((line, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-border bg-card p-3 text-sm shadow-sm"
            >
              <div className="mb-2 flex items-center justify-between lg:hidden">
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

              <div className={`grid gap-2 sm:grid-cols-2 ${LINE_GRID} lg:items-start lg:gap-2`}>
                <span className="hidden pt-2 text-center text-xs font-bold text-muted-foreground lg:block">
                  {idx + 1}
                </span>

                <FormField error={fieldErrors[`line${idx}.item`]} className="lg:mt-0">
                  <span className="mb-1 block text-xs text-muted-foreground lg:hidden">{t.item}</span>
                  <ItemSearchInput
                    value={line}
                    inputClassName={COMPACT_INPUT}
                    placeholder={t.searchItem}
                    searchingLabel={t.searching}
                    noResultsMessage={t.noMatchingItems}
                    canCreateNew={canCreateItem}
                    createNewLabel={t.createNewItem}
                    onCreateNew={() => {
                      setItemModalLine(idx);
                      setItemModal(true);
                    }}
                    onSelect={(item) => {
                      updateLine(idx, {
                        itemCode: item.itemCode,
                        itemName: item.itemName,
                        ugpEntry: item.ugpEntry ?? '',
                        ugpName: item.ugpName || '',
                        warehouseCode: item.warehouseCode || '',
                        warehouseLabel: item.warehouseLabel || item.warehouseCode || '',
                        estimatedUnitPrice: item.estimatedUnitPrice ?? '',
                        itemGroupName: item.itemGroupName || '',
                      });
                    }}
                  />
                </FormField>

                <FormField className="lg:mt-0">
                  <span className="mb-1 block text-xs text-muted-foreground lg:hidden">{t.itemName}</span>
                  <input
                    className={`${COMPACT_INPUT} bg-muted`}
                    readOnly
                    value={line.itemName}
                    placeholder="—"
                  />
                </FormField>

                <FormField error={fieldErrors[`line${idx}.warehouse`]} className="lg:mt-0">
                  <span className="mb-1 block text-xs text-muted-foreground lg:hidden">{t.warehouse}</span>
                  <WarehouseSelect
                    key={`wh-${idx}-${line.itemCode}`}
                    syncKey={`${line.itemCode}|${line.warehouseCode}|${line.warehouseLabel}`}
                    valueCode={line.warehouseCode}
                    valueLabel={line.warehouseLabel}
                    placeholder={t.searchWarehouse}
                    emptyMessage={t.noWarehousesFound}
                    loadingMessage={t.loading}
                    inputClassName={COMPACT_INPUT}
                    onSelect={(code, label) =>
                      updateLine(idx, { warehouseCode: code, warehouseLabel: label })
                    }
                  />
                </FormField>

                <FormField className="lg:mt-0">
                  <span className="mb-1 block text-xs text-muted-foreground lg:hidden">{t.vendor}</span>
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

                <FormField error={fieldErrors[`line${idx}.quantity`]} className="lg:mt-0">
                  <span className="mb-1 block text-xs text-muted-foreground lg:hidden">{t.quantity}</span>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    className={COMPACT_INPUT}
                    value={line.quantity}
                    onChange={(e) => updateLine(idx, { quantity: e.target.value })}
                  />
                </FormField>

                <FormField error={fieldErrors[`line${idx}.unitPrice`]} className="lg:mt-0">
                  <span className="mb-1 block text-xs text-muted-foreground lg:hidden">{t.unitPrice}</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    className={COMPACT_INPUT}
                    value={line.estimatedUnitPrice}
                    onChange={(e) => updateLine(idx, { estimatedUnitPrice: e.target.value })}
                  />
                </FormField>

                <FormField className="lg:mt-0">
                  <span className="mb-1 block text-xs text-muted-foreground lg:hidden">{t.uom}</span>
                  <UomGroupSelect
                    key={`uom-${idx}-${line.itemCode}-${line.ugpEntry}`}
                    valueEntry={line.ugpEntry}
                    valueLabel={line.ugpName}
                    placeholder={t.selectUom}
                    inputClassName={COMPACT_INPUT}
                    onSelect={(entry, row) =>
                      updateLine(idx, {
                        ugpEntry: entry,
                        ugpName: row?.label || '',
                      })
                    }
                  />
                </FormField>

                <FormField className="lg:mt-0">
                  <span className="mb-1 block text-xs text-muted-foreground lg:hidden">{t.total}</span>
                  <input className={`${COMPACT_INPUT} bg-muted`} readOnly value={line.estimatedTotal} />
                </FormField>

                <div className="hidden justify-center lg:flex lg:pt-1">
                  <button
                    type="button"
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-destructive hover:bg-destructive/10"
                    aria-label={t.removeLine}
                    onClick={() => removeLine(idx)}
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card space-y-3 p-4 sm:p-5">
        <h2 className="text-base font-bold text-foreground">{t.attachments}</h2>
        <AttachmentDropzone
          files={files}
          onFilesChange={setFiles}
          dropLabel={t.dropFiles}
          dropHint={t.dropFilesHint}
          removeFileLabel={t.removeFile}
          fileTooLargeMessage={t.fileTooLarge}
          fileTypeMessage={t.fileTypeNotAllowed}
        />
      </section>

      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? t.submitting : t.submitForApproval}
        </button>
        <Link href="/purchase-requests" className="btn-secondary">
          {t.cancel}
        </Link>
      </div>

      <CreateItemModal
        open={itemModal}
        onClose={() => setItemModal(false)}
        onCreated={(item) => updateLine(itemModalLine, item)}
      />
    </form>
  );
}
