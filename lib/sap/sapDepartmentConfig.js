/**
 * SAP U_Department (and related) defaults for Purchase Requests.
 */
export const DEV_DEFAULT_SAP_DEPARTMENT_UDF = 'General';

/**
 * Map portal department to SAP U_Department value.
 */
export function resolveSapDepartmentUdf(department, departmentMap = {}) {
  if (department && departmentMap[department] != null) {
    return String(departmentMap[department]).trim();
  }
  if (departmentMap.default != null) {
    return String(departmentMap.default).trim();
  }

  const envDefault = process.env.SAP_PR_DEPARTMENT_UDF?.trim();
  if (envDefault) return envDefault;

  if (process.env.NODE_ENV !== 'production') {
    return DEV_DEFAULT_SAP_DEPARTMENT_UDF;
  }

  return department?.trim() || null;
}
