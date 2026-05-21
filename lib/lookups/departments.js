import '@/models/index.js';
import SystemSettings from '@/models/SystemSettings.js';
import User from '@/models/User.js';
import { connectDB } from '@/lib/mongodb';

/**
 * Departments from system_settings.branch_map keys and active users (no hardcoded list).
 */
export async function listDepartments() {
  await connectDB();
  const names = new Set();

  const branchDoc = await SystemSettings.findOne({ key: 'branch_map' }).lean();
  if (branchDoc?.value && typeof branchDoc.value === 'object') {
    Object.keys(branchDoc.value).forEach((k) => {
      if (k?.trim()) names.add(k.trim());
    });
  }

  const userDepts = await User.distinct('department', {
    isActive: true,
    department: { $exists: true, $ne: '' },
  });
  userDepts.forEach((d) => {
    if (d?.trim()) names.add(d.trim());
  });

  return [...names].sort((a, b) => a.localeCompare(b)).map((name) => ({ code: name, name }));
}
