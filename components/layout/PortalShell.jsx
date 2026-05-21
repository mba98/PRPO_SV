'use client';

import { usePathname } from 'next/navigation';
import { AnimatedPageWrapper } from '@/components/ui';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function PortalShell({ user, children }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar user={user} />
      <div className="flex min-h-screen flex-1 flex-col">
        <TopBar user={user} />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-[1400px]">
            <AnimatedPageWrapper key={pathname}>{children}</AnimatedPageWrapper>
          </div>
        </main>
      </div>
    </div>
  );
}
