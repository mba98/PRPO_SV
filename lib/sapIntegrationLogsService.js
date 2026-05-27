import mongoose from 'mongoose';
import '@/models/index.js';
import SapIntegrationLog from '@/models/SapIntegrationLog.js';
import { connectDB } from '@/lib/mongodb';
import { buildPagination } from '@/lib/errors';
import { canViewSapIntegrationLogs } from '@/lib/visibilityFilters.js';
import { sanitizeLogPayload } from '@/lib/sap/sapIntegrationLog.js';

function forbidden() {
  const err = new Error('Forbidden');
  err.code = 'FORBIDDEN';
  throw err;
}

function sanitizeLog(row) {
  return {
    id: row._id.toString(),
    documentType: row.documentType,
    documentId: row.documentId?.toString() || null,
    action: row.action,
    requestPayload: sanitizeLogPayload(row.requestPayload),
    responsePayload: sanitizeLogPayload(row.responsePayload),
    sapDocEntry: row.sapDocEntry,
    sapDocNum: row.sapDocNum,
    status: row.status,
    errorMessage: row.errorMessage || null,
    createdAt: row.createdAt,
  };
}

export function buildSapLogFilter(searchParams) {
  const filter = {};
  const documentType = searchParams.get('documentType');
  if (documentType) filter.documentType = documentType;
  const documentId = searchParams.get('documentId');
  if (documentId && mongoose.Types.ObjectId.isValid(documentId)) {
    filter.documentId = new mongoose.Types.ObjectId(documentId);
  }
  const action = searchParams.get('action');
  if (action) filter.action = action;
  const status = searchParams.get('status') || searchParams.get('emailStatus');
  if (status) filter.status = status;
  const sapDocEntry = searchParams.get('sapDocEntry');
  if (sapDocEntry) filter.sapDocEntry = Number(sapDocEntry);
  const sapDocNum = searchParams.get('sapDocNum');
  if (sapDocNum) filter.sapDocNum = { $regex: sapDocNum, $options: 'i' };
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }
  const q = searchParams.get('q')?.trim();
  if (q) {
    filter.$or = [
      { action: { $regex: q, $options: 'i' } },
      { sapDocNum: { $regex: q, $options: 'i' } },
      { errorMessage: { $regex: q, $options: 'i' } },
    ];
  }
  return filter;
}

export async function listSapIntegrationLogs(user, { page, limit, sort, order, searchParams }) {
  await connectDB();
  if (!canViewSapIntegrationLogs(user)) forbidden();

  const filter = buildSapLogFilter(searchParams);
  const sortDir = order === 'asc' ? 1 : -1;
  const sortField = sort || 'createdAt';

  const [total, rows] = await Promise.all([
    SapIntegrationLog.countDocuments(filter),
    SapIntegrationLog.find(filter)
      .sort({ [sortField]: sortDir })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);

  return {
    items: rows.map(sanitizeLog),
    pagination: buildPagination(page, limit, total),
  };
}
