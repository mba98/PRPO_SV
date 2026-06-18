'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/apiClient';
import { AnimatedModal, AnimatedSkeletonLoader, AnimatedStatusBadge } from '@/components/ui';
import SettingsTable from './SettingsTable';

const EMPTY = {
  documentType: 'PR',
  stepName: '',
  pendingStatus: '',
  requiredPermission: '',
  approverRole: '',
  completionPolicy: 'ANY_ONE',
  isActive: true,
};

export default function ApprovalMatrixManager() {
  const [steps, setSteps] = useState([]);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [roles, setRoles] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [filterType, setFilterType] = useState('');
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [modalError, setModalError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [newDocType, setNewDocType] = useState({ code: '', label: '' });

  const loadMeta = useCallback(async () => {
    const [rolesRes, permsRes, typesRes] = await Promise.all([
      apiFetch('/api/roles/picklist'),
      apiFetch('/api/permissions'),
      apiFetch('/api/document-types'),
    ]);
    if (rolesRes.json.success) setRoles(rolesRes.json.data);
    if (permsRes.json.success) setPermissions(permsRes.json.data);
    if (typesRes.json.success) setDocumentTypes(typesRes.json.data);
  }, []);

  const loadSteps = useCallback(async () => {
    setLoading(true);
    setPageError('');
    const qs = filterType ? `?documentType=${filterType}&limit=200` : '?limit=200';
    const { json, status } = await apiFetch(`/api/approval-matrix${qs}`);
    if (json.success) {
      const sorted = [...json.data].sort((a, b) => {
        if (a.documentType !== b.documentType) return a.documentType.localeCompare(b.documentType);
        return a.stepOrder - b.stepOrder;
      });
      setSteps(sorted);
    } else if (status === 403) {
      setPageError('You do not have permission to manage the approval matrix.');
    } else {
      setPageError(json.message || 'Failed to load approval matrix');
    }
    setLoading(false);
  }, [filterType]);

  const loadAudit = useCallback(async () => {
    const qs = filterType ? `?documentType=${filterType}&limit=30` : '?limit=30';
    const { json } = await apiFetch(`/api/approval-matrix/audit${qs}`);
    if (json.success) setAuditLog(json.data);
  }, [filterType]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    loadSteps();
    loadAudit();
  }, [loadSteps, loadAudit]);

  const previewSteps = useMemo(() => {
    const docType = filterType || form.documentType;
    return steps
      .filter((s) => s.documentType === docType && s.isActive)
      .sort((a, b) => a.stepOrder - b.stepOrder);
  }, [steps, filterType, form.documentType]);

  function mapApiErrors(errors = []) {
    const next = {};
    for (const e of errors) {
      const key = e.path && e.path !== 'body' ? e.path : '_form';
      next[key] = e.message;
    }
    return next;
  }

  function openCreate() {
    const docType = filterType || documentTypes[0]?.code || 'PR';
    setEditing(null);
    setForm({
      ...EMPTY,
      documentType: docType,
      requiredPermission: permissions[0]?.key || '',
    });
    setModalError('');
    setFieldErrors({});
    setModalOpen(true);
  }

  function openEdit(step) {
    setEditing(step);
    setForm({
      documentType: step.documentType,
      stepName: step.stepName,
      pendingStatus: step.pendingStatus || '',
      requiredPermission: step.requiredPermission,
      approverRole: step.approverRole?.id || '',
      completionPolicy: step.completionPolicy || 'ANY_ONE',
      isActive: step.isActive,
    });
    setModalError('');
    setFieldErrors({});
    setModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setModalError('');
    setFieldErrors({});

    const payload = {
      documentType: form.documentType,
      stepName: form.stepName,
      pendingStatus: form.pendingStatus || undefined,
      requiredPermission: form.requiredPermission,
      approverRole: form.approverRole,
      completionPolicy: form.completionPolicy || 'ANY_ONE',
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
      await loadAudit();
    } else {
      setModalError(result.json.message || 'Save failed');
      if (result.json.errors?.length) {
        setFieldErrors(mapApiErrors(result.json.errors));
      }
    }
    setSaving(false);
  }

  async function handleDelete(step) {
    if (!confirm(`Delete step "${step.stepName}"?`)) return;
    const { json } = await apiFetch(`/api/approval-matrix/${step.id}`, { method: 'DELETE' });
    if (json.success) {
      await loadSteps();
      await loadAudit();
    } else {
      setPageError(json.message || 'Delete failed');
    }
  }

  async function handleReorder(step, direction) {
    const { json } = await apiFetch(`/api/approval-matrix/${step.id}/reorder`, {
      method: 'POST',
      body: JSON.stringify({ direction }),
    });
    if (json.success) {
      await loadSteps();
      await loadAudit();
    } else {
      setPageError(json.message || 'Reorder failed');
    }
  }

  async function handleAddDocumentType(e) {
    e.preventDefault();
    if (!newDocType.code.trim()) return;
    const { json } = await apiFetch('/api/document-types', {
      method: 'POST',
      body: JSON.stringify({
        code: newDocType.code,
        label: newDocType.label || newDocType.code,
      }),
    });
    if (json.success) {
      setNewDocType({ code: '', label: '' });
      await loadMeta();
    } else {
      setPageError(json.message || 'Failed to add document type');
    }
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
      label: 'Permission',
      render: (s) => <span className="font-mono text-xs">{s.requiredPermission}</span>,
    },
    {
      key: 'approverRole',
      label: 'Role',
      render: (s) => s.approverRole?.name || '—',
    },
    {
      key: 'completionPolicy',
      label: 'Completion policy',
      render: (s) => (s.completionPolicy === 'ANY_ONE' ? 'Any one approver' : s.completionPolicy || 'Any one approver'),
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
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => handleReorder(s, 'up')} className="text-xs text-primary hover:underline">
            ↑
          </button>
          <button type="button" onClick={() => handleReorder(s, 'down')} className="text-xs text-primary hover:underline">
            ↓
          </button>
          <button type="button" onClick={() => openEdit(s)} className="text-xs font-medium text-primary hover:underline">
            Edit
          </button>
          <button type="button" onClick={() => handleDelete(s)} className="text-xs font-medium text-destructive hover:underline">
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Configure approval chains per document type. Inactive steps are skipped. Step order is
        renumbered automatically after add, delete, or reorder.
      </p>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">Document type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="h-9 rounded-md border border-border px-2 text-sm"
            >
              <option value="">All types</option>
              {documentTypes.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.code} — {t.label}
                </option>
              ))}
            </select>
          </div>
          <button type="button" onClick={() => setPreviewOpen(true)} className="btn-secondary">
            Workflow preview
          </button>
        </div>
        <button type="button" onClick={openCreate} className="btn-primary">
          Add step
        </button>
      </div>

      <form onSubmit={handleAddDocumentType} className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-muted/30 p-3">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">New document type code</label>
          <input
            className="input-field h-9"
            value={newDocType.code}
            onChange={(e) => setNewDocType((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
            placeholder="CONTRACT"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Label</label>
          <input
            className="input-field h-9"
            value={newDocType.label}
            onChange={(e) => setNewDocType((p) => ({ ...p, label: e.target.value }))}
            placeholder="Contract Request"
          />
        </div>
        <button type="submit" className="btn-secondary h-9">
          Add type
        </button>
      </form>

      {pageError && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {pageError}
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

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Audit trail</h3>
        <div className="max-h-48 overflow-y-auto rounded-xl border border-border text-xs">
          {auditLog.length === 0 ? (
            <p className="p-3 text-muted-foreground">No changes recorded yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {auditLog.map((row) => (
                <li key={row.id} className="px-3 py-2">
                  <span className="font-medium">{row.summary || row.action}</span>
                  <span className="text-muted-foreground">
                    {' '}
                    — {row.performedByName || 'System'} · {new Date(row.createdAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <AnimatedModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit approval step' : 'Add approval step'}
        size="lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          {modalError && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {modalError}
            </p>
          )}
          {fieldErrors._form && (
            <p className="text-sm text-destructive">{fieldErrors._form}</p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Document type</label>
              <select
                value={form.documentType}
                onChange={(e) => setForm({ ...form, documentType: e.target.value })}
                className="input-field"
              >
                {documentTypes.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.code} — {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium">Step name</label>
              <input
                required
                value={form.stepName}
                onChange={(e) => setForm({ ...form, stepName: e.target.value })}
                className="input-field"
              />
              {fieldErrors.stepName && <p className="mt-1 text-xs text-destructive">{fieldErrors.stepName}</p>}
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium">Pending status (optional)</label>
              <input
                value={form.pendingStatus}
                onChange={(e) => setForm({ ...form, pendingStatus: e.target.value })}
                placeholder={
                  form.documentType === 'PO'
                    ? 'Auto: pending_pm / pending_om / pending_finance'
                    : 'e.g. Pending Warehouse Approval'
                }
                className="input-field"
                disabled={form.documentType === 'PO'}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {form.documentType === 'PO'
                  ? 'PO steps use stable status keys from the required permission (not display labels).'
                  : 'Used as document status while awaiting this step.'}
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Required permission</label>
              <select
                required
                value={form.requiredPermission}
                onChange={(e) => setForm({ ...form, requiredPermission: e.target.value })}
                className="input-field"
              >
                <option value="">Select permission</option>
                {permissions.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.key} — {p.label}
                  </option>
                ))}
              </select>
              {fieldErrors.requiredPermission && (
                <p className="mt-1 text-xs text-destructive">{fieldErrors.requiredPermission}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Approver role</label>
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
            <div>
              <label className="mb-1 block text-sm font-medium">Completion policy</label>
              <select
                value={form.completionPolicy || 'ANY_ONE'}
                onChange={(e) => setForm({ ...form, completionPolicy: e.target.value })}
                className="input-field"
              >
                <option value="ANY_ONE">Any one approver</option>
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                Any authorized user with the required permission and role may complete this step.
              </p>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Active (inactive steps are skipped in workflow)
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-md border border-border px-4 py-2 text-sm">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </AnimatedModal>

      <AnimatedModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={`Workflow preview — ${filterType || 'select a type'}`}
        size="md"
      >
        {previewSteps.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active steps for this document type.</p>
        ) : (
          <ol className="space-y-3">
            {previewSteps.map((step, idx) => (
              <li key={step.id} className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {idx + 1}
                </span>
                <div>
                  <p className="font-medium text-foreground">{step.stepName}</p>
                  <p className="text-xs text-muted-foreground">
                    {step.approverRole?.name} · {step.requiredPermission}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Any one authorized approver
                  </p>
                </div>
                {idx < previewSteps.length - 1 && (
                  <span className="mx-auto hidden text-muted-foreground sm:block">↓</span>
                )}
              </li>
            ))}
            <li className="flex items-center gap-3 border-t border-border pt-3 text-sm text-muted-foreground">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs">SAP</span>
              Create in SAP (after final approval)
            </li>
          </ol>
        )}
      </AnimatedModal>
    </div>
  );
}
