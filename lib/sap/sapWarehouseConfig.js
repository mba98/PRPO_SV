/**
 * Default SAP warehouse for PR lines (confirmed Postman: RAN004).
 */
export const DEV_DEFAULT_WAREHOUSE_CODE = 'RAN004';

/**
 * Resolve warehouse code for a PR line (line → header → env → dev default).
 */
export function resolveLineWarehouseCode(line, pr = {}) {
  const fromLine = line?.warehouseCode?.trim();
  if (fromLine) return fromLine;

  const fromHeader = pr.warehouse?.trim();
  if (fromHeader) return fromHeader;

  const fromEnv = process.env.DEFAULT_SAP_WAREHOUSE_CODE?.trim();
  if (fromEnv) return fromEnv;

  if (process.env.NODE_ENV !== 'production') {
    return DEV_DEFAULT_WAREHOUSE_CODE;
  }

  return null;
}
