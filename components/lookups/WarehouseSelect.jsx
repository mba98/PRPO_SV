'use client';

import SapLookupCombobox from './SapLookupCombobox';

export default function WarehouseSelect({ valueCode, valueLabel, onSelect, disabled }) {
  return (
    <SapLookupCombobox
      endpoint="/api/sap/warehouses"
      valueCode={valueCode}
      valueLabel={valueLabel}
      onSelect={(code, label) => onSelect(code, label)}
      getCode={(w) => w.warehouseCode}
      getLabel={(w) => `${w.warehouseCode} — ${w.warehouseName || ''}`}
      placeholder="Search warehouse"
      disabled={disabled}
      minChars={0}
    />
  );
}
