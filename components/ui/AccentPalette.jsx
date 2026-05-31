'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ACCENT_PALETTE } from '@/lib/theme/themes';
import { useThemeStore } from '@/stores/themeStore';
import { useI18n } from '@/lib/hooks/useI18n';

function PaletteSwatches({ accent, locale, setAccent, onSelect }) {
  return (
    <div className="grid grid-cols-5 justify-center gap-1.5" role="listbox" aria-label="accent">
      {ACCENT_PALETTE.map((item) => {
        const label = locale === 'en' ? item.labelEn : item.labelAr;
        const selected = accent === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="option"
            aria-selected={selected}
            aria-label={label}
            title={item.hex}
            className={[
              'h-6 w-6 rounded-md border border-border transition-transform hover:scale-110 active:scale-95',
              selected ? 'ring-2 ring-primary ring-offset-1 ring-offset-card' : '',
            ].join(' ')}
            style={{ backgroundColor: item.hex }}
            onClick={() => {
              setAccent(item.id);
              onSelect?.();
            }}
          />
        );
      })}
    </div>
  );
}

export default function AccentPalette({ className = '', embedded = false }) {
  const { common, locale } = useI18n();
  const accent = useThemeStore((s) => s.accent);
  const setAccent = useThemeStore((s) => s.setAccent);
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const titleId = useId();

  const currentHex = ACCENT_PALETTE.find((p) => p.id === accent)?.hex || '#3b82f6';

  useEffect(() => {
    if (embedded || !open) return undefined;
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
  }, [open, embedded]);

  if (embedded) {
    return (
      <div className={className}>
        <PaletteSwatches accent={accent} locale={locale} setAccent={setAccent} />
      </div>
    );
  }

  return (
    <div ref={rootRef} className={`relative ${className}`.trim()}>
      <motion.button
        type="button"
        className="topbar-icon-btn topbar-icon-btn-accent"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-labelledby={titleId}
        title={common.accentPaletteTitle}
        animate={reduceMotion ? undefined : { scale: 1 }}
        whileTap={reduceMotion ? undefined : { scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 400, damping: 22 }}
      >
        <motion.span
          className="h-4 w-4 shrink-0 rounded-md border border-border shadow-sm"
          style={{ backgroundColor: currentHex }}
          aria-hidden
          layout={!reduceMotion}
          transition={{ duration: 0.3 }}
        />
      </motion.button>
      {open && (
        <div className="accent-popover-card" role="dialog" aria-labelledby={titleId}>
          <p id={titleId} className="accent-popover-heading">
            {common.accentPaletteTitle}
          </p>
          <PaletteSwatches
            accent={accent}
            locale={locale}
            setAccent={setAccent}
            onSelect={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
