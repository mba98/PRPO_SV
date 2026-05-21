'use client';

import SapLookupCombobox from './SapLookupCombobox';

export default function VendorSelect({ valueCode, valueLabel, onSelect, disabled }) {
  return (
    <SapLookupCombobox
      endpoint="/api/sap/vendors"
      valueCode={valueCode}
      valueLabel={valueLabel}
      onSelect={(code, label) => onSelect(code, label)}
      getCode={(v) => v.cardCode}
      getLabel={(v) => `${v.cardCode} — ${v.cardName || ''}`}
      placeholder="Search vendor"
      disabled={disabled}
      minChars={0}
    />
  );
}
