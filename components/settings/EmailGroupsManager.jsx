'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/apiClient';
import { AnimatedModal, AnimatedSkeletonLoader, AnimatedStatusBadge } from '@/components/ui';
import SettingsTable from './SettingsTable';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatRecipients(group) {
  if (!group?.recipients?.length) return '—';
  return group.recipients
    .map((r) => {
      if (r.type === 'email') return r.email;
      if (r.type === 'user') return r.label || r.email || 'User';
      return r.label || 'Role';
    })
    .join(', ');
}

function recipientsToForm(recipients = []) {
  return recipients.map((r) => {
    if (r.type === 'email') return { kind: 'email', value: r.email };
    if (r.type === 'user') return { kind: 'user', value: r.userId };
    return { kind: 'role', value: r.role };
  });
}

function formToPayload(recipients, ccRoles, isActive) {
  const mapped = recipients
    .filter((r) => r.value)
    .map((r) => {
      if (r.kind === 'email') return { email: r.value.trim() };
      if (r.kind === 'user') return { userId: r.value };
      return { role: r.value };
    });
  return {
    recipients: mapped,
    ccRoles: ccRoles.filter(Boolean),
    isActive,
  };
}

export default function EmailGroupsManager() {
  const [groups, setGroups] = useState([]);
  const [eventKeys, setEventKeys] = useState([]);
  const [eventLabels, setEventLabels] = useState({});
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    eventKey: '',
    recipients: [{ kind: 'role', value: '' }],
    ccRoles: [],
    isActive: true,
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const loadMeta = useCallback(async () => {
    const [rolesRes, usersRes] = await Promise.all([
      apiFetch('/api/roles/picklist'),
      apiFetch('/api/users/picklist'),
    ]);
    if (rolesRes.json.success) setRoles(rolesRes.json.data);
    if (usersRes.json.success) setUsers(usersRes.json.data);
  }, []);

  const loadGroups = useCallback(async () => {
    setLoading(true);
    setError('');
    const { json } = await apiFetch('/api/email-groups');
    if (json.success) {
      setGroups(json.data.groups || []);
      setEventKeys(json.data.eventKeys || []);
      setEventLabels(json.data.eventLabels || {});
    } else {
      setError(json.message || 'Failed to load email groups');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadMeta();
    loadGroups();
  }, [loadMeta, loadGroups]);

  const rowsByKey = Object.fromEntries(groups.map((g) => [g.eventKey, g]));

  function openCreate(eventKey) {
    setEditing(null);
    setForm({
      eventKey: eventKey || eventKeys[0] || '',
      recipients: [{ kind: 'role', value: '' }],
      ccRoles: [],
      isActive: true,
    });
    setModalOpen(true);
  }

  function openEdit(group) {
    setEditing(group);
    setForm({
      eventKey: group.eventKey,
      recipients: recipientsToForm(group.recipients).length
        ? recipientsToForm(group.recipients)
        : [{ kind: 'role', value: '' }],
      ccRoles: (group.ccRoles || []).map((r) => r.id),
      isActive: group.isActive,
    });
    setModalOpen(true);
  }

  function addRecipientRow() {
    setForm((f) => ({
      ...f,
      recipients: [...f.recipients, { kind: 'email', value: '' }],
    }));
  }

  function updateRecipient(index, patch) {
    setForm((f) => {
      const recipients = [...f.recipients];
      recipients[index] = { ...recipients[index], ...patch };
      return { ...f, recipients };
    });
  }

  function removeRecipient(index) {
    setForm((f) => ({
      ...f,
      recipients: f.recipients.filter((_, i) => i !== index),
    }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');

    for (const r of form.recipients) {
      if (r.kind === 'email' && r.value && !EMAIL_RE.test(r.value.trim())) {
        setError('Invalid email address in recipients');
        setSaving(false);
        return;
      }
    }

    const payload = formToPayload(form.recipients, form.ccRoles, form.isActive);

    let result;
    if (editing) {
      result = await apiFetch(`/api/email-groups/${editing.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } else {
      result = await apiFetch('/api/email-groups', {
        method: 'POST',
        body: JSON.stringify({ eventKey: form.eventKey, ...payload }),
      });
    }

    if (result.json.success) {
      setModalOpen(false);
      await loadGroups();
    } else {
      setError(result.json.message || 'Save failed');
    }
    setSaving(false);
  }

  async function handleTestSmtp() {
    setTesting(true);
    setError('');
    const { json } = await apiFetch('/api/email/test', {
      method: 'POST',
      body: JSON.stringify({ eventKey: form.eventKey || 'pr.created' }),
    });
    if (!json.success) {
      setError(json.message || 'Test email failed');
    } else if (!json.data?.sent) {
      setError(json.data?.error || 'Test email failed — check Email Logs');
    }
    setTesting(false);
  }

  const tableRows = eventKeys.map((key) => {
    const group = rowsByKey[key];
    return {
      key,
      data: { eventKey: key, group, label: eventLabels[key] || key },
    };
  });

  const columns = [
    {
      key: 'eventKey',
      label: 'Event',
      render: (row) => (
        <div>
          <p className="font-mono text-xs text-foreground">{row.eventKey}</p>
          <p className="text-xs text-muted-foreground">{row.label}</p>
        </div>
      ),
    },
    {
      key: 'recipients',
      label: 'Recipients',
      render: (row) => formatRecipients(row.group),
    },
    {
      key: 'active',
      label: 'Active',
      render: (row) =>
        row.group ? (
          <AnimatedStatusBadge status={row.group.isActive ? 'Healthy' : 'Failed'} />
        ) : (
          <span className="text-xs text-muted-foreground">Not configured</span>
        ),
    },
    {
      key: 'actions',
      label: '',
      render: (row) =>
        row.group ? (
          <button
            type="button"
            onClick={() => openEdit(row.group)}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
          >
            Edit
          </button>
        ) : (
          <button
            type="button"
            onClick={() => openCreate(row.eventKey)}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
          >
            Configure
          </button>
        ),
    },
  ];

  if (loading) {
    return <AnimatedSkeletonLoader rows={6} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Override notification recipients per workflow event. Inactive or empty groups use role-based fallbacks.
        </p>
        <button
          type="button"
          onClick={handleTestSmtp}
          disabled={testing}
          className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
          {testing ? 'Sending test…' : 'Send SMTP test'}
        </button>
      </div>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <SettingsTable columns={columns} rows={tableRows} emptyMessage="No workflow events defined." />

      <AnimatedModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit email group' : 'Create email group'}
        size="lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-muted-foreground">Event key</label>
            <input
              type="text"
              readOnly
              value={form.eventKey}
              className="mt-1 w-full rounded-md border border-border bg-muted px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-muted-foreground">{eventLabels[form.eventKey]}</p>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Recipients (TO)</label>
              <button type="button" onClick={addRecipientRow} className="text-xs text-indigo-600">
                + Add
              </button>
            </div>
            <div className="space-y-2">
              {form.recipients.map((r, i) => (
                <div key={i} className="flex flex-wrap gap-2">
                  <select
                    value={r.kind}
                    onChange={(e) => updateRecipient(i, { kind: e.target.value, value: '' })}
                    className="rounded-md border border-border px-2 py-2 text-sm"
                  >
                    <option value="email">Email</option>
                    <option value="user">User</option>
                    <option value="role">Role</option>
                  </select>
                  {r.kind === 'email' && (
                    <input
                      type="email"
                      value={r.value}
                      onChange={(e) => updateRecipient(i, { value: e.target.value })}
                      placeholder="name@company.com"
                      className="min-w-[200px] flex-1 rounded-md border border-border px-3 py-2 text-sm"
                    />
                  )}
                  {r.kind === 'user' && (
                    <select
                      value={r.value}
                      onChange={(e) => updateRecipient(i, { value: e.target.value })}
                      className="min-w-[200px] flex-1 rounded-md border border-border px-3 py-2 text-sm"
                    >
                      <option value="">Select user</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name || u.username} ({u.email})
                        </option>
                      ))}
                    </select>
                  )}
                  {r.kind === 'role' && (
                    <select
                      value={r.value}
                      onChange={(e) => updateRecipient(i, { value: e.target.value })}
                      className="min-w-[200px] flex-1 rounded-md border border-border px-3 py-2 text-sm"
                    >
                      <option value="">Select role</option>
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    type="button"
                    onClick={() => removeRecipient(i)}
                    className="text-sm text-muted-foreground hover:text-red-600"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-muted-foreground">CC roles</label>
            <select
              multiple
              value={form.ccRoles}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  ccRoles: Array.from(e.target.selectedOptions, (o) => o.value),
                }))
              }
              className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
              size={4}
            >
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            />
            Active (use this group instead of fallbacks)
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-md px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </AnimatedModal>
    </div>
  );
}
