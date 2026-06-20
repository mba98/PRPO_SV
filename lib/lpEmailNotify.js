import { getCurrentStep } from '@/lib/approvalEngine.js';
import { buildLpEmailContext } from '@/lib/lpEmailContext.js';
import { notifyWorkflowEmail } from '@/lib/emailNotify.js';
import { resolveApprovalStepRecipientEmails } from '@/lib/lpEmailRecipients.js';

const SUBMIT_WARNING =
  'The request was submitted, but the notification email could not be delivered.';

export function buildLpNotificationSummary(eventKey, emailResult, recipientCount) {
  const sent = emailResult?.success === true;
  const warning =
    emailResult?.warning ||
    (emailResult?.attempted && !sent
      ? emailResult?.noRecipients
        ? 'No eligible email recipients were found for this notification.'
        : SUBMIT_WARNING
      : null);

  return {
    event: eventKey,
    attempted: emailResult?.attempted !== false,
    sent,
    recipientCount: recipientCount ?? emailResult?.recipientCount ?? 0,
    warning: sent ? null : warning,
    errorCode: emailResult?.errorCode || null,
  };
}

function logLpEmailDiagnostics({
  event,
  documentId,
  portalNumber,
  step,
  stepResolution,
  recipients,
  emailResult,
}) {
  if (process.env.NODE_ENV === 'production') return;

  const payload = {
    event,
    documentId,
    portalNumber,
    stepOrder: step?.stepOrder ?? null,
    requiredPermission: step?.requiredPermission ?? null,
    approverRole: step?.approverRole?.name ?? stepResolution?.approverRoleName ?? null,
    eligibleUsers: stepResolution?.eligibleUsers ?? 0,
    validRecipients: recipients,
    emailSent: emailResult?.success === true,
    emailError: emailResult?.errorCode || emailResult?.error || null,
  };

  if (!recipients?.length) {
    console.warn('NO_ELIGIBLE_EMAIL_RECIPIENTS', payload);
  } else {
    console.log('Local Purchase email notification', payload);
  }
}

/**
 * Send a Local Purchase workflow email using the active approval-matrix step when provided.
 */
export async function sendLocalPurchaseWorkflowEmail(
  eventKey,
  templateData,
  related,
  { step, document } = {},
) {
  let stepResolution = { emails: [], eligibleUsers: 0 };
  if (step) {
    stepResolution = await resolveApprovalStepRecipientEmails(step);
  }

  const context = {
    ...templateData,
    requiredPermission: step?.requiredPermission || templateData.requiredPermission,
    stepRecipientEmails: stepResolution.emails,
  };

  const emailResult = await notifyWorkflowEmail(eventKey, context, related);
  const recipientCount = emailResult?.recipientCount ?? stepResolution.emails.length;

  logLpEmailDiagnostics({
    event: eventKey,
    documentId: related?.documentId || templateData.documentId,
    portalNumber: document?.portalLPNumber || templateData.portalLPNumber,
    step,
    stepResolution,
    recipients: stepResolution.emails,
    emailResult,
  });

  return {
    emailResult,
    notification: buildLpNotificationSummary(eventKey, emailResult, recipientCount),
  };
}

export async function sendLocalPurchaseSubmitEmail(doc, populated, steps, { isResubmit, previousRejectionReason }) {
  const step = getCurrentStep(steps, doc.currentApprovalStep);
  const docId = doc._id.toString();
  const emailMeta = { documentType: 'LOCAL_PURCHASE', documentId: docId };

  if (isResubmit) {
    return sendLocalPurchaseWorkflowEmail(
      'local_purchase.resubmitted',
      buildLpEmailContext(populated, { previousRejectionReason }),
      emailMeta,
      { step, document: populated },
    );
  }

  return sendLocalPurchaseWorkflowEmail(
    'local_purchase.pending_pm',
    buildLpEmailContext(populated),
    emailMeta,
    { step, document: populated },
  );
}
