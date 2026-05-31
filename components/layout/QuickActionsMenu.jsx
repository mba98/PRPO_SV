'use client';

import { useEffect, useId, useRef, useState } from 'react';
import AccentPalette from '@/components/ui/AccentPalette';
import SunMoonToggle from '@/components/ui/SunMoonToggle';
import LanguageSelector from '@/components/ui/LanguageSelector';
import { useI18n } from '@/lib/hooks/useI18n';

export default function QuickActionsMenu() {
  const { common } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;
    function onDocClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="quick-actions-menu relative flex justify-center">
      <button
        type="button"
        className={`quick-menu-toggle ${open ? 'quick-menu-toggle--open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-labelledby={titleId}
        title={common.quickActions}
      >
        <span className="quick-menu-bars" aria-hidden>
          <span />
          <span />
          <span />
        </span>
      </button>
      {open && (
        <div className="quick-actions-popover" role="dialog" aria-labelledby={titleId}>
          <p id={titleId} className="quick-actions-popover-title">
            {common.quickActions}
          </p>
          <div className="quick-actions-popover-body">
            <div className="quick-actions-row">
              <span className="quick-actions-label">{common.accentPaletteTitle}</span>
              <AccentPalette embedded />
            </div>
            <div className="quick-actions-row quick-actions-row--center">
              <span className="quick-actions-label">{common.colorMode}</span>
              <SunMoonToggle />
            </div>
            <div className="quick-actions-row quick-actions-row--center">
              <span className="quick-actions-label">{common.language}</span>
              <LanguageSelector />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
