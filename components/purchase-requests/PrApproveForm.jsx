'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/apiClient';
import { uploadDocumentAttachments } from '@/lib/attachmentUploadHelpers';
import AttachmentDropzone from '@/components/attachments/AttachmentDropzone';
import { Button, FormField, PortalLoader } from '@/components/ui';
import { useI18n } from '@/lib/hooks/useI18n';

export default function PrApproveForm({ id }) {
  const router = useRouter();
  const { approval: appr, attachments: att, pr: prI18n, common, approve: approveNs, detail } = useI18n();
  const [pr, setPr] = useState(null);
  const [comment, setComment] = useState('');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submittingAction, setSubmittingAction] = useState(null);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');

  useEffect(() => {
    (async () => {
      const { json } = await apiFetch(`/api/purchase-requests/${id}`);
      if (json.success) setPr(json.data);
      else setError(json.message || common.errorLoad);
      setLoading(false);
    })();
  }, [id, common.errorLoad]);

  async function handleAction(action) {
    if (submittingAction) return;
    if (!pr?.canApproveCurrentStep) {
      setError(appr.cannotAct);
      return;
    }

    setSubmittingAction(action);
    setError('');
    setWarning('');

    const endpoint = action === 'approve' ? 'approve' : 'reject';

    try {
      const { json } = await apiFetch(`/api/purchase-requests/${id}/${endpoint}`, {
        method: 'POST',
        body: JSON.stringify({ comment, __v: pr.__v }),
      });

      if (!json.success) {
        setError(json.message || appr.submitError);
        setSubmittingAction(null);
        return;
      }

      if (files.length) {
        const { failures } = await uploadDocumentAttachments({
          documentType: 'PR',
          documentId: id,
          files,
          approvalStep: String(pr.currentApprovalStep),
        });
        if (failures.length) {
          router.push(
            `/purchase-requests/${id}?attachmentWarning=${encodeURIComponent(appr.attachmentUploadWarning)}`,
          );
          return;
        }
      }

      router.push(`/purchase-requests/${id}`);
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

  if (!pr) {
    return <p className="text-sm text-destructive">{error || detail.notFound}</p>;
  }

  const canAct = pr.canApproveCurrentStep === true;
  const currentStep = pr.workflowSteps?.find((s) => s.state === 'current');
  const waitingLabel = currentStep?.stepName
    ? `${appr.waitingFor}: ${currentStep.stepName}`
    : appr.waitingFor;

  const dropHint = `${att.dragApprovalHint} — ${att.dragHint}`;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <p className="text-sm text-muted-foreground">
        <Link href={`/purchase-requests/${id}`} className="text-primary hover:underline">
          {pr.portalPRNumber}
        </Link>
      </p>
      <h1 className="text-xl font-semibold text-foreground sm:text-2xl">
        {approveNs.prTitle || appr.title}
      </h1>
      <p className="text-sm text-muted-foreground">
        {common.status}: <strong>{pr.status}</strong> · {pr.currentApprovalStep}
      </p>

      {error && (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {warning && (
        <p role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
          {warning}
        </p>
      )}

      {!canAct ? (
        <div className="rounded-3xl border border-border bg-card p-4 shadow-xl shadow-black/5 sm:p-5">
          <p className="text-sm text-foreground">{waitingLabel}</p>
          <Link href={`/purchase-requests/${id}`} className="btn-secondary mt-4 inline-flex">
            {appr.backToPr}
          </Link>
        </div>
      ) : (
        <div className="space-y-4 rounded-3xl border border-border bg-card p-4 shadow-xl shadow-black/5 sm:p-5">
          <FormField label={appr.comment} htmlFor="pr-approve-comment">
            <textarea
              id="pr-approve-comment"
              className="input min-h-[96px] w-full"
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
              href={`/purchase-requests/${id}`}
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
