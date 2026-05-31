'use client';

import SapLookupCombobox from './SapLookupCombobox';

export default function WarehouseSelect({
  valueCode,
  valueLabel,
  onSelect,
  disabled,
  placeholder = 'Search warehouse',
  emptyMessage = 'No results',
  inputClassName = 'input-field',
  loadingMessage = 'Loading…',
  minChars = 1,
}) {
  return (
    <SapLookupCombobox
      endpoint="/api/sap/warehouses"
      valueCode={valueCode}
      valueLabel={valueLabel}
      onSelect={(code, label) => onSelect(code, label)}
      getCode={(w) => w.warehouseCode}
      getLabel={(w) => `${w.warehouseCode} — ${w.warehouseName || ''}`}
      placeholder={placeholder}
      disabled={disabled}
      minChars={minChars}
      emptyMessage={emptyMessage}
      inputClassName={inputClassName}
      loadingMessage={loadingMessage}
    />
  );
}
