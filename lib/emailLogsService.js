import mongoose from 'mongoose';
import '@/models/index.js';
import EmailLog from '@/models/EmailLog.js';
import { connectDB } from '@/lib/mongodb';
import { buildPagination } from '@/lib/errors';

function sanitizeLog(row) {
  return {
    id: row._id.toString(),
    eventKey: row.eventKey || null,
    to: row.to || [],
    cc: row.cc || [],
    subject: row.subject,
    body: row.body,
    relatedDocumentType: row.relatedDocumentType,
    relatedDocumentId: row.relatedDocumentId?.toString() || null,
    emailStatus: row.emailStatus,
    sentAt: row.sentAt,
    errorMessage: row.errorMessage || null,
  };
}

export async function listEmailLogs({
  page = 1,
  limit = 25,
  eventKey,
  relatedDocumentType,
  relatedDocumentId,
  emailStatus,
  from,
  to,
}) {
  await connectDB();
  const filter = {};
  if (eventKey) filter.eventKey = eventKey;
  if (relatedDocumentType) filter.relatedDocumentType = relatedDocumentType;
  if (relatedDocumentId) {
    if (mongoose.Types.ObjectId.isValid(relatedDocumentId)) {
      filter.relatedDocumentId = new mongoose.Types.ObjectId(relatedDocumentId);
    }
  }
  if (emailStatus) filter.emailStatus = emailStatus;
  if (from || to) {
    filter.sentAt = {};
    if (from) filter.sentAt.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      filter.sentAt.$lte = end;
    }
  }

  const [total, rows] = await Promise.all([
    EmailLog.countDocuments(filter),
    EmailLog.find(filter)
      .sort({ sentAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);

  return {
    items: rows.map(sanitizeLog),
    pagination: buildPagination(page, limit, total),
  };
}
