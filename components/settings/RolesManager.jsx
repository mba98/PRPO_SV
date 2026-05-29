'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/apiClient';
import { PERMISSION_GROUPS, PERMISSION_LABELS } from '@/lib/permissions';
import { AnimatedModal, AnimatedSkeletonLoader } from '@/components/ui';
import SettingsTable from './SettingsTable';

export default function RolesManager() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [permissions, setPermissions] = useState([]);
  const [saving, setSaving] = useState(false);

  const loadRoles = useCallback(async () => {
    setLoading(true);
    const { json, status } = await apiFetch('/api/roles?limit=100&sort=name&order=asc');
    if (json.success) setRoles(json.data);
    else if (status === 403) setError('You do not have permission to manage roles.');
    else setError(json.message || 'Failed to load roles');
    setLoading(false);
  }, []);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  function openCreate() {
    setEditing(null);
    setName('');
    setPermissions([]);
    setModalOpen(true);
  }

  function openEdit(role) {
    setEditing(role);
    setName(role.name);
    setPermissions([...role.permissions]);
    setModalOpen(true);
  }

  function togglePermission(perm) {
    setPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm],
    );
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const payload = { name, permissions };
    let result;
    if (editing) {
      payload.__v = editing.__v;
      result = await apiFetch(`/api/roles/${editing.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } else {
      result = await apiFetch('/api/roles', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }

    if (result.json.success) {
      setModalOpen(false);
      await loadRoles();
    } else {
      setError(result.json.message || 'Save failed');
    }
    setSaving(false);
  }

  async function handleDelete(role) {
    if (!confirm(`Delete role "${role.name}"?`)) return;
    const { json, status } = await apiFetch(`/api/roles/${role.id}`, { method: 'DELETE' });
    if (json.success) {
      await loadRoles();
    } else {
      setError(json.message || `Delete failed (${status})`);
    }
  }

  const columns = [
    { key: 'name', label: 'Role' },
    {
      key: 'permissions',
      label: 'Permissions',
      render: (r) => (
        <span className="text-xs text-muted-foreground">{r.permissions?.length || 0} assigned</span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (r) => (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => openEdit(r)}
            className="text-sm font-medium text-primary hover:underline"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => handleDelete(r)}
            className="text-sm font-medium text-destructive hover:underline"
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={openCreate}
          className="btn-primary"
        >
          Add role
        </button>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <AnimatedSkeletonLoader variant="table" rows={5} />
      ) : (
        <SettingsTable
          columns={columns}
          rows={roles.map((r) => ({ key: r.id, data: r }))}
          emptyMessage="No roles found."
        />
      )}

      <AnimatedModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit role' : 'Create role'}
        size="lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Role name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
            />
          </div>
          <div className="max-h-80 space-y-4 overflow-y-auto rounded-md border border-border p-3">
            {PERMISSION_GROUPS.map((group) => (
              <fieldset key={group.id}>
                <legend className="mb-2 text-sm font-semibold text-foreground">{group.label}</legend>
                <div className="space-y-2">
                  {group.permissions.map((perm) => (
                    <label key={perm} className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={permissions.includes(perm)}
                        onChange={() => togglePermission(perm)}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="font-mono text-xs text-foreground">{perm}</span>
                        {PERMISSION_LABELS[perm] && (
                          <span className="block text-xs text-muted-foreground">
                            {PERMISSION_LABELS[perm]}
                          </span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
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
              disabled={saving || permissions.length === 0}
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
