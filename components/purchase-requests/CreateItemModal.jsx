'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/apiClient';
import { AnimatedModal } from '@/components/ui';

const EMPTY = {
  ItemCode: '',
  ItemName: '',
  ItemGroup: '',
  UgpEntry: '',
  DefaultWarehouse: '',
  U_Code: '',
  U_AcctCode: '',
  U_Company: '',
};

export default function CreateItemModal({ open, onClose, onCreated, relatedPRNumber }) {
  const [form, setForm] = useState(EMPTY);
  const [itemGroups, setItemGroups] = useState([]);
  const [uomGroups, setUomGroups] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [ig, ug, ac, co] = await Promise.all([
        apiFetch('/api/sap/item-groups?limit=100'),
        apiFetch('/api/sap/uom-groups?limit=100'),
        apiFetch('/api/sap/accounts?limit=100'),
        apiFetch('/api/sap/companies?limit=100'),
      ]);
      if (ig.json.success) setItemGroups(ig.json.data || []);
      if (ug.json.success) setUomGroups(ug.json.data || []);
      if (ac.json.success) setAccounts(ac.json.data || []);
      if (co.json.success) setCompanies(co.json.data || []);
    })();
  }, [open]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const { json } = await apiFetch('/api/sap/items/create', {
      method: 'POST',
      body: JSON.stringify({ ...form, relatedPRNumber }),
    });
    if (json.success) {
      onCreated({
        itemCode: form.ItemCode,
        itemName: form.ItemName,
        ugpEntry: form.UgpEntry ? Number(form.UgpEntry) : undefined,
      });
      setForm(EMPTY);
      onClose();
    } else {
      setError(json.message || 'Failed to create item');
    }
    setSaving(false);
  }

  return (
    <AnimatedModal isOpen={open} onClose={onClose} title="Create New Item">
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && <p className="text-sm text-red-600">{error}</p>}
        <label className="block text-sm">
          <span className="text-muted-foreground">Item Code</span>
          <input
            className="input-field mt-1"
            value={form.ItemCode}
            required
            onChange={(e) => setForm((f) => ({ ...f, ItemCode: e.target.value }))}
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground">Item Name</span>
          <input
            className="input-field mt-1"
            value={form.ItemName}
            required
            onChange={(e) => setForm((f) => ({ ...f, ItemName: e.target.value }))}
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground">Item Group</span>
          <select
            className="input-field mt-1 w-full"
            value={form.ItemGroup}
            onChange={(e) => setForm((f) => ({ ...f, ItemGroup: e.target.value }))}
          >
            <option value="">Select item group</option>
            {itemGroups.map((g) => (
              <option key={g.itmsGrpCod} value={g.itmsGrpCod}>
                {g.itmsGrpNam}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground">UoM Group</span>
          <select
            className="input-field mt-1 w-full"
            value={form.UgpEntry}
            onChange={(e) => setForm((f) => ({ ...f, UgpEntry: e.target.value }))}
          >
            <option value="">Select UoM group</option>
            {uomGroups.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label || g.code || g.value}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground">Part Number (U_Code)</span>
          <input
            className="input-field mt-1"
            value={form.U_Code}
            onChange={(e) => setForm((f) => ({ ...f, U_Code: e.target.value }))}
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground">Account Code (U_AcctCode)</span>
          <select
            className="input-field mt-1 w-full"
            value={form.U_AcctCode}
            onChange={(e) => setForm((f) => ({ ...f, U_AcctCode: e.target.value }))}
          >
            <option value="">Select account</option>
            {accounts.map((a) => (
              <option key={a.acctCode} value={a.acctCode}>
                {a.acctName} ({a.acctCode})
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground">Company (U_Company)</span>
          <select
            className="input-field mt-1 w-full"
            value={form.U_Company}
            onChange={(e) => setForm((f) => ({ ...f, U_Company: e.target.value }))}
          >
            <option value="">Select company</option>
            {companies.map((c) => (
              <option key={c.company} value={c.company}>
                {c.company}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground">Default Warehouse</span>
          <input
            className="input-field mt-1"
            value={form.DefaultWarehouse}
            onChange={(e) => setForm((f) => ({ ...f, DefaultWarehouse: e.target.value }))}
          />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Creating…' : 'Create Item'}
          </button>
        </div>
      </form>
    </AnimatedModal>
  );
}
