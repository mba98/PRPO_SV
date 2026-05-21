'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/apiClient';
import { AnimatedModal } from '@/components/ui';

const EMPTY = {
  ItemCode: '',
  ItemName: '',
  ItemGroup: '',
  UoMGroup: '',
  DefaultWarehouse: '',
  U_Model: '',
  U_PartNo: '',
  U_Category: '',
  U_FactoryName: '',
  U_Code: '',
  U_UOM: '',
};

export default function CreateItemModal({ open, onClose, onCreated, relatedPRNumber }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
        uom: form.U_UOM,
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
        {[
          ['ItemCode', 'Item Code'],
          ['ItemName', 'Item Name'],
          ['ItemGroup', 'Item Group'],
          ['UoMGroup', 'UoM Group'],
          ['DefaultWarehouse', 'Default Warehouse'],
          ['U_Model', 'Model'],
          ['U_PartNo', 'Part No'],
          ['U_Category', 'Category'],
          ['U_FactoryName', 'Factory Name'],
          ['U_Code', 'Code'],
          ['U_UOM', 'UoM'],
        ].map(([key, label]) => (
          <label key={key} className="block text-sm">
            <span className="text-slate-600">{label}</span>
            <input
              className="input-field mt-1"
              value={form[key]}
              required={key === 'ItemCode' || key === 'ItemName'}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
            />
          </label>
        ))}
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
