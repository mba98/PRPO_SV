import { toSapDate } from '@/lib/dateUtils.js';

const DEFAULT_REQ_TYPE = parseInt(process.env.SAP_PR_REQ_TYPE || '12', 10);

/**
 * Resolve branch ID from system_settings.branch_map or env default.
 */
export function resolveBranchId(department, branchMap = {}) {
  if (department && branchMap[department] != null) {
    return branchMap[department];
  }
  const envDefault = process.env.SAP_DEFAULT_BRANCH_ID;
  if (envDefault) return parseInt(envDefault, 10);
  return 1;
}

/**
 * MongoDB PurchaseRequest → SAP Service Layer /PurchaseRequests payload.
 */
export function mapPrToSap(pr, options = {}) {
  const branchMap = options.branchMap || {};
  const requesterCode = options.requesterSapCode || String(pr.requesterEmail || pr.requester || '');

  return {
    ReqType: options.reqType ?? DEFAULT_REQ_TYPE,
    Requester: requesterCode,
    ReqDate: toSapDate(pr.requiredDate),
    DocDate: toSapDate(pr.documentDate || pr.requiredDate),
    DocDueDate: toSapDate(pr.requiredDate),
    Comments: pr.remarks || '',
    BPL_IDAssignedToInvoice: resolveBranchId(pr.department, branchMap),
    U_Department: pr.department,
    DocumentLines: (pr.lines || []).map((line) => ({
      ItemCode: line.itemCode,
      Quantity: line.quantity,
      WarehouseCode: line.warehouseCode || pr.warehouse,
      ProjectCode: line.projectCode || pr.project,
      CostingCode: line.costCenter,
      UnitPrice: line.estimatedUnitPrice,
      RequiredDate: toSapDate(line.requiredDate || pr.requiredDate),
      U_Department: line.uDepartment,
      U_DelDate: toSapDate(line.uDelDate),
      U_Rate: line.uRate,
    })),
  };
}
