'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/apiClient';
import { AnimatedModal } from '@/components/ui';
import SearchableLookup from '@/components/lookups/SearchableLookup';

const EMPTY = {
  ItemName: '',
  ItemGroup: '',
  UgpEntry: '',
  DefaultWarehouse: '',
  U_Code: '',
  U_AcctCode: '',
  U_Company: '',
};

function formatUom(row) {
  if (!row) return '';
  return row.label ? `${row.value} — ${row.label}` : String(row.value ?? '');
}

export default function CreateItemModal({ open, onClose, onCreated, relatedPRNumber }) {
  const [form, setForm] = useState(EMPTY);
  const [labels, setLabels] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const payload = {
      ItemName: form.ItemName,
      ItemGroup: form.ItemGroup || undefined,
      UgpEntry: form.UgpEntry ? Number(form.UgpEntry) : undefined,
      DefaultWarehouse: form.DefaultWarehouse || undefined,
      U_Code: form.U_Code || undefined,
      U_AcctCode: form.U_AcctCode || undefined,
      U_Company: form.U_Company || undefined,
      relatedPRNumber,
    };
    const { json } = await apiFetch('/api/sap/items/create', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (json.success) {
      const createdCode = json.data?.ItemCode;
      onCreated({
        itemCode: createdCode,
        itemName: form.ItemName,
        ugpEntry: form.UgpEntry ? Number(form.UgpEntry) : undefined,
        ugpName: labels.uom?.split(' — ').slice(1).join(' — ') || '',
        warehouseCode: form.DefaultWarehouse,
        warehouseLabel: labels.warehouse || form.DefaultWarehouse,
      });
      setForm(EMPTY);
      setLabels({});
      onClose();
    } else {
      const fieldMessages = json.errors?.map((x) => x.message).filter(Boolean);
      setError(fieldMessages?.length ? fieldMessages.join('; ') : json.message || 'Failed to create item');
    }
    setSaving(false);
  }

  if (!open) return null;

  return (
    <AnimatedModal isOpen={open} onClose={onClose} title="Create New Item">
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

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
          <SearchableLookup
            endpoint="/api/sap/item-groups"
            value={form.ItemGroup}
            label={labels.itemGroup}
            onSelect={(value, display) => {
              setForm((f) => ({ ...f, ItemGroup: value }));
              setLabels((l) => ({ ...l, itemGroup: display }));
            }}
            placeholder="Search item group"
            inputClassName="input-field mt-1"
            loadAllOnFocus
            minChars={0}
          />
        </label>

        <label className="block text-sm">
          <span className="text-muted-foreground">UoM Group</span>
          <SearchableLookup
            endpoint="/api/sap/uom-groups"
            value={form.UgpEntry}
            label={labels.uom}
            onSelect={(value, display) => {
              setForm((f) => ({ ...f, UgpEntry: value }));
              setLabels((l) => ({ ...l, uom: display }));
            }}
            placeholder="Search UoM group"
            inputClassName="input-field mt-1"
            formatOption={formatUom}
            loadAllOnFocus
            minChars={0}
          />
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
          <SearchableLookup
            endpoint="/api/sap/accounts"
            value={form.U_AcctCode}
            label={labels.account}
            onSelect={(value, display) => {
              setForm((f) => ({ ...f, U_AcctCode: value }));
              setLabels((l) => ({ ...l, account: display }));
            }}
            placeholder="Search account"
            inputClassName="input-field mt-1"
            loadAllOnFocus
            minChars={0}
          />
        </label>

        <label className="block text-sm">
          <span className="text-muted-foreground">Company (U_Company)</span>
          <SearchableLookup
            endpoint="/api/sap/companies"
            value={form.U_Company}
            label={labels.company}
            onSelect={(value, display) => {
              setForm((f) => ({ ...f, U_Company: value }));
              setLabels((l) => ({ ...l, company: display }));
            }}
            placeholder="Search company"
            inputClassName="input-field mt-1"
            loadAllOnFocus
            minChars={0}
          />
        </label>

        <label className="block text-sm">
          <span className="text-muted-foreground">Default Warehouse</span>
          <SearchableLookup
            endpoint="/api/sap/warehouses"
            value={form.DefaultWarehouse}
            label={labels.warehouse}
            onSelect={(value, display) => {
              setForm((f) => ({ ...f, DefaultWarehouse: value }));
              setLabels((l) => ({ ...l, warehouse: display }));
            }}
            placeholder="Search warehouse"
            inputClassName="input-field mt-1"
            loadAllOnFocus
            minChars={0}
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
