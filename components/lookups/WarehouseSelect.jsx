'use client';

import SearchableLookup from './SearchableLookup';

export default function WarehouseSelect({
  valueCode = '',
  valueLabel = '',
  onSelect,
  disabled = false,
  placeholder = 'Search warehouse',
  emptyMessage = 'No warehouses found',
  inputClassName = 'input-field',
  loadingMessage = 'Loading…',
  syncKey,
}) {
  return (
    <SearchableLookup
      key={syncKey}
      endpoint="/api/sap/warehouses"
      value={valueCode}
      label={valueLabel}
      onSelect={(code, label, row) => onSelect?.(code, label, row)}
      disabled={disabled}
      placeholder={placeholder}
      emptyMessage={emptyMessage}
      loadingMessage={loadingMessage}
      inputClassName={inputClassName}
      containerClassName="w-full"
      loadAllOnFocus
      minChars={0}
    />
  );
}
