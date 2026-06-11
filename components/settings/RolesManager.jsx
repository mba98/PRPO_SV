'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/apiClient';
import { AnimatedModal, AnimatedSkeletonLoader } from '@/components/ui';
import SettingsTable from './SettingsTable';

export default function RolesManager() {
  const [roles, setRoles] = useState([]);
  const [permissionGroups, setPermissionGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [permissions, setPermissions] = useState([]);
  const [modalError, setModalError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [permissionRefreshNote, setPermissionRefreshNote] = useState('');

  const loadPermissionGroups = useCallback(async () => {
    const { json } = await apiFetch('/api/permissions?grouped=true');
    if (json.success) setPermissionGroups(json.data);
  }, []);

  const loadRoles = useCallback(async () => {
    setLoading(true);
    setPageError('');
    const { json, status } = await apiFetch('/api/roles?limit=100&sort=name&order=asc');
    if (json.success) setRoles(json.data);
    else if (status === 403) setPageError('You do not have permission to manage roles.');
    else setPageError(json.message || 'Failed to load roles');
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPermissionGroups();
    loadRoles();
  }, [loadPermissionGroups, loadRoles]);

  function openCreate() {
    setEditing(null);
    setName('');
    setPermissions([]);
    setModalError('');
    setFieldErrors({});
    setModalOpen(true);
  }

  function openEdit(role) {
    setEditing(role);
    setName(role.name);
    setPermissions([...role.permissions]);
    setModalError('');
    setFieldErrors({});
    setModalOpen(true);
  }

  function togglePermission(permKey) {
    setPermissions((prev) =>
      prev.includes(permKey) ? prev.filter((p) => p !== permKey) : [...prev, permKey],
    );
  }

  function mapApiErrors(errors = []) {
    const next = {};
    for (const e of errors) {
      const key = e.path && e.path !== 'body' ? e.path : '_form';
      next[key] = e.message;
    }
    return next;
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setModalError('');
    setFieldErrors({});

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
      setPermissionRefreshNote(
        'Role saved. Users with this role should refresh the page to update sidebar and permissions. API calls already load the latest permissions from the database.',
      );
      await loadRoles();
    } else {
      setModalError(result.json.message || 'Save failed');
      if (result.json.errors?.length) {
        setFieldErrors(mapApiErrors(result.json.errors));
      }
    }
    setSaving(false);
  }

  async function handleDelete(role) {
    if (!confirm(`Delete role "${role.name}"?`)) return;
    const { json, status } = await apiFetch(`/api/roles/${role.id}`, { method: 'DELETE' });
    if (json.success) {
      await loadRoles();
    } else {
      setPageError(json.message || `Delete failed (${status})`);
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
        <button type="button" onClick={openCreate} className="btn-primary">
          Add role
        </button>
      </div>

      {pageError && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {pageError}
        </p>
      )}

      {permissionRefreshNote && (
        <p
          className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          role="status"
        >
          {permissionRefreshNote}
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
          {modalError && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {modalError}
            </p>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Role name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
            />
            {fieldErrors.name && <p className="mt-1 text-xs text-destructive">{fieldErrors.name}</p>}
          </div>
          <div className="max-h-80 space-y-4 overflow-y-auto rounded-md border border-border p-3">
            {permissionGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground">No permissions defined yet.</p>
            ) : (
              permissionGroups.map((group) => (
                <fieldset key={group.id}>
                  <legend className="mb-2 text-sm font-semibold text-foreground">{group.label}</legend>
                  <div className="space-y-2">
                    {(group.permissions || []).map((perm) => (
                      <label key={perm.key || perm} className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={permissions.includes(perm.key || perm)}
                          onChange={() => togglePermission(perm.key || perm)}
                          className="mt-0.5"
                        />
                        <span>
                          <span className="font-mono text-xs text-foreground">{perm.key || perm}</span>
                          {perm.label && (
                            <span className="block text-xs text-muted-foreground">{perm.label}</span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))
            )}
          </div>
          {fieldErrors.permissions && (
            <p className="text-xs text-destructive">{fieldErrors.permissions}</p>
          )}
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
