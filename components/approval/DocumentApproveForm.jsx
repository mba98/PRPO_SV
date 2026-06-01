'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/apiClient';
import { uploadDocumentAttachments } from '@/lib/attachmentUploadHelpers';
import AttachmentDropzone from '@/components/attachments/AttachmentDropzone';
import { Button, FormField, PortalLoader, Textarea } from '@/components/ui';
import { useI18n } from '@/lib/hooks/useI18n';

const KIND_CONFIG = {
  PR: {
    apiBase: '/api/purchase-requests',
    documentType: 'PR',
    detailPath: (id) => `/purchase-requests/${id}`,
    numberField: 'portalPRNumber',
    titleFromApprove: 'prTitle',
    backLabel: 'backToPr',
    commentId: 'pr-approve-comment',
  },
  PO: {
    apiBase: '/api/purchase-orders',
    documentType: 'PO',
    detailPath: (id) => `/purchase-orders/${id}`,
    numberField: 'portalPONumber',
    titleFromApprove: 'poTitle',
    backLabel: 'backToPo',
    commentId: 'po-approve-comment',
  },
};

export default function DocumentApproveForm({ id, kind = 'PR' }) {
  const config = KIND_CONFIG[kind] || KIND_CONFIG.PR;
  const router = useRouter();
  const { approval: appr, attachments: att, pr: prI18n, common, approve: approveNs, detail } = useI18n();
  const [doc, setDoc] = useState(null);
  const [comment, setComment] = useState('');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submittingAction, setSubmittingAction] = useState(null);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');

  const detailPath = config.detailPath(id);
  const pageTitle = approveNs[config.titleFromApprove] || appr.title;
  const backLabel = appr[config.backLabel] || appr.cancel;

  useEffect(() => {
    (async () => {
      const { json } = await apiFetch(`${config.apiBase}/${id}`);
      if (json.success) setDoc(json.data);
      else setError(json.message || common.errorLoad);
      setLoading(false);
    })();
  }, [id, config.apiBase, common.errorLoad]);

  async function handleAction(action) {
    if (submittingAction) return;
    if (!doc?.canApproveCurrentStep) {
      setError(appr.cannotAct);
      return;
    }

    setSubmittingAction(action);
    setError('');
    setWarning('');

    const endpoint = action === 'approve' ? 'approve' : 'reject';

    try {
      const { json } = await apiFetch(`${config.apiBase}/${id}/${endpoint}`, {
        method: 'POST',
        body: JSON.stringify({ comment, __v: doc.__v }),
      });

      if (!json.success) {
        setError(json.message || appr.submitError);
        setSubmittingAction(null);
        return;
      }

      if (files.length) {
        const { failures } = await uploadDocumentAttachments({
          documentType: config.documentType,
          documentId: id,
          files,
          approvalStep: String(doc.currentApprovalStep),
        });
        if (failures.length) {
          router.push(
            `${detailPath}?attachmentWarning=${encodeURIComponent(appr.attachmentUploadWarning)}`,
          );
          return;
        }
      }

      router.push(detailPath);
    } catch (err) {
      setError(err.message || appr.submitError);
      setSubmittingAction(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <PortalLoader />
      </div>
    );
  }

  if (!doc) {
    return <p className="text-sm text-destructive">{error || detail.notFound}</p>;
  }

  const canAct = doc.canApproveCurrentStep === true;
  const currentStep = doc.workflowSteps?.find((s) => s.state === 'current');
  const waitingLabel = currentStep?.stepName
    ? `${appr.waitingFor}: ${currentStep.stepName}`
    : appr.waitingFor;

  const dropHint = `${att.dragApprovalHint} — ${att.dragHint}`;
  const portalNumber = doc[config.numberField];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <p className="text-sm text-muted-foreground">
        <Link href={detailPath} className="text-primary hover:underline">
          {portalNumber}
        </Link>
      </p>
      <h1 className="text-xl font-semibold text-foreground sm:text-2xl">{pageTitle}</h1>
      <p className="text-sm text-muted-foreground">
        {common.status}: <strong>{doc.status}</strong> · {doc.currentApprovalStep}
        {doc.currentStepName && (
          <span className="ms-2 text-muted-foreground">({doc.currentStepName})</span>
        )}
      </p>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {warning && (
        <p
          role="status"
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200"
        >
          {warning}
        </p>
      )}

      {!canAct ? (
        <div className="rounded-3xl border border-border bg-card p-4 shadow-xl shadow-black/5 sm:p-5">
          <p className="text-sm text-foreground">{waitingLabel}</p>
          <Link href={detailPath} className="btn-secondary mt-4 inline-flex">
            {backLabel}
          </Link>
        </div>
      ) : (
        <div className="space-y-4 rounded-3xl border border-border bg-card p-4 shadow-xl shadow-black/5 sm:p-5">
          <FormField label={appr.comment} htmlFor={config.commentId}>
            <Textarea
              id={config.commentId}
              value={comment}
              placeholder={appr.commentPlaceholder}
              onChange={(e) => setComment(e.target.value)}
              disabled={!!submittingAction}
            />
          </FormField>

          <div className="space-y-2">
            <p className="form-label">{appr.attachments}</p>
            <p className="text-xs text-muted-foreground">{appr.attachmentsOptional}</p>
            <AttachmentDropzone
              mode="staged"
              files={files}
              onFilesChange={setFiles}
              dropLabel={att.dragTitle}
              dropHint={dropHint}
              removeFileLabel={att.removeFile}
              fileTooLargeMessage={prI18n.create.fileTooLarge}
              fileTypeMessage={prI18n.create.fileTypeNotAllowed}
              disabled={!!submittingAction}
            />
            <p className="text-xs text-muted-foreground">{appr.filesUploadAfterAction}</p>
          </div>

          <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:flex-wrap">
            <Button
              type="button"
              variant="primary"
              className="w-full sm:w-auto"
              loading={submittingAction === 'approve'}
              disabled={!!submittingAction}
              onClick={() => handleAction('approve')}
            >
              {submittingAction === 'approve' ? appr.approving : appr.approve}
            </Button>
            <Button
              type="button"
              variant="danger"
              className="w-full sm:w-auto"
              loading={submittingAction === 'reject'}
              disabled={!!submittingAction}
              onClick={() => handleAction('reject')}
            >
              {submittingAction === 'reject' ? appr.rejecting : appr.reject}
            </Button>
            <Link
              href={detailPath}
              className={`btn-secondary inline-flex w-full items-center justify-center sm:w-auto ${
                submittingAction ? 'pointer-events-none opacity-50' : ''
              }`}
              aria-disabled={!!submittingAction}
              tabIndex={submittingAction ? -1 : undefined}
            >
              {appr.cancel}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
