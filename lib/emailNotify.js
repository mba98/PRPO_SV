import '@/models/index.js';
import User from '@/models/User.js';
import EmailGroup from '@/models/EmailGroup.js';
import { connectDB } from '@/lib/mongodb';
import { sendEmail } from '@/lib/email.js';

async function resolveRoleEmails(roleId) {
  const users = await User.find({ role: roleId, isActive: true }).lean();
  return users.map((u) => u.email).filter(Boolean);
}

export async function resolveEventRecipients(eventKey) {
  await connectDB();
  const group = await EmailGroup.findOne({ eventKey, isActive: true }).lean();
  if (!group) return [];

  const emails = new Set();
  for (const r of group.recipients || []) {
    if (r.email) emails.add(r.email);
    if (r.role) {
      const roleEmails = await resolveRoleEmails(r.role);
      roleEmails.forEach((e) => emails.add(e));
    }
    if (r.userId) {
      const user = await User.findById(r.userId).lean();
      if (user?.email) emails.add(user.email);
    }
  }
  for (const roleId of group.ccRoles || []) {
    const roleEmails = await resolveRoleEmails(roleId);
    roleEmails.forEach((e) => emails.add(e));
  }
  return [...emails];
}

export async function notifyEvent(eventKey, { subject, body, relatedDocumentType, relatedDocumentId }) {
  const to = await resolveEventRecipients(eventKey);
  if (!to.length) {
    await sendEmail({
      to: [],
      subject,
      body,
      relatedDocumentType,
      relatedDocumentId,
    });
    return { sent: false, reason: 'No recipients resolved' };
  }
  const result = await sendEmail({
    to,
    subject,
    body,
    relatedDocumentType,
    relatedDocumentId,
  });
  return { sent: result.success, to };
}
