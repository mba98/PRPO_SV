'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { motion, useAnimation, useReducedMotion } from 'framer-motion';
import { AnimatedPageWrapper } from '@/components/ui';
import { useI18n } from '@/lib/hooks/useI18n';
import { useUiTransitionStore } from '@/stores/uiTransitionStore';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import MobileNav from './MobileNav';

export default function PortalShell({ user, children }) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { dir } = useI18n();
  const transitionId = useUiTransitionStore((s) => s.transitionId);
  const reason = useUiTransitionStore((s) => s.reason);
  const reduceMotion = useReducedMotion();
  const contentControls = useAnimation();

  useEffect(() => {
    if (reduceMotion || reason !== 'locale' || transitionId === 0) return;
    const slide = dir === 'rtl' ? 10 : -10;
    contentControls.start({
      opacity: [1, 0.96, 1],
      x: [0, slide, 0],
      transition: { duration: 0.32, ease: 'easeOut' },
    });
  }, [transitionId, reason, dir, reduceMotion, contentControls]);

  return (
    <div className="flex min-h-screen bg-background" dir={dir}>
      <div className="hidden shrink-0 lg:block">
        <Sidebar user={user} />
      </div>
      <MobileNav user={user} isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <TopBar onMenuClick={() => setMobileNavOpen(true)} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 lg:p-8">
          <motion.div className="page-shell" animate={contentControls}>
            <AnimatedPageWrapper key={pathname}>{children}</AnimatedPageWrapper>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
