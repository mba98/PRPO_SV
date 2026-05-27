import mongoose from 'mongoose';
import '@/models/index.js';
import EmailGroup from '@/models/EmailGroup.js';
import Role from '@/models/Role.js';
import User from '@/models/User.js';
import { connectDB } from '@/lib/mongodb';
import { EVENT_LABELS } from '@/lib/emailRecipientConfig.js';

function notFound(message = 'Email group not found') {
  const err = new Error(message);
  err.code = 'NOT_FOUND';
  return err;
}

function duplicate(message = 'Email group already exists for this event') {
  const err = new Error(message);
  err.code = 'DUPLICATE_EMAIL_GROUP';
  return err;
}

async function populateRecipientLabels(recipients = []) {
  const rows = [];
  for (const r of recipients) {
    if (r.email) {
      rows.push({ type: 'email', email: r.email });
      continue;
    }
    if (r.userId) {
      const user = await User.findById(r.userId).select('name email username').lean();
      rows.push({
        type: 'user',
        userId: r.userId.toString(),
        label: user?.name || user?.email || user?.username || 'User',
        email: user?.email,
      });
      continue;
    }
    if (r.role) {
      const role = await Role.findById(r.role).select('name').lean();
      rows.push({
        type: 'role',
        role: r.role.toString(),
        label: role?.name || 'Role',
      });
    }
  }
  return rows;
}

function sanitizeGroup(doc, recipientLabels, ccRoleLabels) {
  return {
    id: doc._id.toString(),
    eventKey: doc.eventKey,
    label: EVENT_LABELS[doc.eventKey] || doc.eventKey,
    recipients: recipientLabels,
    ccRoles: (doc.ccRoles || []).map((id, i) => ({
      id: id.toString(),
      label: ccRoleLabels[i] || id.toString(),
    })),
    isActive: doc.isActive,
    updatedAt: doc.updatedAt,
  };
}

export async function listEmailGroups() {
  await connectDB();
  const groups = await EmailGroup.find().sort({ eventKey: 1 }).lean();
  const result = [];
  for (const g of groups) {
    const recipientLabels = await populateRecipientLabels(g.recipients);
    const ccRoles = await Role.find({ _id: { $in: g.ccRoles || [] } })
      .select('name')
      .lean();
    const ccRoleLabels = (g.ccRoles || []).map(
      (id) => ccRoles.find((r) => r._id.toString() === id.toString())?.name || id.toString(),
    );
    result.push(sanitizeGroup(g, recipientLabels, ccRoleLabels));
  }
  return result;
}

function mapRecipients(recipients = []) {
  return recipients.map((r) => ({
    email: r.email?.trim() || undefined,
    userId: r.userId ? new mongoose.Types.ObjectId(r.userId) : undefined,
    role: r.role ? new mongoose.Types.ObjectId(r.role) : undefined,
  }));
}

function mapCcRoles(ccRoles = []) {
  return ccRoles.map((id) => new mongoose.Types.ObjectId(id));
}

export async function createEmailGroup(data) {
  await connectDB();
  const existing = await EmailGroup.findOne({ eventKey: data.eventKey }).lean();
  if (existing) throw duplicate();

  const doc = await EmailGroup.create({
    eventKey: data.eventKey,
    recipients: mapRecipients(data.recipients),
    ccRoles: mapCcRoles(data.ccRoles),
    isActive: data.isActive !== false,
    updatedAt: new Date(),
  });
  const recipientLabels = await populateRecipientLabels(doc.recipients);
  return sanitizeGroup(doc.toObject(), recipientLabels, []);
}

export async function updateEmailGroup(id, data) {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(id)) throw notFound();
  const doc = await EmailGroup.findById(id);
  if (!doc) throw notFound();

  if (data.recipients !== undefined) doc.recipients = mapRecipients(data.recipients);
  if (data.ccRoles !== undefined) doc.ccRoles = mapCcRoles(data.ccRoles);
  if (data.isActive !== undefined) doc.isActive = data.isActive;
  doc.updatedAt = new Date();
  await doc.save();

  const lean = doc.toObject();
  const recipientLabels = await populateRecipientLabels(lean.recipients);
  const ccRoles = await Role.find({ _id: { $in: lean.ccRoles || [] } })
    .select('name')
    .lean();
  const ccRoleLabels = (lean.ccRoles || []).map(
    (rid) => ccRoles.find((r) => r._id.toString() === rid.toString())?.name || rid.toString(),
  );
  return sanitizeGroup(lean, recipientLabels, ccRoleLabels);
}
