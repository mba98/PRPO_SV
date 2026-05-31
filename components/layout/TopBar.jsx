'use client';

import PortalBrandLogo from './PortalBrandLogo';
import QuickActionsMenu from './QuickActionsMenu';
import IconButton from '@/components/ui/IconButton';
import { useI18n } from '@/lib/hooks/useI18n';

export default function TopBar({ onMenuClick }) {
  const { common } = useI18n();

  return (
    <header className="sticky top-0 z-30 h-20 shrink-0 border-b border-border bg-card/80 backdrop-blur-md">
      <div
        className="topbar-logo-grid mx-auto grid h-full w-full max-w-full grid-cols-3 items-center gap-2 px-3 sm:gap-3 sm:px-6 lg:px-8"
        dir="ltr"
      >
        <div className="topbar-logo-left flex min-w-0 items-center justify-start gap-2">
          <IconButton label={common.menu} onClick={onMenuClick} className="shrink-0 lg:hidden">
            <span className="text-lg" aria-hidden>
              ☰
            </span>
          </IconButton>
          <PortalBrandLogo brand="spc" />
        </div>
        <div className="topbar-logo-center flex justify-center">
          <QuickActionsMenu />
        </div>
        <div className="topbar-logo-right flex justify-end">
          <PortalBrandLogo brand="sv" priority />
        </div>
      </div>
    </header>
  );
}
