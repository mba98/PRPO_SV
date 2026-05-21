'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/apiClient';
import { uploadAttachmentFile } from '@/lib/uploadClient';
import { useAuthStore } from '@/stores/authStore';
import ItemSearchInput from '@/components/lookups/ItemSearchInput';
import VendorSelect from '@/components/lookups/VendorSelect';
import WarehouseSelect from '@/components/lookups/WarehouseSelect';
import ProjectSelect from '@/components/lookups/ProjectSelect';
import CostCenterSelect from '@/components/lookups/CostCenterSelect';
import DepartmentSelect from '@/components/lookups/DepartmentSelect';
import CreateItemModal from './CreateItemModal';

const EMPTY_LINE = () => ({
  itemCode: '',
  itemName: '',
  itemGroupName: '',
  vendor: '',
  vendorLabel: '',
  quantity: 1,
  uom: '',
  warehouseCode: '',
  warehouseLabel: '',
  projectCode: '',
  projectLabel: '',
  costCenter: '',
  costCenterLabel: '',
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
  const user = useAuthStore((s) => s.user);
  const canCreateItem = useAuthStore((s) => s.hasPermission('items.create'));
  const departmentLocked = Boolean(user?.department);

  const [header, setHeader] = useState({
    department: '',
    project: '',
    projectLabel: '',
    requiredDate: '',
    postingDate: '',
    documentDate: '',
    warehouse: '',
    warehouseLabel: '',
    remarks: '',
  });
  const [lines, setLines] = useState([EMPTY_LINE()]);
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [itemModal, setItemModal] = useState(false);
  const [itemModalLine, setItemModalLine] = useState(0);
  const [noResultsLine, setNoResultsLine] = useState(null);

  useEffect(() => {
    if (user?.department) {
      setHeader((h) => ({ ...h, department: user.department }));
    }
  }, [user?.department]);

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

  function applyHeaderDefaults(key, code, label) {
    setHeader((h) => ({ ...h, [key]: code, [`${key}Label`]: label }));
    if (key === 'warehouse') {
      setLines((prev) =>
        prev.map((l) =>
          !l.warehouseCode ? { ...l, warehouseCode: code, warehouseLabel: label } : l,
        ),
      );
    }
    if (key === 'project') {
      setLines((prev) =>
        prev.map((l) =>
          !l.projectCode ? { ...l, projectCode: code, projectLabel: label } : l,
        ),
      );
    }
  }

  function addLine() {
    const base = EMPTY_LINE();
    if (header.warehouse) {
      base.warehouseCode = header.warehouse;
      base.warehouseLabel = header.warehouseLabel;
    }
    if (header.project) {
      base.projectCode = header.project;
      base.projectLabel = header.projectLabel;
    }
    if (header.department) {
      base.uDepartment = header.department;
    }
    setLines((prev) => [...prev, base]);
  }

  function removeLine(idx) {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const payload = {
      department: header.department,
      project: header.project || undefined,
      requiredDate: header.requiredDate,
      postingDate: header.postingDate || undefined,
      documentDate: header.documentDate || undefined,
      warehouse: header.warehouse || undefined,
      remarks: header.remarks || undefined,
      lines: lines.map((l) => ({
        itemCode: l.itemCode,
        itemName: l.itemName,
        vendor: l.vendor || undefined,
        quantity: Number(l.quantity),
        uom: l.uom || undefined,
        warehouseCode: l.warehouseCode || undefined,
        projectCode: l.projectCode || undefined,
        costCenter: l.costCenter || undefined,
        requiredDate: l.requiredDate || undefined,
        estimatedUnitPrice: l.estimatedUnitPrice ? Number(l.estimatedUnitPrice) : undefined,
        estimatedTotal: l.estimatedTotal ? Number(l.estimatedTotal) : undefined,
        remarks: l.remarks || undefined,
        uDepartment: l.uDepartment || undefined,
        uDelDate: l.uDelDate || undefined,
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
          <label className="block text-sm">
            <span className="text-slate-600">Department *</span>
            <DepartmentSelect
              value={header.department}
              onChange={(v) => setHeader((h) => ({ ...h, department: v }))}
              locked={departmentLocked}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Project</span>
            <ProjectSelect
              valueCode={header.project}
              valueLabel={header.projectLabel}
              onSelect={(code, label) => applyHeaderDefaults('project', code, label)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Required date *</span>
            <input
              className="input-field mt-1"
              type="date"
              required
              value={header.requiredDate}
              onChange={(e) => setHeader((h) => ({ ...h, requiredDate: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Posting date</span>
            <input
              className="input-field mt-1"
              type="date"
              value={header.postingDate}
              onChange={(e) => setHeader((h) => ({ ...h, postingDate: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Document date</span>
            <input
              className="input-field mt-1"
              type="date"
              value={header.documentDate}
              onChange={(e) => setHeader((h) => ({ ...h, documentDate: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Warehouse</span>
            <WarehouseSelect
              valueCode={header.warehouse}
              valueLabel={header.warehouseLabel}
              onSelect={(code, label) => applyHeaderDefaults('warehouse', code, label)}
            />
          </label>
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
          <h2 className="text-lg font-semibold text-slate-900">Line items</h2>
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
              <div className="grid min-w-[900px] gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="text-sm sm:col-span-2">
                  <span className="text-slate-600">Item *</span>
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
                      className="mt-1 text-sm text-brand-600 hover:underline"
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
                  <span className="text-slate-600">Item name</span>
                  <input
                    className="input-field mt-1 bg-slate-50"
                    readOnly
                    value={line.itemName}
                    placeholder="From SAP item"
                  />
                </label>
                <label className="text-sm">
                  <span className="text-slate-600">Item group</span>
                  <input
                    className="input-field mt-1 bg-slate-50"
                    readOnly
                    value={line.itemGroupName}
                    placeholder="From SAP item"
                  />
                </label>
                <label className="text-sm">
                  <span className="text-slate-600">Vendor</span>
                  <VendorSelect
                    valueCode={line.vendor}
                    valueLabel={line.vendorLabel}
                    onSelect={(code, label) => updateLine(idx, { vendor: code, vendorLabel: label })}
                  />
                </label>
                <label className="text-sm">
                  <span className="text-slate-600">Quantity *</span>
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
                    className="input-field mt-1 bg-slate-50"
                    readOnly={Boolean(line.itemCode)}
                    value={line.uom}
                    placeholder={line.itemCode ? '' : 'Select an item'}
                    onChange={(e) => updateLine(idx, { uom: e.target.value })}
                  />
                </label>
                <label className="text-sm">
                  <span className="text-slate-600">Warehouse</span>
                  <WarehouseSelect
                    valueCode={line.warehouseCode}
                    valueLabel={line.warehouseLabel}
                    onSelect={(code, label) =>
                      updateLine(idx, { warehouseCode: code, warehouseLabel: label })
                    }
                  />
                </label>
                <label className="text-sm">
                  <span className="text-slate-600">Project</span>
                  <ProjectSelect
                    valueCode={line.projectCode}
                    valueLabel={line.projectLabel}
                    onSelect={(code, label) =>
                      updateLine(idx, { projectCode: code, projectLabel: label })
                    }
                  />
                </label>
                <label className="text-sm">
                  <span className="text-slate-600">Cost center</span>
                  <CostCenterSelect
                    valueCode={line.costCenter}
                    valueLabel={line.costCenterLabel}
                    onSelect={(code, label) =>
                      updateLine(idx, { costCenter: code, costCenterLabel: label })
                    }
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
                  <input className="input-field mt-1 bg-slate-50" readOnly value={line.estimatedTotal} />
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
                  <DepartmentSelect
                    value={line.uDepartment || header.department}
                    onChange={(v) => updateLine(idx, { uDepartment: v })}
                    locked={departmentLocked}
                  />
                </label>
                <label className="text-sm">
                  <span className="text-slate-600">U Del date</span>
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
