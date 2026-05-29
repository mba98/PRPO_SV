'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/apiClient';
import {
  PR_APPROVAL_PERMISSIONS,
  PO_APPROVAL_PERMISSIONS,
  PERMISSION_LABELS,
} from '@/lib/permissions';
import { AnimatedModal, AnimatedSkeletonLoader, AnimatedStatusBadge } from '@/components/ui';
import SettingsTable from './SettingsTable';

const EMPTY = {
  documentType: 'PR',
  stepOrder: 1,
  stepName: '',
  requiredPermission: 'pr.approve.whs',
  approverRole: '',
  isActive: true,
};

export default function ApprovalMatrixManager() {
  const [steps, setSteps] = useState([]);
  const [roles, setRoles] = useState([]);
  const [filterType, setFilterType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const permissionOptions = useMemo(() => {
    if (form.documentType === 'PO') return PO_APPROVAL_PERMISSIONS;
    return PR_APPROVAL_PERMISSIONS;
  }, [form.documentType]);

  const loadRoles = useCallback(async () => {
    const { json } = await apiFetch('/api/roles/picklist');
    if (json.success) setRoles(json.data);
  }, []);

  const loadSteps = useCallback(async () => {
    setLoading(true);
    setError('');
    const qs = filterType ? `?documentType=${filterType}&limit=100` : '?limit=100';
    const { json, status } = await apiFetch(`/api/approval-matrix${qs}`);
    if (json.success) {
      const sorted = [...json.data].sort((a, b) => {
        if (a.documentType !== b.documentType) return a.documentType.localeCompare(b.documentType);
        return a.stepOrder - b.stepOrder;
      });
      setSteps(sorted);
    } else if (status === 403) {
      setError('You do not have permission to manage the approval matrix.');
    } else {
      setError(json.message || 'Failed to load approval matrix');
    }
    setLoading(false);
  }, [filterType]);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  useEffect(() => {
    loadSteps();
  }, [loadSteps]);

  function openCreate() {
    const docType = filterType || 'PR';
    setEditing(null);
    setForm({
      ...EMPTY,
      documentType: docType,
      requiredPermission: docType === 'PO' ? 'po.approve.pm' : 'pr.approve.whs',
    });
    setModalOpen(true);
  }

  function openEdit(step) {
    setEditing(step);
    setForm({
      documentType: step.documentType,
      stepOrder: step.stepOrder,
      stepName: step.stepName,
      requiredPermission: step.requiredPermission,
      approverRole: step.approverRole?.id || '',
      isActive: step.isActive,
    });
    setModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const payload = {
      documentType: form.documentType,
      stepOrder: Number(form.stepOrder),
      stepName: form.stepName,
      requiredPermission: form.requiredPermission,
      approverRole: form.approverRole,
      isActive: form.isActive,
    };

    let result;
    if (editing) {
      payload.__v = editing.__v;
      result = await apiFetch(`/api/approval-matrix/${editing.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } else {
      result = await apiFetch('/api/approval-matrix', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }

    if (result.json.success) {
      setModalOpen(false);
      await loadSteps();
    } else {
      setError(result.json.message || 'Save failed');
    }
    setSaving(false);
  }

  const columns = [
    { key: 'documentType', label: 'Type' },
    {
      key: 'stepOrder',
      label: 'Order',
      render: (s) => <span className="font-mono text-sm">{s.stepOrder}</span>,
    },
    { key: 'stepName', label: 'Step name' },
    {
      key: 'requiredPermission',
      label: 'Required permission',
      render: (s) => (
        <span className="text-xs">
          <span className="font-mono">{s.requiredPermission}</span>
          {PERMISSION_LABELS[s.requiredPermission] && (
            <span className="block text-muted-foreground">{PERMISSION_LABELS[s.requiredPermission]}</span>
          )}
        </span>
      ),
    },
    {
      key: 'approverRole',
      label: 'Approver role',
      render: (s) => s.approverRole?.name || '—',
    },
    {
      key: 'isActive',
      label: 'Active',
      render: (s) => (
        <AnimatedStatusBadge status={s.isActive ? 'Approved' : 'Draft'} />
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (s) => (
        <button
          type="button"
          onClick={() => openEdit(s)}
          className="text-sm font-medium text-primary hover:underline"
        >
          Edit
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Configure approval steps per document type. Workflow reads these rows from the approval matrix
        — do not hardcode steps elsewhere. Use step order 1, 2, 3… to define sequence.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Document type</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="h-9 rounded-md border border-border px-2 text-sm"
          >
            <option value="">All (PR + PO)</option>
            <option value="PR">Purchase Requests (PR)</option>
            <option value="PO">Purchase Orders (PO)</option>
          </select>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="btn-primary"
        >
          Add step
        </button>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <AnimatedSkeletonLoader variant="table" rows={6} />
      ) : (
        <SettingsTable
          columns={columns}
          rows={steps.map((s) => ({ key: s.id, data: s }))}
          emptyMessage="No approval steps configured."
        />
      )}

      <AnimatedModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit approval step' : 'Add approval step'}
        size="lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Document type</label>
              <select
                value={form.documentType}
                onChange={(e) => {
                  const docType = e.target.value;
                  setForm({
                    ...form,
                    documentType: docType,
                    requiredPermission: docType === 'PO' ? 'po.approve.pm' : 'pr.approve.whs',
                  });
                }}
                className="input-field"
              >
                <option value="PR">PR — Purchase Request</option>
                <option value="PO">PO — Purchase Order</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Step order</label>
              <input
                type="number"
                min={1}
                required
                value={form.stepOrder}
                onChange={(e) => setForm({ ...form, stepOrder: e.target.value })}
                className="input-field"
              />
              <p className="mt-1 text-xs text-muted-foreground">1 = first approval, 2 = second, etc.</p>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-foreground">Step name</label>
              <input
                required
                value={form.stepName}
                onChange={(e) => setForm({ ...form, stepName: e.target.value })}
                placeholder="e.g. Warehouse approval"
                className="input-field"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Required permission
              </label>
              <select
                value={form.requiredPermission}
                onChange={(e) => setForm({ ...form, requiredPermission: e.target.value })}
                className="input-field"
              >
                {permissionOptions.map((p) => (
                  <option key={p} value={p}>
                    {p} — {PERMISSION_LABELS[p] || p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Approver role</label>
              <select
                required
                value={form.approverRole}
                onChange={(e) => setForm({ ...form, approverRole: e.target.value })}
                className="input-field"
              >
                <option value="">Select role</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Active
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-md border border-border px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </AnimatedModal>
    </div>
  );
}
