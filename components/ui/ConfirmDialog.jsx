'use client';

import { useEffect } from 'react';
import AnimatedModal from './AnimatedModal';
import Button from './Button';

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  confirmVariant = 'danger',
  loading = false,
}) {
  useEffect(() => {
    if (!isOpen || loading) return undefined;
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, loading, onClose]);

  function handleClose() {
    if (loading) return;
    onClose();
  }

  return (
    <AnimatedModal isOpen={isOpen} onClose={handleClose} title={title} size="sm">
      <p className="text-sm leading-relaxed text-muted-foreground">{message}</p>
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" onClick={handleClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant={confirmVariant}
          onClick={onConfirm}
          loading={loading}
          disabled={loading}
        >
          {confirmLabel}
        </Button>
      </div>
    </AnimatedModal>
  );
}
