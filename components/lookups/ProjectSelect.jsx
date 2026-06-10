'use client';

import SearchableLookup from './SearchableLookup';

export default function ProjectSelect({
  valueCode,
  valueLabel,
  onSelect,
  disabled,
  placeholder = 'Search project',
  emptyMessage = 'No projects found',
  loadingMessage = 'Loading…',
  inputClassName = 'input-field',
}) {
  return (
    <SearchableLookup
      endpoint="/api/sap/projects"
      value={valueCode}
      label={valueLabel}
      onSelect={(code, label) => onSelect(code, label)}
      placeholder={placeholder}
      emptyMessage={emptyMessage}
      loadingMessage={loadingMessage}
      inputClassName={inputClassName}
      disabled={disabled}
      loadAllOnFocus
      minChars={0}
    />
  );
}
