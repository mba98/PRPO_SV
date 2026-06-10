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

const FIELD_LABELS = {
  ItemName: 'Item Name',
  ItemGroup: 'Item Group',
  UgpEntry: 'UoM Group',
  DefaultWarehouse: 'Default Warehouse',
  U_Code: 'Part Number',
  U_AcctCode: 'Account Code',
  U_Company: 'Company',
};

function formatUom(row) {
  if (!row) return '';
  return row.label ? `${row.value} — ${row.label}` : String(row.value ?? '');
}

function mapApiErrors(errors = []) {
  const fieldErrors = {};
  const lines = [];
  for (const e of errors) {
    const key = e.path && e.path !== 'body' ? e.path : '_form';
    const label = FIELD_LABELS[key] || key;
    fieldErrors[key] = e.message;
    lines.push(`${label}: ${e.message}`);
  }
  return { fieldErrors, lines };
}

export default function CreateItemModal({ open, onClose, onCreated, relatedPRNumber }) {
  const [form, setForm] = useState(EMPTY);
  const [labels, setLabels] = useState({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    setFieldErrors({});

    const payload = {
      ItemName: form.ItemName,
      ItemGroup: form.ItemGroup || undefined,
      UgpEntry: form.UgpEntry !== '' && form.UgpEntry != null ? form.UgpEntry : undefined,
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
        ugpEntry: form.UgpEntry !== '' && form.UgpEntry != null ? Number(form.UgpEntry) : undefined,
        ugpName: labels.uom?.split(' — ').slice(1).join(' — ') || '',
        warehouseCode: form.DefaultWarehouse,
        warehouseLabel: labels.warehouse || form.DefaultWarehouse,
      });
      setForm(EMPTY);
      setLabels({});
      onClose();
    } else if (json.errors?.length) {
      const { fieldErrors: next, lines } = mapApiErrors(json.errors);
      setFieldErrors(next);
      setFormError(lines.join('\n'));
    } else {
      const sapMsg = json.sapError?.message;
      setFormError(sapMsg || json.message || 'Failed to create item');
    }
    setSaving(false);
  }

  if (!open) return null;

  return (
    <AnimatedModal isOpen={open} onClose={onClose} title="Create New Item">
      <form onSubmit={handleSubmit} className="space-y-3">
        {formError && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive whitespace-pre-line" role="alert">
            {formError}
          </div>
        )}

        <label className="block text-sm">
          <span className="text-muted-foreground">Item Name</span>
          <input
            className="input-field mt-1"
            value={form.ItemName}
            required
            onChange={(e) => setForm((f) => ({ ...f, ItemName: e.target.value }))}
          />
          {fieldErrors.ItemName && (
            <p className="mt-1 text-xs text-destructive">{fieldErrors.ItemName}</p>
          )}
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
          {fieldErrors.ItemGroup && (
            <p className="mt-1 text-xs text-destructive">{fieldErrors.ItemGroup}</p>
          )}
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
          {fieldErrors.UgpEntry && (
            <p className="mt-1 text-xs text-destructive">{fieldErrors.UgpEntry}</p>
          )}
        </label>

        <label className="block text-sm">
          <span className="text-muted-foreground">Part Number (U_Code)</span>
          <input
            className="input-field mt-1"
            value={form.U_Code}
            onChange={(e) => setForm((f) => ({ ...f, U_Code: e.target.value }))}
          />
          {fieldErrors.U_Code && (
            <p className="mt-1 text-xs text-destructive">{fieldErrors.U_Code}</p>
          )}
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
          {fieldErrors.U_AcctCode && (
            <p className="mt-1 text-xs text-destructive">{fieldErrors.U_AcctCode}</p>
          )}
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
          {fieldErrors.U_Company && (
            <p className="mt-1 text-xs text-destructive">{fieldErrors.U_Company}</p>
          )}
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
          {fieldErrors.DefaultWarehouse && (
            <p className="mt-1 text-xs text-destructive">{fieldErrors.DefaultWarehouse}</p>
          )}
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
