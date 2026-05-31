'use client';

import SapLookupCombobox from './SapLookupCombobox';

export default function VendorSelect({
  valueCode,
  valueLabel,
  onSelect,
  disabled,
  placeholder = 'Search vendor',
  emptyMessage = 'No results',
  inputClassName = 'input-field',
  loadingMessage = 'Loading…',
  minChars = 1,
}) {
  return (
    <SapLookupCombobox
      endpoint="/api/sap/vendors"
      valueCode={valueCode}
      valueLabel={valueLabel}
      onSelect={(code, label) => onSelect(code, label)}
      getCode={(v) => v.cardCode}
      getLabel={(v) => `${v.cardCode} — ${v.cardName || ''}`}
      placeholder={placeholder}
      disabled={disabled}
      minChars={minChars}
      emptyMessage={emptyMessage}
      inputClassName={inputClassName}
      loadingMessage={loadingMessage}
    />
  );
}
