import bcrypt from 'bcrypt';

const BCRYPT_COST = 12;

export async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, BCRYPT_COST);
}

export function getAdminSeedCredentials() {
  const username = process.env.SEED_ADMIN_USERNAME;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!username || !password) {
    throw new Error('SEED_ADMIN_USERNAME and SEED_ADMIN_PASSWORD must be set for seeding');
  }

  return { username, password };
}

export function buildAdminUser(roleId, passwordHash) {
  const { username } = getAdminSeedCredentials();
  return {
    name: 'System Administrator',
    email: `${username}@local.portal`,
    username,
    passwordHash,
    role: roleId,
    department: 'IT',
    isActive: true,
    permissions: [],
  };
}
