'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import ThemeSelector from '@/components/ui/ThemeSelector';
import LanguageSelector from '@/components/ui/LanguageSelector';
import ColorModeSelector from '@/components/ui/ColorModeSelector';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import { useI18n } from '@/lib/hooks/useI18n';

export default function TopBar({ user, onMenuClick }) {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const { common } = useI18n();

  async function handleLogout() {
    await logout();
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 flex h-20 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-card/80 px-4 backdrop-blur-md sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <IconButton label={common.menu} onClick={onMenuClick} className="lg:hidden">
          <span className="text-lg" aria-hidden>
            ☰
          </span>
        </IconButton>
        <div className="min-w-0 text-sm text-muted-foreground">
          {common.signedInAs}{' '}
          <span className="font-semibold text-foreground">{user?.username}</span>
          {user?.roleName && (
            <span className="ms-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {user.roleName}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ColorModeSelector compact />
        <LanguageSelector compact />
        <ThemeSelector compact />
        <Button variant="secondary" onClick={handleLogout}>
          {common.signOut}
        </Button>
      </div>
    </header>
  );
}
