'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { useEffectivePermissions } from '@/lib/hooks/useEffectivePermissions';
import { canAccessSettingsPath } from '@/lib/settingsRoutePermissions';
import { AnimatedSkeletonLoader } from '@/components/ui';

export default function SettingsPageGuard({ children }) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const permissions = useEffectivePermissions();

  const allowed = user ? canAccessSettingsPath(permissions, pathname) : false;

  useEffect(() => {
    if (!loading && user && !allowed) {
      document.title = 'Access denied — Settings';
    }
  }, [loading, user, allowed]);

  if (loading || !user) {
    return <AnimatedSkeletonLoader variant="table" rows={4} />;
  }

  if (!allowed) {
    return (
      <div
        className="rounded-lg border border-rose-200 bg-rose-50 p-6"
        role="alert"
        data-testid="settings-access-denied"
      >
        <h2 className="text-lg font-semibold text-rose-900">Access denied</h2>
        <p className="mt-2 text-sm text-rose-800">
          You do not have permission to view this settings page.
        </p>
        <Link
          href="/dashboard"
          className="mt-4 inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          Return to dashboard
        </Link>
      </div>
    );
  }

  return children;
}
