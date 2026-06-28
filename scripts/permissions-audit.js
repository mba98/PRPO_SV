/**
 * Audit roles, permissions, and approval matrix configuration.
 *
 * Usage:
 *   npm run permissions:audit
 */
import mongoose from 'mongoose';
import { loadEnvLocal } from '../lib/loadEnvLocal.js';
import { connectMongo, disconnectMongo, getMongoUriSummary } from '../lib/mongodb.js';
import {
  ACTIVE_PERMISSION_KEYS,
  ALL_REGISTRY_KEYS,
  PERMISSION_REGISTRY,
} from '../lib/permissionRegistry.js';
import { DEFAULT_ROLES } from '../seed/roles.js';

const ROLES = 'roles';
const USERS = 'users';
const MATRIX = 'approvalmatrices';

async function main() {
  loadEnvLocal();
  const { summary } = getMongoUriSummary();
  if (!summary?.ok) throw new Error(`Invalid MONGODB_URI: ${summary?.message || 'unknown'}`);

  await connectMongo();
  const db = mongoose.connection;

  const roles = await db.collection(ROLES).find({}).toArray();
  const users = await db.collection(USERS).find({ isActive: { $ne: false } }).toArray();
  const matrices = await db.collection(MATRIX).find({}).toArray();

  const registrySet = new Set(ALL_REGISTRY_KEYS);
  const activeSet = new Set(ACTIVE_PERMISSION_KEYS);
  const orphanKeys = new Set();
  const roleReports = [];

  for (const role of roles) {
    const perms = Array.isArray(role.permissions) ? role.permissions : [];
    const unknown = perms.filter((p) => !registrySet.has(p));
    unknown.forEach((p) => orphanKeys.add(p));
    roleReports.push({
      name: role.name,
      id: role._id?.toString(),
      permissions: perms,
      unknownPermissions: unknown,
      excessivePoApproval: perms.filter((p) =>
        ['po.approve.pm', 'po.approve.om', 'po.approve.finance'].includes(p),
      ),
    });
  }

  const whsRole = roleReports.find((r) => /whs/i.test(r.name));
  const whsUsers = users.filter((u) => {
    const roleId = u.role?.toString?.() || u.role;
    return whsRole && roleId === whsRole.id;
  });

  const matrixIssues = [];
  for (const matrix of matrices) {
    for (const step of matrix.steps || []) {
      if (!step.requiredPermission) {
        matrixIssues.push({
          documentType: matrix.documentType,
          stepOrder: step.stepOrder,
          issue: 'missing requiredPermission',
        });
      } else if (!registrySet.has(step.requiredPermission)) {
        matrixIssues.push({
          documentType: matrix.documentType,
          stepOrder: step.stepOrder,
          issue: `unknown permission ${step.requiredPermission}`,
        });
      } else if (!activeSet.has(step.requiredPermission)) {
        matrixIssues.push({
          documentType: matrix.documentType,
          stepOrder: step.stepOrder,
          issue: `inactive permission ${step.requiredPermission}`,
        });
      }
    }
  }

  console.log('=== Permission Audit ===');
  console.log(`Registry active keys: ${ACTIVE_PERMISSION_KEYS.length}`);
  console.log(`Roles in DB: ${roles.length}`);
  console.log(`Active users: ${users.length}`);
  console.log(`Orphan permission keys in roles: ${[...orphanKeys].join(', ') || '(none)'}`);
  console.log('\n--- Default seed roles (reference) ---');
  for (const role of DEFAULT_ROLES) {
    console.log(`${role.name}: ${role.permissions.join(', ')}`);
  }
  console.log('\n--- Database roles ---');
  for (const role of roleReports) {
    console.log(`\n${role.name} (${role.id})`);
    console.log(`  permissions: ${role.permissions.join(', ') || '(none)'}`);
    if (role.unknownPermissions.length) {
      console.log(`  UNKNOWN: ${role.unknownPermissions.join(', ')}`);
    }
    if (/whs/i.test(role.name) && role.excessivePoApproval.length) {
      console.log(`  WARNING: WHS role has PO approval perms: ${role.excessivePoApproval.join(', ')}`);
    }
  }

  if (whsRole) {
    console.log('\n--- WHS Approver users ---');
    for (const user of whsUsers) {
      const direct = Array.isArray(user.permissions) ? user.permissions : [];
      console.log(`${user.username || user.email}: role=${whsRole.name}, direct=[${direct.join(', ')}]`);
    }
    if (!whsUsers.length) console.log('(no active users with WHS role found)');
  }

  if (matrixIssues.length) {
    console.log('\n--- Approval matrix issues ---');
    matrixIssues.forEach((issue) => console.log(JSON.stringify(issue)));
  } else {
    console.log('\nApproval matrix: no missing/unknown step permissions detected.');
  }

  console.log('\nAudit complete.');
}

main()
  .catch((error) => {
    console.error('Audit failed:', error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectMongo();
  });
