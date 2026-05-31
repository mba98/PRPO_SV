'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/apiClient';
import { AnimatedModal, PortalLoader, AnimatedStatusBadge } from '@/components/ui';
import ListPagination from '@/components/lists/ListPagination';
import SettingsTable from './SettingsTable';

const EMPTY_FORM = {
  name: '',
  email: '',
  username: '',
  password: '',
  role: '',
  department: '',
  sapRequesterCode: '',
  isActive: true,
};

export default function UsersManager() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const loadRoles = useCallback(async () => {
    const { json } = await apiFetch('/api/roles/picklist');
    if (json.success) setRoles(json.data);
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({
      page: String(page),
      limit: '25',
      sort: 'createdAt',
      order: 'desc',
    });
    if (q.trim()) params.set('q', q.trim());
    if (status) params.set('status', status);

    const { json, status: httpStatus } = await apiFetch(`/api/users?${params}`);
    if (json.success) {
      setUsers(json.data);
      setPagination(json.pagination || { page: 1, limit: 25, total: 0, totalPages: 1 });
    } else if (httpStatus === 403) {
      setError('You do not have permission to manage users.');
    } else {
      setError(json.message || 'Failed to load users');
    }
    setLoading(false);
  }, [page, q, status]);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(user) {
    setEditing(user);
    setForm({
      name: user.name,
      email: user.email,
      username: user.username,
      password: '',
      role: user.role?.id || user.roleId || '',
      department: user.department || '',
      sapRequesterCode: user.sapRequesterCode || '',
      isActive: user.isActive,
    });
    setModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const payload = {
      name: form.name,
      email: form.email,
      username: form.username,
      role: form.role,
      department: form.department || undefined,
      sapRequesterCode: form.sapRequesterCode || undefined,
      isActive: form.isActive,
    };
    if (form.password) payload.password = form.password;

    let result;
    if (editing) {
      payload.__v = editing.__v;
      result = await apiFetch(`/api/users/${editing.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } else {
      if (!form.password) {
        setError('Password is required for new users');
        setSaving(false);
        return;
      }
      result = await apiFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }

    if (result.json.success) {
      setModalOpen(false);
      await loadUsers();
    } else {
      setError(result.json.message || 'Save failed');
      if (result.json.errors?.length) {
        setError(result.json.errors.map((x) => x.message).join(', '));
      }
    }
    setSaving(false);
  }

  async function handleDeactivate(user) {
    if (!confirm(`Deactivate user "${user.username}"?`)) return;
    const { json } = await apiFetch(`/api/users/${user.id}`, { method: 'DELETE' });
    if (json.success) {
      await loadUsers();
    } else {
      setError(json.message || 'Deactivate failed');
    }
  }

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'username', label: 'Username' },
    { key: 'email', label: 'Email' },
    {
      key: 'role',
      label: 'Role',
      render: (u) => u.roleName || u.role?.name || '—',
    },
    {
      key: 'sapRequesterCode',
      label: 'SAP requester',
      render: (u) => u.sapRequesterCode || '—',
    },
    {
      key: 'status',
      label: 'Status',
      render: (u) => (
        <AnimatedStatusBadge status={u.isActive ? 'Approved' : 'Rejected'} />
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (u) => (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => openEdit(u)}
            className="text-sm font-medium text-primary hover:underline"
          >
            Edit
          </button>
          {u.isActive && (
            <button
              type="button"
              onClick={() => handleDeactivate(u)}
              className="text-sm font-medium text-destructive hover:underline"
            >
              Deactivate
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Search</label>
            <input
              type="search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Name, email, username…"
              className="input-field h-9 w-56 !min-h-9 py-1.5"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="input-field h-9 !min-h-9 w-auto py-1.5"
            >
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => {
              setQ('');
              setStatus('');
              setPage(1);
            }}
            className="h-9 rounded-md border border-border px-3 text-sm text-foreground hover:bg-muted"
          >
            Reset
          </button>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="btn-primary"
        >
          Add user
        </button>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <PortalLoader />
        </div>
      ) : (
        <>
          <SettingsTable
            columns={columns}
            rows={users.map((u) => ({ key: u.id, data: u }))}
            emptyMessage="No users found."
          />
          <ListPagination pagination={pagination} onPageChange={setPage} />
        </>
      )}

      <AnimatedModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit user' : 'Create user'}
        size="lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Name</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Username</label>
              <input
                required
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Department</label>
              <input
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">SAP requester code</label>
              <input
                value={form.sapRequesterCode}
                onChange={(e) => setForm({ ...form, sapRequesterCode: e.target.value })}
                placeholder="e.g. 15"
                className="input-field"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Role</label>
              <select
                required
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
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
              <label className="mb-1 block text-sm font-medium text-foreground">
                Password {editing && '(leave blank to keep)'}
              </label>
              <input
                type="password"
                required={!editing}
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="input-field"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Active
          </label>
          <div className="flex justify-end gap-2 pt-2">
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
