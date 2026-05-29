'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/apiClient';
import {
  uploadDocumentAttachments,
  formatAttachmentUploadWarning,
} from '@/lib/attachmentUploadHelpers';
import { ALLOWED_MIME_TYPES_CLIENT, MAX_FILE_SIZE_BYTES } from '@/lib/attachmentClientConstants';
import { useAuthStore } from '@/stores/authStore';
import ItemSearchInput from '@/components/lookups/ItemSearchInput';
import VendorSelect from '@/components/lookups/VendorSelect';
import WarehouseSelect from '@/components/lookups/WarehouseSelect';
import CreateItemModal from './CreateItemModal';

const DEFAULT_WAREHOUSE_CODE = 'RAN004';

const EMPTY_LINE = () => ({
  itemCode: '',
  itemName: '',
  itemGroupName: '',
  uom: '',
  uomCode: '',
  vendor: '',
  vendorLabel: '',
  warehouseCode: DEFAULT_WAREHOUSE_CODE,
  warehouseLabel: DEFAULT_WAREHOUSE_CODE,
  quantity: 1,
  estimatedUnitPrice: '',
  estimatedTotal: '',
  remarks: '',
});

function recalcTotal(line) {
  const q = parseFloat(line.quantity) || 0;
  const p = parseFloat(line.estimatedUnitPrice) || 0;
  return q && p ? String(q * p) : line.estimatedTotal;
}

