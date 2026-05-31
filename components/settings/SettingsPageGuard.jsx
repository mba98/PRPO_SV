'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { useEffectivePermissions } from '@/lib/hooks/useEffectivePermissions';
import { canAccessSettingsPath } from '@/lib/settingsRoutePermissions';
import { useI18n } from '@/lib/hooks/useI18n';
import { AnimatedSkeletonLoader } from '@/components/ui';

export default function SettingsPageGuard({ children }) {
  const { common } = useI18n();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const permissions = useEffectivePermissions();

  const allowed = user ? canAccessSettingsPath(permissions, pathname) : false;

  useEffect(() => {
    if (!loading && user && !allowed) {
      document.title = common.accessDenied;
    }
  }, [loading, user, allowed, common.accessDenied]);

  if (loading || !user) {
    return <AnimatedSkeletonLoader variant="table" rows={4} />;
  }

  if (!allowed) {
    return (
      <div
        className="card border-destructive/30 bg-destructive/10"
        role="alert"
        data-testid="settings-access-denied"
      >
        <h2 className="text-lg font-bold text-destructive">{common.accessDenied}</h2>
        <p className="mt-2 text-sm text-destructive/90">{common.accessDeniedSettings}</p>
        <Link
          href="/dashboard"
          className="mt-4 inline-block text-sm font-semibold text-primary hover:underline"
        >
          {common.returnDashboard}
        </Link>
      </div>
    );
  }

  return children;
}
