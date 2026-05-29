'use client';

import { motion } from 'framer-motion';
import { useMotionSafe } from './useMotionSafe';

export default function AnimatedTabs({ tabs, activeId, onChange, className = '' }) {
  const motionProps = useMotionSafe({
    layoutId: 'tab-indicator',
    className: 'absolute inset-0 rounded-lg bg-white shadow-sm',
    transition: { type: 'spring', stiffness: 400, damping: 30 },
  });

  return (
    <div
      className={`flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-50/80 p-1 ${className}`}
      role="tablist"
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`relative min-h-10 flex-1 rounded-lg px-3 py-2 text-sm font-medium sm:flex-none ${
              active ? 'text-brand-700' : 'tab-chip-inactive text-slate-600'
            }`}
          >
            {active && Object.keys(motionProps).length > 0 && (
              <motion.span {...motionProps} style={{ zIndex: 0 }} />
            )}
            <span className="relative z-10">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
