'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/apiClient';
import { AnimatedModal, AnimatedSkeletonLoader, AnimatedStatusBadge } from '@/components/ui';
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
            className="text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            Edit
          </button>
          {u.isActive && (
            <button
              type="button"
              onClick={() => handleDeactivate(u)}
              className="text-sm font-medium text-rose-600 hover:text-rose-700"
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
            <label className="mb-1 block text-xs font-medium text-slate-600">Search</label>
            <input
              type="search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Name, email, username…"
              className="h-9 w-56 rounded-md border border-slate-300 px-3 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Status</label>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="h-9 rounded-md border border-slate-300 px-2 text-sm"
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
            className="h-9 rounded-md border border-slate-200 px-3 text-sm text-slate-700 hover:bg-slate-50"
          >
            Reset
          </button>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Add user
        </button>
      </div>

      {error && (
        <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <AnimatedSkeletonLoader variant="table" rows={6} />
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
              <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Username</label>
              <input
                required
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Department</label>
              <input
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">SAP requester code</label>
              <input
                value={form.sapRequesterCode}
                onChange={(e) => setForm({ ...form, sapRequesterCode: e.target.value })}
                placeholder="e.g. 15"
                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Role</label>
              <select
                required
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
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
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Password {editing && '(leave blank to keep)'}
              </label>
              <input
                type="password"
                required={!editing}
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
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
              className="rounded-md border border-slate-200 px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </AnimatedModal>
    </div>
  );
}
