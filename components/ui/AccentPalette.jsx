'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ACCENT_PALETTE } from '@/lib/theme/themes';
import { useThemeStore } from '@/stores/themeStore';
import { useI18n } from '@/lib/hooks/useI18n';

export default function AccentPalette({ className = '' }) {
  const { common, locale } = useI18n();
  const accent = useThemeStore((s) => s.accent);
  const setAccent = useThemeStore((s) => s.setAccent);
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const titleId = useId();

  const currentHex = ACCENT_PALETTE.find((p) => p.id === accent)?.hex || '#3b82f6';

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
    <div ref={rootRef} className={`relative ${className}`.trim()}>
      <button
        type="button"
        className="topbar-icon-btn topbar-icon-btn-accent"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-labelledby={titleId}
        title={common.accentPaletteTitle}
      >
        <span
          className="h-4 w-4 shrink-0 rounded-full border border-border shadow-sm"
          style={{ backgroundColor: currentHex }}
          aria-hidden
        />
      </button>
      {open && (
        <div className="accent-popover-card" role="dialog" aria-labelledby={titleId}>
          <p id={titleId} className="accent-popover-heading">
            {common.accentPaletteTitle}
          </p>
          <div className="accent-palette-row" role="listbox" aria-label={common.accentPaletteTitle}>
            {ACCENT_PALETTE.map((item) => {
              const tooltipLabel = locale === 'en' ? item.labelEn : item.labelAr;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={accent === item.id}
                  data-label={tooltipLabel}
                  title={item.hex}
                  className={`accent-color-item ${accent === item.id ? 'accent-color-item-selected' : ''}`}
                  style={{ '--color': item.hex }}
                  onClick={() => {
                    setAccent(item.id);
                    setOpen(false);
                  }}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
