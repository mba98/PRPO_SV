'use client';

import { useI18n } from '@/lib/hooks/useI18n';

export default function SidebarIdentity({ user }) {
  const { common } = useI18n();
  const username = user?.username || '—';
  const roleName = user?.roleName || user?.role?.name || '';
  const displayName = user?.name || '';

  return (
    <div className="sidebar-identity border-b border-border px-5 py-5">
      <p className="text-sm font-bold tracking-wide text-foreground">{common.appName}</p>
      {displayName ? (
        <p className="mt-1 truncate text-sm font-medium text-foreground">{displayName}</p>
      ) : null}
      <p className="mt-2 text-xs text-muted-foreground">
        {common.signedInAs}{' '}
        <span className="font-semibold text-foreground">{username}</span>
      </p>
      {roleName ? (
        <p className="mt-2">
          <span className="sidebar-role-badge inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold text-primary">
            <span className="text-muted-foreground">{common.roleLabel}:</span>
            <span className="truncate">{roleName}</span>
          </span>
        </p>
      ) : null}
    </div>
  );
}
