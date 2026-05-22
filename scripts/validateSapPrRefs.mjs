import { loadEnvLocal } from '../lib/loadEnvLocal.js';

loadEnvLocal();
process.env.SAP_SL_INSECURE_TLS = process.env.SAP_SL_INSECURE_TLS || 'true';

const { login, slFetch } = await import('../lib/sapServiceLayer.js');

const refs = {
  itemCode: 'ALR00027SV',
  warehouseCode: 'RAN001',
  requester: '12',
  branchId: 1,
  costingCode: 'Project',
};

await login();

async function check(name, path) {
  try {
    await slFetch(path);
    console.log(`${name}: OK`);
    return true;
  } catch (e) {
    console.log(`${name}: FAIL — ${e.message}`);
    return false;
  }
}

await check('Item', `/Items('${refs.itemCode.replace(/'/g, "''")}')`);
await check('Warehouse', `/Warehouses('${refs.warehouseCode.replace(/'/g, "''")}')`);
await check('Branch BPL 1', '/BusinessPlaces(1)');
await check('Employee by key 12', '/EmployeesInfo(12)');
await check(
  'Employee filter ID 12',
  "/EmployeesInfo?$filter=EmployeeID eq 12&$select=EmployeeID,FirstName,LastName",
);
await check(
  'Distribution rule Project',
  "/DistributionRules?$filter=FactorCode eq 'Project'&$top=1",
);

const rules = await slFetch('/DistributionRules?$select=FactorCode,FactorDescription&$top=5');
console.log('Sample distribution rules:', JSON.stringify(rules?.value?.slice(0, 5), null, 2));
