'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatedPageWrapper } from '@/components/ui';
import { useI18n } from '@/lib/hooks/useI18n';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import MobileNav from './MobileNav';

export default function PortalShell({ user, children }) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { dir } = useI18n();

  return (
    <div className="flex min-h-screen bg-background" dir={dir}>
      <div className="hidden shrink-0 lg:block">
        <Sidebar user={user} />
      </div>
      <MobileNav user={user} isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <TopBar user={user} onMenuClick={() => setMobileNavOpen(true)} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="page-shell">
            <AnimatedPageWrapper key={pathname}>{children}</AnimatedPageWrapper>
          </div>
        </main>
      </div>
    </div>
  );
}
