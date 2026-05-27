/**
 * Shared list query parsing with safe sort whitelists.
 */

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const MAX_EXPORT_LIMIT = 5000;

export const PR_SORT_FIELDS = [
  'createdAt',
  'portalPRNumber',
  'status',
  'department',
  'project',
  'requiredDate',
  'sapPRDocNum',
];

export const PO_SORT_FIELDS = [
  'createdAt',
  'portalPONumber',
  'status',
  'vendor',
  'relatedPRNumber',
  'documentDate',
  'sapPODocNum',
];

export const APRI_SORT_FIELDS = [
  'createdAt',
  'portalAPNumber',
  'status',
  'vendor',
  'relatedPONumber',
  'documentDate',
  'sapAPDocNum',
];

export const SAP_LOG_SORT_FIELDS = [
  'createdAt',
  'documentType',
  'action',
  'status',
  'sapDocEntry',
  'sapDocNum',
];

export const EMAIL_LOG_SORT_FIELDS = ['sentAt', 'eventKey', 'emailStatus', 'subject'];

export function resolveSortField(sort, allowed, defaultField = 'createdAt') {
  if (sort && allowed.includes(sort)) return sort;
  return defaultField;
}

/**
 * Parse list query params from a Request URL.
 */
export function parseListQuery(request, { maxLimit = MAX_LIMIT } = {}) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(
    1,
    parseInt(searchParams.get('page') || String(DEFAULT_PAGE), 10) || DEFAULT_PAGE,
  );
  const limit = Math.min(
    maxLimit,
    Math.max(1, parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT),
  );
  const sort = searchParams.get('sort') || undefined;
  const order = searchParams.get('order') === 'asc' ? 'asc' : 'desc';
  const q = searchParams.get('q')?.trim() || undefined;
  const status = searchParams.get('status') || undefined;
  const from = searchParams.get('from') || undefined;
  const to = searchParams.get('to') || undefined;

  return { page, limit, sort, order, q, status, from, to, searchParams };
}

export function parseExportQuery(request) {
  return parseListQuery(request, { maxLimit: MAX_EXPORT_LIMIT });
}
