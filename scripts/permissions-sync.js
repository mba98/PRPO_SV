/**
 * Sync default role permissions and permission catalog (dry-run by default).
 *
 * Usage:
 *   npm run permissions:sync -- --dry-run
 *   npm run permissions:sync -- --apply
 */
import mongoose from 'mongoose';
import { loadEnvLocal } from '../lib/loadEnvLocal.js';
import { connectMongo, disconnectMongo, getMongoUriSummary } from '../lib/mongodb.js';
import { DEFAULT_ROLES } from '../seed/roles.js';
import { PERMISSION_REGISTRY, ACTIVE_PERMISSION_KEYS } from '../lib/permissionRegistry.js';

const ROLES = 'roles';
const PERMISSIONS = 'permissions';

const APPLY = process.argv.includes('--apply');
const DRY_RUN = !APPLY || process.argv.includes('--dry-run');

/** Permissions removed from over-privileged default roles during sync */
const STRIP_FROM_WHS = [
  'view.all',
  'admin.settings',
  'admin.system_logs',
  'po.approve.pm',
  'po.approve.om',
  'po.approve.finance',
  'po.edit',
  'po.create',
  'pr.edit',
];

async function syncPermissionCatalog(collection) {
  const changes = [];
  for (const perm of PERMISSION_REGISTRY) {
    const existing = await collection.findOne({ key: perm.key });
    if (!existing) {
      changes.push({ action: 'insert', key: perm.key });
      if (!DRY_RUN) {
        await collection.insertOne({
          key: perm.key,
          label: perm.label,
          group: perm.group,
          description: perm.description || '',
          isActive: perm.active !== false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }
  }
  return changes;
}

async function syncRole(collection, seedRole) {
  const existing = await collection.findOne({ name: seedRole.name });
  if (!existing) {
    return { name: seedRole.name, action: 'skip-missing-role' };
  }

  let next = [...new Set(seedRole.permissions)];
  if (/whs/i.test(seedRole.name)) {
    next = next.filter((p) => !STRIP_FROM_WHS.includes(p));
    const current = Array.isArray(existing.permissions) ? existing.permissions : [];
    const stripped = current.filter((p) => STRIP_FROM_WHS.includes(p));
    if (stripped.length) {
      return {
        name: seedRole.name,
        action: DRY_RUN ? 'would-strip' : 'strip',
        remove: stripped,
        set: next,
      };
    }
  }

  const current = [...new Set(Array.isArray(existing.permissions) ? existing.permissions : [])].sort();
  const proposed = [...next].sort();
  if (JSON.stringify(current) === JSON.stringify(proposed)) {
    return { name: seedRole.name, action: 'unchanged' };
  }

  if (!DRY_RUN && /whs/i.test(seedRole.name)) {
    await collection.updateOne({ _id: existing._id }, { $set: { permissions: next } });
  }

  return {
    name: seedRole.name,
    action: DRY_RUN ? 'would-update' : 'updated',
    from: current,
    to: proposed,
  };
}

async function main() {
  loadEnvLocal();
  const { summary } = getMongoUriSummary();
  if (!summary?.ok) throw new Error(`Invalid MONGODB_URI: ${summary?.message || 'unknown'}`);

  await connectMongo();
  const db = mongoose.connection;

  console.log(`=== Permission Sync (${DRY_RUN ? 'DRY RUN' : 'APPLY'}) ===`);
  console.log(`Active registry keys: ${ACTIVE_PERMISSION_KEYS.length}`);

  const catalogChanges = await syncPermissionCatalog(db.collection(PERMISSIONS));
  console.log('\nPermission catalog:', catalogChanges.length ? catalogChanges : 'up to date');

  for (const seedRole of DEFAULT_ROLES) {
    const result = await syncRole(db.collection(ROLES), seedRole);
    console.log('\nRole sync:', JSON.stringify(result, null, 2));
  }

  console.log('\nSync complete.');
  if (DRY_RUN) console.log('Re-run with --apply to persist changes.');
}

main()
  .catch((error) => {
    console.error('Sync failed:', error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectMongo();
  });
