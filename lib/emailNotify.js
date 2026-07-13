import '@/models/index.js';
import User from '@/models/User.js';
import Role from '@/models/Role.js';
import EmailGroup from '@/models/EmailGroup.js';
import { connectDB } from '@/lib/mongodb';
import { sendEmail } from '@/lib/email.js';
import { buildWorkflowEmail } from '@/lib/emailTemplates.js';
import {
  EVENT_FALLBACK_RECIPIENTS,
  WORKFLOW_EMAIL_EVENT_KEYS,
} from '@/lib/emailRecipientConfig.js';
import {
  dedupeEmailsCaseInsensitive,
  resolveActiveUserEmailsByPermission,
  resolveLpCompletionRecipientEmails,
} from '@/lib/lpEmailRecipients.js';
import { resolveWorkflowSapFailureRecipients } from '@/lib/workflowEmailRecipients.js';

export { WORKFLOW_EMAIL_EVENT_KEYS };

async function resolveRoleEmails(roleId) {
  const users = await User.find({ role: roleId, isActive: true }).lean();
  return users.map((u) => u.email).filter(Boolean);
}

async function resolveRoleNamesToEmails(roleNames) {
  if (!roleNames?.length) return [];
  const roles = await Role.find({ name: { $in: roleNames } }).lean();
  const emails = new Set();
  for (const role of roles) {
    const roleEmails = await resolveRoleEmails(role._id);
    roleEmails.forEach((e) => emails.add(e));
  }
  return [...emails];
}

async function resolveGroupRecipients(group) {
  const to = new Set();
  const cc = new Set();
  for (const r of group.recipients || []) {
    if (r.email) to.add(r.email.trim());
    if (r.role) {
      const roleEmails = await resolveRoleEmails(r.role);
      roleEmails.forEach((e) => to.add(e));
    }
    if (r.userId) {
      const user = await User.findById(r.userId).lean();
      if (user?.email) to.add(user.email);
    }
  }
  for (const roleId of group.ccRoles || []) {
    const roleEmails = await resolveRoleEmails(roleId);
    roleEmails.forEach((e) => cc.add(e));
  }
  return { to: [...to], cc: [...cc] };
}

/**
 * Resolve TO/CC for an event: EmailGroup override first, then matrix step context, then fallbacks.
 */
export async function resolveEventRecipients(eventKey, context = {}) {
  await connectDB();
  const group = await EmailGroup.findOne({ eventKey }).lean();
  let to = [];
  let cc = [];

  const hasActiveGroup = Boolean(group?.isActive);

  if (hasActiveGroup) {
    const resolved = await resolveGroupRecipients(group);
    to = resolved.to;
    cc = resolved.cc;
  }

  const hasGroupRecipients = to.length > 0 || cc.length > 0;

  if (!hasGroupRecipients) {
    if (context.stepRecipientEmails?.length) {
      to.push(...context.stepRecipientEmails);
    } else if (context.requiredPermission) {
      const permissionEmails = await resolveActiveUserEmailsByPermission(context.requiredPermission);
      to.push(...permissionEmails);
    }
  }

  if (!to.length && !cc.length) {
    const fallback = EVENT_FALLBACK_RECIPIENTS[eventKey];
    if (fallback?.roleNames?.length) {
      to = await resolveRoleNamesToEmails(fallback.roleNames);
    }
  }

  if (context.requesterEmail) {
    const fallback = EVENT_FALLBACK_RECIPIENTS[eventKey];
    if (fallback?.useRequester || !hasActiveGroup) {
      to.push(context.requesterEmail);
    }
  }

  if (context.extraTo?.length) {
    to.push(...context.extraTo);
  }

  if (eventKey === 'local_purchase.completed' && context.documentId) {
    const completionEmails = await resolveLpCompletionRecipientEmails(context.documentId, context);
    to.push(...completionEmails);
  }

  if ((eventKey === 'pr.sap.failed' || eventKey === 'po.sap.failed') && context.documentId) {
    const documentType = eventKey.startsWith('pr.') ? 'PR' : 'PO';
    const involvedEmails = await resolveWorkflowSapFailureRecipients({
      documentType,
      documentId: context.documentId,
      context,
    });
    to.push(...involvedEmails);
  }

  const uniqueTo = dedupeEmailsCaseInsensitive(to);
  const uniqueCc = dedupeEmailsCaseInsensitive(
    cc.filter((email) => !uniqueTo.some((item) => item.toLowerCase() === String(email).toLowerCase())),
  );

  return { to: uniqueTo, cc: uniqueCc };
}

export async function notifyEvent(
  eventKey,
  { subject, body, html, relatedDocumentType, relatedDocumentId, to, cc },
) {
  const recipients = to || [];
  const ccList = cc || [];
  return sendEmail({
    to: recipients,
    cc: ccList,
    subject,
    body,
    html,
    eventKey,
    relatedDocumentType,
    relatedDocumentId,
  });
}

/**
 * Build template, resolve recipients, send mail, log result. Never throws to callers.
 */
export async function notifyWorkflowEmail(eventKey, templateData = {}, related = {}) {
  try {
    const { subject, html, text } = buildWorkflowEmail(eventKey, templateData);
    const { to, cc } = await resolveEventRecipients(eventKey, templateData);
    const recipientCount = to.length + cc.length;

    if (!recipientCount) {
      const noRecipientsMsg = 'NO_ELIGIBLE_EMAIL_RECIPIENTS';
      const result = await notifyEvent(eventKey, {
        subject,
        body: text,
        html,
        to: [],
        cc: [],
        relatedDocumentType: related.documentType,
        relatedDocumentId: related.documentId,
      });
      return {
        ...result,
        attempted: true,
        recipientCount: 0,
        noRecipients: true,
        errorCode: noRecipientsMsg,
        warning: 'No eligible email recipients were found for this notification.',
      };
    }

    const result = await notifyEvent(eventKey, {
      subject,
      body: text,
      html,
      to,
      cc,
      relatedDocumentType: related.documentType,
      relatedDocumentId: related.documentId,
    });
    return {
      ...result,
      attempted: true,
      recipientCount: to.length,
      errorCode: result.success ? null : result.code || 'SMTP_SEND_FAILED',
    };
  } catch (err) {
    console.error(`[email] notifyWorkflowEmail failed for ${eventKey}:`, err.message);
    try {
      await sendEmail({
        to: [],
        cc: [],
        subject: `[Failed] ${eventKey}`,
        body: err.message || 'Notification failed',
        eventKey,
        relatedDocumentType: related.documentType,
        relatedDocumentId: related.documentId,
      });
    } catch {
      /* swallow */
    }
    return { sent: false, success: false, attempted: true, error: err.message, errorCode: 'NOTIFY_FAILED' };
  }
}

/**
 * Fire-and-forget wrapper — workflow code should not await email delivery.
 */
export function notifyWorkflowEmailSafe(eventKey, templateData, related) {
  notifyWorkflowEmail(eventKey, templateData, related).catch((err) => {
    console.error(`[email] background notify failed for ${eventKey}:`, err.message);
  });
}
