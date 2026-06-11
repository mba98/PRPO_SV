'use client';

import SearchableLookup from './SearchableLookup';

function formatUom(row) {
  if (!row) return '';
  const entry = row.value ?? '';
  const name = row.label || row.code || '';
  return name ? `${entry} — ${name}` : String(entry);
}

export default function UomGroupSelect({
  valueEntry,
  valueLabel,
  onSelect,
  disabled,
  placeholder = 'Search UoM group',
  inputClassName = 'input-field',
  emptyMessage = 'No UoM groups found',
  loadingMessage = 'Loading…',
}) {
  const displayLabel = valueLabel
    ? formatUom({ value: valueEntry, label: valueLabel })
    : '';

  return (
    <SearchableLookup
      endpoint="/api/sap/uom-groups"
      value={valueEntry ?? ''}
      label={displayLabel}
      onSelect={(entry, _display, row) => onSelect?.(entry, row)}
      disabled={disabled}
      placeholder={placeholder}
      emptyMessage={emptyMessage}
      loadingMessage={loadingMessage}
      inputClassName={[inputClassName, 'min-w-[180px]'].filter(Boolean).join(' ')}
      containerClassName="min-w-[180px] w-full"
      formatOption={formatUom}
      loadAllOnFocus
      minChars={0}
    />
  );
}
