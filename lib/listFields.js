/** Fields loaded for list pages (exclude heavy nested arrays and SAP payloads). */
export const PR_LIST_SELECT =
  'portalPRNumber requester requesterEmail department project warehouse status currentApprovalStep sapPRDocNum sapPRDocEntry sapPOCreationStatus relatedPortalPONumber createdAt updatedAt lines';

export const PO_LIST_SELECT =
  'portalPONumber relatedPRNumber requester vendor department project warehouse status currentApprovalStep sapPODocNum sapPODocEntry docCurrency createdAt updatedAt lines';

export const APRI_LIST_SELECT =
  'portalAPNumber relatedPONumber vendor status currentApprovalStep sapAPDocNum sapAPDocEntry createdAt updatedAt lines';

export const LP_LIST_SELECT =
  'portalLPNumber documentDate projectCode projectName vendorName currency exchangeRate documentTotal status currentApprovalStep createdBy createdAt updatedAt lines';

export function lineCount(doc) {
  return Array.isArray(doc?.lines) ? doc.lines.length : 0;
}
