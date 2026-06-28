import '@/models/index.js';
import User from '@/models/User.js';
import { connectDB } from '@/lib/mongodb';
import { getApprovalHistory } from '@/lib/auditHistory.js';
import { getApprovalSteps } from '@/lib/approvalEngine.js';
import {
  dedupeEmailsCaseInsensitive,
  resolveActiveUserEmailsByPermission,
  resolveApprovalStepRecipientEmails,
} from '@/lib/lpEmailRecipients.js';

function isValidEmailAddress(email) {
  const trimmed = String(email || '').trim();
  return trimmed.length > 3 && trimmed.includes('@');
}

/**
 * Emails of users who acted on a document (approval history).
 */
export async function resolveApprovalHistoryActorEmails(documentType, documentId) {
  if (!documentId) return [];
  await connectDB();
  const history = await getApprovalHistory(documentType, documentId);
  const userIds = [
    ...new Set(
      history
        .map((entry) => entry.actionBy?._id?.toString?.() || entry.actionBy?.toString?.())
        .filter(Boolean),
    ),
  ];
  if (!userIds.length) return [];
  const users = await User.find({
    _id: { $in: userIds },
    isActive: true,
    email: { $exists: true, $ne: '' },
  })
    .select('email')
    .lean();
  return dedupeEmailsCaseInsensitive(users.map((user) => user.email));
}

/**
 * All users involved in a PR/PO workflow for SAP failure notifications.
 * Includes creator/requester, procurement (PO), approvers from history,
 * and active users for each approval-matrix step.
 */
export async function resolveWorkflowSapFailureRecipients({
  documentType,
  documentId,
  context = {},
}) {
  const docType = String(documentType || 'PR').toUpperCase();
  const emails = [];

  if (context.requesterEmail) emails.push(context.requesterEmail);
  if (context.creatorEmail) emails.push(context.creatorEmail);

  emails.push(...(await resolveApprovalHistoryActorEmails(docType, documentId)));

  if (docType === 'PO') {
    emails.push(...(await resolveActiveUserEmailsByPermission('po.create')));
  }

  const steps = await getApprovalSteps(docType);
  for (const step of steps) {
    if (step.isActive === false) continue;
    const { emails: stepEmails } = await resolveApprovalStepRecipientEmails(step);
    emails.push(...stepEmails);
  }

  if (context.extraTo?.length) {
    emails.push(...context.extraTo.filter(isValidEmailAddress));
  }

  return dedupeEmailsCaseInsensitive(emails);
}
