'use client';

import { Input } from '@/components/ui';

/**
 * Read-only UoM display for PR/PO line items (SAP item master is authoritative).
 */
export default function LineUomDisplay({ line, inputClassName = '', className = '' }) {
  const code = line?.uomCode || line?.uom || '';
  const label = line?.ugpName || line?.uomName || '';
  const display =
    code && label && label !== code ? `${code} — ${label}` : code || label || '—';

  return (
    <Input
      className={`${inputClassName} ${className}`.trim()}
      readOnly
      tabIndex={-1}
      value={display}
      title={display}
    />
  );
}
