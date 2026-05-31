'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ACCENT_PALETTE } from '@/lib/theme/themes';
import { useThemeStore } from '@/stores/themeStore';
import { useI18n } from '@/lib/hooks/useI18n';

export default function AccentPalette({ className = '' }) {
  const { common } = useI18n();
  const accent = useThemeStore((s) => s.accent);
  const setAccent = useThemeStore((s) => s.setAccent);
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
    <div ref={rootRef} className={`relative ${className}`.trim()}>
      <button
        type="button"
        className="topbar-control-accent"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-labelledby={titleId}
        title={common.accentPaletteTitle}
      >
        <span
          className="h-5 w-5 rounded-full border-2 border-border shadow-inner"
          style={{ backgroundColor: ACCENT_PALETTE.find((p) => p.id === accent)?.hex || '#3b82f6' }}
          aria-hidden
        />
      </button>
      {open && (
        <div
          className="accent-popover"
          role="dialog"
          aria-labelledby={titleId}
        >
          <p id={titleId} className="accent-popover-title">
            {common.accentPaletteTitle}
          </p>
          <div className="accent-palette-row" role="listbox" aria-label={common.accentPaletteTitle}>
            {ACCENT_PALETTE.map((item) => (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={accent === item.id}
                title={item.hex}
                className={`accent-swatch ${accent === item.id ? 'accent-swatch-selected' : ''}`}
                style={{ '--color': item.hex }}
                onClick={() => {
                  setAccent(item.id);
                  setOpen(false);
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
