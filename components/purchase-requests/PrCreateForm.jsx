'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/apiClient';
import { uploadAttachmentFile } from '@/lib/uploadClient';
import { useAuthStore } from '@/stores/authStore';
import ItemSearchInput from './ItemSearchInput';
import CreateItemModal from './CreateItemModal';

const EMPTY_LINE = () => ({
  itemCode: '',
  itemName: '',
  vendor: '',
  quantity: 1,
  uom: '',
  warehouseCode: '',
  projectCode: '',
  costCenter: '',
  requiredDate: '',
  estimatedUnitPrice: '',
  estimatedTotal: '',
  remarks: '',
  uDepartment: '',
  uDelDate: '',
  uRate: '',
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
    department: '',
    project: '',
    requiredDate: '',
    postingDate: '',
    documentDate: '',
    warehouse: '',
    remarks: '',
  });
  const [lines, setLines] = useState([EMPTY_LINE()]);
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [itemModal, setItemModal] = useState(false);
  const [itemModalLine, setItemModalLine] = useState(0);
  const [noResultsLine, setNoResultsLine] = useState(null);

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

    const payload = {
      ...header,
      lines: lines.map((l) => ({
        ...l,
        quantity: Number(l.quantity),
        estimatedUnitPrice: l.estimatedUnitPrice ? Number(l.estimatedUnitPrice) : undefined,
        estimatedTotal: l.estimatedTotal ? Number(l.estimatedTotal) : undefined,
        uRate: l.uRate ? Number(l.uRate) : undefined,
      })),
    };

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
      setError(submitJson.message || 'Failed to submit PR');
      setSaving(false);
      return;
    }

    try {
      for (const file of files) {
        await uploadAttachmentFile({ documentType: 'PR', documentId: prId, file });
      }
    } catch (uploadErr) {
      setError(uploadErr.message || 'Attachment upload failed');
      setSaving(false);
      return;
    }

    router.push(`/purchase-requests/${prId}`);
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Header</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['department', 'Department', true],
            ['project', 'Project', false],
            ['requiredDate', 'Required Date', true],
            ['postingDate', 'Posting Date', false],
            ['documentDate', 'Document Date', false],
            ['warehouse', 'Warehouse', false],
          ].map(([key, label, req]) => (
            <label key={key} className="block text-sm">
              <span className="text-slate-600">{label}</span>
              <input
                className="input-field mt-1"
                type={key.includes('Date') ? 'date' : 'text'}
                required={req}
                value={header[key]}
                onChange={(e) => setHeader((h) => ({ ...h, [key]: e.target.value }))}
              />
            </label>
          ))}
          <label className="block text-sm sm:col-span-2 lg:col-span-3">
            <span className="text-slate-600">Remarks</span>
            <textarea
              className="input-field mt-1"
              rows={2}
              value={header.remarks}
              onChange={(e) => setHeader((h) => ({ ...h, remarks: e.target.value }))}
            />
          </label>
        </div>
      </section>

      <section className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Line Items</h2>
          <button type="button" className="btn-secondary text-sm" onClick={addLine}>
            Add line
          </button>
        </div>
        <div className="space-y-6 overflow-x-auto">
          {lines.map((line, idx) => (
            <div key={idx} className="rounded-lg border border-slate-200 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Line {idx + 1}</span>
                <button type="button" className="text-sm text-red-600" onClick={() => removeLine(idx)}>
                  Remove
                </button>
              </div>
              <div className="grid min-w-[800px] gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="text-sm sm:col-span-2">
                  <span className="text-slate-600">Item search</span>
                  <ItemSearchInput
                    value={line}
                    onSelect={(item) => {
                      updateLine(idx, item);
                      setNoResultsLine(null);
                    }}
                  />
                  {canCreateItem && noResultsLine === idx && (
                    <button
                      type="button"
                      className="mt-1 text-sm text-brand-600 hover:underline"
                      onClick={() => {
                        setItemModalLine(idx);
                        setItemModal(true);
                      }}
                    >
                      Create New Item
                    </button>
                  )}
                </label>
                <label className="text-sm">
                  <span className="text-slate-600">Item name</span>
                  <input
                    className="input-field mt-1"
                    value={line.itemName}
                    onChange={(e) => updateLine(idx, { itemName: e.target.value })}
                  />
                </label>
                <label className="text-sm">
                  <span className="text-slate-600">Vendor</span>
                  <input
                    className="input-field mt-1"
                    value={line.vendor}
                    onChange={(e) => updateLine(idx, { vendor: e.target.value })}
                  />
                </label>
                <label className="text-sm">
                  <span className="text-slate-600">Quantity</span>
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
                  <span className="text-slate-600">UoM</span>
                  <input
                    className="input-field mt-1"
                    value={line.uom}
                    onChange={(e) => updateLine(idx, { uom: e.target.value })}
                  />
                </label>
                <label className="text-sm">
                  <span className="text-slate-600">Warehouse code</span>
                  <input
                    className="input-field mt-1"
                    value={line.warehouseCode}
                    onChange={(e) => updateLine(idx, { warehouseCode: e.target.value })}
                  />
                </label>
                <label className="text-sm">
                  <span className="text-slate-600">Project code</span>
                  <input
                    className="input-field mt-1"
                    value={line.projectCode}
                    onChange={(e) => updateLine(idx, { projectCode: e.target.value })}
                  />
                </label>
                <label className="text-sm">
                  <span className="text-slate-600">Cost center</span>
                  <input
                    className="input-field mt-1"
                    value={line.costCenter}
                    onChange={(e) => updateLine(idx, { costCenter: e.target.value })}
                  />
                </label>
                <label className="text-sm">
                  <span className="text-slate-600">Required date</span>
                  <input
                    type="date"
                    className="input-field mt-1"
                    value={line.requiredDate}
                    onChange={(e) => updateLine(idx, { requiredDate: e.target.value })}
                  />
                </label>
                <label className="text-sm">
                  <span className="text-slate-600">Unit price</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    className="input-field mt-1"
                    value={line.estimatedUnitPrice}
                    onChange={(e) => updateLine(idx, { estimatedUnitPrice: e.target.value })}
                  />
                </label>
                <label className="text-sm">
                  <span className="text-slate-600">Total</span>
                  <input
                    className="input-field mt-1 bg-slate-50"
                    readOnly
                    value={line.estimatedTotal}
                  />
                </label>
                <label className="text-sm sm:col-span-2">
                  <span className="text-slate-600">Remarks</span>
                  <input
                    className="input-field mt-1"
                    value={line.remarks}
                    onChange={(e) => updateLine(idx, { remarks: e.target.value })}
                  />
                </label>
                <label className="text-sm">
                  <span className="text-slate-600">U Department</span>
                  <input
                    className="input-field mt-1"
                    value={line.uDepartment}
                    onChange={(e) => updateLine(idx, { uDepartment: e.target.value })}
                  />
                </label>
                <label className="text-sm">
                  <span className="text-slate-600">U Del Date</span>
                  <input
                    type="date"
                    className="input-field mt-1"
                    value={line.uDelDate}
                    onChange={(e) => updateLine(idx, { uDelDate: e.target.value })}
                  />
                </label>
                <label className="text-sm">
                  <span className="text-slate-600">U Rate</span>
                  <input
                    type="number"
                    className="input-field mt-1"
                    value={line.uRate}
                    onChange={(e) => updateLine(idx, { uRate: e.target.value })}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Attachments</h2>
        <input
          type="file"
          multiple
          className="text-sm"
          onChange={(e) => setFiles(Array.from(e.target.files || []))}
        />
        {files.length > 0 && (
          <ul className="text-sm text-slate-600">
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
