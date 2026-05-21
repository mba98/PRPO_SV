'use client';

import SapLookupCombobox from './SapLookupCombobox';

export default function CostCenterSelect({ valueCode, valueLabel, onSelect, disabled }) {
  return (
    <SapLookupCombobox
      endpoint="/api/sap/cost-centers"
      valueCode={valueCode}
      valueLabel={valueLabel}
      onSelect={(code, label) => onSelect(code, label)}
      getCode={(c) => c.code}
      getLabel={(c) => `${c.code} — ${c.name || ''}`}
      placeholder="Search cost center"
      disabled={disabled}
      minChars={0}
    />
  );
}