export default function PrCreateForm() {
  const router = useRouter();
  const canCreateItem = useAuthStore((s) => s.hasPermission('items.create'));

  const [header, setHeader] = useState({
    requiredDate: '',
    documentDate: '',
    dueDate: '',
    remarks: '',
  });
  const [lines, setLines] = useState([EMPTY_LINE()]);
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [itemModal, setItemModal] = useState(false);
  const [itemModalLine, setItemModalLine] = useState(0);
  const [noResultsLine, setNoResultsLine] = useState(null);

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
  }

  function addLine() {
    setLines((prev) => [...prev, EMPTY_LINE()]);
  }

  function removeLine(idx) {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setWarning('');

    const documentDate = header.documentDate || header.requiredDate;
    const dueDate = header.dueDate || header.requiredDate;

    const payload = {
      requiredDate: header.requiredDate,
      documentDate: documentDate || undefined,
      dueDate: dueDate || undefined,
      remarks: header.remarks || undefined,
      lines: lines.map((l) => ({
        itemCode: l.itemCode,
        itemName: l.itemName || undefined,
        uom: l.uom || undefined,
        uomCode: l.uomCode?.trim() || l.uom?.trim() || undefined,
        vendor: l.vendor || undefined,
        warehouseCode: l.warehouseCode || undefined,
        quantity: Number(l.quantity),
        estimatedUnitPrice: l.estimatedUnitPrice ? Number(l.estimatedUnitPrice) : undefined,
        estimatedTotal: l.estimatedTotal ? Number(l.estimatedTotal) : undefined,
        remarks: l.remarks || undefined,
      })),
    };

    try {
      const { json: createJson } = await apiFetch('/api/purchase-requests', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!createJson.success) {
        setError(createJson.message || 'Failed to create PR');
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
          `PR ${createJson.data.portalPRNumber || prId} was created but could not be submitted: ${submitJson.message || 'Submit failed'}. Open the PR to retry.`,
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
      setError(err.message || 'Failed to save purchase request');
    }
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {warning && (
        <p className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800" role="status">
          {warning}
        </p>
      )}

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Header</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-muted-foreground">Required date *</span>
            <input
              className="input-field mt-1"
              type="date"
              required
              value={header.requiredDate}
              onChange={(e) => updateHeader({ requiredDate: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">Document date</span>
            <input
              className="input-field mt-1"
              type="date"
              value={header.documentDate}
              onChange={(e) => updateHeader({ documentDate: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">Due date</span>
            <input
              className="input-field mt-1"
              type="date"
              value={header.dueDate}
              onChange={(e) => updateHeader({ dueDate: e.target.value })}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-muted-foreground">Remarks</span>
            <textarea
              className="input-field mt-1"
              rows={2}
              value={header.remarks}
              onChange={(e) => updateHeader({ remarks: e.target.value })}
            />
          </label>
        </div>
      </section>

      <section className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Line items</h2>
          <button type="button" className="btn-secondary text-sm" onClick={addLine}>
            Add line
          </button>
        </div>
        <div className="space-y-6 overflow-x-auto">
          {lines.map((line, idx) => (
            <div key={idx} className="rounded-lg border border-border p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Line {idx + 1}</span>
                <button type="button" className="text-sm text-red-600" onClick={() => removeLine(idx)}>
                  Remove
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className="text-sm sm:col-span-2">
                  <span className="text-muted-foreground">Item *</span>
                  <ItemSearchInput
                    value={line}
                    onSelect={(item) => {
                      updateLine(idx, item);
                      setNoResultsLine(null);
                    }}
                    onSearchError={(failed) => setNoResultsLine(failed ? idx : null)}
                  />
                  {canCreateItem && noResultsLine === idx && (
                    <button
                      type="button"
                      className="mt-1 text-sm text-primary hover:underline"
                      onClick={() => {
                        setItemModalLine(idx);
                        setItemModal(true);
                      }}
                    >
                      Create new item
                    </button>
                  )}
                </label>
                <label className="text-sm">
                  <span className="text-muted-foreground">Item name</span>
                  <input
                    className="input-field mt-1 bg-muted"
                    readOnly
                    value={line.itemName}
                    placeholder="From SAP item"
                  />
                </label>
                <label className="text-sm">
                  <span className="text-muted-foreground">Warehouse *</span>
                  <WarehouseSelect
                    valueCode={line.warehouseCode}
                    valueLabel={line.warehouseLabel}
                    onSelect={(code, label) =>
                      updateLine(idx, { warehouseCode: code, warehouseLabel: label })
                    }
                  />
                </label>
                <label className="text-sm">
                  <span className="text-muted-foreground">Vendor</span>
                  <VendorSelect
                    valueCode={line.vendor}
                    valueLabel={line.vendorLabel}
                    onSelect={(code, label) => updateLine(idx, { vendor: code, vendorLabel: label })}
                  />
                </label>
                <label className="text-sm">
                  <span className="text-muted-foreground">UoM code</span>
                  <input
                    className="input-field mt-1"
                    value={line.uomCode}
                    placeholder={line.uom || 'From SAP item'}
                    onChange={(e) => updateLine(idx, { uomCode: e.target.value })}
                  />
                </label>
                <label className="text-sm">
                  <span className="text-muted-foreground">Quantity *</span>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    className="input-field mt-1"
                    required
                    value={line.quantity}
                    onChange={(e) => updateLine(idx, { quantity: e.target.value })}
                  />
                </label>
                <label className="text-sm">
                  <span className="text-muted-foreground">Unit price *</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    className="input-field mt-1"
                    required
                    value={line.estimatedUnitPrice}
                    onChange={(e) => updateLine(idx, { estimatedUnitPrice: e.target.value })}
                  />
                </label>
                <label className="text-sm">
                  <span className="text-muted-foreground">Total</span>
                  <input className="input-field mt-1 bg-muted" readOnly value={line.estimatedTotal} />
                </label>
                <label className="text-sm sm:col-span-2 lg:col-span-3">
                  <span className="text-muted-foreground">Remarks</span>
                  <input
                    className="input-field mt-1"
                    value={line.remarks}
                    onChange={(e) => updateLine(idx, { remarks: e.target.value })}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Attachments</h2>
        <input
          type="file"
          multiple
          accept={ALLOWED_MIME_TYPES_CLIENT.join(',')}
          className="text-sm"
          onChange={(e) => setFiles(Array.from(e.target.files || []))}
        />
        <p className="text-xs text-muted-foreground">PDF, images, Office files — max 25 MB each</p>
        {files.length > 0 && (
          <ul className="text-sm text-muted-foreground">
            {files.map((f) => (
              <li key={f.name}>{f.name}</li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex gap-3">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Submitting…' : 'Submit for approval'}
        </button>
        <Link href="/purchase-requests" className="btn-secondary">
          Cancel
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
