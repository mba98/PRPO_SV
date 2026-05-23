'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/apiClient';

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
  const [header, setHeader] = useState({
    vendor: po.vendor || '',
    postingDate: toDateInput(po.postingDate),
    documentDate: toDateInput(po.documentDate),
    requiredDate: toDateInput(po.requiredDate),
    dueDate: toDateInput(po.dueDate),
    docRate: po.docRate != null ? String(po.docRate) : '',
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
      uomCode: line.uomCode || line.uom || '',
      remarks: line.remarks || '',
    })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
    <form onSubmit={handleSubmit} className="card space-y-6">
      <h2 className="text-lg font-semibold text-slate-900">Edit purchase order</h2>
      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm">
          <span className="text-slate-600">Vendor (CardCode) *</span>
          <input
            className="input-field mt-1"
            required
            value={header.vendor}
            onChange={(e) => setHeader((h) => ({ ...h, vendor: e.target.value }))}
          />
        </label>
        <label className="text-sm">
          <span className="text-slate-600">Exchange rate (DocRate)</span>
          <input
            type="number"
            min="0"
            step="any"
            className="input-field mt-1"
            placeholder="Optional"
            value={header.docRate}
            onChange={(e) => setHeader((h) => ({ ...h, docRate: e.target.value }))}
          />
        </label>
        <label className="text-sm">
          <span className="text-slate-600">Posting date</span>
          <input
            type="date"
            className="input-field mt-1"
            value={header.postingDate}
            onChange={(e) => setHeader((h) => ({ ...h, postingDate: e.target.value }))}
          />
        </label>
        <label className="text-sm">
          <span className="text-slate-600">Document date</span>
          <input
            type="date"
            className="input-field mt-1"
            value={header.documentDate}
            onChange={(e) => setHeader((h) => ({ ...h, documentDate: e.target.value }))}
          />
        </label>
        <label className="text-sm">
          <span className="text-slate-600">Required date</span>
          <input
            type="date"
            className="input-field mt-1"
            value={header.requiredDate}
            onChange={(e) => setHeader((h) => ({ ...h, requiredDate: e.target.value }))}
          />
        </label>
        <label className="text-sm">
          <span className="text-slate-600">Due date</span>
          <input
            type="date"
            className="input-field mt-1"
            value={header.dueDate}
            onChange={(e) => setHeader((h) => ({ ...h, dueDate: e.target.value }))}
          />
        </label>
        <label className="text-sm sm:col-span-2 lg:col-span-3">
          <span className="text-slate-600">Remarks</span>
          <textarea
            className="input-field mt-1"
            rows={2}
            value={header.remarks}
            onChange={(e) => setHeader((h) => ({ ...h, remarks: e.target.value }))}
          />
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="pb-2 pr-3">Item</th>
              <th className="pb-2 pr-3">Qty</th>
              <th className="pb-2 pr-3">Unit price</th>
              <th className="pb-2 pr-3">UoM code</th>
              <th className="pb-2 pr-3">Warehouse</th>
              <th className="pb-2 pr-3">Total</th>
              <th className="pb-2">Remarks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.map((line, idx) => (
              <tr key={line._id || idx}>
                <td className="py-2 pr-3">
                  <input
                    className="input-field mb-1"
                    value={line.itemCode}
                    required
                    onChange={(e) => updateLine(idx, { itemCode: e.target.value })}
                  />
                  <input
                    className="input-field text-xs"
                    value={line.itemName}
                    placeholder="Item name"
                    onChange={(e) => updateLine(idx, { itemName: e.target.value })}
                  />
                </td>
                <td className="py-2 pr-3">
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    className="input-field"
                    required
                    value={line.quantity}
                    onChange={(e) => updateLine(idx, { quantity: e.target.value })}
                  />
                </td>
                <td className="py-2 pr-3">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    className="input-field"
                    required
                    value={line.unitPrice}
                    onChange={(e) => updateLine(idx, { unitPrice: e.target.value })}
                  />
                </td>
                <td className="py-2 pr-3">
                  <input
                    className="input-field"
                    value={line.uomCode}
                    onChange={(e) => updateLine(idx, { uomCode: e.target.value })}
                  />
                </td>
                <td className="py-2 pr-3">
                  <input
                    className="input-field"
                    value={line.warehouseCode}
                    onChange={(e) => updateLine(idx, { warehouseCode: e.target.value })}
                  />
                </td>
                <td className="py-2 pr-3">{line.lineTotal || '—'}</td>
                <td className="py-2">
                  <input
                    className="input-field"
                    value={line.remarks}
                    onChange={(e) => updateLine(idx, { remarks: e.target.value })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        {onCancel && (
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
