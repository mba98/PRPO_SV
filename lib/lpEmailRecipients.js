import '@/models/index.js';
import User from '@/models/User.js';
import Role from '@/models/Role.js';
import { connectDB } from '@/lib/mongodb';
import { getEffectivePermissions, userHasEffectivePermission } from '@/lib/effectivePermissions.js';
import { getApprovalHistory } from '@/lib/auditHistory.js';

function normalizeRoleId(role) {
  if (!role) return null;
  if (typeof role === 'object' && role._id) return role._id;
  return role;
}

function isValidEmailAddress(email) {
  const trimmed = String(email || '').trim();
  return trimmed.length > 3 && trimmed.includes('@');
}

export function dedupeEmailsCaseInsensitive(emails = []) {
  const seen = new Set();
  const result = [];
  for (const email of emails) {
    const trimmed = String(email || '').trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

/**
 * Active users who hold a permission via role or direct assignment.
 */
export async function resolveActiveUserEmailsByPermission(requiredPermission) {
  if (!requiredPermission) return [];
  await connectDB();
  const roles = await Role.find({ permissions: requiredPermission }).select('_id permissions').lean();
  const roleIds = roles.map((role) => role._id);
  const users = await User.find({
    isActive: true,
    email: { $exists: true, $ne: '' },
    $or: [{ role: { $in: roleIds } }, { permissions: requiredPermission }],
  })
    .populate('role', 'name permissions')
    .select('email role permissions')
    .lean();

  return dedupeEmailsCaseInsensitive(
    users
      .filter((user) => userHasEffectivePermission(user, requiredPermission))
      .map((user) => user.email)
      .filter(isValidEmailAddress),
  );
}

/**
 * Resolve recipients for an approval-matrix step: active users on approverRole with requiredPermission.
 */
export async function resolveApprovalStepRecipientEmails(step) {
  if (!step?.requiredPermission) {
    return {
      emails: [],
      eligibleUsers: 0,
      requiredPermission: null,
      approverRoleId: null,
      approverRoleName: null,
    };
  }

  await connectDB();
  const requiredPermission = step.requiredPermission;
  const approverRoleId = normalizeRoleId(step.approverRole);

  const query = {
    isActive: true,
    email: { $exists: true, $ne: '' },
  };
  if (approverRoleId) {
    query.role = approverRoleId;
  }

  const users = await User.find(query)
    .populate('role', 'name permissions')
    .select('email role permissions')
    .lean();

  const eligible = users.filter(
    (user) =>
      isValidEmailAddress(user.email) && userHasEffectivePermission(user, requiredPermission),
  );

  return {
    emails: dedupeEmailsCaseInsensitive(eligible.map((user) => user.email)),
    eligibleUsers: eligible.length,
    requiredPermission,
    approverRoleId: approverRoleId?.toString?.() || null,
    approverRoleName: step.approverRole?.name || eligible[0]?.role?.name || null,
  };
}

/**
 * Emails of users who acted on this Local Purchase (approval history).
 */
export async function resolveLpApprovalHistoryActorEmails(documentId) {
  if (!documentId) return [];
  await connectDB();
  const history = await getApprovalHistory('LOCAL_PURCHASE', documentId);
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
 * Creator + approval-history actors + optional extras (deduped).
 */
export async function resolveLpCompletionRecipientEmails(documentId, context = {}) {
  const emails = [];
  if (context.creatorEmail) emails.push(context.creatorEmail);
  if (context.requesterEmail) emails.push(context.requesterEmail);
  emails.push(...(await resolveLpApprovalHistoryActorEmails(documentId)));
  if (context.extraTo?.length) emails.push(...context.extraTo);
  return dedupeEmailsCaseInsensitive(emails);
}
