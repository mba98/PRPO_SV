'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import ThemeSelector from '@/components/ui/ThemeSelector';
import { common } from '@/lib/i18n';

export default function TopBar({ user, onMenuClick }) {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);

  async function handleLogout() {
    await logout();
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 lg:hidden"
          aria-label={common.menu}
        >
          <span className="text-lg" aria-hidden>
            ☰
          </span>
        </button>
        <div className="min-w-0 text-sm text-slate-600">
          {common.signedInAs}{' '}
          <span className="font-medium text-slate-900">{user?.username}</span>
          {user?.roleName && (
            <span className="ms-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {user.roleName}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ThemeSelector compact />
        <button
          type="button"
          onClick={handleLogout}
          className="btn-secondary min-h-10"
        >
          {common.signOut}
        </button>
      </div>
    </header>
  );
}
