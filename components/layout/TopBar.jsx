'use client';

import PortalBrandLogo from './PortalBrandLogo';
import QuickActionsMenu from './QuickActionsMenu';
import IconButton from '@/components/ui/IconButton';
import { useI18n } from '@/lib/hooks/useI18n';

export default function TopBar({ onMenuClick }) {
  const { common } = useI18n();

  return (
    <header className="sticky top-0 z-30 flex h-20 shrink-0 items-center justify-between gap-3 border-b border-border bg-card/80 px-4 backdrop-blur-md sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <IconButton label={common.menu} onClick={onMenuClick} className="lg:hidden">
          <span className="text-lg" aria-hidden>
            ☰
          </span>
        </IconButton>
        <PortalBrandLogo brand="sv" priority />
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <PortalBrandLogo brand="spc" />
        <QuickActionsMenu />
      </div>
    </header>
  );
}
