'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/apiClient';
import { Button, FormField, Textarea } from '@/components/ui';
import { useI18n } from '@/lib/hooks/useI18n';
import { extractLocalPurchaseDocument } from '@/lib/localPurchaseDocument.js';
import { fetchPortalDocument } from '@/lib/hooks/usePortalDocument';
import { primePortalDocument, invalidatePortalDocument } from '@/lib/documentClientCache';
import { useAuthStore } from '@/stores/authStore';
import { formatMoneyWithCurrency, LP_CURRENCIES } from '@/lib/lpMoney';
import MoneyInput from '@/components/local-purchases/MoneyInput';

const EMPTY_LINE = () => ({
  description: '',
  quantity: 1,
  unitPrice: 0,
  notes: '',
});

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function logSaveVersion(localPurchase, payload, responseDoc) {
  if (process.env.NODE_ENV !== 'development') return;
  console.log('Local Purchase save version', {
    documentId: localPurchase?.id || localPurchase?._id,
    formVersion: localPurchase?.__v,
    payloadVersion: payload?.__v,
    latestResponseVersion: responseDoc?.__v,
  });
}

export default function LpForm({ mode = 'create', initialDoc = null, onDocumentChange }) {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const { common, lp: lpI18n } = useI18n();
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [conflictMessage, setConflictMessage] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [currencyWarning, setCurrencyWarning] = useState(false);

  const [localPurchase, setLocalPurchase] = useState(initialDoc);
  const documentRef = useRef(localPurchase);
  const formVersionRef = useRef(initialDoc?.__v ?? null);

  const isEdit = Boolean(localPurchase?.id);
  const documentId = localPurchase?.id;

  useEffect(() => {
    documentRef.current = localPurchase;
    if (localPurchase?.__v != null) {
      formVersionRef.current = localPurchase.__v;
    }
  }, [localPurchase]);

  const [header, setHeader] = useState(() => ({
    documentDate: initialDoc?.documentDate
      ? new Date(initialDoc.documentDate).toISOString().slice(0, 10)
      : todayInputValue(),
    currency: initialDoc?.currency || 'IQD',
    budget: initialDoc?.budget ?? 0,
    remarks: initialDoc?.remarks || '',
  }));

  const [lines, setLines] = useState(() =>
    initialDoc?.lines?.length
      ? initialDoc.lines.map((line) => ({
          _id: line._id,
          description: line.description || '',
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

  const hasMonetaryValues =
    Number(header.budget) > 0 ||
    lines.some((line) => Number(line.unitPrice) > 0 || Number(line.quantity) * Number(line.unitPrice) > 0);

  function applyDocumentUpdate(updatedDocument) {
    if (!updatedDocument) return;
    setLocalPurchase(updatedDocument);
    formVersionRef.current = updatedDocument.__v;
    documentRef.current = updatedDocument;
    if (documentId || updatedDocument.id) {
      primePortalDocument('LOCAL_PURCHASE', updatedDocument.id, updatedDocument, userId);
    }
    onDocumentChange?.(updatedDocument);
  }

  function updateHeader(patch) {
    if (patch.currency != null && patch.currency !== header.currency && hasMonetaryValues) {
      setCurrencyWarning(true);
    }
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
    const payload = {
      documentDate: header.documentDate,
      currency: header.currency,
      budget: Number(header.budget),
      remarks: header.remarks || undefined,
      lines: lines.map(({ _id, ...line }) => ({
        ...(_id ? { _id } : {}),
        description: line.description,
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice),
        notes: line.notes || undefined,
      })),
    };
    if (isEdit && formVersionRef.current != null) {
      payload.__v = formVersionRef.current;
    }
    return payload;
  }

  async function refreshLatestVersion() {
    if (!documentId || !userId) return null;
    invalidatePortalDocument('LOCAL_PURCHASE', documentId, userId);
    const latest = await fetchPortalDocument(
      'LOCAL_PURCHASE',
      documentId,
      'LpForm:conflict-refresh',
      userId,
    );
    if (latest?.__v != null) {
      formVersionRef.current = latest.__v;
      documentRef.current = { ...documentRef.current, __v: latest.__v };
    }
    return latest;
  }

  async function persistDocument({ redirectAfter = false, forSubmit = false } = {}) {
    if (isSaving || isSubmitting) return null;

    if (forSubmit) {
      setIsSubmitting(true);
    } else {
      setIsSaving(true);
    }
    setError('');
    setConflictMessage('');
    setSaveMessage('');
    setFieldErrors({});

    const payload = buildPayload();
    const endpoint = isEdit ? `/api/local-purchases/${documentId}` : '/api/local-purchases';
    const method = isEdit ? 'PATCH' : 'POST';

    const { json, status } = await apiFetch(endpoint, {
      method,
      body: JSON.stringify(payload),
      source: forSubmit ? 'LpForm:submit-save' : 'LpForm:save',
      dedupe: false,
    });

    const updatedDocument = extractLocalPurchaseDocument(json.data);
    logSaveVersion(documentRef.current, payload, updatedDocument);

    if (!json.success) {
      if (status === 409 && json.error === 'VERSION_CONFLICT') {
        await refreshLatestVersion();
        setConflictMessage(lpI18n.versionConflict);
      } else {
        if (json.errors) setFieldErrors(json.errors);
        setError(json.message || lpI18n.saveFailed);
      }
      if (forSubmit) setIsSubmitting(false);
      else setIsSaving(false);
      return null;
    }

    applyDocumentUpdate(updatedDocument);

    if (forSubmit) {
      // keep isSubmitting true until submit completes
    } else {
      setIsSaving(false);
      setSaveMessage(lpI18n.saveDraftSuccess);
    }

    if (!forSubmit && !isEdit && updatedDocument?.id) {
      router.replace(`/local-purchases/${updatedDocument.id}/edit`);
    } else if (!forSubmit && redirectAfter && updatedDocument?.id) {
      router.push(`/local-purchases/${updatedDocument.id}`);
    }

    return updatedDocument;
  }

  async function handleSaveDraft() {
    if (isSaving || isSubmitting) return;
    await persistDocument();
  }

  async function handleSubmitForApproval() {
    if (isSaving || isSubmitting) return;

    const saved = await persistDocument({ forSubmit: true });
    if (!saved) {
      setIsSubmitting(false);
      return;
    }

    const docId = saved.id;
    const submitEndpoint =
      isEdit && localPurchase?.status === 'rejected'
        ? `/api/local-purchases/${docId}/resubmit`
        : `/api/local-purchases/${docId}/submit`;

    const submitRes = await apiFetch(submitEndpoint, {
      method: 'POST',
      body: JSON.stringify({ __v: saved.__v }),
      source: 'LpForm:submit',
      dedupe: false,
    });

    setIsSubmitting(false);

    if (!submitRes.json.success) {
      if (submitRes.status === 409 && submitRes.json.error === 'VERSION_CONFLICT') {
        await refreshLatestVersion();
        setConflictMessage(lpI18n.versionConflict);
      } else {
        setError(submitRes.json.message || lpI18n.submitFailed);
      }
      return;
    }

    const submittedDocument = extractLocalPurchaseDocument(submitRes.json.data);
    if (submittedDocument) {
      applyDocumentUpdate(submittedDocument);
    }
    router.push(`/local-purchases/${docId}`);
  }

  const currency = header.currency || 'IQD';

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label={lpI18n.requestDate}>
          <input
            type="date"
            className="input-field"
            value={header.documentDate}
            onChange={(e) => updateHeader({ documentDate: e.target.value })}
            required
            disabled={isSaving || isSubmitting}
          />
        </FormField>
        <FormField label={lpI18n.currency}>
          <select
            className="input-field"
            value={header.currency}
            onChange={(e) => updateHeader({ currency: e.target.value })}
            required
            disabled={isSaving || isSubmitting}
          >
            {LP_CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code === 'IQD' ? lpI18n.currencyIqd : lpI18n.currencyUsd}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label={lpI18n.budget}>
          <MoneyInput
            value={header.budget}
            currency={currency}
            onChange={(value) => updateHeader({ budget: value })}
            required
            disabled={isSaving || isSubmitting}
          />
        </FormField>
        {currencyWarning && (
          <p className="sm:col-span-3 text-sm text-amber-700">{lpI18n.currencyChangeWarning}</p>
        )}
        <FormField label={lpI18n.remarks} className="sm:col-span-3">
          <Textarea
            value={header.remarks}
            onChange={(e) => updateHeader({ remarks: e.target.value })}
            disabled={isSaving || isSubmitting}
          />
        </FormField>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{common.lines}</h3>
          <Button
            type="button"
            variant="secondary"
            onClick={addLine}
            disabled={isSaving || isSubmitting}
          >
            {lpI18n.addLine}
          </Button>
        </div>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>{lpI18n.item}</th>
                <th>{lpI18n.quantity}</th>
                <th>{lpI18n.estimatedPrice}</th>
                <th>{lpI18n.lineNotes}</th>
                <th>{lpI18n.lineTotal}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => {
                const lineTotal =
                  (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0);
                return (
                  <tr key={line._id || index}>
                    <td>{index + 1}</td>
                    <td>
                      <input
                        className="input-field min-w-[12rem]"
                        value={line.description}
                        onChange={(e) => updateLine(index, { description: e.target.value })}
                        required
                        disabled={isSaving || isSubmitting}
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
                        disabled={isSaving || isSubmitting}
                      />
                    </td>
                    <td>
                      <MoneyInput
                        className="input-field w-28"
                        value={line.unitPrice}
                        currency={currency}
                        onChange={(value) => updateLine(index, { unitPrice: value })}
                        required
                        disabled={isSaving || isSubmitting}
                      />
                    </td>
                    <td>
                      <input
                        className="input-field min-w-[8rem]"
                        value={line.notes}
                        onChange={(e) => updateLine(index, { notes: e.target.value })}
                        disabled={isSaving || isSubmitting}
                      />
                    </td>
                    <td>{formatMoneyWithCurrency(lineTotal, currency)}</td>
                    <td>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => removeLine(index)}
                        disabled={isSaving || isSubmitting}
                      >
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
          {lpI18n.documentTotal}: {formatMoneyWithCurrency(documentTotal, currency)}
        </p>
      </div>

      {saveMessage && <p className="text-sm text-green-700">{saveMessage}</p>}
      {conflictMessage && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800">
          {conflictMessage}
        </p>
      )}
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
        <Button
          type="button"
          variant="secondary"
          loading={isSaving}
          disabled={isSaving || isSubmitting}
          onClick={handleSaveDraft}
        >
          {lpI18n.saveDraft}
        </Button>
        <Button
          type="button"
          variant="primary"
          loading={isSubmitting}
          disabled={isSaving || isSubmitting}
          onClick={handleSubmitForApproval}
        >
          {isEdit && localPurchase?.status === 'rejected'
            ? lpI18n.resubmit
            : lpI18n.submitForApproval}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={isSaving || isSubmitting}>
          {common.cancel}
        </Button>
      </div>
    </div>
  );
}
