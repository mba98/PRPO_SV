'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProjectSelect from '@/components/lookups/ProjectSelect';
import { apiFetch } from '@/lib/apiClient';
import { Button, FormField, PortalLoader, Textarea } from '@/components/ui';
import { useI18n } from '@/lib/hooks/useI18n';

const EMPTY_LINE = () => ({
  description: '',
  uom: '',
  quantity: 1,
  unitPrice: 0,
  notes: '',
});

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export default function LpForm({ mode = 'create', initialDoc = null }) {
  const router = useRouter();
  const { common, lp: lpI18n } = useI18n();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const [header, setHeader] = useState(() => ({
    documentDate: initialDoc?.documentDate
      ? new Date(initialDoc.documentDate).toISOString().slice(0, 10)
      : todayInputValue(),
    requiredDate: initialDoc?.requiredDate
      ? new Date(initialDoc.requiredDate).toISOString().slice(0, 10)
      : '',
    projectCode: initialDoc?.projectCode || '',
    projectName: initialDoc?.projectName || '',
    vendorName: initialDoc?.vendorName || '',
    vendorReference: initialDoc?.vendorReference || '',
    currency: initialDoc?.currency || 'USD',
    exchangeRate: initialDoc?.exchangeRate ?? 1,
    remarks: initialDoc?.remarks || '',
  }));

  const [lines, setLines] = useState(() =>
    initialDoc?.lines?.length
      ? initialDoc.lines.map((line) => ({
          _id: line._id,
          description: line.description || '',
          uom: line.uom || '',
          quantity: line.quantity ?? 1,
          unitPrice: line.unitPrice ?? 0,
          notes: line.notes || '',
        }))
      : [EMPTY_LINE()],
  );

  const documentTotal = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const qty = Number(line.quantity) || 0;
        const price = Number(line.unitPrice) || 0;
        return sum + qty * price;
      }, 0),
    [lines],
  );

  function updateHeader(patch) {
    setHeader((prev) => ({ ...prev, ...patch }));
  }

  function updateLine(index, patch) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function addLine() {
    setLines((prev) => [...prev, EMPTY_LINE()]);
  }

  function removeLine(index) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  function buildPayload() {
    return {
      ...header,
      exchangeRate: Number(header.exchangeRate) || 1,
      lines: lines.map(({ _id, ...line }) => ({
        ...(_id ? { _id } : {}),
        ...line,
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice),
      })),
      ...(mode === 'edit' ? { __v: initialDoc.__v } : {}),
    };
  }

  async function saveDraft() {
    setSubmitting(true);
    setError('');
    setFieldErrors({});
    const payload = buildPayload();
    const isEdit = mode === 'edit';
    const { json, status } = await apiFetch(
      isEdit ? `/api/local-purchases/${initialDoc.id}` : '/api/local-purchases',
      {
        method: isEdit ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
        source: 'LpForm:save',
        dedupe: false,
      },
    );
    setSubmitting(false);
    if (!json.success) {
      if (json.errors) setFieldErrors(json.errors);
      setError(json.message || lpI18n.saveFailed);
      return;
    }
    router.push(`/local-purchases/${json.data.id}`);
  }

  async function submitForApproval() {
    setSubmitting(true);
    setError('');
    setFieldErrors({});
    const payload = buildPayload();
    const isEdit = mode === 'edit';
    const saveRes = await apiFetch(
      isEdit ? `/api/local-purchases/${initialDoc.id}` : '/api/local-purchases',
      {
        method: isEdit ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
        source: 'LpForm:submit-save',
        dedupe: false,
      },
    );
    if (!saveRes.json.success) {
      setSubmitting(false);
      if (saveRes.json.errors) setFieldErrors(saveRes.json.errors);
      setError(saveRes.json.message || lpI18n.saveFailed);
      return;
    }
    const docId = saveRes.json.data.id;
    const submitRes = await apiFetch(
      isEdit && initialDoc?.status === 'rejected'
        ? `/api/local-purchases/${docId}/resubmit`
        : `/api/local-purchases/${docId}/submit`,
      {
        method: 'POST',
        body: JSON.stringify({ __v: saveRes.json.data.__v }),
        source: 'LpForm:submit',
        dedupe: false,
      },
    );
    setSubmitting(false);
    if (!submitRes.json.success) {
      setError(submitRes.json.message || lpI18n.submitFailed);
      return;
    }
    router.push(`/local-purchases/${docId}`);
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        saveDraft();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={common.documentDate}>
          <input
            type="date"
            className="input-field"
            value={header.documentDate}
            onChange={(e) => updateHeader({ documentDate: e.target.value })}
            required
          />
        </FormField>
        <FormField label={lpI18n.requiredDate}>
          <input
            type="date"
            className="input-field"
            value={header.requiredDate}
            onChange={(e) => updateHeader({ requiredDate: e.target.value })}
          />
        </FormField>
        <FormField label={common.project} className="sm:col-span-2">
          <ProjectSelect
            valueCode={header.projectCode}
            valueLabel={header.projectName || header.projectCode}
            onSelect={(code, label) =>
              updateHeader({ projectCode: code, projectName: label || code })
            }
          />
        </FormField>
        <FormField label={lpI18n.vendorName}>
          <input
            className="input-field"
            value={header.vendorName}
            onChange={(e) => updateHeader({ vendorName: e.target.value })}
            required
          />
        </FormField>
        <FormField label={lpI18n.vendorReference}>
          <input
            className="input-field"
            value={header.vendorReference}
            onChange={(e) => updateHeader({ vendorReference: e.target.value })}
          />
        </FormField>
        <FormField label={lpI18n.currency}>
          <select
            className="input-field"
            value={header.currency}
            onChange={(e) => updateHeader({ currency: e.target.value })}
          >
            <option value="USD">USD</option>
            <option value="EGP">EGP</option>
            <option value="SAR">SAR</option>
          </select>
        </FormField>
        <FormField label={lpI18n.exchangeRate}>
          <input
            type="number"
            min="0"
            step="0.0001"
            className="input-field"
            value={header.exchangeRate}
            onChange={(e) => updateHeader({ exchangeRate: e.target.value })}
          />
        </FormField>
        <FormField label={lpI18n.remarks} className="sm:col-span-2">
          <Textarea
            value={header.remarks}
            onChange={(e) => updateHeader({ remarks: e.target.value })}
          />
        </FormField>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{common.lines}</h3>
          <Button type="button" variant="secondary" onClick={addLine}>
            {lpI18n.addLine}
          </Button>
        </div>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="data-table">
            <thead>
              <tr>
                <th>{lpI18n.lineDescription}</th>
                <th>{lpI18n.uom}</th>
                <th>{lpI18n.quantity}</th>
                <th>{lpI18n.unitPrice}</th>
                <th>{common.total}</th>
                <th>{lpI18n.notes}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => {
                const lineTotal =
                  (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0);
                return (
                  <tr key={line._id || index}>
                    <td>
                      <input
                        className="input-field min-w-[12rem]"
                        value={line.description}
                        onChange={(e) => updateLine(index, { description: e.target.value })}
                        required
                      />
                    </td>
                    <td>
                      <input
                        className="input-field w-24"
                        value={line.uom}
                        onChange={(e) => updateLine(index, { uom: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        className="input-field w-24"
                        value={line.quantity}
                        onChange={(e) => updateLine(index, { quantity: e.target.value })}
                        required
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        className="input-field w-28"
                        value={line.unitPrice}
                        onChange={(e) => updateLine(index, { unitPrice: e.target.value })}
                        required
                      />
                    </td>
                    <td>{lineTotal.toFixed(2)}</td>
                    <td>
                      <input
                        className="input-field min-w-[8rem]"
                        value={line.notes}
                        onChange={(e) => updateLine(index, { notes: e.target.value })}
                      />
                    </td>
                    <td>
                      <Button type="button" variant="ghost" onClick={() => removeLine(index)}>
                        {common.delete}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-right text-sm font-medium">
          {common.total}: {documentTotal.toFixed(2)} {header.currency}
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {Object.keys(fieldErrors).length > 0 && (
        <ul className="text-sm text-red-600">
          {Object.entries(fieldErrors).map(([key, message]) => (
            <li key={key}>
              {key}: {message}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="secondary" loading={submitting}>
          {lpI18n.saveDraft}
        </Button>
        <Button type="button" variant="primary" loading={submitting} onClick={submitForApproval}>
          {mode === 'edit' && initialDoc?.status === 'rejected'
            ? lpI18n.resubmit
            : lpI18n.submitForApproval}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          {common.cancel}
        </Button>
      </div>
    </form>
  );
}
