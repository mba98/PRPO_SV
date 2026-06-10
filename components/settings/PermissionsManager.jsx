'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/apiClient';
import { AnimatedModal, AnimatedSkeletonLoader } from '@/components/ui';
import SettingsTable from './SettingsTable';

const EMPTY = { key: '', label: '', group: 'custom' };

export default function PermissionsManager() {
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [modalError, setModalError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const loadPermissions = useCallback(async () => {
    setLoading(true);
    setPageError('');
    const { json, status } = await apiFetch('/api/permissions');
    if (json.success) setPermissions(json.data);
    else if (status === 403) setPageError('You do not have permission to manage permissions.');
    else setPageError(json.message || 'Failed to load permissions');
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  function mapApiErrors(errors = []) {
    const next = {};
    for (const e of errors) {
      const key = e.path && e.path !== 'body' ? e.path : '_form';
      next[key] = e.message;
    }
    return next;
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setModalError('');
    setFieldErrors({});
    setModalOpen(true);
  }

  function openEdit(perm) {
    setEditing(perm);
    setForm({ key: perm.key, label: perm.label, group: perm.group || 'custom' });
    setModalError('');
    setFieldErrors({});
    setModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setModalError('');
    setFieldErrors({});

    let result;
    if (editing) {
      result = await apiFetch(`/api/permissions/${editing.id}`, {
        method: 'PUT',
        body: JSON.stringify({ label: form.label, group: form.group, __v: editing.__v }),
      });
    } else {
      result = await apiFetch('/api/permissions', {
        method: 'POST',
        body: JSON.stringify(form),
      });
    }

    if (result.json.success) {
      setModalOpen(false);
      await loadPermissions();
    } else {
      setModalError(result.json.message || 'Save failed');
      if (result.json.errors?.length) {
        setFieldErrors(mapApiErrors(result.json.errors));
      }
    }
    setSaving(false);
  }

  async function handleDelete(perm) {
    if (!confirm(`Delete permission "${perm.key}"?`)) return;
    const { json } = await apiFetch(`/api/permissions/${perm.id}`, { method: 'DELETE' });
    if (json.success) {
      await loadPermissions();
    } else {
      setPageError(json.message || 'Delete failed');
    }
  }

  const columns = [
    {
      key: 'key',
      label: 'Key',
      render: (p) => <span className="font-mono text-xs">{p.key}</span>,
    },
    { key: 'label', label: 'Label' },
    { key: 'group', label: 'Group' },
    {
      key: 'isActive',
      label: 'Active',
      render: (p) => (p.isActive ? 'Yes' : 'No'),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (p) => (
        <div className="flex gap-2">
          <button type="button" onClick={() => openEdit(p)} className="text-sm font-medium text-primary hover:underline">
            Edit
          </button>
          <button type="button" onClick={() => handleDelete(p)} className="text-sm font-medium text-destructive hover:underline">
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Define permission keys used by roles and approval matrix steps (e.g. po.approve.finance).
      </p>
      <div className="flex justify-end">
        <button type="button" onClick={openCreate} className="btn-primary">
          Add permission
        </button>
      </div>

      {pageError && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {pageError}
        </p>
      )}

      {loading ? (
        <AnimatedSkeletonLoader variant="table" rows={8} />
      ) : (
        <SettingsTable
          columns={columns}
          rows={permissions.map((p) => ({ key: p.id, data: p }))}
          emptyMessage="No permissions found."
        />
      )}

      <AnimatedModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit permission' : 'Create permission'}
        size="md"
      >
        <form onSubmit={handleSave} className="space-y-4">
          {modalError && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {modalError}
            </p>
          )}
          {!editing && (
            <div>
              <label className="mb-1 block text-sm font-medium">Permission key</label>
              <input
                required
                value={form.key}
                onChange={(e) => setForm({ ...form, key: e.target.value })}
                placeholder="po.approve.om"
                className="input-field font-mono text-sm"
              />
              {fieldErrors.key && <p className="mt-1 text-xs text-destructive">{fieldErrors.key}</p>}
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium">Label</label>
            <input
              required
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              className="input-field"
            />
            {fieldErrors.label && <p className="mt-1 text-xs text-destructive">{fieldErrors.label}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Group</label>
            <input
              value={form.group}
              onChange={(e) => setForm({ ...form, group: e.target.value })}
              className="input-field"
            />
          </div>
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
    </div>
  );
}
