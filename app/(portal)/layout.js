import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken, getCurrentUser, sanitizeUser } from '@/lib/auth';
import AuthProvider from '@/components/providers/AuthProvider';
import PortalShell from '@/components/layout/PortalShell';

export default async function PortalLayout({ children }) {
  const token = cookies().get('portal_session')?.value;

  if (!token) {
    redirect('/login');
  }

  let session;
  try {
    session = await verifyToken(token);
  } catch {
    redirect('/login');
  }

  const user = await getCurrentUser(session);
  if (!user) {
    redirect('/login');
  }

  const safeUser = sanitizeUser({
    ...user,
    roleName: user.roleName || user.role?.name,
  });

  return (
    <AuthProvider initialUser={safeUser}>
      <PortalShell user={safeUser}>{children}</PortalShell>
    </AuthProvider>
  );
}
