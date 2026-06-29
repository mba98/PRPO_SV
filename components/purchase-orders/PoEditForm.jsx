'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/apiClient';
import { useI18n } from '@/lib/hooks/useI18n';
import { Button } from '@/components/ui';
import PoBusinessFields from '@/components/purchase-orders/PoBusinessFields';
import {
  resolveFormDocCurrencyFromPo,
  resolveFormDocRateFromPo,
  getPoExchangeRateSubmitBlocker,
} from '@/lib/poCurrency.js';
import { toPoDateInput } from '@/lib/poFormUtils.js';

export default function PoEditForm({ po, onSaved, onCancel }) {
  const { po: poI18n } = useI18n();
  const t = poI18n.edit;
  const vendorEditable = po.canEdit !== false;

  const [header, setHeader] = useState({
    vendor: po.vendor || '',
    vendorLabel: po.vendor || '',
    postingDate: toPoDateInput(po.postingDate),
    documentDate: toPoDateInput(po.documentDate),
    requiredDate: toPoDateInput(po.requiredDate),
    dueDate: toPoDateInput(po.dueDate),
    docCurrency: resolveFormDocCurrencyFromPo(po),
    docRate: resolveFormDocRateFromPo(po),
    remarks: po.remarks || '',
  });
  const [lines, setLines] = useState(
    (po.lines || []).map((line) => ({
      _id: line._id,
      itemCode: line.itemCode || '',
      itemName: line.itemName || '',
      quantity: line.quantity ?? '',
      unitPrice: line.unitPrice ?? '',
      lineTotal: line.lineTotal ?? '',
      warehouseCode: line.warehouseCode || '',
      warehouseLabel: line.warehouseCode || '',
      uomCode: line.uomCode || line.uom || '',
      remarks: line.remarks || '',
    })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [exchangeRateState, setExchangeRateState] = useState({
    rateLoading: false,
    rateError: '',
    needsRate: false,
  });

  async function handleSubmit(e) {
    e.preventDefault();
    if (saving) return;

    const rateBlocker = getPoExchangeRateSubmitBlocker(
      header,
      header.companyLocalCurrency,
      exchangeRateState,
      {
        loading: poI18n.create.loadingExchangeRate,
        missing: poI18n.create.sapExchangeRateMissing,
      },
    );
    if (rateBlocker) {
      setError(rateBlocker);
      return;
    }

    setSaving(true);
    setError('');

    const payload = {
      __v: po.__v,
      vendor: header.vendor.trim(),
      remarks: header.remarks,
      postingDate: header.postingDate || undefined,
      documentDate: header.documentDate || undefined,
      requiredDate: header.requiredDate || undefined,
      dueDate: header.dueDate || undefined,
      docCurrency: header.docCurrency,
      lines: lines.map((l) => ({
        _id: l._id,
        itemCode: l.itemCode,
        itemName: l.itemName || undefined,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        warehouseCode: l.warehouseCode || undefined,
        uomCode: l.uomCode?.trim() || undefined,
        remarks: l.remarks || undefined,
      })),
    };

    const { json } = await apiFetch(`/api/purchase-orders/${po.id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });

    if (json.success) {
      onSaved?.(json.data);
    } else {
      setError(json.message || 'Failed to save purchase order');
      if (json.errors?.length) {
        setError(json.errors.map((x) => x.message).join(', '));
      }
    }
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}
      <PoBusinessFields
        header={header}
        setHeader={setHeader}
        lines={lines}
        setLines={setLines}
        vendorEditable={vendorEditable}
        disabled={saving}
        onExchangeRateStateChange={setExchangeRateState}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          loading={saving}
          disabled={
            saving || exchangeRateState.rateLoading || Boolean(exchangeRateState.rateError)
          }
        >
          {saving ? t.saving : t.saveChanges}
        </Button>
        {onCancel && (
          <Button type="button" variant="secondary" disabled={saving} onClick={onCancel}>
            {t.cancel}
          </Button>
        )}
      </div>
    </form>
  );
}
